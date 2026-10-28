---
title: インストール
description: juiz コマンドと、各言語で機能要素を書くためのパッケージをインストールします。
sidebar:
  order: 1
---

`juiz` コマンドの入れ方は 2 通りあります。使う言語で選んでください。

| 使う言語 | 入れ方 | Rust のツールチェーン |
| --- | --- | --- |
| Python・C++・Haskell | `pip install juiz-cli` | 不要(C++・Haskell は、当面 libjuiz_sdk のビルドに必要) |
| Rust(Python・C++・Haskell も併用可) | `cargo install juiz_app` | 必要 |

C++ と Haskell の機能要素は、どちらの入れ方の `juiz` でも動きます(下の「[言語ごとのパッケージ](#言語ごとのパッケージ)」で、`juiz` と同じ版の libjuiz_sdk を用意します)。

## pip で入れる場合

PyPI の [juiz-cli](https://pypi.org/project/juiz-cli/) を入れると、`juiz` コマンドと、Process を書くための [pyjuiz](https://pypi.org/project/pyjuiz/)(`import juiz`)の両方が入ります。Rust のツールチェーンは要りません。

必要なもの:

- Python 3.10 以降
- Linux(x86_64・aarch64)、macOS(Apple シリコン・Intel)、Windows(x86_64)のいずれか

```sh
python3 -m venv .venv
source .venv/bin/activate        # Windows では .venv\Scripts\activate
pip install juiz-cli
juiz --help
```

`juiz` コマンドは venv の中に入ります。以降は、この venv を有効にしたターミナルで `juiz` を実行してください。

:::caution
pip で入れた `juiz` は、juiz の CI でビルドしたものです。手元でビルドした Rust のプラグイン(Rust で書いた Process や、QUIC ブローカーなど)は、コンパイラの版がそろわないため読み込めません。
Rust でも書く場合は、次の `cargo install juiz_app` を使ってください。C++ と Haskell のプラグインは読み込めます。
:::

## cargo で入れる場合

必要なもの:

- Linux または macOS
- Rust 1.81 以降([rustup](https://rustup.rs/) でインストール)
- C++ で機能要素を書く場合: CMake と C++17 対応のコンパイラ
- Python で機能要素も書く場合: Python 3 と開発用ヘッダー(Ubuntu なら `sudo apt install python3-dev python3-venv`)

crates.io で公開されている `juiz_app` をインストールします。

```sh
cargo install juiz_app
```

`juiz` コマンドが `~/.cargo/bin` に入ります。

### Python の Process も使う

この `juiz` で Python の Process も動かすときは、PyPI の [pyjuiz](https://pypi.org/project/pyjuiz/) **だけ** を追加します。
`juiz` コマンドはビルド時に見つけた Python を組み込むので、同じ Python で venv を作ってください。

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install pyjuiz
```

:::caution
この venv には `juiz-cli` を入れないでください。`juiz` コマンドが 2 つになり、どちらが動くかが PATH の順番で決まってしまいます。
:::

## 言語ごとのパッケージ

### Rust

機能要素は [juiz_sdk](https://crates.io/crates/juiz_sdk) クレートで書きます。`Cargo.toml` で共有ライブラリとしてビルドする設定にします。
juiz_sdk の版は、`cargo install juiz_app` で入れた `juiz` と合わせてください。版が食い違うプラグインは、読み込むときにエラーで止まります。

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
juiz_sdk = "0.0.25"
```

### Python

[pyjuiz](https://pypi.org/project/pyjuiz/) のデコレータ(`from juiz import juiz_process` など)で書きます。pyjuiz は `juiz-cli` と一緒に入ります。`cargo install juiz_app` を使う場合は、上のとおり pyjuiz だけを入れます。

### C++ と Haskell の共通: libjuiz_sdk

C++ と Haskell の機能要素は、libjuiz_sdk(値を受け渡す C の関数の共有ライブラリ)にリンクします。
いまは libjuiz_sdk を配布物としては公開していないので、juiz のソースを `juiz` と **同じ版** のタグで取得してビルドします(Rust のツールチェーンが要ります)。

```sh
juiz --version      # 例: juiz 0.0.25
git clone --depth 1 --branch v0.0.25 https://github.com/OpenJUIZ/juiz.git ~/juiz-0.0.25
cargo build --release -p juiz_sdk --manifest-path ~/juiz-0.0.25/Cargo.toml
# => ~/juiz-0.0.25/target/release/libjuiz_sdk.so (macOS は .dylib)
```

C++ のヘッダは同じソースの `bindings/cjuiz/include` と `bindings/cppjuiz/include` にあります。

:::note
OS・CPU ごとにヘッダと一緒にした libjuiz_sdk のアーカイブを [GitHub Releases](https://github.com/OpenJUIZ/juiz/releases) に置く準備をしています。公開したら、ソースからのビルドは要らなくなります。
:::

### C++

サンプル集 [juiz_examples_cpp](https://github.com/OpenJUIZ/juiz_examples_cpp) の CMake([cmake/Juiz.cmake](https://github.com/OpenJUIZ/juiz_examples_cpp/blob/main/cmake/Juiz.cmake))が、上の取得とビルドを自動で行います。自分のプロジェクトでも、このファイルを使うのが手早い方法です。
手で設定するときは、インクルードパスに `bindings/cjuiz/include` と `bindings/cppjuiz/include` を足し、`target/release` の libjuiz_sdk にリンクします。

### Haskell

[hsjuiz](https://github.com/OpenJUIZ/juiz/tree/main/bindings/hsjuiz) で書きます。GHC 9.6 以降と cabal が必要です(Linux・macOS)。
hsjuiz も、いまは juiz のソース(上で取得した `bindings/hsjuiz`)から使います。自分のパッケージの `cabal.project` に、hsjuiz のソースと libjuiz_sdk の場所を書きます。

```txt
packages: . /home/me/juiz-0.0.25/bindings/hsjuiz

package hsjuiz
  extra-lib-dirs: /home/me/juiz-0.0.25/target/release
  ghc-options: -optl-Wl,-rpath,/home/me/juiz-0.0.25/target/release
```

rpath は、Template Haskell を動かすときに GHC が hsjuiz と一緒に libjuiz_sdk を読み込むために要ります。
サンプル集 [juiz_examples_haskell](https://github.com/OpenJUIZ/juiz_examples_haskell) の `build.sh` が、juiz のソースの取得から libjuiz_sdk とサンプルのビルドまでを自動で行うので、ひな形にも使えます。

書き方は [hsjuiz の README](https://github.com/OpenJUIZ/juiz/tree/main/bindings/hsjuiz) を見てください。

:::note
hsjuiz は Hackage への公開を待っています。公開したら、`cabal.project` に hsjuiz のソースを書かずに Hackage から入れられるようになります。
:::

## ソースからビルドする

開発版を使う場合はリポジトリをクローンしてビルドします。

```sh
git clone https://github.com/OpenJUIZ/juiz.git
cd juiz
cargo build
cargo install --path juiz_app
```
