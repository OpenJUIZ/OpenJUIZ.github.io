---
title: Quick start
description: Build the examples and run a Process with juiz.
sidebar:
  order: 2
---

This page runs a Process from the Rust examples, [juiz_examples_rust](https://github.com/OpenJUIZ/juiz_examples_rust).
Install the `juiz` command first (see [Installation](/getting-started/install/)).

## Build the examples

```sh
git clone https://github.com/OpenJUIZ/juiz_examples_rust.git
cd juiz_examples_rust
cargo build
```

Each example is built as a shared library that juiz loads as a plugin.
The config files look for plugins in `./target/debug`, so run `juiz` from the repository root.

## Run

```sh
juiz -f increment_process.conf -d
```

`increment_process` simply adds 1 to its argument. With `-d`, juiz starts an HTTP broker on port 8000 and waits (Ctrl+C to quit).

## Call it

Open this URL to call the Process from Swagger UI:

```
http://127.0.0.1:8000/docs
```

Swagger UI is available in juiz 0.0.17 and later. In 0.0.16 and earlier, only the OpenAPI definition is available at http://127.0.0.1:8000/api-docs/openapi.json.

## See it in the web UI

With juiz 0.0.19 or later, open this URL to inspect the running Processes and connections in the web UI. See [Web UI](/guides/web-ui/) for details.

```
http://127.0.0.1:8000/ui/
```

## Examples in other languages

- Python: [juiz_examples_python](https://github.com/OpenJUIZ/juiz_examples_python)
- C++: [juiz_examples_cpp](https://github.com/OpenJUIZ/juiz_examples_cpp)
