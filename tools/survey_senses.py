"""嗅覚（ORN）と機械感覚（JO）が、下行ニューロンまで本当につながっているかを調べる。

各感覚から前向きに 3 段たどった影響と、DN へ後ろ向きに 3 段たどった影響の積で、
間に立つ細胞型の順位を出す。extract_circuit.py に入れる入力を決めるための下調べ。
"""
from pathlib import Path

import numpy as np
import pandas as pd

from flywire_common import DN_TYPES, backward_influence, load

SENSES = {
    "olf_food": ["ORN_DM1", "ORN_DM2", "ORN_DM4", "ORN_VM2"],   # 酢・発酵（誘引）
    "olf_co2": ["ORN_V"],                                        # 二酸化炭素（忌避）
    "wind": ["JO-CM", "JO-CL", "JO-CA1", "JO-EV1", "JO-EV2", "JO-ED2_a"],  # 風・重力
    "sound": ["JO-B1_a", "JO-B2", "JO-B3"],                      # 羽音・空気のふるえ
}


def forward(Wn, sources, hops=3):
    v = np.zeros(Wn.shape[0])
    v[sources] = 1.0
    total = np.zeros_like(v)
    for _ in range(hops):
        v = Wn.T @ v
        total += np.abs(v)
    return total


HOPS = 5


def main():
    con, ann, Wn = load()
    ct = ann.cell_type.fillna("")
    dn_idx = ann.loc[ct.isin(DN_TYPES), "idx"].to_numpy()
    b = np.abs(backward_influence(Wn, dn_idx, hops=3))
    print("hops =", HOPS)

    for name, types in SENSES.items():
        src = ann.loc[ct.isin(types), "idx"].to_numpy()
        f = forward(Wn, src, hops=HOPS)
        score = f * b
        score[src] = 0
        s = pd.Series(score, index=ct.to_numpy())
        top = s.groupby(level=0).sum().sort_values(ascending=False).head(12)
        # その感覚が DN に届く強さ（DN 上での前向き影響）
        reach = {t: round(float(f[ann.loc[ct == t, "idx"].to_numpy()].sum()), 4) for t in DN_TYPES}
        print(f"\n=== {name}  n={len(src)} ===")
        print("DN への到達:", reach)
        print("間の型:", {k: round(float(v), 4) for k, v in top.items()})


if __name__ == "__main__":
    main()
