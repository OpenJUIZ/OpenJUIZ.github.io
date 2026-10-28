---
title: juiz の考え方
description: Process、Container、ContainerProcess と、connect / call という 2 つの使い方。
sidebar:
  order: 1
---

juiz は、ROS の Node のような「状態と振る舞いをひとまとめにしたコンポーネント」を分解し、
振る舞いを **Process**、状態を **Container** として扱います。

## Process

Process は、入力（引数）と出力を持つ冪等な関数です。同じ引数を与えれば同じ結果を返します。
状態を持たないので、テストしやすく、組み合わせても振る舞いが予測しやすくなります。

:::note
Process は、以前の発表では「Operation」と呼んでいました。
:::

## Container と ContainerProcess

状態を保持したいときは Container を使います。Container は状態を表すデータ（構造体）で、
その状態を読み書きするのは Container に結びついた **ContainerProcess** です。
状態に触れる処理が ContainerProcess に限られるので、どこで状態が変わるのかが明確になります。

## 2 つの使い方

- **connect**: Process の出力を別の Process の入力につなぎ、データフローとしてロボットを動かします。ROS などのロボット用ミドルウェアに近い開発スタイルです。
- **call**: 外部から Process を呼び出して結果を受け取ります。サーバー・クライアント型のソフトウェアに近い開発スタイルです。

## Broker と Execution Context

- **Broker** は Process や Container をネットワーク越しに公開します。HTTP+JSON と QUIC、同じマシンの中で速く渡す IPC のブローカーを標準で提供し(→ [ブローカーの選び方と大きなデータ](/ja/guides/large-data/))、HTTP ブローカーは OpenAPI 定義を出すので Swagger UI から試せます。
- **Execution Context** は Process を実行するタイミングを決めます。周期実行の TimerEC、メインスレッドで実行する MainLoopEC、一度だけ実行する OneShotEC があります。

juiz を作った動機と設計思想は [MOTIVATION.md](https://github.com/OpenJUIZ/juiz/blob/main/MOTIVATION.md) にまとめています。
