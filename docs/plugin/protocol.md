# 协议数据包

## 处理聊天消息

`proton.py` 已经注册了 `TextPacket(0x09)` 的内核协议事件，解析后触发 `OnTextPacket`
用户事件，插件**直接监听即可**：

```python
def on_text(args):
    data = args[0]                    # dict
    if data['type'] == 1:             # CHAT
        source = data['source_name']  # str（Unicode）
        msg = data['message']         # str（Unicode）
        print(f'<{source}> {msg}')    # Py3 f-string，中文直接打印

engine.register(on_text, "OnTextPacket")
```

::: warning Py3 下不要 decode
`source_name` / `message` 已经是 `str`，**不要**再调用 `.decode('utf-8')`
（str 根本没有这个方法）。
:::

`data` 的完整字段和 `type` 取值见[事件系统 · OnTextPacket](/plugin/events#ontextpacket-聊天消息)。

## 处理其他数据包

用 `engine.register_protocol_event(packet_id, cb, False)` 注册；回调收到的 `data`
是**原始二进制**（`bytes`，包 ID 已去除）：

```python
import pkt

def on_move_player(data):
    runtime_id, off = pkt.read_varint(data, 0)
    x, y, z, off = pkt.unpack("fff", data, off)
    print(f'entity {runtime_id} moved to {x:.1f}, {y:.1f}, {z:.1f}')

# 第三个参数 False = 用户协议事件，重载时自动清除
engine.register_protocol_event(0x13, on_move_player, False)
```

::: danger 第三个参数必须是 False
`True` 是内核协议事件，只有 `proton.py` 可以用。插件传 `True` 会破坏框架自己的注册。
:::

## 不用手写解析器：结构化协议事件

如果只是想拿字段，不必自己 `pkt.unpack`。以下包已经支持结构化解析，
`engine.register_structured_protocol_event(id, cb)` 会直接给 dict：

`MovePlayer`、`ContainerOpen`、`InventoryContent`、`BlockActorData`、
`PlayStatus`、`Text`、`CommandOutput`、`PlayerList`

```python
def on_packet(event):
    if event["parsed"]:
        print(event["packet_name"], event["data"])

engine.register_structured_protocol_event(56, on_packet)
```

字段说明见[结构化协议事件](/api/structured-events)。

## 该用哪个？

| 场景 | 用 |
| --- | --- |
| 聊天 / 系统消息 | `OnTextPacket`（已解析好） |
| 上表那 8 个包 | `register_structured_protocol_event`（拿 dict） |
| 其他包 / 需要原始字节 | `register_protocol_event` + `pkt` 手工解析 |
| 指令返回 | `on_command_output` 事件（配合 `engine.command_guid`） |

## 常用包 ID

| 包 | ID |
| --- | --- |
| `TextPacket` | `0x09` |
| `MovePlayer` | `0x13` |
| `ContainerOpenPacket` | 46 |
| `InventoryContentPacket` | 49 |
| `BlockActorDataPacket` | 56 |
| `CommandBlockUpdate` | 78 |

## 下一步

- [代码模板](/plugin/templates)
- [关键数据包（C++ 视角）](/architecture/packets)
