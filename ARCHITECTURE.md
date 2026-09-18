# FLY ME TO THE MOON — Architecture

> FlyWire の配線を素材にした小さな脳が、2D の世界で光を見て歩く。
> 人間には「月を目指している」ように見えるが、ハエの中にあるのは光と発火と脚の動きだけ。
>
> 更新：2026-09-18。Phase 0–2 と Phase 4 の最小部分を実装済み。

---

## 0. 方針：科学的忠実度と、作品としての面白さを分ける

コードは 4 つの層に分かれる。層ごとに「どこまで本物か」がはっきり違い、それを隠さない。

| 層 | ファイル | 何が入っているか | 忠実度 |
|---|---|---|---|
| **科学** | `src/circuit.js`, `src/brain.js` | 細胞型、結合、シナプス数、LIF 方程式 | 細胞型名と LIF のパラメータは FlyWire / Shiu et al. 2024 に合わせる。**配線は Phase 2 では模式**で、Phase 3 で実データに置き換える |
| **接点** | `src/interface.js` | 世界 → 感覚ニューロンの入力率、DN の発火率 → 前進・旋回 | 手で決めた変換。connectome からは出てこない（Eon Systems の身体化モデルも同じ） |
| **ゲーム** | `src/world.js`, `src/game.js` | 2D の身体、光・餌・岩、スコア、エネルギー | 大胆に単純化してよい部分 |
| **表現** | `src/render.js`, `index.html` | 宇宙、月、ハエ、脳の粒子、網膜の帯 | 人間に見せるための層。ここで初めて光のひとつが「月」として描かれる |

**「月」という概念は科学層にも接点層にも無い。** `interface.js` が受け取るのは光源の方位・大きさ・明るさだけで、月かランプかを区別しない。
月を特別扱いするのはゲーム層（スコア）と表現層（絵）だけ。

---

## 1. 技術の選択：JavaScript + Canvas（依存ゼロ）

| 観点 | Python + NumPy + pygame | **JavaScript + Canvas** | その他（WebGL / WASM / Pyodide） |
|---|---|---|---|
| インストール | Python と pygame が要る（この PC には未導入） | **不要**。ブラウザだけ | 不要だが構成が重い |
| Web で公開 | pygbag などで変換が要り、手間がかかる | **そのまま GitHub Pages に置ける** | 可能 |
| 性能（数百〜数千ニューロン） | NumPy でベクトル化すれば十分 | **十分**（下の実測） | 過剰 |
| 描画の表現力 | 素朴 | Canvas 2D で光・粒子・線が描ける。のちに WebGL も足せる | 高い |
| FlyWire データの前処理 | **最適**（pandas / pyarrow） | 不向き（100 MB の parquet） | — |

**決定**：本体は JavaScript + Canvas。ビルドなし、ES modules も使わない（`<script>` の順読み込み）。
これで **`index.html` をダブルクリックするだけで動く**（`file://` でも可）。
Python は Phase 3 のデータ抽出（オフライン、1 回きり）だけに使う。

---

## 2. 規模：Ryzen 5 5560U で快適に動く大きさ

**この PC 上のブラウザで実測した値**：

| 項目 | 値 |
|---|---|
| 現在の回路 | 244 ニューロン、1,586 シナプス（結合） |
| LIF の刻み | 0.5 ms（1 フレーム 1/60 秒で 33 刻み） |
| 脳の計算 | **約 0.3 ms / フレーム** |
| 1 フレーム全体（脳 + 世界 + 描画） | 約 1–2 ms（予算は 16.7 ms） |
| 画面なしの検証実行 | 実時間の約 130 倍 |

1 ニューロン 1 刻みあたり約 37 ns（乱数を含む）。脳に 6 ms / フレームを割り当てると、上限は約 5,000 ニューロン。

**規模の目安**：

| 段階 | ニューロン | 結合 | 備考 |
|---|---|---|---|
| Phase 2（現在） | 約 250 | 約 1,600 | 細胞型ごとに縮約 |
| Phase 3 の目標 | **1,000–3,000** | **≤ 100,000** | FlyWire の実ニューロン単位。発火したときだけ結合をたどるので、結合数よりニューロン数が効く |
| 上限の目安 | 約 5,000 | — | これを超えるなら Web Worker に逃がすか、細胞型ごとに集約する |

---

## 3. データの流れ（1 フレーム = 1/60 秒）

```
 プレイヤー（マウス：光・月・餌・岩）
        │
        ▼
 ┌─────────────┐   方位・大きさ・明るさ    ┌──────────────┐  Poisson 率   ┌──────────────────────┐
 │ World       │ ──────────────────────▶ │ Senses       │ ────────────▶ │ Brain（LIF, 0.5 ms×33）│
 │ 光源、餌の匂い、岩 │   匂いの濃度（左右の触角）  │ interface.js │               │ circuit.js の回路      │
 └──────▲──────┘                          └──────────────┘               └──────────┬───────────┘
        │ 位置・向き                                                                  │ DN の発火率
 ┌──────┴──────┐        前進 px/s、旋回 rad/s、跳躍         ┌──────────────┐           │
 │ Body（2D）   │ ◀───────────────────────────────────────── │ Motor        │ ◀─────────┘
 │ world.js    │                                           │ interface.js │
 └──────┬──────┘                                           └──────────────┘
        │ 出来事（食べた・ぶつかった・月に触れた）
        ▼
 Game（スコア・エネルギー・試行）── 空腹 ──▶ Senses（Or42b の感度を上げる：Root et al. 2011）
```

- 脳は 1 フレームに 33 刻み（16.5 ms）進んでから、身体を 1 フレーム動かす。身体は脳より約 17 ms 遅れて反応する。
- 描画が遅い PC でも、固定刻み（1/60 秒）で追いつくので、時間の進み方は変わらない。
- ゲーム層から脳へ戻る信号は「空腹」だけ。これも嗅覚の感度という形で入り、スコアは脳に届かない。

---

## 4. 回路（Phase 2：FlyWire の細胞型にもとづく模式）

| 経路 | 集団（FlyWire cell_type の候補） | 役割 | 根拠 |
|---|---|---|---|
| 光 → 旋回 | R7/R8 → Tm/Mi（+ Dm の側方抑制） → 視覚投射（側方：MeTu/LC） → **DNa02**, DNa01（同じ側） | 光のある側へ曲がる | DNa02 の活動は同じ側への旋回を予測する（Rayshubskiy et al. 2020） |
| 光 → 前進 | Tm → 視覚投射（前方） → **DNp09**（両側） | 正面に光があると速く歩く | DNp09 / P9 は前進歩行を起こす（Bidaye et al. 2020） |
| 接近 → 逃避 | **LPLC2**/LC4 → **GF (DNp01)**、反対側の DNa02、**MDN** | 迫る岩から跳ぶ・避ける・後ずさる | LPLC2 → GF（Ache et al. 2019）、MDN = moonwalker（Bidaye et al. 2014） |
| 匂い → 旋回 | Or42b ORN → DM1 PN（+ **ALLN** の一様抑制） → 側角 → DNa02 | 匂いの濃い側へ曲がる | ORN は同じ側を強く駆動（Gaudry et al. 2013）、LN による正規化（Olsen & Wilson 2008） |
| 匂い → 減速 | PN → 側角（減速） → DNp09 を抑制 | 餌のそばで止まる | 模式 |
| 作品側の駆動 | 歩行衝動 → DNp09、ゆらぎ → DNa02 | 刺激がなくても歩き、探索する | FlyWire の外（点線で表示） |

DN の数は FlyWire の片側あたりの実数（DNa02 1、DNa01 1、DNp09 1、MDN 2、GF 1）。感覚と中間層は縮約してある。
LIF は Shiu et al. 2024 と同じ（静止 −52 mV、閾値 −45 mV、τm 20 ms、τsyn 5 ms、不応期 2.2 ms、遅延 1.8 ms、重み = 0.275 mV × シナプス数）。

### 経路が効いていることの確認（`tests.html`）

回路の一部を切ると行動が崩れるかを、シードを固定して測る（この PC で実行した結果）。

| 課題 | 無傷 | 損傷 | 切った経路 |
|---|---|---|---|
| 月（左前方）に届く | 6/6 | 1/6 | 視覚投射（側方）→ DNa02/01 |
| 月（真後ろ）に届く | 6/6 | 3/6 | 同上 |
| 餌の匂いをたどる | 12/18 | 1/18 | 側角 → DN |
| 岩を避ける | 衝突 0 回 | 衝突 1 回 | LPLC2 → GF/DNa02/MDN（**差が小さく、根拠としては弱い**） |

つまり行動は if 文ではなく、回路を通って生まれている。ただし **Phase 2 の配線は模式なので、「FlyWire の配線がこの行動を生む」とはまだ言えない**。それを確かめるのが Phase 3。

---

## 5. Phase 3：FlyWire の実データをどれだけ取り込むか

### 5.1 使うデータ（ログイン不要、合計約 136 MB）

| ファイル | 大きさ | 中身 | 出所 |
|---|---|---|---|
| `Connectivity_783.parquet` | 100.8 MB | 有向結合（前・後・符号付きシナプス数） | `philshiu/Drosophila_brain_model`（Shiu モデルの入力そのもの） |
| `Completeness_783.csv` | 3.3 MB | インデックス ↔ FlyWire root_id | 同上 |
| `Supplemental_file1_neuron_annotations.tsv` | 31.7 MB | root_id ごとの super_class, cell_class, cell_type, side, 神経伝達物質 | `flyconnectome/flywire_annotations`（v783） |

どれも `data/`（git 管理外）に置き、リポジトリには含めない。

### 5.2 抽出の手順（`tools/extract_circuit.py`、未実装）

1. **種を決める**
   - 入力側：R7/R8（光）、LPLC2/LC4（接近）、ORN_DM1（匂い）。
   - 出力側：DNa02, DNa01, DNp09, MDN, DNp01（GF）。
2. **出力側から上流へたどる**：各 DN への入力のうち、シナプス数 ≥ 5 のものを 2–3 段さかのぼる。
3. **入力側から下流へたどる**：同じ条件で 2–3 段たどる。
4. **両方に入るニューロンだけを残す**：入力と出力をつなぐ経路の上にあるものだけ。
5. 数が予算（≤ 3,000）を超えたら、段数やシナプス数の閾値を上げる。視覚の列ごとの型（Tm など）は、左右の目の方位ごとに何本かを代表として残す。
6. `circuit.js` と同じ形式（`pattern: "explicit"`, `prov: "flywire_v783"`）の `src/circuit_flywire.js` を書き出す。
   符号は Shiu と同じく ACh = 興奮、GABA/Glu = 抑制。
7. `tests.html` で模式版と実データ版を並べて比べる。

### 5.3 予想される問題と、作品としての扱い

- 光受容細胞から DNa02 までの実際の経路は長く（おそらく 4 段以上）、「光の側へ曲がる」性質がそのまま出てくる保証はない。
  **出てこなければ、足りない部分だけを模式の「橋」で補い、`prov: "schematic"` として画面上でも区別して見せる**。
- どこまでが FlyWire で、どこからが作品側かを、脳の可視化の線の種類（実線・点線）で示す。今の UI はすでにそうしている。
- 段階を分けて入れていく：まず DN の直前だけを実データにし、次に視覚投射、最後に髄質へと広げる。

---

## 6. 開発の段階

| Phase | 内容 | 状態 |
|---|---|---|
| 0 | GPU なしで動く最小構成の設計 | 済（本書） |
| 1 | 2D の世界 + ハエ + 月 | 済 |
| 2 | 視覚入力 → 軽い神経回路 → 左右の運動 | 済（模式の回路 + 損傷テスト） |
| 3 | FlyWire の回路を実データとして入れる | 未（データのダウンロード許可待ち、§5） |
| 4 | プレイヤーの操作・餌・岩・スコア | 最小限は済（光・月・餌・岩、スコア、エネルギー、試行、生存時間） |
| 5 | 神経活動の美しい可視化 | 骨組みは済（粒子・結合の流れ・網膜の帯） |
| 6 | ゲームとしての完成度 | 未。「月まで連れていけるか？」のステージ、制限時間、ランプの電池など |
| 7 | ブラウザで公開できる形に整える | ほぼ整っている（静的ファイルのみ）。ライセンス表記を詰める |

---

## 7. ファイル

```
index.html          作品本体（ダブルクリックで開ける）
tests.html          損傷テスト（ブラウザで開くと実行される）
src/circuit.js      回路データ（科学層）
src/brain.js        LIF シミュレータ（科学層）
src/interface.js    感覚と運動の変換（接点層）
src/world.js        2D の世界と身体（ゲーム層）
src/game.js         スコア・エネルギー・試行（ゲーム層）
src/render.js       世界と脳の描画（表現層）
src/main.js         起動・入力・ループ・検証用の FM.experiment
```

---

## 参考文献

- Dorkenwald et al. 2024, *Neuronal wiring diagram of an adult brain*, Nature（FlyWire）
- Schlegel et al. 2024, *Whole-brain annotation and multi-connectome cell typing of Drosophila*, Nature
- Shiu et al. 2024, *A Drosophila computational brain model reveals sensorimotor processing*, Nature
- Rayshubskiy et al. 2020, *Neural control of steering in walking Drosophila*, bioRxiv
- Bidaye et al. 2014, *Neuronal control of Drosophila walking direction*, Science（MDN）
- Bidaye et al. 2020, *Two brain pathways initiate distinct forward walking programs in Drosophila*, Neuron（P9 / DNp09）
- Ache et al. 2019, *Neural basis for looming size and velocity encoding in the Drosophila giant fiber escape pathway*, Current Biology
- Gaudry et al. 2013, *Asymmetric neurotransmitter release enables rapid odour lateralization in Drosophila*, Nature
- Olsen & Wilson 2008, *Lateral presynaptic inhibition mediates gain control in an olfactory circuit*, Nature
- Root et al. 2011, *Presynaptic facilitation by neuropeptide signaling mediates odor-driven food search*, Cell
- Eon Systems 2026, *How the Eon Team Produced a Virtual Embodied Fly* — https://eon.systems/updates/embodied-brain-emulation
