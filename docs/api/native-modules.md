# 原生模块速查

## NBT

```python
import nbt

document = nbt.loads(raw, "network_little_endian")
root = document.GetRoot()
root.Set("CustomName", nbt.Tag.String("Storage"))
encoded = nbt.dump_document(document, "network_little_endian")
```

支持 `big_endian`、`little_endian` 和 `network_little_endian`。

::: warning 两个约束
- 所有列表必须保持**单一元素类型**
- Compound 不允许包含命名 End Tag
:::

## CommandRequest

```python
import os
from packets import CommandOrigin, CommandRequest

packet = CommandRequest()
packet.SetCommand("say hello")
packet.SetCommandOrigin(CommandOrigin.Player)
packet.SetRandomUUID(os.urandom(16))
packet.Send()
```

::: tip 协议字段不作为 Python 属性暴露
版本适配由 C++ 的 `Serialize()` 负责 —— 你不需要关心线格式随协议版本的变化。
:::

## 游戏状态

```python
import game_state

player = game_state.get_local_player()
if player is None:
    print("server has not confirmed local player state")
else:
    print(player["position"])
```

`get_block_actor` 和 `get_container` 同样在缓存中不存在目标时返回 `None`。

## 关于 None 的语义

::: warning None 一律表示「不知道」，不是「空」
- 容器**已经打开但内容包尚未到达**时，返回结果中的 `slots` 为 `None`，
  **不会**错误地返回空容器
- 本地移动或转向产生的**预测值不属于查询结果**；服务器确认前，对应的 `position`
  或 `rotation` 字段为 `None`
- `get_server()` 只在服务器已通过 `StartGame` 确认当前游戏会话后返回信息；
  **断线和重连期间返回 `None`**
:::

旧版 `engine.get_pot_*`、`engine.get_head_*` 与 `engine.get_entity_runtime_id()`
同样遵守这一规则。

## 下一步

- [结构化协议事件](/api/structured-events)
- [接口参考](/api/reference)
