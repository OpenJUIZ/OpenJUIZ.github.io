---
title: Configuration file
description: Load several Processes and Containers together with a YAML configuration file.
sidebar:
  order: 3
---

To run several building blocks together, write a configuration file (`.conf`) in YAML and pass it with `-f`.

```sh
juiz -f system.conf -d
```

## Example

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

## Entries

| Entry | Meaning |
|---|---|
| `name` | Name of the system |
| `namespace` | Default namespace for the whole System. It can also be set on each element (see [Namespaces](/guides/namespace/), juiz 0.0.21 or later) |
| `option` | Settings for modules that run by default. Setting `start` of `http_broker` to `true` starts the HTTP broker on the port given by `port`. `pythonpath` adds places that Python Processes `import` from (relative to the plugin's directory), and `type_check.on_call` turns on type checks on calls (→ [Data types](/guides/datatype/#type-checks), juiz 0.0.23 or later). `http_broker` also takes `cors_allow_origins`, `static_filepaths` and `webui: false` (→ [Web UI](/guides/web-ui/)) |
| `brokers` | Extra brokers to start. Give `type_name`, either `qmp` (QUIC) or `ipc` (same machine), and `name`. The body size limit of the HTTP broker is `option.http_broker.max_body_bytes` (→ [Choosing a broker and large data](/guides/large-data/), IPC needs juiz 0.0.26 or later) |
| `subsystems` / `mastersystem` | Other juiz instances to connect to as subsystems (or as the master). Give `type_name` (`http`, `qmp` or `ipc`) and where it listens, as in `brokers` (→ [Choosing a broker and large data](/guides/large-data/#connecting-as-a-subsystem), [Transforms across Systems](/guides/transformations/#transforms-across-systems)) |
| `topics` | Per-Topic settings. `shared_memory` streams the Topic to other processes on the same machine through shared memory (→ [Streaming a Topic through shared memory](/guides/large-data/#streaming-a-topic-through-shared-memory), juiz 0.0.26 or later) |
| `plugins` | Shared libraries (factories) to load. `process_factories` for Processes, `container_factories` for Containers, `components` for Components (several elements in one file), `ec_factories` for Execution Contexts and `broker_factories` for brokers |
| `containers` | Instances to create from the loaded Containers, and the ContainerProcesses bound to each Container. A ContainerProcess entry can have `p_apply` |
| `processes` | Instances to create from the loaded Processes. An entry can have `p_apply`, `publishes` and `subscribes`. Keys juiz does not know are reported as a warning at startup |
| `composites` | Definitions of types (Composites) that combine existing Processes (→ [Composition](/guides/composition/), juiz 0.0.22 or later) |
| `composite_containers` | CompositeContainers that bundle references to existing Containers, and the CompositeContainerProcesses on them (→ [Composition](/guides/composition/)) |
| `transforms` | Transforms that link Containers (`source`, `destination`, `translation`, `rotation`; also `rate` and `timeout` across Systems → [Transforms across Systems](/guides/transformations/#transforms-across-systems), from juiz 0.2.1; `writers` lists the Containers that may write it with `set_transform`, from juiz 0.2.4). The Anchors at the origin of coordinates go in `containers:` with `type_name: periodic_anchor` / `static_anchor` (→ [Transformations](/guides/transformations/), from juiz 0.2.0) |
| `pose_listeners` | Pose notifications that call a Process when a Container's pose is written (→ [Transformations](/guides/transformations/#pose-notifications)) |
| `connections` | Connections from a Process's output to another Process's argument. Give `source`, `destination`, `arg_name` and `connection_type` (such as `Push`) |
| `ecs` | Execution Contexts. Give `type_name` (such as `main_loop_ec`), `rate` [Hz], `bind` (the Processes to run) and `auto_start` |

A factory's shared library is looked up by "the name of the type it provides + extension".

## Initial argument values (p_apply)

In a `processes` entry, or a `processes` entry inside `containers`, `p_apply` gives initial values to the instance's arguments (juiz 0.0.15 or later).

```yaml
processes:
  - type_name: "increment_process"
    name: "inc0"
    p_apply:
      arg1: 10
```

The values are used when the Process is executed without arguments, for example from an Execution Context. A call that passes arguments uses the passed values. Values pushed through `connections` overwrite them.
If `p_apply` names an argument the Process does not have, `juiz` fails at startup.
