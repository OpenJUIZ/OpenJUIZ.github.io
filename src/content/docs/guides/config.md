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
| `option` | Settings for modules that run by default. Setting `start` of `http_broker` to `true` starts the HTTP broker on the port given by `port` |
| `plugins` | Shared libraries (factories) to load. `container_factories` for Containers, `process_factories` for Processes |
| `containers` | Instances to create from the loaded Containers, and the ContainerProcesses bound to each Container |
| `processes` | Instances to create from the loaded Processes |
| `connections` | Connections from a Process's output to another Process's argument. Give `source`, `destination`, `arg_name` and `connection_type` (such as `Push`) |
| `ecs` | Execution Contexts. Give `type_name` (such as `main_loop_ec`), `rate` [Hz], `bind` (the Processes to run) and `auto_start` |

A factory's shared library is looked up by "the name of the type it provides + extension".
