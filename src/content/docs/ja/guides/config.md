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
| `namespace` | System 全体の既定のネームスペース。各要素にも書ける(→ [ネームスペース](/ja/guides/namespace/)、juiz 0.0.21 以降) |
| `option` | 既定で動くモジュールの設定。`http_broker` の `start` を `true` にすると、`port` で指定したポートで HTTP ブローカーが起動します |
| `plugins` | 読み込む共有ライブラリ（ファクトリー）の定義。`container_factories` は Container、`process_factories` は Process |
| `containers` | 読み込んだ Container を実体化する定義と、その Container に結びつく ContainerProcess。ContainerProcess の項目には `p_apply` を書ける |
| `processes` | 読み込んだ Process を実体化する定義。`p_apply` を書ける |
| `composites` | 既にある Process を組み合わせた型(Composite)の定義(→ [Composition](/ja/guides/composition/)、juiz 0.0.22 以降) |
| `composite_containers` | 既存の Container への参照を束ねた CompositeContainer と、その上の CompositeContainerProcess(→ [Composition](/ja/guides/composition/)) |
| `connections` | Process の出力を別の Process の引数につなぐ定義。`source`・`destination`・`arg_name`・`connection_type`(`Push` など)を書く |
| `ecs` | Execution Context の定義。`type_name`(`main_loop_ec` など)・`rate` [Hz]・`bind`(実行する Process)・`auto_start` を書く |

ファクトリーの共有ライブラリは「提供する型の名前 + 拡張子」で探されます。

## 引数の初期値 (p_apply)

`processes` の項目と、`containers` の中の `processes` の項目には、`p_apply` でインスタンスの引数に初期値を与えられます(juiz 0.0.15 以降)。

```yaml
processes:
  - type_name: "increment_process"
    name: "inc0"
    p_apply:
      arg1: 10
```

この値は、引数を渡さずに Process を実行したとき(Execution Context から動かしたときなど)に使われます。引数を渡す call では、渡した値が使われます。`connections` で値が届くと上書きされます。
Process が持っていない引数の名前を書くと、`juiz` は起動時にエラーで止まります。
