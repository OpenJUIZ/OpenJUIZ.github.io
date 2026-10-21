---
title: クイックスタート
description: サンプルをビルドして、juiz で Process を動かします。
sidebar:
  order: 2
---

Rust のサンプル集 [juiz_examples_rust](https://github.com/OpenJUIZ/juiz_examples_rust) を使って、Process を動かしてみます。
先に [インストール](/ja/getting-started/install/) で `juiz` コマンドを入れておいてください。

## サンプルをビルドする

```sh
git clone https://github.com/OpenJUIZ/juiz_examples_rust.git
cd juiz_examples_rust
cargo build
```

各サンプルは共有ライブラリとしてビルドされ、juiz がプラグインとして読み込みます。
設定ファイルは `./target/debug` からプラグインを探すので、リポジトリのルートで `juiz` を実行します。

## 起動する

```sh
juiz -f increment_process.conf -d
```

`increment_process` は引数に 1 を足して返すだけの Process です。
`-d` を付けると、HTTP ブローカーを 8000 番ポートで立ち上げて待機します（Ctrl+C で終了）。

## 呼び出す

ブラウザで次の URL を開くと、Swagger UI から Process を呼び出して結果を確かめられます。

```
http://127.0.0.1:8000/docs
```

Swagger UI は juiz 0.0.17 以降で使えます。0.0.16 以前では http://127.0.0.1:8000/api-docs/openapi.json で OpenAPI 定義だけを取得できます。

## 管理画面で見る

juiz 0.0.19 以降なら、ブラウザで次の URL を開くと、動いている Process や接続を管理画面で確かめられます。詳しくは [管理画面](/ja/guides/web-ui/) を見てください。

```
http://127.0.0.1:8000/ui/
```

## ほかの言語のサンプル

- Python: [juiz_examples_python](https://github.com/OpenJUIZ/juiz_examples_python)
- C++: [juiz_examples_cpp](https://github.com/OpenJUIZ/juiz_examples_cpp)
