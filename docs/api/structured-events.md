# 结构化协议事件

比手工 `pkt.unpack` 更省事：让 C++ 侧把包解析成 dict 再交给插件。

## 注册事件

```python
import engine

def on_packet(event):
    print(event["packet_id"], event["packet_name"], event["size"])
    if event["parsed"]:
        print(event["data"])
    elif event["error"] is not None:
        print("parse failed:", event["error"])

engine.register_structured_protocol_event(56, on_packet)
```

函数签名：

```python
engine.register_structured_protocol_event(packet_id, callback, is_kernel=False)
```

::: danger 第三个参数不要传 True
`is_kernel` 默认为 `False`。**内核事件只应由框架自身注册**，插件传 `True`
会与框架抢注册。
:::

## 事件信封

每次回调接收一个字典：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `packet_id` | `int` | 基岩版协议包 ID |
| `packet_name` | `str` | 已知包名，未知时为 `Unknown` |
| `payload` | `bytes` | 不含包 ID 的原始负载 |
| `size` | `int` | 原始负载长度 |
| `parsed` | `bool` | 是否已可靠解析为 `data` |
| `data` | `dict \| None` | 已解析字段；不支持解析时为 `None` |
| `error` | `str \| None` | 解析错误；没有错误时为 `None` |

::: tip 解析失败不会中断其他回调
解析异常会保留在 `error` 字段里，其他协议回调继续执行。
:::

## 支持的包与字段

| 包 | ID | 已解析字段 |
| --- | --- | --- |
| `MovePlayer` | 19 | `entity_runtime_id`、`position{x,y,z}`、`pitch`、`yaw`、`head_yaw` |
| `ContainerOpen` | 46 | `window_id`、`window_type`、`position{x,y,z}`、`entity_unique_id` |
| `InventoryContent` | 49 | `window_id`、`slots`、`container_id`、`dynamic_container_id` |
| `BlockActorData` | 56 | `position{x,y,z}`、`raw_nbt`、`nbt`、`root_name` |
| `PlayStatus` | 2 | `status` |
| `Text` | 9 | `type`、`data`、`data2`、`system_message` |
| `CommandOutput` | 79 | `origin`、`request_id`、`output_type`、`success_count`、`messages`、`data_set` |
| `PlayerList` | 63 | `action`、`entries` |

其他包仍会提供完整事件信封和 `payload`，但 `parsed` 为 `False`、`data` 为 `None`。

## 字段详解

### MovePlayer

```python
{
    "entity_runtime_id": 123,
    "position": {"x": 0.0, "y": 64.0, "z": 0.0},  # float
    "pitch": 0.0,
    "yaw": 0.0,
    "head_yaw": 0.0,
}
```

### ContainerOpen

```python
{
    "window_id": 2,
    "window_type": 0,
    "position": {"x": 106, "y": 93, "z": 69},     # int
    "entity_unique_id": 0,
}
```

### InventoryContent

```python
{
    "window_id": 2,
    "slots": [
        {
            "network_id": 276,
            "count": 1,
            "metadata": 0,
            "block_runtime_id": 0,
            "stack_id": 0 | None,
            "extra": b"",
        }
    ],
    "container_id": 0,
    "dynamic_container_id": 0 | None,
}
```

### BlockActorData

```python
{
    "position": {"x": 106, "y": 93, "z": 69},
    "raw_nbt": b"...",
    "nbt": nbt.Tag | None,
    "root_name": "..." | None,
}
```

NBT 解析失败时 `nbt` / `root_name` 为 `None`，错误写入事件信封的 `error`，
`parsed` 为 `False`。

### PlayStatus

```python
{"status": 3}
```

### Text

```python
{
    "type": 1,                 # CHAT
    "data": "<玩家名>",         # chat/whisper/announcement 时是 source_name
    "data2": "消息内容",        # chat/whisper/announcement 时是 message
    "system_message": "",      # filtered_message
}
```

对非聊天类文本，`data` 是消息正文，`data2` 为空字符串。需要完整字段
（`parameters`、`xuid`、`platform_chat_id`、`needs_translation`）时，使用
`TextParsed` 原生事件或 `register_protocol_event(9, ...)` 自己解析。

### CommandOutput

```python
{
    "origin": 0,               # 当前实现固定为 Player
    "request_id": "...",
    "output_type": 1,          # 0 none / 1 lastoutput / 2 silent / 3 alloutput / 4 dataset
    "success_count": 1,
    "messages": [
        {"success": False, "message": "commands.give.success"}
        # 注意：结构化事件不包含 parameters
    ],
    "data_set": "",
}
```

需要 `parameters` 时使用 `CommandOutputParsed` 原生事件（见[事件系统](/plugin/events)）。

### PlayerList

```python
{
    "action": 0,               # 0 add / 1 remove
    "entries": [
        {
            "uuid": b"...",             # 16 字节
            "entity_unique_id": 123,
            "username": "...",
            "xuid": "...",
            "platform_chat_id": "...",
        }
    ],
}
```

`PlayerList` 的完整条目（含皮肤、`build_platform`、`host` 等）通过
`on_player_list` 原生事件获得，或使用 `game_state.get_players()`。

## 包名映射

`packet_name` 当前能识别：

```text
Login  PlayStatus  Disconnect  StartGame  MovePlayer
ContainerOpen  InventoryContent  BlockActorData
CommandRequest  CommandOutput  PlayerList
PlayerAuthInput  SubChunk  PyRpc
```

不在表中的包返回 `Unknown`。

## 示例：从 BlockActorData 里取命令方块指令

```python
import engine

def on_block_actor(event):
    if not event["parsed"]:
        return
    tag = event["data"]["nbt"]
    if tag is None:
        return
    command = tag.Get("Command")
    if command is not None:
        print(command.GetValue())

engine.register_structured_protocol_event(56, on_block_actor)
```

## 该用哪个接口？

| 场景 | 用 |
| --- | --- |
| 上表 8 个包，只要字段 | `register_structured_protocol_event` |
| 其他包 / 需要原始字节 | `register_protocol_event` + `pkt` |
| 聊天消息 | `OnTextPacket` 或 `TextParsed`（见[事件系统](/plugin/events)） |

## 下一步

- [协议数据包处理](/plugin/protocol)
- [接口参考](/api/reference)
