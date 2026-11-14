# 原生模块速查

本文给可直接复制的示例；完整导出列表见[接口参考](/api/reference)。

## NBT

```python
import nbt

document = nbt.loads(raw, "network_little_endian")
root = document.GetRoot()

# 读取
name = root.Get("CustomName")
if name is not None:
    print(name.GetValue())

# 修改 / 新增
root.Set("CustomName", nbt.Tag.String("Storage"))

# 序列化
encoded = nbt.dumps(root, root.Get("CustomName").GetValue(), "network_little_endian")
```

支持的编码：

| 名称 | 说明 |
| --- | --- |
| `big_endian` / `big` | 大端 |
| `little_endian` / `little` | 小端 |
| `network_little_endian` / `network` | 网络小端（基岩版默认） |

### Tag 构造器

```python
nbt.Tag.Byte(1)
nbt.Tag.Short(2)
nbt.Tag.Int(3)
nbt.Tag.Long(4)
nbt.Tag.Float(1.5)
nbt.Tag.Double(2.5)
nbt.Tag.ByteArray(b"\x01\x02")
nbt.Tag.String("text")
nbt.Tag.List(nbt.TagType.Int, [nbt.Tag.Int(1), nbt.Tag.Int(2)])
nbt.Tag.Compound({"id": nbt.Tag.String("Chest")})
nbt.Tag.IntArray([1, 2, 3])
nbt.Tag.LongArray([1, 2, 3])
```

### Tag 方法

| 方法 | 说明 |
| --- | --- |
| `GetType()` | 返回 `TagType` |
| `GetListElementType()` | List 的元素类型 |
| `GetValue()` | 标量值（List / Compound 返回 Python 容器） |
| `ToPython()` | 递归转成 Python 原生对象 |
| `Get(key_or_index)` | Compound 按键 / List 按索引取子 Tag，不存在返回 `None` |
| `Set(key, value)` | 设置 Compound 字段 |
| `Append(value)` | 追加 List 元素 |
| `Contains(key)` | Compound 是否包含键 |
| `Erase(key)` | 删除 Compound 字段，返回 `bool` |
| `Size()` / `len(tag)` | 元素数量 |
| `ToSnbt()` | 转 SNBT 字符串 |

### Document 与模块函数

| 函数 / 方法 | 说明 |
| --- | --- |
| `loads(data, encoding="network_little_endian", allow_trailing_data=False, max_depth=64, max_elements=1<<20)` | 解析为 `Document` |
| `load_tag(data, encoding=...)` | 直接返回根 `Tag` |
| `dumps(root, root_name="", encoding=...)` | 序列化根 Tag |
| `dump_document(document, encoding=...)` | 序列化 Document（保留根名） |
| `flatten(tag)` | 扁平化为 `dict[str, str]` |
| `document.GetRoot()` / `SetRoot(tag)` | 根 Tag |
| `document.GetRootName()` / `SetRootName(name)` | 根名 |
| `document.GetBytesRead()` | 已读取字节数 |
| `document.ToSnbt()` | SNBT 字符串 |

::: warning 两个约束
- 同一个 List 的所有元素必须是**同一类型**。
- Compound 不允许包含名为 End 的 Tag。
:::

NBT 解析失败抛 `api_errors.NbtError`。

## packets

### 通用 Packet

```python
from packets import Packet, encode, decode, decode_bytes

packet = Packet(9, payload)          # 包 ID + 不含 ID 的负载
print(packet.GetPacketID())
print(packet.GetPacketName())
print(packet.GetPayload())
print(packet.GetData())              # 已支持结构化解析时返回 dict，否则 None
raw = packet.Serialize()             # varint 包 ID + 负载
```

```python
raw = encode(9, payload)
packet = decode(9, payload)
packet = decode_bytes(raw)           # 自动读取 varint 包 ID
```

### CommandRequest

```python
import os
from packets import CommandOrigin, CommandRequest

packet = CommandRequest()
packet.SetCommand("say hello")
packet.SetCommandOrigin(CommandOrigin.Player)
packet.SetRandomUUID(os.urandom(16))
packet.SetRequestID("my-request")
packet.SetPlayerID(0)
packet.SetInternalSource(False)
packet.SetUnlimit(True)

packet.Send()          # 直接写入当前游戏连接，返回 WritePacket 结果
raw = packet.Serialize()
```

::: warning 线格式固定为 player + latest
当前协议下 C++ 的 `Serialize()` 固定写：

```text
command
"player"
16 字节 UUID
request_id
int64 player_id（负数按 0）
bool internal_source
bool unlimit
"latest"
```

`SetCommandOrigin()` / `SetCommandVersion()` 仅保存值，不改变线格式。
`SetRandomUUID()` 必须传 16 字节，否则抛 `PacketError`。
:::

`Send()` 在客户端未连接时抛 `api_errors.ConnectionError`。

## 游戏状态

```python
import game_state

player = game_state.get_local_player()
if player is None:
    print("server has not confirmed local player state")
else:
    print(player["entity_runtime_id"])
    print(player["position"])      # dict 或 None
    print(player["rotation"])      # dict 或 None
```

### 可用函数

| 函数 | 返回 |
| --- | --- |
| `get_local_player()` | 本地玩家状态或 `None` |
| `has_local_player()` | `bool` |
| `get_server()` | `{ip, port, server_id}` 或 `None` |
| `get_block_actor(x, y, z)` | 方块实体数据或 `None` |
| `get_container(x, y, z)` | 容器数据或 `None` |
| `get_players()` | 玩家列表 |
| `get_world()` | 世界基础状态或 `None` |
| `get_inventory()` | 窗口 0 背包或 `None` |
| `request_subchunks_async(...)` | 异步子区块请求句柄 |

### 方块实体与容器

```python
actor = game_state.get_block_actor(106, 93, 69)
if actor is not None:
    print(actor["raw_nbt"])       # bytes
    tag = actor["nbt"]            # nbt.Tag 或 None
    if tag is not None:
        print(tag.ToSnbt())

container = game_state.get_container(106, 93, 69)
if container is not None and container["slots"] is not None:
    for slot in container["slots"]:
        print(slot["network_id"], slot["count"], slot["extra"])
```

容器已经打开但内容包尚未到达时，`slots` 为 `None`，**不会**返回空容器。

### 玩家 / 世界 / 背包

```python
for player in game_state.get_players():
    print(player["username"], player["entity_unique_id"], player["uuid"].hex())

world = game_state.get_world()
if world is not None:
    print(world["gamemode"], world["position"])

inventory = game_state.get_inventory()
if inventory is not None:
    print(inventory["window_id"], len(inventory["slots"]))
```

### 异步子区块

```python
request = game_state.request_subchunks_async(
    0, 64, 0,
    [(0, 0, 0), (1, 0, 0)],
    timeout_ms=6000,
)

if not request.done():
    print("still loading")

blocks = request.result(3000)
for block in blocks:
    # 注意：这里的 states 是 JSON 字符串
    print(block["x"], block["y"], block["z"], block["name"], block["states"])
```

`request.result()` 超时抛 `api_errors.TimeoutError`。想要 `states` 直接是 dict，
用同步的 `engine.get_subchunk_blocks()`。

## 关于 None 的语义

::: warning None 一律表示「不知道」，不是「空」
- 容器**已经打开但内容包尚未到达**时，`slots` 为 `None`，不会返回空容器。
- 本地移动或转向产生的预测值不属于查询结果；服务器确认前，对应的
  `position` / `rotation` 字段为 `None`。
- `get_server()` 只在服务器已通过 `StartGame` 确认当前游戏会话后返回信息；
  断线和重连期间返回 `None`。
- `engine.get_pot_*`、`engine.get_head_*` 与 `engine.get_entity_runtime_id()`
  同样遵守这一规则。
:::

## 下一步

- [结构化协议事件](/api/structured-events)
- [接口参考](/api/reference)
