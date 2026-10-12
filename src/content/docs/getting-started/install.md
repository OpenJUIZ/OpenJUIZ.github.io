---
title: インストール
description: juiz コマンドと、各言語で機能要素を書くためのパッケージをインストールします。
sidebar:
  order: 1
---

## 必要なもの

- Linux または macOS
- Rust 1.81 以降（[rustup](https://rustup.rs/) でインストール）
- Python で機能要素を書く場合: Python 3 と開発用ヘッダー（Ubuntu なら `sudo apt install python3-dev python3-venv`）
- C++ で機能要素を書く場合: CMake と C++17 対応のコンパイラ

## juiz コマンド

crates.io で公開されている `juiz_app` をインストールします。

```sh
cargo install juiz_app
```

`juiz` コマンドが `~/.cargo/bin` に入ります。

## 言語ごとのパッケージ

### Rust

機能要素は [juiz_sdk](https://crates.io/crates/juiz_sdk) クレートで書きます。`Cargo.toml` で共有ライブラリとしてビルドする設定にします。

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
juiz_sdk = "0.0.9"
```

### Python

PyPI の [pyjuiz](https://pypi.org/project/pyjuiz/) を使います。`juiz` コマンドはビルド時に見つけた Python を組み込むので、同じ Python の環境にインストールしてください。

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install pyjuiz
```

### C++

C++ 向けのヘッダー `juiz/juiz.h` は juiz リポジトリの `bindings/cppjuiz/include` にあります。

## ソースからビルドする

開発版を使う場合はリポジトリをクローンしてビルドします。

```sh
git clone https://github.com/OpenJUIZ/juiz.git
cd juiz
cargo build
cargo install --path juiz_app
```
