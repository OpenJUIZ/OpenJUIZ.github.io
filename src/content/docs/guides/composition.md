---
title: Composition
description: Combine existing Processes into an expression tree and turn them into a single Process type, without rewriting their functions.
sidebar:
  order: 6
---

Composition lets you **combine existing Processes and ContainerProcesses into a single Process type without rewriting their functions**.
The resulting type is called a **Composite**. An instance of a Composite is placed like any other Process, and supports call, connections, binding to an Execution Context, p_apply, Topics and calls across brokers.

```text
inc_twice(arg1) = increment_process(increment_process(arg1))
```

:::caution[Requires juiz 0.0.22 or later]
Definitions in the configuration file (`composites:` / `composite_containers:`) and the display in the CLI and web UI are available from juiz 0.0.22.
Defining Composites in a running juiz ([Defining at run time](#defining-at-run-time)) and [lazy evaluation](/guides/lazy-evaluation/), which skips conversion within a process, are available from 0.0.23.
Type checks when a Composite is defined ([Type checks](#type-checks)) were added in 0.0.25.
:::

## The idea

- A Composite is registered as a **type (Factory)**. You create its instances under `processes:` and so on, just like an ordinary Process.
- No instances of the combined Processes (the **children**) are created. The body functions of the children's types are taken out and composed, so the children do not appear in the system.
- The combination is an **expression tree**. Each stage's return value goes into exactly one argument of its parent stage.
- From the outside it is one call with one memo. Intermediate values are not visible from outside.

A Composite without Containers is a **Composite Process**; a Composite that contains ContainerProcesses is a **CompositeContainerProcess**.
A CompositeContainerProcess sits on a **CompositeContainer**, which bundles named references to existing Containers.

## Writing it in the configuration file

### An example without Containers

List the definitions under `composites:` in the configuration file. `body` is the root (outermost stage) of the expression tree.

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
    description: "Add 1 twice"
    body:
      process: increment_process
      args:
        arg1: { process: increment_process }   # the inner arg1, not written here, is exposed under its own name
  # plus_one(x) = decrement_process(inc_twice(x))
  - type_name: plus_one
    body:
      process: decrement_process
      args:
        arg1:
          process: inc_twice                   # a Composite defined earlier can be a child
          args:
            arg1: { expose: x }                # expose the argument under the name x
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

### Definition keys

| Key | Required | Meaning |
|---|---|---|
| `type_name` | yes | Type name of the Composite. An error if it clashes with an existing type name |
| `description` | no | Description |
| `containers` | no | Slot declarations: slot name → Container type name ([An example with Containers](#an-example-with-containers)) |
| `body` | yes | The root stage of the expression tree |

Each stage (node) has these keys.

| Key | Required | Meaning |
|---|---|---|
| `process` | yes | Type name of the child (a Process, a ContainerProcess, or a Composite defined earlier) |
| `container` | when the child is a ContainerProcess | The slot to use |
| `args` | no | Child argument name → value. Each value takes exactly one of the three forms below |

| Value form | Meaning |
|---|---|
| `{ process: ..., container: ..., args: ... }` | A child expression. Its return value is passed to this argument |
| `{ const: <value> }` | Fixed to a constant. Not exposed as an argument of the Composite |
| `{ expose: <name> }` or `{ expose: { name: <name>, default: <value>, description: <text> } }` | Exposed as an argument of the Composite |

### How arguments are exposed

The Composite's arguments are built from the children's arguments by these rules.

1. **Child arguments not written in `args` are exposed under their own names.**
2. `expose` renames an argument. The object form can also give a default and a description.
3. **The same exposed name can feed several children.** One value goes to every child argument with that name. All those child arguments must have the same type, or it is an error.
4. If exposing under the original names makes names collide and the types differ, it is an error. The message shows the positions of both stages; give them different names with `expose`. If the types match, rule 3 applies and the value is shared (use `expose` to separate them if you do not want that).
5. Type, default and description come from the child argument (the first child where the name appears).
6. Arguments are ordered by where each exposed name first appears when the tree is walked in the evaluation order below.
7. The Container of a ContainerProcess child is not an argument; it comes from a slot.

### Type checks

From 0.0.25, when a Composite is defined (in the configuration file or [at run time](#defining-at-run-time)), juiz uses the children's [data types](/guides/datatype/) to check the following. If any check fails, the definition is an error (`CompositeManifestInvalidError`) and nothing is registered.

- Each child's return type can be read as the type of the parent argument that receives it. The rules are the same as for connections ([Compatibility rules](/guides/datatype/#compatibility-rules)). The error shows the position of the receiving argument (such as `body.pose`).
- `const` values and `expose` defaults match the type of the child argument.
- Arguments merged under one exposed name (rule 3) have the same type. Typed arguments that are only compatible are not merged.

If either side is untyped, nothing is compared, so Processes without types can be combined as before.

### Evaluation order

When a Composite is called, it is evaluated from the root as follows.

- At each stage, the **child's arguments are evaluated in their declared order** (not the order written in `args` in the configuration file), then the child is called (depth first).
- ContainerProcesses are not necessarily idempotent, so this order is fixed.
- If a stage fails, evaluation stops there and the error is returned. Side effects of stages already called are not undone.

The error says which stage in the tree failed. The position starts from the root `body` and joins argument names with `.`.

```text
Composite(capture_save) failed at body.img.img (video_capture_readandget): ...
```

### An example with Containers

This example combines "read a sensor → control law → drive a motor" into one CompositeContainerProcess and binds it to an Execution Context (`control_loop.conf` in the Rust examples).

```text
follow_target(cc{sensor, motor}, target)
  = dummy_motor_drive(cc.motor,
        velocity = p_control(measured = dummy_sensor_read(cc.sensor), target, gain = 2.0))
```

```yaml
composites:
  - type_name: follow_target
    containers:                 # slot name → Container type name
      sensor: dummy_sensor
      motor: dummy_motor
    body:
      process: dummy_motor_drive
      container: motor          # a ContainerProcess stage names the slot it uses
      args:
        velocity:
          process: p_control
          args:
            measured: { process: dummy_sensor_read, container: sensor }
            gain: { const: 2.0 }
            # target is not written, so it is exposed with its own name and default
containers:
  - { type_name: dummy_sensor, name: sensor0 }
  - { type_name: dummy_motor, name: motor0, dt: 0.05 }
composite_containers:
  - name: robot0
    slots:                      # slot name → existing Container
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

The three stages run once each, in this order, every cycle, so you do not have to worry about timing between stages as you would with connections.

Each entry of `composite_containers:` has these keys.

| Key | Required | Meaning |
|---|---|---|
| `name` | yes | Name of the CompositeContainer |
| `namespace` | no | [Namespace](/guides/namespace/), with the same rules as Containers |
| `slots` | yes | Slot name → referenced Container: a name (resolved in the CompositeContainer's namespace), an ID string, or `{ name, namespace }` |
| `processes` | no | CompositeContainerProcesses placed on it. `p_apply`, `publishes` and `subscribes` can be written too |

- The referenced Containers must be in this juiz process. A type that differs from the declaration is an error.
- One CompositeContainer can host several Composites that use different slots (extra slots are fine).
- A Composite with slots cannot go under `processes:`; put it under `processes` of `composite_containers:`.
- A CompositeContainer does not keep the referenced Containers locked. Each stage locks its own Container, so another Process may touch the same Container between stages.
- A Container referenced from a slot cannot be destroyed (`ContainerInUseError`). Destroy the CompositeContainer first.

### What can and cannot be a child

- Children must be **types registered in the same juiz process**. Types in subsystems or behind brokers cannot be used.
- Within the same juiz process, **children in different languages can be mixed** (the profile's `language` becomes `mixed`).
- A Composite **defined earlier** in `composites:` can be a child. Later definitions and the Composite itself cannot.
- A Composite with slots cannot be a child for now.
- Only trees are allowed. Feeding the result of one sub-expression to several arguments (a DAG) is not supported.

## Memo and trace

- Memo works per Composite. The instance's `use_memo` means the same as for an ordinary Process (default `false`).
- Intermediate values are not memoized. Even if only part of the input changes, every stage is recomputed.
- Writing `trace: true` on an instance logs the position and a summary of the return value each time a stage is evaluated (with `RUST_LOG=info`).

```text
INFO ... Composite(inc_twice) body.arg1 (increment_process) -> 4
INFO ... Composite(inc_twice) body (increment_process) -> 5
```

## Display

- `juiz process list --long` and `juiz container-process list --long` print the expression tree under each Composite row. `juiz container list --long` prints the slots of a CompositeContainer and what they refer to. `info` shows the same.

  ```text
  NAMESPACE  NAME        TYPE       ID
  /          plus_one0   plus_one   http://127.0.0.1:8000/process/plus_one0::plus_one
      decrement_process
      └─ arg1: inc_twice
         └─ arg1 = $x
  ```

  A child expression is `<argument>: <child type>`, a constant is `<argument> = <value>`, an exposed argument is `<argument> = $<exposed name>`, and a stage that uses a slot gets `[<slot>: <Container type>]`.
- In the [web UI](/guides/web-ui/), the "Composition" field of the properties panel shows the expression tree, and the "Slot" field of a CompositeContainer shows its slots and their targets.
- The profile includes `composition` (the normalized expression tree), and a CompositeContainer's profile includes `slots`.

## Defining at run time

You can add and remove Composites in a running juiz from the CLI or Python (0.0.23 or later). The definitions have the same shape as in the configuration file.

```sh
# A file with one Composite (type_name and body), or with composites: / composite_containers:
juiz composite create def.yaml
# created: inc_twice (process)
#   increment_process
#   └─ arg1: increment_process
#      └─ arg1 = $x
juiz composite list --long
juiz composite info inc_twice
juiz composite destroy inc_twice
juiz container destroy "core://core/container/cc0::composite_container"   # destroy a CompositeContainer
```

- A Composite you create is an ordinary type: create instances with `process/create` (or `container_process/create` if it has slots).
- Only Composite types can be destroyed. While instances of the type exist, or another Composite uses it as a child, it cannot be destroyed (`CompositeInUseError`); destroy those first.
- The `namespace` of a CompositeContainer created through the API is treated as absolute.
- The HTTP API is `POST /api/composite/create` (body `{"__manifest__": <definition>}`), `GET /api/composite/list`, `GET /api/composite/profile_full?identifier=<type name>`, `DELETE /api/composite/destroy?identifier=<type name>` and `POST /api/composite_container/create`.

In Python (pyjuiz), call them from `SystemProxy`.

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

system.composites()            # list of type names
system.composite("inc_twice")  # manifest (the expression tree is under 'composition')
```

Create a CompositeContainer with `system.create_composite_container({...})` (it returns a ContainerProxy) and destroy it with `system.destroy_container(ID)`.

## Composition or connections

| | Composition | Connection |
|---|---|---|
| When they are joined | At definition (when the type is made) | At run time (between instances) |
| Unit | One Process (one call, one memo) | A Process, memo and lock per stage |
| Intermediate results | Not visible (can be logged with `trace`) | Visible as each stage's output, readable by others |
| Rewiring | Redefine | Any time while running |
| Scope | Within one juiz process | Across brokers, processes and languages |
| Branching | Trees only | One output can feed any number of inputs (and Topics) |
| Partial memo | No (every stage is recomputed) | Unchanged stages hit their memo |
| Reuse | Instantiate the type as often as you like | Each configuration file is its own setup |

Composition suits:

- Groups of processing steps you want to run with one call from outside, such as an image processing pipeline
- Binding "read a sensor → control law → drive a motor" to one Execution Context to guarantee the order of stages
- Adding unit conversion or adapters before or after an existing Process (without changing either Process)
- Hiding internal arguments with `const` to narrow down the arguments exposed

Connections suit:

- Delivering intermediate results to several receivers, or reading them from elsewhere
- Connecting Processes in other processes, on other machines, or in subsystems
- Rewiring while running
- Letting memo work for heavy stages

## Speed

Within one process, passing values is about as fast with a Composite as with connections. Rust stages never convert values between them.
To avoid converting values between Python stages, see [lazy evaluation](/guides/lazy-evaluation/). It is not specific to Composites and works for connections too.

## Examples

| Language | Repository | Configuration files |
|---|---|---|
| Rust | [juiz_examples_rust](https://github.com/OpenJUIZ/juiz_examples_rust) | `composite.conf` (no Containers, nesting, `expose`, `trace`), `control_loop.conf` (control loop), `opencv_capture_oneshot_composite.conf` (capture with a camera and save) |
| Python | [juiz_examples_python](https://github.com/OpenJUIZ/juiz_examples_python) | `image_pipeline.conf` (four image processing stages built both as a Composite and with connections, with timing) |

The detailed rules are in [docs/spec/composition.md](https://github.com/OpenJUIZ/juiz/blob/main/docs/spec/composition.md) in the juiz repository (in Japanese).
