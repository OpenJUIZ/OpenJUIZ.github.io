---
title: 用語集
description: チュートリアルやガイドに出てくる juiz の用語(Process・Container・Execution Context・call・execute・call_partial・p_apply など)を短く説明します。
sidebar:
  order: 2
---

チュートリアルやガイドに出てくる用語を、短くまとめました。
考え方の全体像は [juiz の考え方](/ja/concepts/overview/) を見てください。管理画面では、多くの用語が日本語の名前(括弧内)で表示されます。

## 部品

### Process(処理)

引数を受け取って結果を返す、冪等な関数です。同じ引数なら、いつも同じ結果を返します。juiz で動くものの基本の単位です。→ [第 1 章](/ja/tutorial/first-process/)

### Container(容器)

状態(データ)を持つ部品です。Container 自身は処理を持たず、状態の読み書きは ContainerProcess が受け持ちます。→ [第 2 章](/ja/tutorial/container/)

### ContainerProcess

1 つの Container に結びつき、その状態を読み書きする Process です。Container ごとにインスタンスを作ります。状態を書き換えないものには `readonly` を付けられます。→ [第 2 章](/ja/tutorial/container/)

### 型とインスタンス

型は Process や Container の作り方(コード)です。`#[juiz_component_process]` を付けた関数の名前などが**型名**になります。インスタンスは、型から作った名前の付いた実体で、その名前が**インスタンス名**です。1 つの型から、名前の違うインスタンスをいくつも作れます。→ [第 3 章](/ja/tutorial/config-file/)

### Component

複数の型(Process・Container・ContainerProcess)を 1 つのライブラリにまとめたものです。`juiz pkg create` の雛形は Component の形で書かれています。→ [第 6 章](/ja/tutorial/component/)

### プラグイン

`juiz` が読み込む共有ライブラリ(`.so`・`.dylib`・`.dll`)や Python のファイルです。設定ファイルの `plugins` に書きます。

### ID(識別子)

動いているインスタンスを指す URL の形の名前です。`http://127.0.0.1:8000/process/my_juiz_add0::my_juiz_add` のように、ブローカーの場所・種類・インスタンス名・型名が入ります。ブローカー自身の中を指すときは先頭が `core://core` になります。

### ネームスペース(名前空間)

インスタンス名の前に付ける区切り(`robot1/` など)です。同じ名前のインスタンスを、ロボットごとなどに分けられます。→ [ガイド](/ja/guides/namespace/)

## 動かし方

### call

外から Process に引数を渡して実行し、結果を受け取る使い方です。渡さなかった引数には、型に書かれた**既定値**が入ります。`p_apply` の値は使いません。→ [第 1 章](/ja/tutorial/first-process/)

### execute(実行)

引数を渡さずに Process を実行することです。引数には、`p_apply` や接続で入った値(なければ既定値)が使われます。Execution Context は Process をこの方法で動かします。→ [第 3 章](/ja/tutorial/config-file/)

### call_partial

一部の引数だけを渡して実行し、結果を受け取る呼び方です。渡さなかった引数は `p_apply` や接続で入った値(なければ既定値)で補います。渡した値で、それらの値は書き換わりません。コマンドでは `juiz process call-partial` です。→ [第 3 章](/ja/tutorial/config-file/)

### 既定値

型の定義に書いた、引数の初期の値です(Rust なら `arguments = { default = { ... } }`)。call で省いた引数に使われます。

### p_apply と拘束値

`p_apply` は、設定ファイルでインスタンスの引数に値を入れておく書き方です。入れておいた値を**拘束値**と呼び、execute や call_partial で、渡されなかった引数に使われます。管理画面の引数の表にも「拘束値」として出ます。→ [第 3 章](/ja/tutorial/config-file/)

### Execution Context(EC、実行文脈)

Process をいつ実行するかを決める部品です。`main_loop_ec` は決まった周期で、`one_shot_ec` は一度だけ、`bind` した Process を execute します。→ [第 5 章](/ja/tutorial/connect/)

### connect(接続)

Process の出力を、別の Process の引数につなぐ使い方です。データの流れとしてロボットを動かします。→ [第 4 章](/ja/tutorial/multi-process/)・[第 5 章](/ja/tutorial/connect/)

### Push と Pull(押込・引込)

接続の種類です。Push は、送り元が実行されたら、その出力を送り先に渡して送り先も実行します。Pull は、送り先が実行されるときに、送り元を実行して値を取ってきます。→ [第 5 章](/ja/tutorial/connect/)

### Topic(話題)と publish / subscribe(発行・購読)

名前の付いた通り道で、Process の出力を名前で流し(publish)、その名前を受け取る Process の引数に届けます(subscribe)。送り手と受け手が互いの ID を知らなくてもつながります。設定ファイルでは `publishes`・`subscribes` に書きます。→ [第 4 章](/ja/tutorial/multi-process/)

## 起動と通信

### 設定ファイル(conf)

`juiz -f` に渡す YAML のファイルです。何を読み込むか(`plugins`)、何を作るか(`processes`・`containers`・`ecs`)、どうつなぐか(`connections`)を書きます。→ [第 3 章](/ja/tutorial/config-file/)・[ガイド](/ja/guides/config/)

### System(系)

1 つの `juiz` のプロセスの中にある、インスタンス・ブローカーなど全体のことです。別の System を**サブシステム**としてつなぐと、相手のインスタンスも ID で呼べます。設定ファイルでは `subsystems`・`mastersystem` に書きます。→ [第 4 章](/ja/tutorial/multi-process/)

### Broker(仲介)

System の中身を外に公開し、外から呼び出せるようにする部品です。HTTP(`http`)、同じマシンの中で速い IPC(`ipc`)、別のマシンへ速い Zenoh(`zenoh`)、QUIC(`qmp`)があります。→ [ブローカーの選び方](/ja/guides/large-data/)

### 管理画面

`juiz` が `http://localhost:8000/ui/` で出す画面です。動いているものの一覧と図を見たり、Process を呼び出したりできます。→ [ガイド](/ja/guides/web-ui/)

### juiz pkg

Process や Container を書くプロジェクトの雛形を作るコマンドです(`juiz pkg create`・`juiz pkg add`)。→ [ガイド](/ja/guides/pkg/)

### .juizapp

部品と設定ファイルをまとめた配布用のファイルです。`juiz run` だけで動かせます。→ [ガイド](/ja/guides/app-package/)
