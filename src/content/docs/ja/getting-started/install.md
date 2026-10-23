---
title: インストール
description: juiz コマンドと、各言語で機能要素を書くためのパッケージをインストールします。
sidebar:
  order: 1
---

`juiz` コマンドの入れ方は 2 通りあります。使う言語で選んでください。

| 使う言語 | 入れ方 | Rust のツールチェーン |
| --- | --- | --- |
| Python・C++・Haskell | `pip install juiz-cli` | 不要 |
| Rust(Python・C++・Haskell も併用可) | `cargo install juiz_app` | 必要 |

C++ と Haskell の機能要素は、どちらの入れ方の `juiz` でも動きます(下の「[言語ごとのパッケージ](#言語ごとのパッケージ)」で、`juiz` と同じ版の libjuiz_sdk を入れます)。

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
juiz_sdk = "0.0.17"
```

### Python

[pyjuiz](https://pypi.org/project/pyjuiz/) のデコレータ(`from juiz import juiz_process` など)で書きます。pyjuiz は `juiz-cli` と一緒に入ります。`cargo install juiz_app` を使う場合は、上のとおり pyjuiz だけを入れます。

### C++ と Haskell の共通: libjuiz_sdk

C++ と Haskell の機能要素は、libjuiz_sdk(値を受け渡す C の関数の共有ライブラリ)にリンクします。
[GitHub Releases](https://github.com/OpenJUIZ/juiz/releases) に、ヘッダと一緒にした OS・CPU ごとのアーカイブ
(Linux x86_64・aarch64、macOS arm64・x86_64)を置いているので、`juiz` と **同じ版** を入れます。

```sh
juiz --version      # 例: juiz 0.0.21
curl -fsSL https://raw.githubusercontent.com/OpenJUIZ/juiz/main/scripts/install-juiz-sdk.sh | sh -s -- 0.0.21
```

`~/.juiz/sdk/0.0.21` に展開されます。版の違う libjuiz_sdk でビルドした機能要素は、`juiz` が読み込むときにエラーで止まります。

### C++

C++ 向けのヘッダー `juiz/juiz.h` は、展開したディレクトリの `cppjuiz/include` にあります(juiz リポジトリの `bindings/cppjuiz/include` と同じもの)。
インクルードパスに `cjuiz/include` と `cppjuiz/include` を足し、`lib` の libjuiz_sdk にリンクします。pkg-config も使えます。

```sh
export PKG_CONFIG_PATH=$HOME/.juiz/sdk/0.0.21/lib/pkgconfig
pkg-config --cflags --libs juiz_sdk
```

### Haskell

[hsjuiz](https://hackage.haskell.org/package/hsjuiz)(Hackage)で書きます。GHC 9.6 以降と cabal が必要です(Linux・macOS)。
自分のパッケージの `cabal.project` で、hsjuiz に libjuiz_sdk の場所を渡します。

```txt
packages: .

package hsjuiz
  extra-lib-dirs: /home/me/.juiz/sdk/0.0.21/lib
  ghc-options: -optl-Wl,-rpath,/home/me/.juiz/sdk/0.0.21/lib
```

書き方は [hsjuiz の README](https://github.com/OpenJUIZ/juiz/tree/main/bindings/hsjuiz) を見てください。

## ソースからビルドする

開発版を使う場合はリポジトリをクローンしてビルドします。

```sh
git clone https://github.com/OpenJUIZ/juiz.git
cd juiz
cargo build
cargo install --path juiz_app
```
