# 快速开始

## 基础环境

| 项目 | 说明 |
| --- | --- |
| Python 版本 | **3.12.2**（解释器核心静态链在 `Program.exe` 里，exe 旁没有 `python312.dll`） |
| 语法 | 使用 **Python 3** 语法 |
| 开发模式 | **source 模式**（源码）—— 修改 `.py` 文件后自动热重载 |
| 发布模式 | MCP 模式（**遗留**，仅 source 模式受支持） |
| Python 运行时 | `source/Lib/`（标准库 + `site-packages/`），由 exe 的 `PYTHONHOME=<exe>\source` 定位 |
| 插件目录 | `scripts/` —— 所有插件均放在此目录下 |

::: warning 不要修改 source/
`source/` 是 Vector 运行环境（框架脚本 + 标准库）。你的代码放 `scripts/`。
:::

## 装第三方库

Vector 内置完整 Python 3.12 标准库。如需第三方库：

```bash
# 用系统 Python 的 pip 安装到 Vector 的 site-packages：
pip install requests --target "Vector\source\Lib\site-packages"
```

或直接把纯 Python 包复制到 `source/Lib/site-packages/`。插件里直接 `import` 即可。

::: danger 只支持纯 Python 包
wheel 文件名形如 `py3-none-any` 的才可以。带平台 tag 的包（`numpy`、`Pillow`、`lxml`
这类 `cp312-...-win_amd64` wheel）装进去也**无法 import** —— 解释器是静态链接的，
官方 `.pyd` 加载不了。

原因和绕法见[静态链接与扩展限制](/architecture/static-linking)。
:::

## 插件目录结构

```text
scripts/
  my_plugin/                  ← 插件根目录（与内层包名一致）
    redirect.py               ← MCP 导入钩子（source 模式可为空文件）
    my_plugin/                ← 实际 Python 包
      __init__.py             ← 插件入口（必须，加载时自动执行）
      other_module.py         ← 其他模块（可选）
      utils/                  ← 子包（可选）
        __init__.py
```

**命名规则：**

- 插件根目录名 = 内层包名 = 插件名，三者**必须一致**
- `__init__.py` 是插件入口，加载时自动执行
- `redirect.py` 只在 MCP 模式下生效，source 模式可以放空文件
- **不要在**插件根目录放 `__init__.py`，否则会和内层包冲突

一个最小插件：

```python
# scripts/my_plugin/my_plugin/__init__.py

def on_start(args):
    print('MyPlugin loaded!')
    engine.message('', 'Hello, world!')

engine.register(on_start, "ModEventStartUp")
```

## 加载流程

```text
start_game 事件
  → init.py 调用 load_all_plugins()
  → 扫描 scripts/ 下的插件目录
  → 将插件根目录加入 sys.path
  → __import__('插件名') 执行 __init__.py
  → 触发 ModEventStartUp 事件（所有插件加载完成）
```

## 热重载

**开发阶段（source 模式）自带文件监视：**

- 每 **1.5 秒**扫描 `scripts/` 下所有 `.py` 文件的修改时间
- **只重载有修改的那个插件**，不影响其他插件
- 保存文件即生效，无需手动操作

**单插件重载流程：**

```text
1. 调用插件的 on_uninit()（如果实现了）
2. 精准注销该插件注册的所有事件
3. importlib.reload() 重新执行插件代码
```

**全量重载：**

```python
engine.trigger("reload")       # 或 engine.trigger("mod_reload")
```

```text
1. 触发 ModEventUnInit 事件（所有插件收到）
2. engine.cleanup_user() 清除所有用户事件
3. engine.clear_all_user_protocol_event() 清除所有用户协议事件
4. 逐个 reload() 所有已加载插件
5. 触发 ModEventStartUp 事件
```

也可以在 Python 层调用：

```python
import init
init.reload_plugin("my_plugin")      # 重载指定插件
init.reload_all_plugins()            # 重载所有插件
```

::: danger 有后台线程就必须实现 on_uninit()
否则重载时会崩溃 —— 旧线程还在跑，引用的模块对象已经被卸载了。
见[代码模板 · 线程与资源](/plugin/templates#线程与资源管理)。
:::

## 下一步

- [事件系统](/plugin/events)
- [engine API](/plugin/engine)
- [代码模板](/plugin/templates)
