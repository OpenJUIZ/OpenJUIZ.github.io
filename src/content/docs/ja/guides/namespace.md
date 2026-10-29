---
title: ネームスペース
description: ネームスペースを使って、同じ名前の Process や Container を 1 つの System の中に並べて置きます。
sidebar:
  order: 5
---

ネームスペースを使うと、同じインスタンス名の Process・Container・Execution Context・Topic を、1 つの System の中に並べて置けます。
使い方は大きく 2 つあります。

- **同じ構成の複製**: 1 台の PC で 2 台のロボットを動かすとき、同じ設定ファイルを `robot1` と `robot2` に読み込みます(ROS の namespace に近い使い方です)。
- **整理**: 機能のまとまりごとにネームスペースを分け、CLI や管理画面でグループとして見ます。

:::caution[juiz 0.0.21 以降が必要です]
ネームスペースは juiz 0.0.21 から使えます。ネームスペースを使わなければ、ID・Topic 名・設定ファイルは今までと同じです。
:::

## ID の形

ネームスペースは、ID のインスタンス名の前に `/` 区切りで入ります。

```text
core://core/process/inc0::increment                     # ルート(ネームスペースなし)
core://core/process/robot1/inc0::increment              # robot1 の inc0
http://127.0.0.1:8000/process/robot1/arm/inc0::increment # robot1/arm の inc0
```

- ネームスペースは `/` 区切りの階層です(`robot1/arm`)。空ならルートで、今までの ID とまったく同じ文字列になります。
- 最後の `/` の後ろがインスタンス名、その前がネームスペースです。
- ContainerProcess は、所属する Container と同じネームスペースに置かれます。
- インスタンス名とネームスペースの各要素には `/` `:` `|` を使えません。使うと起動時にエラーになります。
- 同じ ID のものを 2 つ登録するとエラーになります。

## 設定ファイルの `namespace`

各要素に `namespace` を書きます。トップレベルの `namespace` は、System 全体の既定のネームスペースです(省略するとルート)。

```yaml
namespace: robot1          # 既定のネームスペース
processes:
  - type_name: increment_process
    name: inc0             # => robot1/inc0
  - type_name: increment_process
    name: inc1
    namespace: arm         # 相対指定 => robot1/arm/inc1
  - type_name: increment_process
    name: inc0
    namespace: /tools      # 先頭が / なら絶対指定 => tools/inc0
```

| 書き方 | 意味 |
|---|---|
| 書かない | 既定のネームスペース |
| `arm`(相対) | 既定のネームスペースの下(`robot1/arm`) |
| `/tools`(絶対) | ルートからの指定(`tools`) |
| `/` | ルート |

`connections` の `source`・`destination` と `ecs` の `bind` に名前で書いた参照は、その Connection や Execution Context のネームスペースで解決されます。
別のネームスペースのものを指すときは、参照の中にも `namespace` を書きます。

```yaml
ecs:
  - name: ec0
    type_name: main_loop_ec
    rate: 1.0
    bind:
      - name: talker0
        namespace: robot1
        type_name: talker
      - name: talker0
        namespace: robot2
        type_name: talker
```

ID を文字列(`identifier` キー)で直接書いた参照は、そのまま使われます。

## Topic

Topic 名も同じ規則で解決されます。

- `chatter` は、その Process のネームスペースの下(`robot1/chatter`)。
- `/chatter` はルート。

`robot1` の `chatter` と `robot2` の `chatter` は別の Topic なので、同じ設定を 2 つのネームスペースに置いても混ざりません。
ネームスペースをまたいでやり取りしたいときは、`/chatter` のように絶対指定にします。
既定のネームスペースがルートなら、Topic 名は今までと同じです。

```yaml
processes:
  - type_name: talker
    name: talker0
    namespace: robot1
    publishes: [chatter]      # => robot1/chatter
  - type_name: listener
    name: listener0
    namespace: robot1
    subscribes:
      arg1: chatter           # => robot1/chatter
```

サブシステムをまたいだ publish / subscribe も、解決した後の名前(`robot1/chatter`)で行われます。

## CLI

### 同じ設定ファイルを別のネームスペースで起動する

`--namespace` を付けると、設定ファイルの既定のネームスペースを置き換えて起動します(連結ではなく置き換えです。`/` ならルート)。

```sh
juiz -f increment_process.conf --namespace robot1 -d
```

別のターミナルで、同じ設定ファイルを `robot2` で起動します。2 つ目は 1 つ目のサブシステムになり(8001 番ポート)、1 つの System として扱えます。

```sh
juiz -f increment_process.conf --namespace robot2 -d
```

### 一覧と呼び出し

`list` の `--namespace` で、そのネームスペースとその下だけに絞り込めます。`--long` を付けると、ネームスペース・名前・型の列つきの表になります。
`process` のほか、`container`・`container-process`・`ec` の `list` でも使えます。

```sh
juiz process list --namespace robot2
# => ["http://127.0.0.1:8001/process/robot2/increment0::increment_process"]

juiz process list --long
# NAMESPACE  NAME        TYPE               ID
# /robot1    increment0  increment_process  http://127.0.0.1:8000/process/robot1/increment0::increment_process
# /robot2    increment0  increment_process  http://127.0.0.1:8001/process/robot2/increment0::increment_process
```

呼び出すときは、ネームスペース付きの ID を渡します。

```sh
juiz process call "http://127.0.0.1:8000/process/robot1/increment0::increment_process" '{"arg1": 1}' -p
# => CapsulePtr((value:Value(2), option: []))
```

HTTP API でも、list に `?namespace=robot1` を付けると同じように絞り込めます。

## Python (pyjuiz)

```python
from juiz.proxy import SystemProxy, HttpProxy, ProcessProxy

system = SystemProxy(HttpProxy('localhost', 8000))
system.processes(namespace='robot1')   # robot1 とその下の Process

p = ProcessProxy('inc0', 'localhost', 8000, namespace='robot1')
# または ProcessProxy('robot1/inc0', 'localhost', 8000)
p.namespace()   # => 'robot1'
p.full_name()   # => 'robot1/inc0'
```

ネームスペースを指定しないとルートのものが優先されます。ルートに無く、複数のネームスペースに同じ名前があるときは `AmbiguousNameError` になります。

## 管理画面

[管理画面](/ja/guides/web-ui/)では、ツリーの分類(処理、容器、実行文脈、話題)の下にネームスペースがフォルダとして並びます。性質欄には「名前空間」が出ます(ルートなら「ルート」)。システム図ではネームスペース付きの名前で表示されます。

![管理画面。ツリーに robot1・robot2 のフォルダが並び、図にはネームスペース付きの名前が出る](../../../../assets/namespace/web-ui.png)

## IPC ブローカーの `namespace` との違い

0.0.26 より前の IPC ブローカーの設定には `namespace` というキーがあり、ソケットファイルの名前(`/tmp/<namespace>`)を表していました。ここで説明した ID のネームスペースとは関係ありません。紛らわしいため 0.0.26 で廃止し、IPC ブローカーの名前は `name` で決めます(→ [ブローカーの選び方と大きなデータ](/ja/guides/large-data/#ipc-ブローカーを使う))。

## サンプル

どの言語のサンプルリポジトリにも `namespace.conf` があります。`talker0` と `listener0` を `robot1` と `robot2` に置き、Topic `chatter` でつなぐ例で、それぞれの `listener0` には同じネームスペースの `talker0` の出力だけが届きます。
README には、同じ設定ファイルを `--namespace robot1` と `--namespace robot2` で 2 つ起動する例もあります。

| 言語 | リポジトリ | 型の名前 |
|---|---|---|
| Rust | [juiz_examples_rust](https://github.com/OpenJUIZ/juiz_examples_rust) | `talker` / `listener` |
| Python | [juiz_examples_python](https://github.com/OpenJUIZ/juiz_examples_python) | `talker_python` / `listener_python` |
| C++ | [juiz_examples_cpp](https://github.com/OpenJUIZ/juiz_examples_cpp) | `talker_cpp` / `listener_cpp` |
| Haskell | [juiz_examples_haskell](https://github.com/OpenJUIZ/juiz_examples_haskell) | `talker_hs` / `listener_hs` |

サンプルの用意のしかたは、[クイックスタート](/ja/getting-started/quickstart/) の各言語のページを見てください。

```sh
juiz -f namespace.conf -d
# talker: Hello from robot1
# listener: Hello from robot1
# talker: Hello from robot2
# listener: Hello from robot2
# ...
```
