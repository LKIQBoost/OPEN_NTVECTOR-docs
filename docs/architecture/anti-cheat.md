# RPC 与反作弊校验

服务器通过 `PyRpc` 包下发 `on_rpc` 事件，框架（`source/ntvector/mcp_check.py`）负责响应。
这条链**必须完整**，否则会被判定为「违规游戏行为」并踢下线。

## 三种 RPC

| 服务器请求 | 框架响应 | 说明 |
| --- | --- | --- |
| `S2CHeartBeat` | `ClientLoadAddonsFinishedFromGac` | 心跳 |
| `GetStartType` | `SetStartType` | 用 `utility` 解密 / 加密 |
| `GetMCPCheckNum` | `SetMCPCheckNum` | **反作弊校验值计算** |

## MCP 校验链

`GetMCPCheckNum` 的处理是整条链里最脆弱的部分，Py2 → Py3 迁移时**全是坑**。
实现全部位于 `source/ntvector/mcp_check.py`：

```text
_mcp_rotor_decrypt        ← rotor.decrypt + zlib + _mcp_reverse_data
        ↓
_get_calc_check_num       ← RC4 解密 + md5
        ↓
SetMCPCheckNum            ← 回给服务器
```

::: danger 三个必须同时成立的条件
1. **`umsgpack.compatibility = True`** —— 否则长度 > 31 字节的字符串会被打成
   `str8` 而不是 `raw16`，字节流与服务器期望的不一致，校验必然失败。
   这一行在 `source/ntvector/common.py` 模块级执行，所有框架模块都导入它，
   所以它必然先于任何 `packb()` 生效。
2. **RC4 / `_mcp_reverse_data` / `_get_calc_check_num` 必须是 Py3 版本**
   （bytes / int 操作）—— 迁移时这三处都重写过。
3. **`on_rpc` 事件必须以 bytes 传递** —— C++ 侧必须走 `triggerBytes`，
   用普通 `trigger` 会被当 UTF-8 文本解码，msgpack 数据当场损坏。
:::

## 失败的表现

服务器判定「违规游戏行为，您的账号被禁止进入游戏」并踢下线，
记录在 `dis.log`。

这**不是**协议错误、也不是登录失败 —— 登录是成功的（`PlayStatus 0`），
是校验值算错了。

## 排查清单

怀疑校验链有问题时，按顺序查：

1. `on_rpc` 事件真的触发了吗？（`triggerBytes` vs `trigger`，见
   [事件系统](/architecture/events#两个触发入口)）
2. `umsgpack.compatibility` 是否在**打包前**设成了 `True`？
3. `source/Lib/site-packages/umsgpack.py` 是不是 Py3 版本？
4. `rotor` / RC4 的处理路径有没有被改动？（这几处对字节序和整数行为很敏感）
5. 是否改动了 `PythonRuntime.cpp` 的初始化顺序？
   `AppendStdlibInittab()` 必须在 `Py_Initialize()` **之前**。

::: tip 静态化之后的额外注意事项
解释器从动态改成静态链接后，初始化路径变了。上线前必须实测一次真实连服，
确认 `PlayStatus value: 3`（PlayerSpawn 正常进服）**且未被踢**。
2026-09-26 已实测通过，见[静态链接与扩展限制](/architecture/static-linking#实测状态)。
:::

## 下一步

- [插件开发](/plugin/) —— 写插件时你不需要碰这条链，但要知道它存在
- [常见问题](/guide/faq)
