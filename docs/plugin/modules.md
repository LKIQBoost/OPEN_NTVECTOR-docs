# 模块与工具

## C++ 内置模块（直接 import）

| 模块 | 用途 |
| --- | --- |
| `engine` | 事件系统、RPC、游戏控制 |
| `mod_log` | 日志输出到 C++ Logger |
| `setting` | 获取 UID、玩家 ID、版本号 |
| `utility` | 加解密工具 |
| `pkt` | 二进制数据包快速读写（MC 协议专用） |
| `fop` | MCP 文件系统操作（普通用户无需使用） |
| `rotor` | Rotor 加密 |
| `aes` | AES 加密 |
| `_chacha` | ChaCha20 加密 |
| `_websocket` | WebSocket 客户端 |

另有 `nbt` / `packets` / `game_state` / `api_errors` 等新接口，见
[Python 原生接口](/api/reference)。

## mod_log —— 日志

```python
import mod_log

mod_log.log(1, "普通信息")    # LOG_INFO  = 1
mod_log.log(2, "警告信息")    # LOG_WARN  = 2
mod_log.log(4, "错误信息")    # LOG_ERROR = 4
```

## setting —— 玩家 / 版本信息

| 函数 | 返回值 | 说明 |
| --- | --- | --- |
| `setting.gettoken()` | `str` | 当前登录 token |
| `setting.getplayerid()` | `str` | Py 层玩家实体 ID |
| `setting.get_engine_version()` | `str` | 引擎版本 |
| `setting.get_patch_version()` | `str` | 补丁版本 |
| `setting.get_uid()` | `str` | 用户 ID |
| `setting.get_name()` | `str` | 玩家昵称（**已是 str，中文直接可用**） |

## utility —— 加解密

| 函数 | 说明 |
| --- | --- |
| `utility.encrypt_with_tail(bytes)` → `bytes` | 加密（同 `/authentication-v2` 模式） |
| `utility.decrypt_with_tail(bytes)` → `bytes` | 解密（同 `/authentication-v2` 模式） |
| `utility.get_encrypt_token(token, body, url)` → `bytes` | 生成 HTTP 动态 token（用于 user-token 标头） |

## pkt —— MC 协议数据包读写

### 读取函数

所有读取函数返回 `(value, new_offset)`：

| 函数 | 说明 |
| --- | --- |
| `pkt.read_byte(data, off)` | uint8 |
| `pkt.read_bool(data, off)` | bool |
| `pkt.read_varint(data, off)` | 无符号 varint |
| `pkt.read_svarint(data, off)` | 有符号 zigzag varint |
| `pkt.read_string(data, off)` | varint 长度前缀字符串（**返回 str，已解码 UTF-8**） |
| `pkt.read_u16(data, off)` | 小端 uint16 |
| `pkt.read_u32(data, off)` | 小端 uint32 |
| `pkt.read_u64(data, off)` | 小端 uint64 |
| `pkt.read_i32(data, off)` | 小端 int32 |
| `pkt.read_i64(data, off)` | 小端 int64 |
| `pkt.read_f32(data, off)` | 小端 float32 |
| `pkt.read_f64(data, off)` | 小端 float64 |
| `pkt.read_bytes(data, off, n)` | 读 n 个字节（**返回 bytes**） |
| `pkt.remaining(data, off)` | 剩余字节数 |

::: tip Py3 行为变化
`read_string` / `unpack 's'` 返回**解码后的 `str`**（Unicode），不再是 Py2 的 bytes。
插件直接使用即可，中文无需再 `.decode()`。
:::

### 写入函数

所有写入函数返回 `bytes`：

| 函数 | 说明 |
| --- | --- |
| `pkt.write_byte(val)` | uint8 |
| `pkt.write_bool(val)` | bool |
| `pkt.write_varint(val)` | 无符号 varint |
| `pkt.write_string(s)` | varint 长度前缀字符串（接受 str） |
| `pkt.write_u16(val)` | 小端 uint16 |
| `pkt.write_u32(val)` | 小端 uint32 |
| `pkt.write_i32(val)` | 小端 int32 |
| `pkt.write_u64(val)` | 小端 uint64 |
| `pkt.write_f32(val)` | 小端 float32 |
| `pkt.write_f64(val)` | 小端 float64 |

### 批量读取 / 写入

```python
# 批量读取
pkt.unpack("b?vs", data, off)       # → (val1, val2, val3, val4, new_off)

# 格式码
# b = byte(u8)    ? = bool          v = varint(无符号)
# V = svarint     s = varint前缀字符串 → 返回 str
# h = u16         H = i16           i = u32
# I = i32         q = u64           Q = i64
# f = f32         d = f64

# 批量写入
pkt.pack("b?vs", 1, True, 100, "hello")   # → bytes
```

::: tip pkt 和 struct 的区别
`pkt` 支持 varint、varint 前缀字符串等 MC 协议特有类型；`struct` 只支持固定长度。
解析数据包用 `pkt` 更方便。
:::

## 下一步

- [协议数据包](/plugin/protocol)
- [代码模板](/plugin/templates)
