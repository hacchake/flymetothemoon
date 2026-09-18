"""FlyWire v783 から、作品で使う視覚・逃避の回路を抜き出して src/circuit_flywire.js に書く。

入力（感覚側）と出力（下行ニューロン）は、survey_steering.py の結果にもとづいて選んだ：
  light_steer : LC10a / LC10c-1 / LC10c-2 / LC10d   … 同じ側の DNa02/DNa01 を最も強く動かす視覚投射
  light_fwd   : LC9 / LC31a                          … DNp09（前進）を最も強く動かす視覚投射
  loom        : LPLC2 / LC4                          … GF（DNp01）への既知の接近検出経路
  出力        : DNa02, DNa01, DNp09, MDN, DNp01（各左右）

中間のニューロンは、入力からの影響（前向き 1〜2 段）と DN への影響（後ろ向き 1〜2 段）の積で順位をつけ、
上位 MAX_MID 個を残す。選んだニューロンどうしの結合は、FlyWire のシナプス数をそのまま使う（MIN_SYN 未満は捨てる）。

出力ファイルは FlyWire データからの派生物なので CC BY-NC 4.0。
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

from flywire_common import DN_TYPES, backward_influence, load

ROOT = Path(__file__).resolve().parent.parent
MAX_MID = 1200
MIN_SYN = 5

INPUTS = {
    "light_steer": ["LC10a", "LC10c-1", "LC10c-2", "LC10d"],
    "light_fwd": ["LC9", "LC31a"],
    "loom": ["LPLC2", "LC4"],
}
NT = {"acetylcholine": "ACh", "gaba": "GABA", "glutamate": "Glu", "dopamine": "DA", "serotonin": "5HT", "octopamine": "OA"}


# 全ニューロンの座標の範囲（FAFB v783、ボクセル単位）
X0, X1, Y0, Y1, Z0, Z1 = 21906, 225720, 12840, 110722, 16, 6968


def to3d(px, py, pz):
    half = (X1 - X0) / 2
    return ((px - (X0 + X1) / 2) / half, -(py - (Y0 + Y1) / 2) / half, (pz * 10 - (Z0 + Z1) * 5) / half)


def forward_influence(Wn, sources, hops=2):
    v = np.zeros(Wn.shape[0])
    v[sources] = 1.0
    total = np.zeros_like(v)
    for _ in range(hops):
        v = Wn.T @ v
        total += np.abs(v)
    return total


def main():
    con, ann, Wn = load()
    ann = ann[ann.S.isin(["L", "R"]) | ann.cell_type.isin(DN_TYPES)]
    ann = ann.copy()
    ann["S"] = ann.S.fillna("C")

    modality = {}
    for mod, types in INPUTS.items():
        for i in ann.loc[ann.cell_type.isin(types), "idx"]:
            modality[int(i)] = mod
    in_idx = np.array(sorted(modality))
    dn_idx = ann.loc[ann.cell_type.isin(DN_TYPES), "idx"].to_numpy()

    f = forward_influence(Wn, in_idx, hops=2)
    b = np.abs(backward_influence(Wn, dn_idx, hops=2))
    score = f * b
    score[in_idx] = 0
    score[dn_idx] = 0
    valid = np.zeros(len(score), bool)
    valid[ann.idx.to_numpy()] = True
    score[~valid] = 0
    mid_idx = np.argsort(score)[::-1][:MAX_MID]
    mid_idx = mid_idx[score[mid_idx] > 0]

    keep = np.concatenate([in_idx, mid_idx, dn_idx])
    keep_set = set(keep.tolist())
    e = con[con.Presynaptic_Index.isin(keep_set) & con.Postsynaptic_Index.isin(keep_set)]
    e = e[e.w.abs() >= MIN_SYN]
    e = e[~e.Postsynaptic_Index.isin(in_idx)]  # 入力は外から駆動するので、入力への結合は捨てる

    info = ann.set_index("idx").loc[keep]
    info["role"] = "inter"
    info.loc[in_idx, "role"] = "sensor"
    info.loc[dn_idx, "role"] = "dn"
    info["modality"] = [modality.get(int(i), "") for i in info.index]
    info["ct"] = info.cell_type.fillna(info.super_class.fillna("unknown"))

    # 画面用の位置：正面から見た図（x = 左右、y = 背腹）を 0..1 に
    px, py = info.pos_x.to_numpy(), info.pos_y.to_numpy()
    x0, x1, y0, y1 = 21906, 225720, 12840, 110722  # 全ニューロンの範囲
    info["vx"] = (px - x0) / (x1 - x0)
    info["vy"] = (py - y0) / (y1 - y0)
    # 立体の位置：FAFB の座標は x・y が 4 nm、z が 40 nm 刻みなので、z を 10 倍して縮尺をそろえる。
    # 脳の中心を原点に、左右の幅の半分を 1 とする。y は上を正にする（画面の上 = 背側）
    X, Y, Z = to3d(px, py, info.pos_z.to_numpy())
    info["X"], info["Y"], info["Z"] = X, Y, Z

    # 集団 = 細胞型 × 左右
    info["pop"] = info.ct.astype(str).str.replace(r"[^A-Za-z0-9]+", "_", regex=True) + "_" + info.S
    pops, local = [], {}
    for pid, g in info.groupby("pop", sort=False):
        for k, i in enumerate(g.index):
            local[int(i)] = (pid, k)
        row = g.iloc[0]
        pops.append({
            "id": pid, "side": row.S, "n": len(g), "role": row.role, "modality": row.modality,
            "group": {"sensor": "vision", "dn": "motor"}.get(row.role, "flywire"),
            "source": "flywire", "flywire": [str(row.ct)], "label": str(row.ct),
            "super_class": str(row.super_class), "nt": NT.get(row.top_nt, "?"),
            "root_ids": [str(r) for r in g.root_id] if "root_id" in g else [],
            "pos": [[round(float(x), 4), round(float(y), 4)] for x, y in zip(g.vx, g.vy)],
            "pos3": [[round(float(a), 4), round(float(b), 4), round(float(c), 4)] for a, b, c in zip(g.X, g.Y, g.Z)],
        })
    # root_id は index 側にある
    idx_to_root = ann.set_index("idx").index.to_series()
    ids = pd.read_csv(ROOT / "data" / "Completeness_783.csv", index_col=0).index.to_numpy()
    for p in pops:
        g = info[info["pop"] == p["id"]]
        p["root_ids"] = [str(ids[i]) for i in g.index]

    proj = {}
    for a, b2, w in zip(e.Presynaptic_Index, e.Postsynaptic_Index, e.w):
        (pa, ka), (pb, kb) = local[int(a)], local[int(b2)]
        proj.setdefault((pa, pb), []).append([ka, kb, int(w)])
    projections = [{"from": a, "to": b2, "pattern": "explicit", "nt": "signed", "prov": "flywire_v783", "edges": ed}
                   for (a, b2), ed in proj.items()]

    out = {
        "meta": {
            "name": "flywire_v783_vision_escape",
            "source": "FlyWire FAFB v783 (Dorkenwald et al. 2024; Schlegel et al. 2024), connectivity table from Shiu et al. 2024",
            "license": "CC BY-NC 4.0",
            "inputs": INPUTS, "outputs": DN_TYPES, "max_mid": MAX_MID, "min_syn": MIN_SYN,
            "n_neurons": int(len(info)), "n_edges": int(len(e)), "n_synapses": int(e.w.abs().sum()),
        },
        "populations": pops,
        "projections": projections,
    }
    js = ("// 自動生成：tools/extract_circuit.py\n"
          "// FlyWire FAFB v783 からの派生データ。CC BY-NC 4.0（非営利）。README の「FlyWire のデータとライセンス」を参照。\n"
          "window.FM = window.FM || {};\nwindow.FM.FLYWIRE = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    (ROOT / "src" / "circuit_flywire.js").write_text(js, encoding="utf-8")
    print(json.dumps(out["meta"], ensure_ascii=False, indent=1))
    by_role = info.groupby(["role", "modality"]).size()
    print(by_role.to_string())
    print("top intermediate types:", info[info.role == "inter"].ct.value_counts().head(15).to_dict())
    print(f"file: {len(js) / 1e6:.2f} MB")

    # 背景に描く全脳の点群（12000 点を間引いて）。[x2d, y2d, 種類, X, Y, Z]
    rng = np.random.default_rng(0)
    allp = ann[["pos_x", "pos_y", "pos_z", "super_class"]].dropna()
    s = allp.iloc[rng.choice(len(allp), 12000, replace=False)]
    cls = {"optic": 0, "central": 1, "visual_projection": 2, "sensory": 3, "descending": 4}
    AX, AY, AZ = to3d(s.pos_x.to_numpy(), s.pos_y.to_numpy(), s.pos_z.to_numpy())
    atlas = [[round((x - x0) / (x1 - x0), 4), round((y - y0) / (y1 - y0), 4), cls.get(c, 5), round(float(a), 3), round(float(b), 3), round(float(d), 3)]
             for x, y, c, a, b, d in zip(s.pos_x, s.pos_y, s.super_class, AX, AY, AZ)]
    (ROOT / "src" / "brain_atlas.js").write_text(
        "// 自動生成：tools/extract_circuit.py。FlyWire FAFB v783 のニューロン位置を 12000 点に間引いたもの。CC BY-NC 4.0。\n"
        "window.FM = window.FM || {};\nwindow.FM.ATLAS = " + json.dumps(atlas, separators=(",", ":")) + ";\n", encoding="utf-8")


if __name__ == "__main__":
    main()
