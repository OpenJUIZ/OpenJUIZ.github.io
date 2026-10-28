---
title: How juiz works
description: Process, Container, ContainerProcess, and the two ways to use them, connect and call.
sidebar:
  order: 1
---

juiz takes apart the kind of component that bundles state and behavior together (like a ROS Node),
and treats behavior as a **Process** and state as a **Container**.

## Process

A Process is an idempotent function with inputs (arguments) and outputs: the same arguments always give the same result.
Because it holds no state, it is easy to test and predictable when combined with others.

:::note
Earlier talks called the Process an "Operation".
:::

## Container and ContainerProcess

When you need to keep state, use a Container: a piece of data (a struct) that holds the state.
Only the **ContainerProcesses** bound to a Container read or write it, so it is always clear where state changes.

## Two ways to use it

- **connect**: wire one Process's output to another's input and drive the robot as a dataflow, much like ROS and other robot middleware.
- **call**: call a Process from outside and receive its result, much like client/server software.

## Brokers and Execution Contexts

- A **Broker** exposes Processes and Containers over the network. HTTP+JSON, QUIC and same-machine IPC brokers are built in (see [Choosing a broker and large data](/guides/large-data/)), and the HTTP broker serves an OpenAPI definition you can try from Swagger UI.
- An **Execution Context** decides when a Process runs: TimerEC runs it periodically, MainLoopEC on the main thread, and OneShotEC once.

The motivation and design philosophy behind juiz are in [MOTIVATION.md](https://github.com/OpenJUIZ/juiz/blob/main/MOTIVATION.md) (Japanese).
