---
title: Lazy evaluation
description: Python Processes in the same juiz process pass values to each other as they are, without converting them.
sidebar:
  order: 7
---

A Process's return value is normally converted to juiz's common format (a JSON-like value or an image) before it is passed to the next Process.
**Lazy evaluation** **postpones this conversion until it is needed**. When Python Processes in the same juiz process pass values to each other, no conversion happens at all.

:::caution[From the release after 0.0.22]
Lazy evaluation arrives in the release after juiz 0.0.22. For now it covers Python only. Rust and C++ will follow after data type definitions (IDL) are in place.
:::

## What changes

Passing values up to 0.0.22:

```text
return value of Python f (dict / ndarray) --convert--> common format --convert--> argument of Python g
```

With lazy evaluation:

```text
return value of Python f --> stays a Python object --> argument of Python g
                               \--convert (only when needed, once)--> Rust Process / broker / web UI
```

For four image processing stages on a 640x480 RGB image written in Python, one run took:

| How the stages are joined | Up to 0.0.22 | With lazy evaluation |
|---|---|---|
| Plain Python, without juiz | 2.7 ms | 2.7 ms |
| [Composite](/guides/composition/) | 34 ms | 1.8 ms |
| Pull connections | 34 ms | 2.0 ms |

It works the same for Composites and connections. You do not need to change configuration files or Process code.

## When conversion is skipped

A value is passed as a Python object when all of these hold.

- The sender and the receiver are in **the same juiz process** (across brokers or processes, values are always converted)
- **Both are Python** Processes
- The return value is an object such as a `dict`, `list`, `tuple`, `set`, numpy array or PIL image

Return values of type `str`, `int`, `float`, `bool` and `None` are small, so they are converted to the common format right away, as before.

numpy arrays can now be returned (this used to crash). When something other than Python reads one, it gets the `tolist()` value (it is not treated as an image).

## Where conversion happens

Conversion happens only where a value has to be read in the common format, and only once; the result is kept. Reading the same value many times converts it once.

| Where | Behavior |
|---|---|
| Passing to a Rust, C++ or Haskell Process | The receiver reads the common format, so the value is converted |
| Responses across brokers (HTTP, QUIC and so on, including the CLI's `call`) | Converted, returning the same JSON or image as before |
| Publishing to a Topic | Converted and delivered as before |
| Argument values in the profile and the web UI | Converted, showing the same values as before |
| A Composite's `trace` | **Not converted**. Only the type is shown, such as `native(python:numpy.ndarray)` |

A Python object that cannot be converted can still be passed between Python Processes, but reading it at one of the places above is an error (a 500 for an HTTP response).

## Do not modify received arguments

Values are shared rather than copied. The outlet's memo, every connected receiver and the parent stage of a Composite see the same Python object.
So **if you modify a received argument in place, the change is visible to the memo and to other receivers**. Values used to be copied on every hand-off, so this is a change in behavior.

**Python Processes must not modify the arguments they receive.** Copy first if you need to change something. juiz does not check this (it is the same rule you normally follow for Python functions).

```python
import numpy as np

# Bad: modifies the received array in place
def brighten_bad(img: np.ndarray) -> np.ndarray:
    img += 10            # also changes the value in the sender's memo
    return img

# Good: returns a new array
def brighten(img: np.ndarray) -> np.ndarray:
    return img + 10      # the original array is unchanged

# The same goes for dicts
def add_key(d: dict) -> dict:
    out = dict(d)        # copy before modifying
    out["key"] = 1
    return out
```

One more change: between Python Processes, PIL images are passed as they are, so a grayscale (`L`) image no longer turns into RGB on the way.

## Not covered yet

- Between Rust or C++ Processes (after data type definitions are in place)
- Haskell
- Topics (values are converted even between Python Processes)
- Across brokers or processes (always converted)

The detailed rules are in [docs/spec/lazy-evaluation.md](https://github.com/OpenJUIZ/juiz/blob/main/docs/spec/lazy-evaluation.md) in the juiz repository (in Japanese).
