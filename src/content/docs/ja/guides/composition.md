---
title: Composition
description: 既にある Process を、関数を書き換えずに式の木として組み合わせ、1 つの Process の型にします。
sidebar:
  order: 6
---

Composition を使うと、既にある Process や ContainerProcess を**関数を書き換えずに組み合わせ、1 つの Process の型**にできます。
組み合わせてできた型を **Composite** と呼びます。Composite のインスタンスは普通の Process と同じように置いて、call・接続・Execution Context への bind・p_apply・Topic・ブローカー越しの呼び出しができます。

```text
inc_twice(arg1) = increment_process(increment_process(arg1))
```

:::caution[juiz 0.0.22 以降が必要です]
設定ファイルでの定義(`composites:` / `composite_containers:`)と CLI・管理画面での表示は juiz 0.0.22 から使えます。
実行中の juiz への定義([実行中に定義する](#実行中に定義する))と、プロセス内の受け渡しで変換を省く[遅延評価](/ja/guides/lazy-evaluation/)は、0.0.23 から使えます。
:::

## 考え方

- Composite は**型(Factory)**として登録します。インスタンスは設定ファイルの `processes:` などで、普通の Process と同じように作ります。
- 組み合わせる Process(**子**)のインスタンスは作りません。子の型の本体の関数を取り出して合成するので、子はシステムに現れません。
- 組み合わせ方は**式の木**です。各段の戻り値は、親の段の引数 1 つにだけ入ります。
- 外から見ると 1 回の call で、memo も 1 つです。途中の段の値は外からは見えません。

Container を使わない Composite は **Composite Process**、ContainerProcess を含む Composite は **CompositeContainerProcess** になります。
CompositeContainerProcess は、既存の Container への参照を名前付きで束ねた **CompositeContainer** の上に置きます。

## 設定ファイルに書く

### Container を使わない例

設定ファイルの `composites:` に定義を並べます。`body` が式の木の根(一番外側の段)です。

```yaml
plugins:
  process_factories:
    increment_process:
      path: "./target/debug"
    decrement_process:
      path: "./target/debug"
composites:
  # inc_twice(arg1) = increment_process(increment_process(arg1))
  - type_name: inc_twice
    description: "1 を 2 回足す"
    body:
      process: increment_process
      args:
        arg1: { process: increment_process }   # 書かなかった内側の arg1 は、元の名前のまま公開される
  # plus_one(x) = decrement_process(inc_twice(x))
  - type_name: plus_one
    body:
      process: decrement_process
      args:
        arg1:
          process: inc_twice                   # 先に定義した Composite も子に使える
          args:
            arg1: { expose: x }                # 公開する引数の名前を x に変える
processes:
  - { type_name: inc_twice, name: inc_twice0, trace: true }
  - { type_name: plus_one, name: plus_one0 }
```

```sh
juiz process call "http://127.0.0.1:8000/process/inc_twice0::inc_twice" '{"arg1": 3}' -p
# => CapsulePtr((value:Value(5), option: []))
juiz process call "http://127.0.0.1:8000/process/plus_one0::plus_one" '{"x": 3}' -p
# => CapsulePtr((value:Value(4), option: []))
```

### 定義の項目

| キー | 必須 | 内容 |
|---|---|---|
| `type_name` | 必須 | Composite の型名。既にある型名と重なるとエラー |
| `description` | 任意 | 説明 |
| `containers` | 任意 | スロットの宣言。スロット名 → Container の型名([Container を含む例](#container-を含む例)) |
| `body` | 必須 | 式の木の根の段 |

各段(ノード)には次のキーを書きます。

| キー | 必須 | 内容 |
|---|---|---|
| `process` | 必須 | 子の型名(Process、ContainerProcess、先に定義した Composite) |
| `container` | 子が ContainerProcess のとき | 使うスロット名 |
| `args` | 任意 | 子の引数名 → 値。値は次の 3 つの形のどれか 1 つ |

| 値の形 | 意味 |
|---|---|
| `{ process: ..., container: ..., args: ... }` | 子の式。その戻り値をこの引数に渡す |
| `{ const: <値> }` | 定数で固定する。Composite の引数としては公開しない |
| `{ expose: <公開名> }` または `{ expose: { name: <公開名>, default: <値>, description: <説明> } }` | Composite の引数として公開する |

### 引数を公開する規則

Composite の引数は、子の引数から次の規則で作られます。

1. `args` に**書かなかった子の引数は、元の名前のまま公開**されます。
2. `expose` で名前を変えられます。オブジェクト形なら既定値と説明も付けられます。
3. **同じ公開名を複数の子に渡せます**。1 つの値が、その名前を持つすべての子の引数に入ります。ただし子の引数の型が全部同じでなければエラーです。
4. 元の名前のまま公開して名前がぶつかり、型が違うときはエラーになります。メッセージに両方の段の位置が出るので、`expose` で別の名前を付けてください。型が同じなら規則 3 の共有になります(意図しない共有を避けたいときも `expose` で名前を分けます)。
5. 型・既定値・説明は子の引数から引き継ぎます(最初に出てきた子のもの)。
6. 引数の並びは、下の評価順で木をたどったときに公開名が最初に出てきた順です。
7. ContainerProcess の子の Container は引数ではなく、スロットから渡します。

### 評価順

Composite を call すると、根から次の順に評価します。

- 各段では、**子の引数を宣言順に**(設定ファイルの `args` に書いた順ではありません)評価してから、その子を呼びます(深さ優先)。
- ContainerProcess は冪等とは限らないので、この順番は固定です。
- どこかの段でエラーが起きたら、そこでやめてエラーを返します。それより前に呼んだ段の副作用は取り消されません。

エラーには、木のどの段で失敗したかが付きます。位置は根を `body` として、引数名を `.` でつないだものです。

```text
Composite(capture_save) failed at body.img.img (video_capture_readandget): ...
```

### Container を含む例

「センサを読む → 制御則 → モータに出す」を 1 つの CompositeContainerProcess にまとめ、Execution Context に bind する例です(Rust サンプルの `control_loop.conf`)。

```text
follow_target(cc{sensor, motor}, target)
  = dummy_motor_drive(cc.motor,
        velocity = p_control(measured = dummy_sensor_read(cc.sensor), target, gain = 2.0))
```

```yaml
composites:
  - type_name: follow_target
    containers:                 # スロット名 → Container の型名
      sensor: dummy_sensor
      motor: dummy_motor
    body:
      process: dummy_motor_drive
      container: motor          # ContainerProcess の段は、使うスロットを書く
      args:
        velocity:
          process: p_control
          args:
            measured: { process: dummy_sensor_read, container: sensor }
            gain: { const: 2.0 }
            # target は書いていないので、元の名前と既定値のまま公開される
containers:
  - { type_name: dummy_sensor, name: sensor0 }
  - { type_name: dummy_motor, name: motor0, dt: 0.05 }
composite_containers:
  - name: robot0
    slots:                      # スロット名 → 既存の Container
      sensor: sensor0
      motor: motor0
    processes:
      - { type_name: follow_target, name: follow0 }
ecs:
  - name: ec0
    type_name: main_loop_ec
    rate: 20.0
    bind:
      - { name: follow0, type_name: follow_target, container_name: robot0 }
    auto_start: true
```

3 つの段が毎周期この順番で 1 回ずつ実行されるので、接続で組むときのように段の間のタイミングを気にする必要がありません。

`composite_containers:` の各要素には次を書きます。

| キー | 必須 | 内容 |
|---|---|---|
| `name` | 必須 | CompositeContainer の名前 |
| `namespace` | 任意 | [ネームスペース](/ja/guides/namespace/)。Container と同じ規則 |
| `slots` | 必須 | スロット名 → 参照先の Container。名前(CompositeContainer のネームスペースで解決)、ID 文字列、`{ name, namespace }` のどれか |
| `processes` | 任意 | この上に置く CompositeContainerProcess。`p_apply`・`publishes`・`subscribes` も書ける |

- 参照先はこの juiz プロセスの Container でなければなりません。型が宣言と違えばエラーです。
- 1 つの CompositeContainer に、使うスロットが違う複数の Composite を載せられます(余分なスロットがあってもかまいません)。
- スロットを持つ Composite は `processes:` には書けません。`composite_containers:` の `processes` に書きます。
- CompositeContainer は参照先の Container をロックし続けません。各段が自分の Container を自分でロックするので、段の合間に他の Process が同じ Container を触ることがあります。
- スロットから参照されている Container は削除できません(`ContainerInUseError`)。先に CompositeContainer を削除します。

### 子にできるもの・できないもの

- 子は**同じ juiz プロセスに登録された型**に限ります。サブシステムやブローカー越しの型は使えません。
- 同じ juiz プロセスの中なら、**言語の違う子を混ぜられます**(profile の `language` は `mixed` になります)。
- `composites:` の中で**先に定義した Composite** は子にできます。後ろの定義や自分自身は使えません。
- スロットを持つ Composite を子にすることは、今はできません。
- 式は木だけです。同じ部分式の結果を複数の引数に配ること(DAG)はできません。

## memo とトレース

- memo は Composite 単位です。インスタンスの `use_memo` が普通の Process と同じ意味で働きます(省略時は `false`)。
- 途中の段の値は memo しません。入力の一部だけ変わっても、全部の段を計算し直します。
- インスタンスに `trace: true` を書くと、段を評価するたびに位置と戻り値の要約をログに出します(`RUST_LOG=info` のとき)。

```text
INFO ... Composite(inc_twice) body.arg1 (increment_process) -> 4
INFO ... Composite(inc_twice) body (increment_process) -> 5
```

## 表示

- `juiz process list --long` と `juiz container-process list --long` は、Composite の行の下に式の木を出します。`juiz container list --long` は CompositeContainer のスロットと参照先を出します。`info` も同じです。

  ```text
  NAMESPACE  NAME        TYPE       ID
  /          plus_one0   plus_one   http://127.0.0.1:8000/process/plus_one0::plus_one
      decrement_process
      └─ arg1: inc_twice
         └─ arg1 = $x
  ```

  子の式は `<引数名>: <子の型>`、定数は `<引数名> = <値>`、公開した引数は `<引数名> = $<公開名>`、スロットを使う段には `[<スロット名>: <Container の型>]` が付きます。
- [管理画面](/ja/guides/web-ui/)では、性質欄の「合成(Composition)」に式の木が、CompositeContainer の「差込口(Slot)」にスロットと参照先が出ます。
- profile には `composition`(正規化した式の木)が、CompositeContainer の profile には `slots` が入ります。

## 実行中に定義する

起動している juiz に、CLI や Python から Composite を足したり消したりできます(0.0.23 以降)。定義の形は設定ファイルと同じです。

```sh
# Composite 1 件(type_name と body)か、composites: / composite_containers: を持つファイル
juiz composite create def.yaml
# created: inc_twice (process)
#   increment_process
#   └─ arg1: increment_process
#      └─ arg1 = $x
juiz composite list --long
juiz composite info inc_twice
juiz composite destroy inc_twice
juiz container destroy "core://core/container/cc0::composite_container"   # CompositeContainer を消す
```

- 作った Composite は普通の型として、`process/create`(スロットがあれば `container_process/create`)でインスタンスを作れます。
- 消せるのは Composite の型だけです。その型のインスタンスがあるとき、ほかの Composite が子として使っているときは消せません(`CompositeInUseError`)。先にそちらを消します。
- API で作る CompositeContainer の `namespace` は絶対指定として扱います。
- HTTP の API は `POST /api/composite/create`(ボディ `{"__manifest__": <定義>}`)、`GET /api/composite/list`、`GET /api/composite/profile_full?identifier=<型名>`、`DELETE /api/composite/destroy?identifier=<型名>`、`POST /api/composite_container/create` です。

Python(pyjuiz)では `SystemProxy` から呼びます。

```python
from juiz.proxy import SystemProxy, HttpProxy, ProcessProxy

system = SystemProxy(HttpProxy('localhost', 8000))
system.create_composite({
    "type_name": "inc_twice",
    "body": {"process": "increment_process",
             "args": {"arg1": {"process": "increment_process",
                               "args": {"arg1": {"expose": "x"}}}}},
})
system.create_process("inc_twice", "it0")
ProcessProxy("it0", "localhost", 8000).call(x=3)   # => 5

system.composites()            # 型名のリスト
system.composite("inc_twice")  # manifest (式の木は 'composition')
```

CompositeContainer は `system.create_composite_container({...})`(ContainerProxy を返します)で作り、`system.destroy_container(ID)` で消します。

## 接続との使い分け

| | Composition | 接続(Connection) |
|---|---|---|
| 結合する時期 | 定義するとき(型を作るとき) | 実行時(インスタンス同士) |
| 単位 | 1 つの Process(1 回の call、1 つの memo) | 段ごとに Process・memo・ロック |
| 途中の結果 | 見えない(`trace` でログに出せる) | 各段の出力として見える・他から読める |
| つなぎ替え | 定義し直す | 実行中にいつでも |
| 範囲 | 同じ juiz プロセスの中 | ブローカー越し・別プロセス・別言語 |
| 分岐 | 木だけ | 1 つの出力を何本にでも配れる(Topic もある) |
| 部分的な memo | 効かない(毎回全段を計算) | 変わっていない段は memo が効く |
| 再利用 | 型として何度でもインスタンス化できる | 構成は設定ファイルごと |

Composition が向くもの:

- 画像処理のパイプラインなど、外から 1 回の呼び出しで済ませたい処理の組
- 「センサを読む → 制御則 → モータに出す」を 1 つの Execution Context に bind して、段の順番を保証したいとき
- 既存の Process の前後に単位変換やアダプタを付けたいとき(どちらの Process も直さずに済みます)
- 内部の引数を `const` で隠し、外に出す引数を絞りたいとき

接続が向くもの:

- 途中の結果を複数の相手に配りたい、他から読みたいとき
- 別プロセス・別マシン・サブシステムの Process をつなぎたいとき
- 実行中につなぎ替えたいとき
- 重い段の memo を効かせたいとき

## 速さ

プロセス内の受け渡しは、Composite でも接続でもほぼ同じ速さです。Rust の段の間はもともと変換が入りません。
Python の段の間で値を変換しないようにする仕組みは [遅延評価](/ja/guides/lazy-evaluation/) を見てください。これは Composite 専用ではなく、接続でも同じように効きます。

## サンプル

| 言語 | リポジトリ | 設定ファイル |
|---|---|---|
| Rust | [juiz_examples_rust](https://github.com/OpenJUIZ/juiz_examples_rust) | `composite.conf`(Container なし・入れ子・`expose`・`trace`)、`control_loop.conf`(制御ループ)、`opencv_capture_oneshot_composite.conf`(カメラで撮って保存) |
| Python | [juiz_examples_python](https://github.com/OpenJUIZ/juiz_examples_python) | `image_pipeline.conf`(画像処理の 4 段を Composite と接続の 2 通りで組み、時間を比べる) |

仕様の細かい規則は juiz リポジトリの [docs/spec/composition.md](https://github.com/OpenJUIZ/juiz/blob/main/docs/spec/composition.md) にあります。
