# 关键数据包

记录几个**容易写错且后果严重**的数据包。当前协议版本：

```text
ProtocolVersion = 898   →  MCBE 1.21.130
```

> 包结构注释里仍会看到 `1.21.120`，那是字段布局的验证基线；数值和 ID 已按 v898 更新。

## CommandBlockUpdate（ID 78，客户端 → 服务端）

::: danger 必须带 `filtered_name`
字段顺序里 `filtered_name` 位于 `name` 之后、`should_track_output` 之前。
**缺失会导致服务端解析越界，直接踢人。**
:::

字段顺序：

```text
is_block: bool
[if is_block] position (UBlockPos)
              x: zigzag32, y: varuint, z: zigzag32
              mode: varuint32
              needs_redstone: bool
              conditional: bool
[else]        minecart_entity_runtime_id: varuint64
command: string
last_output: string
name: string
filtered_name: string          ← 关键
should_track_output: bool
tick_delay: uint32             ← 网易版
execute_on_first_tick: bool
```

`mode` 取值：

| 值 | 模式 |
| --- | --- |
| 0 | 脉冲（Impulse） |
| 1 | 循环（Repeating） |
| 2 | 链（Chain） |

Python 侧封装：`engine.command_update(...)`，见
[engine API · 命令方块更新](/plugin/engine#命令方块更新-command-update)。

## SettingsCommand（ID 140）

当前 N 个版本的实际线格式：

```text
WriteVarUInt32(ID())    → 140
WriteVarUInt(len)       → command 的 UTF-8 字节长度
command                 → 原始字符串
WriteUInt8(suppress)    → 是否抑制输出
```

::: warning 旧文档里的「先写 1 字节 1」已不适用
当前实现直接写 `varuint ID + varuint 长度 + 命令 + uint8 suppress`，
没有额外的硬编码 `1`。
:::

::: warning 普通用户别直接写
直接发 `SettingsCommand` 有反作弊风险。插件请用 `engine.command()` 或
`engine.settingscommand()`。
:::

## CommandRequest（ID 77，客户端 → 服务端）

当前 `CommandRequest::Serializ()` 的字段：

```text
command: string
origin: string                → 固定 "player"
uuid: 16 bytes
request_id: string
player_id: int64（小端）      → 负数按 0
internal_source: bool
unlimit: bool
command_version: string       → 固定 "latest"
```

对应 Python 侧：

```python
packet.SetCommandOrigin(...)      # 只保存值，线格式仍写 "player"
packet.SetCommandVersion(...)     # 只保存值，线格式仍写 "latest"
packet.SetPlayerID(-1)            # 线格式按 0 发送
```

::: tip 不要依赖来源 / 版本 setter
这两个字段在当前协议下由 C++ 固定，Python 侧设置不会改变发送内容。
:::

`engine.command()` 会自动生成随机 16 字节 UUID；`engine.command_guid()`
使用调用方传入的 GUID。

## CommandOutput（ID 79，服务端 → 客户端）

反序列化字段：

```text
origin: string
uuid: 16 bytes
request_id: string
player_unique_id: int64（小端，恒定存在）
output_type: string            → none / lastoutput / silent / alloutput / dataset
success_count: uint32
messages: varuint 数量
  message_id: string
  internal: bool
  parameters: varuint 数量 + string 数组
data_set: bool + string（可选尾部）
```

`output_type` 数值映射：

| 值 | 名称 |
| --- | --- |
| 0 | `none` |
| 1 | `lastoutput` |
| 2 | `silent` |
| 3 | `alloutput` |
| 4 | `dataset` |

C++ 原生事件 `CommandOutputParsed` 提供：

```text
[messages[{success, message, parameters}], guid:bytes,
 output_type:int, success_count:int, data_set:str]
```

结构化协议事件 `CommandOutput` 提供同样的主体字段，但 **`messages` 里没有
`parameters`**；需要参数时用 `CommandOutputParsed`。

## 已结构化解析的包

`application/PythonAPI/StructuredProtocol.cpp` 为以下包提供字段解析，
可通过 `engine.register_structured_protocol_event(id, cb)` 拿到 dict：

| 包 | ID |
| --- | --- |
| `PlayStatus` | 2 |
| `Text` | 9 |
| `MovePlayer` | 19 |
| `ContainerOpen` | 46 |
| `InventoryContent` | 49 |
| `BlockActorData` | 56 |
| `PlayerList` | 63 |
| `CommandOutput` | 79 |

事件结构见[结构化协议事件](/api/structured-events)。

## 容器与方块实体交互

| 包 | ID | 作用 |
| --- | --- | --- |
| `InventoryTransaction` | — | 客户端请求打开容器（use_item / click_block） |
| `ContainerOpen` | 46 | 服务端确认打开，客户端缓存 |
| `InventoryContent` | 49 | 容器槽位内容，客户端缓存 |
| `BlockActorData` | 56 | 方块实体数据（告示牌文本、命令方块命令），客户端缓存 |

`engine.openContainer(x, y, z)` 会发送打开请求，并返回**当前已缓存**的数据；
容器内容到达后再次调用即可拿到完整槽位。它要求本地玩家坐标已被服务器确认，
否则抛 `ConnectionError`。

`game_state.get_container()` 只查询缓存，不会主动发请求；`slots` 为 `None`
表示「容器已打开但内容包尚未到达」。

## 子区块（SubChunk，ID 174）

两条获取路径：

| 接口 | 返回的 `states` | 特点 |
| --- | --- | --- |
| `engine.get_subchunk_blocks(...)` | `dict` | 同步阻塞，失败抛 `ConnectionError` |
| `game_state.request_subchunks_async(...)` | JSON 字符串 | 异步句柄，可超时 / 取消 |

`offsets` 是子区块相对原点的偏移，每个分量按 `int8` 处理。
返回项：

```python
{"x": 0, "y": 64, "z": 0, "name": "minecraft:stone", "states": {...}}
```

## 下一步

- [RPC 与反作弊校验](/architecture/anti-cheat)
- [协议数据包处理（插件视角）](/plugin/protocol)
