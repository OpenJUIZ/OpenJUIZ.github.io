---
title: Glossary
description: Short explanations of the juiz terms used in the tutorial and guides, such as Process, Container, Execution Context, call, execute, call_partial and p_apply.
sidebar:
  order: 2
---

A short list of the terms used in the tutorial and guides.
For the big picture, see [How juiz works](/concepts/overview/). The web UI shows many of these terms with Japanese names; they are given in brackets.

## Building blocks

### Process (処理)

A function that takes arguments and returns a result, and is idempotent: with the same arguments it always returns the same result. It is the basic unit that runs in juiz. → [Chapter 1](/tutorial/first-process/)

### Container (容器)

A building block that holds state (data). A Container has no processing of its own; ContainerProcesses read and write its state. → [Chapter 2](/tutorial/container/)

### ContainerProcess

A Process bound to one Container that reads and writes its state. You create instances for each Container. One that does not change the state can be marked `readonly`. → [Chapter 2](/tutorial/container/)

### Type and instance

A type is how a Process or Container is made (its code). The name of a function marked with `#[juiz_component_process]`, for example, becomes the **type name**. An instance is a named object created from a type, and its name is the **instance name**. One type can produce many instances with different names. → [Chapter 3](/tutorial/config-file/)

### Component

A library that bundles several types (Processes, Containers and ContainerProcesses). The skeletons made by `juiz pkg create` are written as Components. → [Chapter 5](/tutorial/component/)

### Plugin

A shared library (`.so`, `.dylib` or `.dll`) or a Python file that `juiz` loads. You list plugins under `plugins` in the configuration file.

### ID (identifier)

A name in the form of a URL that points to a running instance, such as `http://127.0.0.1:8000/process/my_juiz_add0::my_juiz_add`. It contains where the broker is, the kind of object, the instance name and the type name. To point inside the broker itself, it starts with `core://core`.

### Namespace (名前空間)

A prefix such as `robot1/` placed before an instance name. It lets you keep instances with the same name apart, for example one set per robot. → [Guide](/guides/namespace/)

## Ways to run

### call

Passing arguments to a Process from outside, running it and getting the result back. Arguments you leave out take the **default values** written in the type. `p_apply` values are not used. → [Chapter 1](/tutorial/first-process/)

### execute (実行)

Running a Process without passing arguments. The arguments take the values put in by `p_apply` or by connections (or the defaults if there are none). An Execution Context runs Processes this way. → [Chapter 3](/tutorial/config-file/)

### call_partial

Calling a Process with only some of the arguments and getting the result back. Arguments you leave out are filled in from the values put in by `p_apply` or by connections (or the defaults). The values you pass do not overwrite those values. The command is `juiz process call-partial`. → [Chapter 3](/tutorial/config-file/)

### Default value

The initial value of an argument written in the type's definition (in Rust, `arguments = { default = { ... } }`). It is used for arguments left out of a call.

### p_apply and bound values

`p_apply` puts values into an instance's arguments from the configuration file. The values put in this way are called **bound values** (拘束値); execute and call_partial use them for arguments that are not passed. The web UI shows them in the "拘束値" column of the argument table. → [Chapter 3](/tutorial/config-file/)

### Execution Context (EC, 実行文脈)

A building block that decides when to run Processes. `main_loop_ec` executes the Processes `bind`-ed to it at a fixed rate, and `one_shot_ec` executes them once. → [Chapter 4](/tutorial/connect/)

### connect (接続)

Connecting the output of a Process to an argument of another Process, so that the robot runs as a flow of data. → [Chapter 4](/tutorial/connect/)

### Push and Pull (押込・引込)

The two kinds of connection. With Push, when the source runs, its output is passed to the destination and the destination runs too. With Pull, when the destination runs, it runs the source to fetch the value.

### Topic (話題) and publish / subscribe (発行・購読)

A named channel. A Process sends its output under a name (publish), and it is delivered to the arguments of the Processes that receive that name (subscribe). Senders and receivers are connected without knowing each other's IDs. In the configuration file, write them under `publishes` and `subscribes`.

## Starting and communicating

### Configuration file (conf)

The YAML file you pass to `juiz -f`. It says what to load (`plugins`), what to create (`processes`, `containers`, `ecs`) and how to connect them (`connections`). → [Chapter 3](/tutorial/config-file/), [Guide](/guides/config/)

### System (系)

Everything in one `juiz` process: its instances, brokers and so on. When you connect another System as a **subsystem**, you can call its instances by ID as well. → [Chapter 6](/tutorial/multi-process/)

### Broker (仲介)

A building block that exposes the contents of a System so that they can be called from outside. There are HTTP (`http`), IPC (`ipc`, fast within one machine), Zenoh (`zenoh`, fast to other machines) and QUIC (`qmp`). → [Choosing a broker](/guides/large-data/)

### Web UI

The screen `juiz` serves at `http://localhost:8000/ui/`. You can see what is running as a list and a diagram, and call Processes. → [Guide](/guides/web-ui/)

### juiz pkg

The command that creates a project skeleton for writing Processes and Containers (`juiz pkg create`, `juiz pkg add`). → [Guide](/guides/pkg/)

### .juizapp

A file for distribution that bundles the building blocks and the configuration file. You can run it with just `juiz run`. → [Guide](/guides/app-package/)
