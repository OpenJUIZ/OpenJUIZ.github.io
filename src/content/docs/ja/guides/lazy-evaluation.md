---
title: 遅延評価
description: 同じ juiz プロセスの Python の Process 同士は、値を変換せずにそのまま受け渡します。
sidebar:
  order: 7
---

juiz の Process の戻り値は、ふだん juiz の共通形式(JSON 相当の値か画像)に変換してから次の Process に渡されます。
**遅延評価**は、この変換を**必要になるまで行わない**仕組みです。同じ juiz プロセスの中で、Python の Process 同士が値を受け渡すときは、変換が一度も起きません。

:::caution[juiz 0.0.23 以降が必要です]
遅延評価は juiz 0.0.23 から使えます。Python の Process 同士に加えて、[データ型](/ja/guides/datatype/)で型を付けた Rust・C++ の値も対象です([Rust・C++ の型付きの値](#rustc-の型付きの値))。
:::

## 何が変わるか

今まで(0.0.22 まで)の受け渡し:

```text
Python f の戻り値 (dict / ndarray) --変換--> 共通形式 --変換--> Python g の引数
```

遅延評価の後:

```text
Python f の戻り値 --> Python のオブジェクトのまま --> Python g の引数
                         \--変換(必要なときだけ、1 回)--> Rust の Process / ブローカー / 管理画面
```

画像処理の 4 段(640x480 の RGB 画像)を Python で組んだときの 1 回あたりの時間は、次のようになりました。

| 組み方 | 0.0.22 まで | 遅延評価の後 |
|---|---|---|
| juiz を通さず Python だけでつなぐ | 2.7 ms | 2.7 ms |
| [Composite](/ja/guides/composition/) | 34 ms | 1.8 ms |
| Pull 接続 | 34 ms | 2.0 ms |

Composite でも接続でも同じように効きます。設定ファイルや Process のコードを直す必要はありません。

## 変換が省かれる条件

次をすべて満たすと、値は Python のオブジェクトのまま渡ります。

- 渡す側と受け取る側が**同じ juiz プロセス**の中にある(ブローカー越し・別プロセスでは必ず変換します)
- **どちらも Python** の Process である
- 戻り値が `dict`・`list`・`tuple`・`set`・numpy の配列・PIL の画像などのオブジェクトである

`str`・`int`・`float`・`bool`・`None` の戻り値は小さいので、今までどおりその場で共通形式にします。

numpy の配列を戻り値にできるようになりました(今までは落ちていました)。Python 以外が読むときは `tolist()` した値になります(画像としては扱いません)。

## 変換が入る場所

値を共通形式で読む必要があるところでだけ、1 回だけ変換が起き、結果は覚えておかれます。同じ値を何度読んでも変換は 1 回です。

| 場所 | 振る舞い |
|---|---|
| Rust・C++・Haskell の Process への受け渡し | 受け取る側が共通形式を読むので変換する |
| ブローカー越しの応答(HTTP・QUIC など、CLI の `call` も) | 変換して今までと同じ JSON や画像を返す |
| Topic への publish | 今までどおり変換して配る |
| profile・管理画面の引数の値 | 変換して今までと同じ値を見せる |
| Composite の `trace` | **変換しない**。`native(python:numpy.ndarray)` のように型名だけ出す |

変換できない Python のオブジェクトは、Python の Process 同士なら渡せますが、上の場所で読もうとするとエラーになります(HTTP の応答なら 500)。

## 受け取った引数を書き換えない

値は複製されずに共有されます。outlet の memo、複数の接続先、Composite の親の段が、同じ Python のオブジェクトを見ています。
そのため、**受け取った引数をその場で書き換えると、memo やほかの接続先にも見えてしまいます**。今までは受け渡しのたびに複製されていたので、これは振る舞いの変化です。

**Python の Process は、受け取った引数を書き換えないでください。** 書き換えたいときは複製してから使います。juiz はこれを検査しません(Python の関数で普通に守る約束と同じです)。

```python
import numpy as np

# よくない: 受け取った配列をその場で書き換える
def brighten_bad(img: np.ndarray) -> np.ndarray:
    img += 10            # 渡してきた側の memo の値まで変わる
    return img

# よい: 新しい配列を作って返す
def brighten(img: np.ndarray) -> np.ndarray:
    return img + 10      # もとの配列は変わらない

# dict も同じ
def add_key(d: dict) -> dict:
    out = dict(d)        # 複製してから書き換える
    out["key"] = 1
    return out
```

もう 1 つの変化として、Python 同士では PIL の画像がそのまま渡るので、グレースケール(`L`)の画像が途中で RGB に変わらなくなります。

## Rust・C++ の型付きの値

[データ型](/ja/guides/datatype/)で型を付けた Rust・C++ の Process の戻り値も、同じ言語の Process へは構造体のまま渡ります。

- Rust: `#[derive(JuizType)]` か `juiz-idl` で生成した record 型の戻り値が対象です。**同じプラグインの中**(同じプラグインの Process をつないだ Composite や接続)でだけ構造体のまま渡り、Composite では値を移し、接続では 1 回 `clone` します。別のプラグインへは共通形式に変換します。
- C++: `juiz-idl -g cpp` で生成した型が対象です。別のプラグインどうしでも、コンパイラと標準ライブラリがそろっていれば構造体のまま渡り、受け取る側は値を複製せずに借りて読みます。
- 列挙型・基本型・型を付けない引数(`Value`)は、今までどおり共通形式で渡します。

## まだ対象でないもの

- Haskell
- Topic(Python 同士でも変換して配ります)
- ブローカー越し・別プロセス(必ず変換します)

仕様の細かい規則は juiz リポジトリの [docs/spec/lazy-evaluation.md](https://github.com/OpenJUIZ/juiz/blob/main/docs/spec/lazy-evaluation.md) にあります。
