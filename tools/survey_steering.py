"""FlyWire の中で、どの視覚投射の細胞型が「同じ側へ曲がる」DN を動かすかを調べる。

各細胞型 × 左右について、1〜3 段の経路で DNa02+DNa01（左・右）と DNp09 に与える影響を合計し、
  steer = 同じ側の DNa02/01 への影響 − 反対側への影響
が大きい順に並べる。結果は data/steering_survey.csv に書く。
"""
import pandas as pd

from flywire_common import backward_influence, idx_of, load


def main():
    _, ann, Wn = load()
    dn = {}
    for s in "LR":
        dn[f"turn_{s}"] = backward_influence(Wn, list(idx_of(ann, "DNa02", s)) + list(idx_of(ann, "DNa01", s)))
    dn["fwd"] = backward_influence(Wn, idx_of(ann, "DNp09"))
    dn["gf"] = backward_influence(Wn, idx_of(ann, "DNp01"))

    df = ann[["cell_type", "super_class", "S"]].copy()
    for k, v in dn.items():
        df[k] = v
    df = df[df.S.isin(["L", "R"]) & df.cell_type.notna()]
    df["ipsi"] = df.apply(lambda r: r[f"turn_{r.S}"], axis=1)
    df["contra"] = df.apply(lambda r: r["turn_R" if r.S == "L" else "turn_L"], axis=1)
    g = df.groupby(["super_class", "cell_type", "S"]).agg(
        n=("ipsi", "size"), ipsi=("ipsi", "sum"), contra=("contra", "sum"), fwd=("fwd", "sum"), gf=("gf", "sum")
    ).reset_index()
    g["steer"] = g.ipsi - g.contra
    g.to_csv("data/steering_survey.csv", index=False)

    pd.set_option("display.width", 160)
    vpn = g[g.super_class == "visual_projection"]
    # 左右とも同じ向きに効く型だけ（片側だけの偶然を除く）
    both = vpn.pivot_table(index="cell_type", columns="S", values="steer").dropna()
    both["min"] = both[["L", "R"]].min(axis=1)
    print("== 視覚投射：同じ側へ曲げる力（左右とも正の型、上位 20）==")
    print(both.sort_values("min", ascending=False).head(20).to_string())
    print("\n== 視覚投射：前進（DNp09）への影響 上位 10 ==")
    print(vpn.groupby("cell_type").fwd.sum().sort_values(ascending=False).head(10).to_string())
    print("\n== 全体：同じ側へ曲げる力 上位 15（参考）==")
    print(g.sort_values("steer", ascending=False).head(15)[["super_class", "cell_type", "S", "n", "ipsi", "contra", "steer"]].to_string())
    for t in ["LPLC2", "LC4", "ORN_DM1", "DM1_lPN", "PFL3"]:
        print(t, g[g.cell_type == t][["S", "n", "ipsi", "contra", "steer", "fwd", "gf"]].round(4).to_dict("records"))


if __name__ == "__main__":
    main()
