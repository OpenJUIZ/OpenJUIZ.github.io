---
title: Naming service
description: How to find a running juiz by name and connect to it (the name list of this machine, LAN discovery and asking a known juiz), and how to use juiz name, -s <name> and name://.
sidebar:
  order: 9.8
---

The naming service looks up where to connect to a juiz (`ipc://…`, `http://…`, `qmp://…`, `zenoh://…`) from its name (a package name or the name of a System).
You can point at a juiz by name, as in `juiz -s mobile_sim process list`, without remembering URLs or port numbers. Even when a base package starts on another port because its port was in use, apps find the base by name.

:::note[Available from the version after juiz 0.3.6]
The naming service is available from the version after juiz 0.3.6.
:::

## Three ways to find a juiz

There is no central name server and no daemon. Three ways are layered.

| Way | Reach | Default |
| --- | --- | --- |
| [The name list of this machine](#the-name-list-of-this-machine) | The same machine (the same user) | Registering and looking up are on |
| [LAN discovery (mDNS)](#lan-discovery-mdns) | A LAN that multicast reaches | Advertising is off. Looking up is on in a juiz built with the feature `naming-mdns` |
| [Asking a known juiz (peers)](#asking-a-known-juiz-peers) | The URLs you write | Only when written |

A lookup looks at the name list of this machine first, and at the LAN and the peers only when nothing is found there.

- What people write (a URL in `-s`, `--depend` of `juiz run`, remembered connections, `subsystems` and `mastersystem` in configuration files) always wins over names. Existing configuration files and commands work as before.
- What is registered is a System (a juiz process). Processes and Containers are not registered; once connected, you find them by ID and `list` as before.
- The whole picture after connecting (every juiz in the robot) is shown by the [web UI](/guides/web-ui/#showing-juiz-in-other-processes) and recursive listing. The naming service takes care of making the first connection by name, and of choosing which of the brokers of a juiz to use.

## The name list of this machine

A juiz that keeps running (`juiz -d`, `juiz -d -f <configuration file>`, `juiz run <package>`) writes its name and the brokers it started into the name list of this machine after starting its brokers, and removes them when it stops.

| How it starts | Registered name |
| --- | --- |
| `juiz run <package>` | The package name |
| `juiz -f <configuration file>` | `name` of the configuration file |
| No `name` in the configuration file | Not registered |

- If the System has a default [namespace](/guides/namespace/) (such as `--namespace robot1`), the registered name becomes `robot1/mobile_sim`.
- A name is 1 to 64 letters, digits, `_`, `-` and `.` (not starting with `.`). For other names, juiz warns and starts without registering.
- A juiz that runs once for a command such as `juiz process list` is not registered.
- Each registration is a file under `names/` in the directory of the IPC broker sockets (on Linux and macOS `JUIZ_IPC_DIR` → `$XDG_RUNTIME_DIR/juiz` → `/tmp/juiz-<uid>`; on Windows `JUIZ_IPC_DIR` → `%LOCALAPPDATA%\juiz\run`). Other users cannot read them. Docker containers that share `JUIZ_IPC_DIR` see each other as the same machine.
- Registrations left by a killed juiz are checked and removed when looked up (when the process is gone, or a different juiz answers). There is no periodic heartbeat.

### Listing: juiz name list

```sh
juiz name list
```

```text
NAME               PACKAGE             PID    STARTED               BROKERS
robot1/mobile_sim  mobile_sim 0.4.0    12345  2026-11-25T06:00:00Z  ipc://mobile_sim http://127.0.0.1:8001
teleop_twist       teleop_twist 0.1.1  12400  2026-11-25T06:01:10Z  ipc://teleop_twist http://127.0.0.1:8002
```

- `--check` asks each juiz and marks the ones that do not answer with `(not answering)`.
- `--json` prints JSON.

### Looking up: juiz name resolve

```sh
juiz name resolve mobile_sim
# ipc://mobile_sim
```

It prints the URL of the broker to connect to in one line. `--all` prints every candidate with its brokers.

Names can be written as follows.

| Written as | Meaning |
| --- | --- |
| `mobile_sim` | `mobile_sim` in any namespace |
| `robot1/mobile_sim` | Only `mobile_sim` in the namespace `robot1` |
| `/mobile_sim` | Only `mobile_sim` in the root namespace |
| `mobile_sim@robot2-pc` | Only `mobile_sim` on the machine `robot2-pc` (to tell apart what is found on the LAN or the peers) |

When there are several candidates, juiz never picks one silently. From a terminal it asks you to choose by number; otherwise it fails and lists the candidates.

```text
2 juiz are registered as mobile_sim:
  1) robot1/mobile_sim  0.4.0  pid 12345  (this machine)
  2) robot2/mobile_sim  0.4.0  at robot2-pc
choose [1]:
```

```text
mobile_sim is ambiguous: robot1/mobile_sim (this machine), robot2/mobile_sim@robot2-pc. Write the namespace or the machine (ex., robot1/mobile_sim).
```

### Which broker is used

When a juiz runs several brokers, the first one that can be used in this order is chosen.

| Where it is | Order |
| --- | --- |
| The same machine | `ipc` → `zenoh` → `qmp` → `http` |
| Another machine (LAN, peers) | `zenoh` → `qmp` → `http` |

On the same machine IPC comes first because it is fast and uses no port. For other machines the order is by speed ([choosing a broker](/guides/large-data/), [Zenoh broker](/guides/zenoh-broker/)). To fix the kind, write it, as in `name://mobile_sim?type=http` or `--depend mobile_sim=http`.

### Starting two juiz with the same name

Only one registration with the same name can exist on the same machine in the same namespace.

- A base package (`kind: base`) can only run once on a machine anyway ([Base](/guides/app-package/#base)).
- `juiz -f` and apps start as before. The second one is registered with `-2` added to its name (the third with `-3`), with a warning.

```text
warning: mobile_sim is already registered by another juiz (pid 12345); this juiz is registered as mobile_sim-2
```

To refuse a second one with the same name, write `option.naming.unique: true` in the configuration file; the second one then stops with an error.

## Pointing at a juiz by name

### -s of the CLI

When the value of `-s` has neither `://` nor `:`, it is looked up as a name.

```sh
juiz -s mobile_sim process list
juiz -s robot1/mobile_sim container list
```

Values such as `http://…` or `localhost:8000` work as before. The default when `-s` is not written is still `http://127.0.0.1:8000`.

### name://

Wherever a broker URL is written, `name://<name>` can be used.

```text
name://mobile_sim
name://mobile_sim?ns=robot1          # the namespace goes in the query (ns=/ for the root)
name://mobile_sim@robot2-pc
name://mobile_sim?type=http          # fix the kind of broker
name://mobile_sim/process/inc0::increment
```

It can be used in `-s` of the CLI, `--depend` of `juiz run`, `subsystems` and `mastersystem` of configuration files, IDs with a broker (the last example) and the address given to pyjuiz.
To tell it apart from the rest of an ID (`/process/…`), the namespace is written with `?ns=` instead of `/`. The query (`ns`, `type`) cannot be written in an ID with a broker.
IDs shown in lists and profiles are the real URLs after the lookup (`ipc://mobile_sim/…`).

In configuration files, set the kind of the existing form to `name`.

```yaml
subsystems:
  - type_name: name
    name: "mobile_sim"            # a query can be added, as in "mobile_sim?type=http"
mastersystem:
  broker_type: name
  broker_name: "mobile_sim"
```

### pyjuiz

```python
import juiz

proxy = juiz.proxy.connect("mobile_sim")       # connect by name ("name://mobile_sim" works too)
print(juiz.resolve_name("mobile_sim"))          # the URL to connect to
for r in juiz.name_list():                      # the name list of this machine
    print(r)
```

pyjuiz reads the registration files itself (without going through juiz). It connects with `ipc` → `http` in this order. With no candidate it raises `NameNotRegisteredError`, and with several `NameAmbiguousError` (it does not ask you to choose). pyjuiz only looks at this machine, not at the LAN or the peers.

### Web UI

"ほかの系" (Other systems) in the left pane of the [web UI](/guides/web-ui/) lists the systems running on this machine. For a system with an HTTP broker, "開く" (Open) opens its web UI in another window.

## juiz run and base packages

An app started by `juiz run` also looks for the base packages it depends on in the name list. Where to connect is decided in this order (the bold ones are new).

1. `--depend` on the command line
2. The remembered connection
3. An entry in the app configuration file's `subsystems` that has `package:`
4. **A registration on this machine with the right package name, `kind: base` and version**
5. **A registration on the LAN or the peers with the same conditions as 4**
6. Default: `ipc://<name of the base>`

Even when the base starts on another port (8100 → 8101, for example) because its port was in use, apps on the same machine find the port in the name list. When the name list decides where to connect, juiz run says so (not when it is the same as the default `ipc://<name of the base>`).

```text
using chatter_base at http://127.0.0.1:8101 (found in the name list)
```

Writing only a kind instead of a URL in `--depend` picks a broker of that kind from the name list. So does leaving out `name` in `subsystems` of the configuration file.

```sh
juiz run chatter_listener --depend chatter_base=http
```

```yaml
subsystems:
  - package: chatter_base
    type_name: http      # without name, only the kind is looked up in the name list (type_name can be left out too)
```

See [Base packages and apps](/guides/app-package/#app) of the .juizapp guide for more.

## LAN discovery (mDNS)

A juiz on another machine on the same LAN is found without any setting. The DNS-SD service type is `_juiz._tcp`.

:::caution[Advertising is off by default]
The HTTP broker of juiz has no authentication. Advertising a juiz on the LAN tells everyone on that LAN that they can call its Processes. Turn advertising on only on a network you trust, and only for the juiz you want to show.
:::

### Getting a juiz with the feature

LAN discovery works only in a juiz built with the feature `naming-mdns`.

```sh
cargo install juiz_app --features naming-mdns
```

A juiz without the feature does not look at the LAN. With `--lan`, it warns and lists only this machine.

### Advertising

Write `option.naming.advertise: true` in the configuration file, or start with `--advertise`.

```sh
juiz run mobile_sim --advertise
# note: mobile_sim is advertised on the LAN (mDNS). Other machines on the LAN can find and call it.
```

- Only brokers that other machines can reach (`http`, `qmp`, `zenoh`) are advertised. `ipc` is not.
- A kind whose `brokers` entries in the configuration file all have `host: 127.0.0.1` listens only inside this machine, so it is not advertised.
- A goodbye is sent when the juiz stops. Advertisements left by a killed juiz expire, and the side that looks up checks them too.
- Advertising works on its own: it still happens with `--no-register`.

### Finding

On another machine, look up the name as usual. When it is not found on this machine, the LAN is searched (this waits about 1.5 seconds).

```sh
juiz name resolve mobile_sim
# http://192.168.0.12:8001
juiz -s mobile_sim@robot2-pc process list
```

The list shows the LAN only with `--lan`, with an extra `MACHINE` column.

```sh
juiz name list --lan
```

```text
NAME               MACHINE    PACKAGE           PID    STARTED               BROKERS
robot1/mobile_sim  (this)     mobile_sim 0.4.0  12345  2026-11-25T06:00:00Z  ipc://mobile_sim http://127.0.0.1:8001
robot2/mobile_sim  robot2-pc  mobile_sim 0.4.0  12345  2026-11-25T06:00:00Z  http://192.168.0.12:8001
```

When `juiz run` finds the same base more than once on the LAN, it fails without asking. Decide with `--depend <base>=<URL>`.

LAN discovery does not work where multicast does not reach (Docker bridge networks, some Wi-Fi, across subnets). Use peers there.

## Asking a known juiz (peers)

Write the URL of a juiz running on another machine, and juiz asks it for its name list. The juiz asked is an ordinary juiz; no new server is needed, and it does not need to advertise.

There are three ways to write peers, and they add up.

```yaml
# configuration file
option:
  naming:
    peers:
      - "http://192.168.0.10:8000"
```

```sh
# argument (can be written more than once; juiz -f, juiz run, juiz name)
juiz name resolve mobile_sim --peer 192.168.0.10
# environment variable (separated by , or spaces; one line in a Docker container is enough)
export JUIZ_NAMING_PEERS="192.168.0.10:8000,192.168.0.11"
juiz -s mobile_sim process list
```

- The URL of a peer is its HTTP broker. `http://` can be left out, and the port defaults to 8000. Other kinds (`qmp://…` and so on) cannot be used.
- Peers are asked only when nothing is found on this machine (in parallel with the LAN, up to 1.5 seconds each). A peer that does not answer is skipped with a warning, and the search goes on elsewhere.
- A peer returns the registrations of its own machine, plus those of the juiz it connects to over HTTP on other machines. Writing one juiz of the robot as a peer lets you find the juiz connected to it by name too.
- A peer does not ask its own peers or the LAN (one step only). Peers written in a loop do not spread the questions.
- Addresses such as `127.0.0.1` and `0.0.0.0` returned by a peer are replaced with the address in the peer's URL.
- `juiz name list --lan` (the LAN and the peers) or `juiz name list --peer <URL>` lists them. Those found through a peer have `"found": "peer"` in `--json`.

## Settings and arguments

```yaml
option:
  naming:
    register: true      # false: do not write into the name list of this machine
    unique: false       # true: stop when a registration with the same name exists
    advertise: false    # true: advertise on the LAN (feature naming-mdns)
    peers: []           # URLs of the juiz to ask for names
```

| Argument | Effect | Where |
| --- | --- | --- |
| `--no-register` | `register: false` | `juiz -f`, `juiz run` |
| `--advertise` | `advertise: true` | `juiz -f`, `juiz run` |
| `--peer <URL>` | Adds to `peers` (can be written more than once) | `juiz -f`, `juiz run`, `juiz name` |

| Environment variable | Meaning |
| --- | --- |
| `JUIZ_NAMING_PEERS` | URLs of peers (separated by `,` or spaces) |
| `JUIZ_IPC_DIR` | Where the name list is kept (the same as the IPC broker sockets) |

| API (GET) | Returns |
| --- | --- |
| `naming/list` | The name list of the machine of that juiz. `?check=true` also checks that they answer, `?lan=true` adds the LAN and the peers |
| `naming/resolve?name=<name>` | Every candidate for the name (the caller chooses) |

## Not covered

- No authentication or encryption (brokers stay as they are).
- No automatic discovery across subnets or the internet (writing a URL in peers reaches them).
- No connection with ROS 2 discovery or the OpenRTM naming service.

The details are in [docs/spec/naming.md](https://github.com/OpenJUIZ/juiz/blob/main/docs/spec/naming.md) of juiz.
