# 插件常见问题

### Q: 控制台中文乱码？

A: Py3 下 `str` 是 Unicode，网络数据是 UTF-8，插件内**直接使用即可**。
Windows 控制台默认 GBK，`print` 中文可能显示乱码，可以这样让控制台正确显示：

```python
import sys
sys.stdout.reconfigure(encoding='utf-8')     # 或 'gbk'
```

仅影响控制台显示，**不影响实际发送 / 接收的中文**。

### Q: 重载后事件会不会重复注册？

A: 不会。

- **单插件重载**：先精准注销该插件所有事件再重新执行
- **全量重载**：`cleanup_user()` 清空所有用户事件

### Q: `engine.trigger` 传 dict 但回调收到 list？

A: C++ 层会把非 list/tuple 参数包成 `[arg]`。传 dict 请用 `[dict]` 包一层：

```python
engine.trigger("MyEvent", [my_dict])        # ✅
engine.trigger("MyEvent", my_dict)          # ❌ 回调收到 [[my_dict]]
```

回调：

```python
def handler(args):
    data = args[0]      # 收到 my_dict
```

### Q: 事件注册了但回调不触发？

A: 按这个顺序查：

1. 用对注册函数了吗？（插件只能用 `engine.register`）
2. `engine.trigger` 的第二个参数是 list/tuple 吗？非 list/tuple 会被**静默丢弃**，
   没有报错。
3. 事件名拼写是否完全一致？

### Q: 怎么发游戏指令？

```python
engine.command("/say hello")
engine.command("/tp @s 0 100 0")
engine.settingscommand("/gamemode creative @s")   # 需要管理员权限
```

### Q: `pkt` 和 `struct` 有什么区别？

A: `pkt` 支持 varint、varint 前缀字符串等 MC 协议特有类型，`struct` 只支持固定长度。
解析数据包用 `pkt` 更方便。

### Q: 线程没停导致重载崩溃？

A: 必须实现 `on_uninit()` 停止所有线程。旧线程跑旧代码、引用已卸载的模块对象会崩溃。

### Q: 想用 `numpy` / `Pillow` / `lxml` 这类库怎么办？

A: 当前**用不了**。解释器是静态链接的，官方 `.pyd` 动态扩展加载不了 ——
只有 `py3-none-any` 的纯 Python 包能 `pip install --target` 进去。

替代方案：

1. 看看纯 Python 的替代品（如 `requests` 代替 `httpx` 的简单用法、纯 Python 的图片处理库）；
2. 需要 C 扩展就把源码编进 exe（改 `cmake/PythonBuiltinModules.cmake` 白名单 + 重编）；
3. 或者按 `Program.lib` 自编 `.pyd` 放进 `source/Lib/site-packages/`。

详见[静态链接与扩展限制](/architecture/static-linking)。

### Q: 从 Python 2.7 迁移到 3.12，我的旧插件要改什么？

A: 主要改这三类：

1. **语法**：`print 'x'` → `print('x')`；`reload(x)` → `importlib.reload(x)`；
   `import thread` → `import threading`（或 `_thread`）。
2. **编码**：删除所有 `.decode('utf-8').encode('gbk')` ——
   Py3 下字符串已是 Unicode，直接使用。
3. **pkt 返回值**：`pkt.read_string` / `unpack 's'` 返回 `str`（非 bytes），
   不要对它再 `.decode()`。

另外，`source/lib/` 里的旧 Py2 标准库副本（`urllib2`、`StringIO` 等）已不再需要，
直接用 Py3 标准库（`urllib.request`、`io` 等）。

更完整的迁移说明见 [Py2 → Py3 迁移](/reference/migration)。

## 下一步

- [Python 原生接口](/api/) —— `nbt` / `packets` / `game_state`
- [Py2 → Py3 迁移](/reference/migration)
