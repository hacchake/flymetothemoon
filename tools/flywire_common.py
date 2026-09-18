"""FlyWire v783 のデータを読む共通処理（Phase 3）。

data/ に次の 3 つが必要（README の「FlyWire のデータ」を参照）:
  Connectivity_783.parquet  Shiu et al. 2024 の結合表（符号付きシナプス数）
  Completeness_783.csv      Shiu モデルのニューロン一覧
  neuron_annotations.tsv    Schlegel et al. 2024 の注釈（細胞型・左右・位置）
"""
from pathlib import Path

import numpy as np
import pandas as pd
import scipy.sparse as sp

DATA = Path(__file__).resolve().parent.parent / "data"

# 読み出す下行ニューロン（FlyWire の cell_type）
DN_TYPES = ["DNa02", "DNa01", "DNp09", "MDN", "DNp01"]
SIDES = {"left": "L", "right": "R"}


def load():
    """結合表・注釈・ニューロンの並びを読み、列を正規化した行列 Wn を作る。

    Wn[i, j] = 符号付きシナプス数(i→j) / j が受ける全シナプス数（絶対値の和）
    """
    con = pd.read_parquet(
        DATA / "Connectivity_783.parquet",
        columns=["Presynaptic_ID", "Postsynaptic_ID", "Presynaptic_Index", "Postsynaptic_Index", "Excitatory x Connectivity"],
    ).rename(columns={"Excitatory x Connectivity": "w"})
    ann = pd.read_csv(DATA / "neuron_annotations.tsv", sep="\t", low_memory=False)
    ids = pd.read_csv(DATA / "Completeness_783.csv", index_col=0).index.to_numpy()
    n = len(ids)
    ann = ann.set_index("root_id").reindex(ids)
    ann["idx"] = np.arange(n)
    ann["S"] = ann["side"].map(SIDES)

    pre, post, w = con.Presynaptic_Index.to_numpy(), con.Postsynaptic_Index.to_numpy(), con.w.to_numpy().astype(np.float64)
    tot_in = np.bincount(post, weights=np.abs(w), minlength=n)
    wn = w / np.maximum(tot_in[post], 1)
    Wn = sp.csr_matrix((wn, (pre, post)), shape=(n, n))
    return con, ann, Wn


def backward_influence(Wn, targets, hops=3):
    """各ニューロンが targets（インデックス配列）に与える影響の和を返す（1〜hops 段の経路の合計）。"""
    v = np.zeros(Wn.shape[0])
    v[targets] = 1.0
    total = np.zeros_like(v)
    for _ in range(hops):
        v = Wn @ v
        total += v
    return total


def idx_of(ann, cell_type, side=None):
    m = ann.cell_type == cell_type
    if side:
        m &= ann.S == side
    return ann.loc[m, "idx"].to_numpy()
