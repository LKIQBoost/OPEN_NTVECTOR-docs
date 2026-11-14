# 代码模板

## 线程与资源管理

### 线程清理（必须）

如果插件开了后台线程，**必须**实现 `on_uninit()` 函数，否则重载时会崩溃 ——
旧线程还在跑，引用的模块对象已经被卸载了。

**推荐用 `threading` 模块（Py3 标准库）：**

```python
import threading
import time

_running = False

def _worker():
    while _running:
        time.sleep(1)   # 每秒执行一次
        # 业务逻辑

def on_uninit():
    global _running
    _running = False

_running = True
threading.Thread(target=_worker, daemon=True).start()
```

**如果坚持用底层 `_thread`：**

```python
import _thread          # Py3 中 thread 改名 _thread

def _worker():
    while _running:
        pass

_thread.start_new_thread(_worker, ())
```

**同时建议监听 `ModEventUnInit`：**

```python
def _on_uninit(args):
    on_uninit()

engine.register(_on_uninit, "ModEventUnInit")
```

`on_uninit()` 的调用时机：

- **单插件重载**：框架（`ntvector/plugins.py`）在注销事件前主动调用
- **全量重载**：通过 `ModEventUnInit` 事件通知

### 文件资源

- 不要长期持有文件句柄，重载后句柄会失效
- 配置文件建议放在插件目录外（如 `config/`），避免触发热重载
- 临时文件用完即删

## 最简插件

```python
# scripts/my_plugin/my_plugin/__init__.py

def on_start(args):
    print('MyPlugin loaded!')
    engine.message('', 'Hello, world!')

engine.register(on_start, "ModEventStartUp")
```

## 完整插件结构

```python
import threading
import time

# ── 状态 ──
_running = False

# ── 事件处理 ──
def on_text(args):
    data = args[0]
    print(f"Chat: {data['message']}")      # message 已是 str

def on_command_output(args):
    result, guid = args
    print(f'Command result: {result}')

def on_disconnect(args):
    print('Disconnected from server')
    global _running
    _running = False

# ── 后台线程 ──
def _worker():
    while _running:
        time.sleep(1)   # 每秒执行一次

# ── 生命周期 ──
def on_uninit():
    global _running
    _running = False

def _on_uninit(args):
    on_uninit()

# ── 初始化 ──
engine.register(on_text, "OnTextPacket")
engine.register(on_command_output, "on_command_output")
engine.register(on_disconnect, "on_disconnect")
engine.register(_on_uninit, "ModEventUnInit")

_running = True
threading.Thread(target=_worker, daemon=True).start()
```

## 发送指令

```python
engine.command("/say hello")
engine.command("/tp @s 0 100 0")
engine.settingscommand("/gamemode 1 @s")       # 需要管理员权限时优先用
```

## RPC 调用

```python
import umsgpack
engine.send(umsgpack.packb(['ModEventC2S', [None], None]))
```

> `umsgpack` 由框架提供，位于 `source/Lib/site-packages/umsgpack.py`，
> Py3 下可直接导入。

## 注册用户协议事件

```python
import pkt

def on_move_player(data):
    runtime_id, off = pkt.read_varint(data, 0)
    x, y, z, off = pkt.unpack("fff", data, off)
    print(f'entity {runtime_id} moved to {x:.1f}, {y:.1f}, {z:.1f}')

engine.register_protocol_event(0x13, on_move_player, False)
```

## 使用原生接口

### 读取 NBT

```python
import nbt

document = nbt.loads(raw_nbt, "network_little_endian")
root = document.GetRoot()
name = root.Get("CustomName")
if name is not None:
    print(name.GetValue())
```

### 查询已确认的游戏状态

```python
import game_state

player = game_state.get_local_player()
if player is not None:
    print(player["entity_runtime_id"], player["position"])

for entry in game_state.get_players():
    print(entry["username"])
```

### 发送 CommandRequest

```python
import os
from packets import CommandOrigin, CommandRequest

request = CommandRequest()
request.SetCommand("say hello")
request.SetCommandOrigin(CommandOrigin.Player)
request.SetRandomUUID(os.urandom(16))
request.Send()
```

### 结构化收包

```python
import engine

def on_container(event):
    if not event["parsed"]:
        return
    data = event["data"]
    print(data["window_id"], data["position"])

engine.register_structured_protocol_event(46, on_container)
```

更多字段见[原生模块速查](/api/native-modules)与[结构化协议事件](/api/structured-events)。

## MCP 打包发布（遗留）

::: danger 不要用 MCP 发布
MCP 模式（`vanilla.mcp` 加密打包）是 Python 2.7 时代的机制。迁移到 Python 3.12 后，
**MCP 打包的字节码（Py2 marshal）无法在 Py3 加载**。

**发布请使用 source 模式** —— 直接分发 `scripts/` 目录下的 `.py` 源码。
:::

代码中的 MCP 相关函数（`fop.new_mcp` / `fop.reload_mcp` / `redirect.mcs` 等）
仍然保留，但仅用于兼容旧逻辑，不建议在新插件中使用。

旧的打包命令（**仅 Py2 时代有效**）：

```text
Program.exe mcp_compile <源目录> <输出文件> [选项]
```

## 下一步

- [常见问题](/plugin/faq)
