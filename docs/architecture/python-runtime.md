# Python 内嵌机制

解释器核心由 `cmake/BuildPython312.cmake` 在 configure 期从 `third_party/Python-3.12.2`
编成静态库 `python312core.lib`（约 74 MB），直接链进 `Program.exe`。
运行时**不需要** `python312.dll` / `python3.dll`。

## 初始化流程

`PythonRuntime::startUp()`（`application/Python/PythonRuntime.cpp`）：

1. 设 `Py_NoSiteFlag = 1`、`Py_IgnoreEnvironmentFlag = 1`
2. **`SetPythonHome()`** —— 指向 `<exe 目录>/source`（通过 `GetModuleFileNameA` 计算）

   标准库在 `source/Lib/`：`Modules/getpath.py:193-194` 在 Windows 上用 `Lib\os.py`
   作 landmark 在 prefix 下找标准库；**缺 `DLLs/` 目录是被显式容忍的**
   （`getpath.py:610-614`，注释 `If DLLs is missing on Windows, don't warn`），
   所以静态化后删掉 `DLLs/` 不会报错。

3. **`AppendStdlibInittab()` —— 必须在 `Py_Initialize()` 之前**

   把编进 exe 的 stdlib C 扩展注册进 builtin import table。声明与注册代码由
   `cmake/PythonBuiltinModules.cmake` 生成到
   `build/generated/ntvector_python_builtin_inittab.inc`。

4. `Py_Initialize()` → `PyEval_SaveThread()`（释放 GIL 给工作线程）
5. `PyGILState_Ensure()` → `initModules()`（注册本工程自己的 19 个模块）
6. 按模式设置 `sys.path`，然后 `import init`

::: tip 为什么用 `PyImport_AppendInittab` 而不是往 `sys.modules` 塞
前者是 `Python/import.c` 契约里的 **pre-init-only** 接口
（`PyImport_AppendInittab() may not be called after Py_Initialize()`），
它决定 `sys.builtin_module_names`，也是 `BuiltinImporter`（`sys.meta_path` 第一顺位）
的查找来源。

后者只对 `sys.modules` 已命中的 `import` 生效，`find_spec`、子解释器、
以及 `initModules()` 之前的 import 都看不到。

本工程自己的 19 个模块仍走 `sys.modules` 注册（见 `initModules`），没有改动。
:::

## sys.path 的两种模式

`startUp()` 里有两条分支：

| 模式 | 触发 | sys.path 处理 |
| --- | --- | --- |
| **source 模式**（当前支持） | `ConfigLoader::use_mcp == false` | **不清空**默认路径（清空会丢掉标准库），只追加 `./source`、`./scripts`、`./source/Lib/site-packages` |
| **MCP 模式**（遗留） | `use_mcp == true` | 先 `PyList_SetSlice` **整个清空**，再追加 `vanilla.mcp/*` 系列路径 |

::: warning MCP 分支的坑
清空 `sys.path` 会连标准库路径一起清掉。静态链接下这些路径由 `PYTHONHOME` 在启动时
解析一次，之后必须显式补回。当前代码已在 MCP 路径**之后**补回
`./source/Lib` 与 `./source/Lib/site-packages`（追加在最后，所以
`vanilla.mcp/lib/` 若存在仍然优先）。
:::

## 框架模块划分

`source/` **不是包**，只是一个被追加到 `sys.path` 的普通目录，`init.py` 以顶层模块
`init` 的身份被 `PyRun_SimpleString("import init")` 加载。因此 `init.py` 里只能用
**裸 import**（`from ntvector.plugins import ...`）；而 `ntvector/` 是真包，内部可以用相对 import。

`init.py` 只保留启动编排与 kernel 事件注册，实现按职责拆到 `ntvector/`：

| 模块 | 职责 | 关键符号 |
| --- | --- | --- |
| `init.py` | 入口：启动编排、kernel 事件注册、转发插件管理 API | `_on_start_game` · `_on_reload` |
| `ntvector/common.py` | 日志工厂 + `umsgpack.compatibility` 全局开关 | `make_logger` · `LOG_INFO/WARN/ERROR` |
| `ntvector/plugins.py` | 插件加载 / 重载 / 文件监视热重载 | `load_all_plugins` · `reload_plugin` · `start_watch` |
| `ntvector/mcp_check.py` | RPC 反作弊校验 | `_on_rpc` · `_mcp_check_num` |
| `ntvector/mcp_pack.py` | `.mcp` 打包工具（`--do_main mcp_compile`） | `pack_mcp` · `_do_mcp_compile` |
| `ntvector/neox.py` | NeoXHash（`.mcp` 容器里的文件名 / 目录名哈希） | `neox_hash` |

依赖是单向的，没有环：

```text
init.py ──→ ntvector.plugins ──→ ntvector.mcp_pack ──→ ntvector.neox
   │               │                    │                   │
   └───────────────┴────────────────────┴───────→ ntvector.common
```

::: tip `umsgpack.compatibility` 为什么放在 common.py
它必须在**任何** `packb()` 之前生效，否则长度 > 31 字节的字符串会被打成 `str8`
而不是 `raw16`，反作弊校验必然失败。集中放在 `common.py` 的模块级，而其他所有模块
都导入它 —— 顺序就天然正确，不依赖谁先谁后。
:::

::: warning 不要往 `source/` 里放与插件同名的模块
`sys.path` 中 `./source` 排在 `./scripts` **之前**。新建一个 `source/main.py` 这类文件，
有很高的概率静默顶替同名插件，打断依赖它的其它插件。框架代码统一收进 `ntvector/`
包内，就不会与插件名或原生模块名竞争。
:::

::: info 改 `source/` 下的文件需要重启
文件监视器只 `os.walk(./scripts)`，`source/` 不参与热重载 —— 这一点在拆分前后没有变化。
:::

## 模块注册（19 个）

`PythonRuntime::initModules()` 逐个调用 `PyInit_*()` 创建模块，再由 `RegisterModule()`
塞进 `sys.modules`：

```cpp
static void RegisterModule(PyObject* m, const char* name)
{
    if (m) {
        PyDict_SetItemString(PyImport_GetModuleDict(), name, m);
        Py_DECREF(m);
    }
}
```

| 模块 | init 符号 | 创建方式 |
| --- | --- | --- |
| `api_errors` | `PyInit_api_errors` | C API |
| `nbt` | `PyInit_nbt` | pybind11 |
| `packets` | `PyInit_packets` | pybind11 |
| `game_state` | `PyInit_game_state` | pybind11 |
| `client_instance` | `PyInit_client_instance` | pybind11 |
| `easy_utils` | `PyInit_easy_utils` | pybind11 |
| `_client` | `PyInit__client` | C API |
| `tan_lobby_game_clicpp_wrapper` | `register_tan_lobby_game_module()` | pybind11 `create_extension_module` |
| `_websocket` | `PyInit__websocket` | C API |
| `aes` | `PyInit_aes` | C API |
| `_chacha` | `PyInit__chacha` | C API |
| `_raknet` | `PyInit__raknet` | C API |
| `utility` | `PyInit_utility` | C API |
| `setting` | `PyInit_setting` | C API |
| `mod_log` | `PyInit_mod_log` | C API |
| `engine` | `PyInit_engine` | C API |
| `rotor` | `PyInit_rotor` | C API |
| `fop` | `PyInit_fop` | C API |
| `pkt` | `PyInit_pkt` | C API |

::: details 两个已知的编译期坑
- `fopmodule.cpp` / `rotormodule.c` 通过 `.h` 里 `#include "xxx.cpp"` 编译进多个 TU，
  init 函数必须 `static`（否则链接重复定义）。
- pybind11 2.13 的 `create_extension_module` 会对传入指针做 placement new，
  传 `nullptr` 会写地址 0 崩溃；`TanGame.cpp` 传的是 `new PyModuleDef()`。
:::

## 编进 exe 的 stdlib C 扩展

CPython 3.12 把 `_socket` / `select` / `_queue` 等一批 stdlib C 模块从核心拆成了
独立 `.pyd`。静态链接下这些文件加载不了，必须把源码编进 exe 并注册为 builtin。

白名单在 `cmake/PythonBuiltinModules.cmake`，**加一个扩展 = 表里加一行 + 重编 exe**，
C++ 侧不用改：

| 模块 | 备注 |
| --- | --- |
| `_socket` `select` `_queue` | 框架/插件实际用到；`Lib/socket.py:52` 与 `Lib/selectors.py:12` 是**硬 import** |
| `zlib` | 核心出于符号冲突没内建它；对着项目自己的 `zlibstatic` 编 |
| `_hashlib` | 源文件是 `Modules/_hashopenssl.c`（不是 `_hashlib.c`） |
| `unicodedata` `_overlapped` `_zoneinfo` `winsound` `_asyncio` `_uuid` `_multiprocessing` | 常见插件写法覆盖 |
| `pyexpat` `_elementtree` | 共用 `Modules/expat/` 的三个 `.c`（内置，无需外部 expat） |

**已经是核心内建、不要重复加的**：`winreg`（`PC/winreg.c`）、`binascii`、`_struct`、
`_json`、`_pickle`、`_random`、`_thread`、`_sre`、`_csv`、`_datetime`、`math`、`cmath`、
`array`、`mmap`、`signal`、`_winapi`、`cjkcodecs`（gbk / gb18030 等）等 74 个模块。

::: tip `hashlib` 不需要 `_hashlib` 也能用
`Lib/hashlib.py` 有 `except ImportError: __get_hash = __get_builtin_constructor`，
会回退到内建 `_sha256` / `_sha512` / `md5`。只有 `pbkdf2_hmac` / `scrypt` 依赖
OpenSSL 版。
:::

## 字符串编码边界

| 方向 | 规则 |
| --- | --- |
| C++ → Python 文本 | `PyTextFromUtf8`（UTF-8 数据）/ `PyTextFromGbk`（GBK 配置，走 Python 的 gbk codec） |
| C++ → Python 二进制 | `PyBytes_FromStringAndSize` |
| Python → C++（`s` / `s#`） | Py3 下给出 **UTF-8** |
| Python → C++（`y#`） | 给出 **bytes** |

集中辅助在 `application/Python/Py3Compat.h`（header-only，不依赖 `windows.h`）。

## 下一步

- [静态链接与扩展限制](/architecture/static-linking)
- [事件系统](/architecture/events)
