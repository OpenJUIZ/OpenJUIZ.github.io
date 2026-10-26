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
| `option` | Settings for modules that run by default. Setting `start` of `http_broker` to `true` starts the HTTP broker on the port given by `port` |
| `plugins` | Shared libraries (factories) to load. `container_factories` for Containers, `process_factories` for Processes |
| `containers` | Instances to create from the loaded Containers, and the ContainerProcesses bound to each Container. A ContainerProcess entry can have `p_apply` |
| `processes` | Instances to create from the loaded Processes. An entry can have `p_apply` |
| `composites` | Definitions of types (Composites) that combine existing Processes (→ [Composition](/guides/composition/), juiz 0.0.22 or later) |
| `composite_containers` | CompositeContainers that bundle references to existing Containers, and the CompositeContainerProcesses on them (→ [Composition](/guides/composition/)) |
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
