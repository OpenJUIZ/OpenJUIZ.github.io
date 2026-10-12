---
title: Installation
description: Install the juiz command and the packages for writing components in each language.
sidebar:
  order: 1
---

## Requirements

- Linux or macOS
- Rust 1.81 or later (install with [rustup](https://rustup.rs/))
- For Python components: Python 3 with development headers (`sudo apt install python3-dev python3-venv` on Ubuntu)
- For C++ components: CMake and a C++17 compiler

## The juiz command

Install `juiz_app` from crates.io.

```sh
cargo install juiz_app
```

The `juiz` command is installed into `~/.cargo/bin`.

## Language packages

### Rust

Write components with the [juiz_sdk](https://crates.io/crates/juiz_sdk) crate, built as a shared library.

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
juiz_sdk = "0.0.9"
```

### Python

Use [pyjuiz](https://pypi.org/project/pyjuiz/) from PyPI. The `juiz` command embeds the Python it found at build time, so install pyjuiz into that same Python.

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install pyjuiz
```

### C++

The C++ header `juiz/juiz.h` lives in `bindings/cppjuiz/include` of the juiz repository.

## Building from source

```sh
git clone https://github.com/OpenJUIZ/juiz.git
cd juiz
cargo build
cargo install --path juiz_app
```
