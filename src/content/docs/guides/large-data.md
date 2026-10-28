---
title: Choosing a broker and large data
description: When to use the HTTP, QUIC and IPC brokers, and how to pass large data such as camera images to other processes quickly (the IPC broker and shared memory).
sidebar:
  order: 9
---

juiz Processes can be called from other processes and other machines through brokers.
This page explains when to use each of the three brokers (HTTP, QUIC and IPC) and how to pass large data such as camera images quickly.

:::caution[Requires juiz 0.1.0 or later]
The IPC broker, raw-byte image transfer over the QUIC broker, shared memory, pyjuiz's `IpcProxy`, and image arguments and return values in C++ and Haskell are available from juiz 0.1.0.
The QUIC broker in 0.1.0 cannot talk to QUIC brokers of earlier versions (the wire format changed). Use 0.1.0 or later for every juiz you connect over QUIC.
:::

## Choosing a broker

| | HTTP (`http`) | QUIC (`qmp`) | IPC (`ipc`) |
|---|---|---|---|
| Reach | Other machines too | Other machines too | **Same machine only** |
| ID prefix | `http://127.0.0.1:8000` | `qmp://127.0.0.1:5000` | `ipc://cam0` |
| Port | Yes (8000 by default) | Yes (UDP) | No (Unix domain socket / named pipe) |
| How images travel | Compressed to PNG (multipart) | Raw pixels | Raw pixels |
| A call returning a 720p image | about 19 ms | about 11–13 ms | **about 1.2 ms** |
| Browser, curl, web UI | Yes | No | No |
| How to start | `-d` (on by default) | `brokers` in the configuration file | `--ipc <name>` or `brokers` in the configuration file |

As a rule of thumb:

- **For small values, or to work from a browser or the web UI**, use HTTP. It starts with `-d` as before.
- **To send images to another machine**, use QUIC. It does not turn images into PNG, so it is faster than HTTP; on a slow network the network speed decides. See [Tutorial chapter 7](/tutorial/quic-broker/) for how to use it.
- **To send images to another process on the same machine**, use IPC. It opens no port and is more than ten times as fast as HTTP.

One juiz can have several brokers at once. Keep HTTP from `-d` and add IPC, and you can watch the system in the web UI over HTTP while receiving images over IPC.

## Using the IPC broker

### Starting it

Start juiz with `--ipc` and a broker name. Pick a name that is unique on the machine.

```sh
juiz -f image_pipeline.conf --ipc cam0 -d
```

`image_pipeline.conf` is the example in the [Python examples](https://github.com/OpenJUIZ/juiz_examples_python) that loads an image, shrinks it and binarizes it. This juiz now answers on `ipc://cam0` as well as on `http://127.0.0.1:8000`.
From another terminal, pass the `ipc://` ID to `-s`.

```sh
juiz -s ipc://cam0 process list
# => ["ipc://cam0/process/resize0::image_resize_python", "ipc://cam0/process/load0::image_load_python", ...]
```

In a configuration file, add `type_name: ipc` to `brokers`.

```yaml
brokers:
  - type_name: ipc
    name: cam0                  # juiz if omitted
    max_frame_bytes: 1073741824 # limit for one request or response (1 GiB by default). Optional
```

- A name is 1 to 64 characters of letters, digits, `_`, `-` and `.`, and must not start with `.`.
- If an IPC broker with the same name is already running, juiz fails to start (`ipc://cam0 is already in use`). If an earlier juiz crashed and only left its socket file behind, juiz cleans it up and starts.
- The IPC broker's `namespace` key from configuration files before 0.1.0 has been removed. It is now an error, so rename it to `name`. `buffer_size` is ignored.

### Transport and access control

The IPC broker uses Unix domain sockets on Linux and macOS, and named pipes on Windows.

| OS | Location |
|---|---|
| Linux, macOS | `<dir>/<name>.sock`. `<dir>` is the first of the environment variable `JUIZ_IPC_DIR`, `$XDG_RUNTIME_DIR/juiz` and `/tmp/juiz-<uid>` |
| Windows | `\\.\pipe\juiz-<name>` |

The socket or pipe is created so that only the user who started juiz can open it. **Only processes of the same user can connect.**
When containers share a volume, point `JUIZ_IPC_DIR` at the same place in both. Also use `JUIZ_IPC_DIR` to pick a shorter place when the socket path is too long (over 104 bytes on macOS or 108 bytes on Linux).

### Connecting as a subsystem

You can register another juiz as a subsystem or master system with `ipc://`, just as with HTTP.

```yaml
subsystems:
  - type_name: ipc
    name: cam0        # make the juiz listening on ipc://cam0 a subsystem
```

### Calling from Python

Use pyjuiz's `IpcProxy`. `ProcessProxy` and the other proxies work the same as over HTTP.

```python
from juiz.proxy import ProcessProxy, connect

load = ProcessProxy("load0", ipc="cam0")   # connect to ipc://cam0 and look the Process up by name
img = load.call("images/sample.png")       # a PIL Image arrives as raw pixels (no PNG)
small = ProcessProxy("resize0", ipc="cam0").call(img, 160, 120)   # sending an image as an argument works too

system = connect("ipc://cam0")             # a SystemProxy; connect("http://localhost:8000") has the same shape
```

- You can send images as a PIL `Image` (`L`, `LA`, `RGB`, `RGBA`, `I;16`) or a numpy array. Images you receive are PIL `Image`s when PIL can represent the format, and numpy arrays otherwise (16-bit color and 32-bit float).
- The response timeout is 10 seconds by default (change it with `IpcProxy("cam0", timeout=seconds)`).
- Errors raised on the server are `IpcRemoteError`; transport errors such as failing to connect are `IpcError`.

## Passing large data quickly

### How each broker carries images

Images (`Capsule::Image`) as arguments and return values, and images flowing through Topics, travel differently depending on the broker.

- **IPC and QUIC** send pixels as they are, without compression. Small values go as JSON, and images sit outside the JSON as raw bytes. The receiver reads the bytes straight into the image buffer, so no extra copies are made.
- **HTTP** still converts images to PNG so that browsers and curl can use it. About 80% of its time goes into PNG compression and decompression.

These 10 image formats can be sent.

| Format | Contents |
|---|---|
| `l8` / `la8` | 8-bit gray (+ alpha) |
| `rgb8` / `rgba8` | 8-bit color (+ alpha) |
| `l16` / `la16` / `rgb16` / `rgba16` | 16-bit |
| `rgb32f` / `rgba32f` | 32-bit float |

Images in BGR order (such as OpenCV's `cv::Mat`) are reordered to RGB by juiz when a C++ or Haskell Process returns them (see [Images in C++ and Haskell](#images-in-c-and-haskell)).

Arrays of 1024 or more elements that are all integers or all floats (point clouds and the like) are also sent as raw bytes over IPC and QUIC instead of as a JSON list of numbers. The distinction between integers and floats is kept.
Values of type `bytes` are still sent as base64 strings for now.

### Sending large images over HTTP

The HTTP broker accepts request bodies up to 256 MiB by default (enough for a 4K PNG). To send something bigger, raise `option.http_broker.max_body_bytes`. Bodies over the limit get a 413 error.

```yaml
option:
  http_broker:
    max_body_bytes: 536870912   # 512 MiB
```

### Streaming a Topic through shared memory

To keep streaming large images such as 4K through a Topic to another process on the same machine, you can use a ring buffer in shared memory.
The sender writes the image into shared memory once and only tells the receivers where it is over IPC. Even with several subscribers, the image is written only once.

Shared memory is used for a push that meets all of the following. Other pushes are sent in the normal IPC format (raw bytes).

1. It is a Topic push (shared memory is not used for call arguments and return values)
2. The destination broker is IPC
3. The sender's configuration file has `shared_memory` for that Topic
4. The data is at least `min_bytes`

Write the settings per Topic in the top-level `topics` of the **sender's** configuration file (the juiz that has the Process publishing to the Topic). The receiver needs no settings.
Start the receiving juiz first with an IPC broker, and register it in the sender's `subsystems` over IPC.

```yaml
# Receiver (viewer.conf). Start it first with juiz -f viewer.conf --ipc viewer -d
processes:
  - type_name: image_white_ratio_python
    name: ratio0
    subscribes:
      img: camera/image
```

```yaml
# Sender (camera.conf). Start it with juiz -f camera.conf -d
brokers:
  - type_name: ipc
    name: camera
subsystems:
  - type_name: ipc
    name: viewer               # register the juiz on ipc://viewer as the receiver
processes:
  - type_name: image_load_python
    name: load0
    publishes: [camera/image]
topics:
  - name: camera/image         # Topic name (namespaces resolve as in publishes and subscribes)
    shared_memory:
      slots: 4                 # number of slots. Default 4, at least 2
      slot_bytes: 25165824     # bytes per slot. Default auto
      min_bytes: 1048576       # smaller data does not use shared memory. Default 1 MiB
```

To use the defaults, write `shared_memory: {}`.
(This example leaves out `plugins` and the `ecs` that runs `load0`.)

| Key | Default | Meaning |
|---|---|---|
| `slots` | 4 | Number of slots in the ring. The sender overwrites them in turn |
| `slot_bytes` | auto | Size of one slot. With auto, the size of the first data sent, rounded up to a multiple of 1 MiB |
| `min_bytes` | 1 MiB | Smaller data is sent without shared memory |

#### When the receiver is slow (dropping old frames)

Topics that use shared memory **favor new frames and drop old ones**.

- The sender does not wait for receivers. When a slot's turn comes, it is overwritten even if a receiver has not finished reading it. That is why a push through shared memory returns without waiting for the receiver to finish processing.
- The receiver keeps a "latest only" inbox per Topic. If a new notice arrives before the previous one is read, the previous one is dropped (counted as `dropped`).
- If a slot is overwritten before or while it is being read, that frame is dropped (counted as `overwritten`). This is not an error.
- If the data is larger than `slot_bytes`, that push is sent without shared memory, and a warning is logged the first time only (counted as `fallback`). If the resolution may go up later, set `slot_bytes` explicitly.

This suits data where "only the latest frame matters", like camera images. For data where nothing may be lost, leave out `shared_memory`.

#### Counters

The Topic profile on the sender and the receiver (in `core_store.topics` of HTTP `system/profile_full`) shows these counts.

```json
"shared_memory": {"slots": 4, "slot_bytes": 25165824, "sent": 1200, "fallback": 0, "dropped": 3, "overwritten": 0}
```

The sender counts `sent` and `fallback`; the receiver counts `dropped` and `overwritten`. The web UI and the CLI do not show them yet.

The shared memory region is created with `memfd` on Linux, with `shm_open` whose name is removed right after creation on macOS, and with a named mapping backed by the paging file on Windows. No files or names are left behind even if a process crashes. Receivers map the region read-only.

### Images in Python

Python Processes keep using PIL `Image`s as arguments and return values. juiz hides the differences between brokers, so the Process code does not change.
When you call from outside, use [`IpcProxy`](#calling-from-python) to skip PNG.

### Images in C++ and Haskell

C++ and Haskell Processes can also take and return images. Once an image is inside juiz, it is the same as a Rust image, so it travels as raw bytes over IPC and QUIC and can be connected to Processes in other languages.

In C++, use `juiz::Image` from `juiz/image.h` and add an image argument to the manifest with `add_image_arg`. With OpenCV, `to_mat` and `from_mat` in `juiz/opencv.h` convert to and from `cv::Mat` (juiz reorders BGR to RGB).

```cpp
#include "juiz/juiz.h"
#include "juiz/opencv.h"

static auto image_flip_cpp_manif = ProcessManifest("image_flip_cpp").add_image_arg("img", "image to flip");
std::optional<juiz::Image> image_flip_cpp(const juiz::Image& img) {
    cv::Mat m = juiz::to_mat(img);   // copied into a cv::Mat in BGR order
    cv::flip(m, m, 1);
    return juiz::from_mat(m);        // enters juiz as RGB8
}
COMPONENT_PROCESS_FACTORY(image_flip_cpp_manif, image_flip_cpp);   // register in a Component as in chapter 5
```

To read an image without copying, borrow it for the duration of a function with `juiz::with_image(cm, name, f)`.

In Haskell, use `Image` from `Juiz.Image` and add an image argument to the manifest with `addImageArg`.

```haskell
invertManifest :: ProcessManifest
invertManifest = processManifest "image_invert_hs"
  & addImageArg "img" "image to invert"

invert :: Image -> Image
invert img = img { imageData = BS.map (255 -) (imageData img) }   -- for 8-bit formats
```

`Image` can only be used as the type of an argument or return value itself. It cannot go inside a dictionary or list (such as `[Image]`).

## How fast is it

Time to call a Process in another process on the same machine and receive an RGB image as the return value (a 4-core cloud Xeon, release build, ms per call).

| Image | HTTP | QUIC | IPC | (Reference) same process |
|---|---|---|---|---|
| 720p (1280×720, 2.8 MB) | 19 | 11–13 | 1.2 | 0.23 |
| 1080p (1920×1080, 6.2 MB) | 41 | — | 3.0 | 0.59 |
| 4K (3840×2160, 24.9 MB) | 150 | — | 12.7 | 4.3 |

- Most of HTTP's time is PNG compression and decompression.
- The QUIC figure is over loopback on one machine, where QUIC's own encryption and small-packet handling dominate. Between machines the network speed matters more (720p takes about 22 ms on 1 Gbps).

Time to stream images through a Topic to another process (IPC, ms).

| Image | Normal push: returns | Normal push: arrives | Shared memory: returns | Shared memory: arrives |
|---|---|---|---|---|
| 720p | 1.2 | 1.3 | 0.6 | 1.2 |
| 1080p | 2.4 | 2.6 | 1.2 | 2.3 |
| 4K | 19.2 | 20.5 | 8.0 | 18.5 |

Shared memory roughly halves the time until the sender's publish returns (so the sender's loop can run faster). The time until the image reaches the receiver barely changes, because the receiver still copies the image once into a new buffer.

The figures come from `juiz_core/tests/integration/image_transfer_bench.rs` in juiz. To get numbers for your own machine, run this in the juiz repository.

```sh
cargo test --release -p juiz_core --test integration -- image_transfer_bench --ignored --nocapture --test-threads=1
```
