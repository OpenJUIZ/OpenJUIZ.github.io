---
title: 設定ファイル
description: 複数の Process や Container を YAML の設定ファイルでまとめて読み込みます。
sidebar:
  order: 3
---

複数の機能要素をまとめて動かすときは、YAML 形式の設定ファイル（`.conf`）を書いて `-f` で渡します。

```sh
juiz -f system.conf -d
```

## 例

```yaml
name: "test_system"
option:
  http_broker:
    start: true
    port: 8000
plugins:
  container_factories:
    example_container:
      language: "rust"
      path: "./target/debug"
      processes:
        example_container_get:
          path: "./target/debug"
        example_container_increment:
          path: "./target/debug"
  process_factories:
    increment_process:
      path: "./target/debug"
containers:
  - type_name: "example_container"
    name: "container0"
    processes:
      - type_name: "example_container_increment"
        name: "increment0"
      - type_name: "example_container_get"
        name: "get0"
processes:
  - type_name: "increment_process"
    name: "inc0"
```

## 各項目

| 項目 | 内容 |
|---|---|
| `name` | システムの名前 |
| `option` | 既定で動くモジュールの設定。`http_broker` の `start` を `true` にすると、`port` で指定したポートで HTTP ブローカーが起動します |
| `plugins` | 読み込む共有ライブラリ（ファクトリー）の定義。`container_factories` は Container、`process_factories` は Process |
| `containers` | 読み込んだ Container を実体化する定義と、その Container に結びつく ContainerProcess |
| `processes` | 読み込んだ Process を実体化する定義 |

ファクトリーの共有ライブラリは「提供する型の名前 + 拡張子」で探されます。
