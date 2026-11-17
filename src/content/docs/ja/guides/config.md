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
| `option` | 既定で動くモジュールの設定。`http_broker` の `start` を `true` にすると、`port` で指定したポートで HTTP ブローカーが起動します。`pythonpath` は Python の Process が `import` する場所の追加(プラグインの場所から見た相対パス)、`type_check.on_call` は呼び出し時の型の検査(→ [データ型](/ja/guides/datatype/#型の検査)、juiz 0.0.23 以降)。`http_broker` には `cors_allow_origins`・`static_filepaths`・`webui: false` も書ける(→ [管理画面](/ja/guides/web-ui/))。ポートが使われていたときの動作は `port_fallback`・`adopt_master`(→ [ポートが使われていたとき](#ポートが使われていたとき)、juiz 0.3.0 から) |
| `brokers` | 追加で立てるブローカー。`type_name` が `qmp`(QUIC)か `ipc`(同じマシンの中)で、`name` を書く。HTTP ブローカーの本文の上限は `option.http_broker.max_body_bytes`(→ [ブローカーの選び方と大きなデータ](/ja/guides/large-data/)、IPC は juiz 0.0.26 以降) |
| `subsystems` / `mastersystem` | サブシステム(または親)としてつなぐ別の juiz。`brokers` と同じく `type_name`(`http`・`qmp`・`ipc`)と待ち受け先を書く(→ [ブローカーの選び方と大きなデータ](/ja/guides/large-data/#サブシステムとしてつなぐ)、[System をまたぐ Transform](/ja/guides/transformations/#system-をまたぐ-transform)) |
| `topics` | Topic ごとの設定。`shared_memory` で、同じマシンの別プロセスへ共有メモリで流す(→ [共有メモリで Topic を流す](/ja/guides/large-data/#共有メモリで-topic-を流す)、juiz 0.0.26 以降) |
| `plugins` | 読み込む共有ライブラリ（ファクトリー）の定義。`process_factories` は Process、`container_factories` は Container、`components` は Component(複数の要素をまとめた 1 ファイル)、`ec_factories` は Execution Context、`broker_factories` はブローカー |
| `containers` | 読み込んだ Container を実体化する定義と、その Container に結びつく ContainerProcess。ContainerProcess の項目には `p_apply` を書ける |
| `processes` | 読み込んだ Process を実体化する定義。`p_apply`・`publishes`・`subscribes` を書ける。juiz の知らないキーは起動時に警告が出る |
| `composites` | 既にある Process を組み合わせた型(Composite)の定義(→ [Composition](/ja/guides/composition/)、juiz 0.0.22 以降) |
| `composite_containers` | 既存の Container への参照を束ねた CompositeContainer と、その上の CompositeContainerProcess(→ [Composition](/ja/guides/composition/)) |
| `transforms` | Container 同士をつなぐ Transform(`source`・`destination`・`translation`・`rotation`、System をまたぐときは `rate`・`timeout` も。→ [System をまたぐ Transform](/ja/guides/transformations/#system-をまたぐ-transform)、juiz 0.2.1 から。`writers` は `set_transform` で書ける Container、juiz 0.2.4 から)。座標の原点の Anchor は `containers:` に `type_name: periodic_anchor` / `static_anchor` で書く(→ [Transformations](/ja/guides/transformations/)、juiz 0.2.0 から) |
| `pose_listeners` | Container の位置姿勢が書かれたら Process を呼ぶ Pose 通知(→ [Transformations](/ja/guides/transformations/#pose-通知)) |
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

## ポートが使われていたとき

:::note[juiz 0.3.0 から使えます]
:::

ブローカーの待ち受けるポートがもう使われていると、juiz は次の空いている番号で取り直します。さらに、そのポートにいたのが juiz なら、その juiz の subsystem としてつながります(相手を `mastersystem` にします)。これが既定の動作で、ブローカーごとにそれぞれ禁止できます。

```yaml
option:
  http_broker:
    start: true
    port: 8000
    port_fallback: next     # next(既定)か error
    adopt_master: true      # true(既定)か false
brokers:
  - type_name: qmp
    port: 3000
    port_fallback: error    # qmp も同じ 2 つを書ける
    adopt_master: false
```

| 設定 | 値 | 意味 |
| --- | --- | --- |
| `port_fallback` | `next`(既定) | 使われていたら 1 ずつ足して取り直す(元の番号 + 100 まで) |
| | `error` | 使われていたら起動を止める |
| `adopt_master` | `true`(既定) | ポートにいたのが juiz なら、その juiz の subsystem になる |
| | `false` | juiz がいても親にはしない(番号を取り直すだけ) |

- 相手が juiz かは、`/api/system/profile` に 1 秒まで問い合わせて確かめます。juiz 以外のプログラムを親にすることはありません。
- 設定ファイルに `mastersystem` を書いていれば、`adopt_master` によらずそちらを親にします。
- コマンドラインの `--no-port-fallback` はすべてのブローカーを `port_fallback: error` に、`--no-adopt-master` はすべてのブローカーを `adopt_master: false` にします。`juiz -f` と `juiz run` のどちらにも付けられ、設定ファイルより優先します。
- `juiz run` で起動したときの `adopt_master` の既定は、基礎パッケージと、`depends` の基礎につなぐアプリでは `false` です(基礎がつなぎ返して親になるので、親が 2 つになるのを避けるため)。`juiz run` では、このほかに起動前の確認と選択があります([アプリの配布](/ja/guides/app-package/#ポートが使われていたとき))。

番号を変えたときと、親にしたときは、ログの設定によらず標準エラーに出ます。

```text
warning: port 8000 is in use; the HTTP broker uses 8001
joined the juiz at 127.0.0.1:8000 as its subsystem
```

`port_fallback: error` で止まったときや、権限が無いなど使用中以外の理由で待ち受けられなかったときは、理由を書いたエラーで止まります。

```text
port 8000 for the HTTP broker is in use (by a juiz). Use another port, or remove port_fallback: error / --no-port-fallback.
cannot start the HTTP broker on 0.0.0.0:80: Permission denied (os error 13)
```
