# 关键数据包

记录几个**容易写错且后果严重**的数据包。协议版本 `ProtocolVersion = 860` = MCBE **1.21.120**。

## CommandBlockUpdate（ID 78，客户端 → 服务端）

::: danger 必须带 `filtered_name`
1.21.120 协议的字段顺序里，`filtered_name` 位于 `name` 之后、`should_track_output` 之前。
**缺失会导致服务端解析越界，直接踢人。**
:::

字段顺序：

```text
is_block: bool
[if is_block] position (UBlockPos: x = zigzag32, y = varint, z = zigzag32),
              mode: varint, needs_redstone: bool, conditional: bool
[else]        minecart_entity_runtime_id: varint64
command: string
last_output: string
name: string
filtered_name: string          ← 关键
should_track_output: bool
tick_delay: li32
execute_on_first_tick: bool
```

> 注意 `position` 的三个分量编码**不一样**：x 和 z 是 zigzag32，y 是 varint。

Python 侧的封装是 `engine.command_update(...)`，见
[engine API · 命令方块更新](/plugin/engine#命令方块更新-command-update)。

## SettingsCommand（ID 140）

序列化方式：

```text
WriteUInt8(ID())        ← 140
WriteUInt8(1)
WriteVarUInt(len)       ← command 长度
command
suppress
```

::: tip 一个巧合
ID 140 的 VarUInt 编码恰好是 `[0x8C][0x01]`，与硬编码的那个 `1` 字节对上了。
这是巧合，不是设计 —— 改动时要留意。
:::

::: warning 普通用户别直接用
直接发 `SettingsCommand` 有反作弊风险。插件请用 `engine.command()` 或
`engine.settingscommand()`。
:::

## 其他已结构化解析的包

`application/PythonAPI/StructuredProtocol.cpp` 为以下包提供字段解析，
可通过 `engine.register_structured_protocol_event(id, cb)` 拿到 dict：

`MovePlayer`、`ContainerOpen`、`InventoryContent`、`BlockActorData`、
`PlayStatus`、`Text`、`CommandOutput`、`PlayerList`

事件结构见 [结构化协议事件](/api/structured-events)。

## 容器与方块实体交互

| 包 | ID | 作用 |
| --- | --- | --- |
| `InventoryTransactionPacket` | — | 客户端请求打开容器（use_item / click_block） |
| `ContainerOpenPacket` | 46 | 服务端确认打开，客户端缓存 |
| `InventoryContentPacket` | 49 | 容器槽位内容，客户端缓存 |
| `BlockActorDataPacket` | 56 | 方块实体数据（告示牌文本、命令方块命令），客户端缓存 |

`engine.openContainer(x, y, z)` 会把请求发出去，并返回**当前已缓存**的数据；
容器内容到达后再次调用即可拿到完整槽位。详见
[engine API · 打开容器](/plugin/engine#打开容器-opencontainer)。

## 下一步

- [RPC 与反作弊校验](/architecture/anti-cheat)
- [协议数据包处理（插件视角）](/plugin/protocol)
