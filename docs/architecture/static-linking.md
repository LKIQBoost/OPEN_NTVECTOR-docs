# 静态链接与扩展限制

## 形态

解释器核心由 `cmake/BuildPython312.cmake` 在 configure 期编成静态库
`python312core.lib`（约 74 MB）链进 `Program.exe`，exe 旁**没有** `python312.dll`。

这与 Python 2.7 时代一致：当年用 `Py_NO_ENABLE_SHARED` + `PYTHON_STATIC` 链
32 MB 的静态 `python27.lib`，由仓库里 `Python-2.7.18/PCbuild` 的 `pythoncore` 工程
（MSBuild，amd64 Release）产出。

**为什么要自己编**：CPython 官方在 **3.12 把 `PCbuild/pythoncore.vcxproj` 改成直接产
DLL** 了，静态工程不复存在。所以 `BuildPython312.cmake` 会读取该工程、打 7 处补丁
（`ConfigurationType=StaticLibrary` / `TargetName` / 去掉 `_TriggerRegen` 与
`regen.targets` / 去掉 `python_nt.rc` / 补 zlib include / 相对路径与 Import 绝对化），
生成副本到 `build/_deps/python-static/proj/` 再构建 —— **不改 `third_party/` 里的源码**。

构建细节见[构建 · 静态 CPython 核心是怎么来的](/guide/build#静态-cpython-核心是怎么来的)。

## 链接宏怎么分配

搞反的后果很隐蔽，所以单独列出来：

| 构建单元 | 宏 | 效果 |
| --- | --- | --- |
| `python312core.lib` | **保留** `Py_ENABLE_SHARED` + `Py_BUILD_CORE` | `Py_EXPORTED_SYMBOL` 非空 → API 带 `dllexport` 导出进 `Program.exe` |
| `Program.exe` 的应用 TU | `Py_NO_ENABLE_SHARED` | API 声明不是 `dllimport`，同映像内直接调用 |
| 用户自编 `.pyd` | 默认（`pyconfig.h` 自动给 `Py_ENABLE_SHARED`） | 按模块名从 `Program.exe` 导入 |

依据是 `Include/exports.h:6-9`：**`Py_ENABLE_SHARED` 没有定义时
`Py_EXPORTED_SYMBOL` 是空的**，而 `Include/pyport.h:507` 的整个 dllexport 分支
也以它为门。

::: danger 两种搞反的后果
- 核心写成 `Py_NO_ENABLE_SHARED` → **零导出**，`.pyd` 那条路直接死掉。
- 应用侧带 `Py_ENABLE_SHARED` → `PyAPI_FUNC` 变成 `dllimport`，
  会去找一个并不存在的 `python312.dll`，链接失败。

`application/application.cpp` 顶部原来那句 `#define Py_ENABLE_SHARED` 已删除 ——
链接方式必须只由 CMake 决定，否则该 TU 会和其他 TU 取到不同的 `pyconfig.h` 分支。
:::

另外 pybind11 的 `PYBIND11_EXPORT` 默认给 `PyInit_xxx` 挂 `__declspec(dllexport)`，
而静态侧 `PyMODINIT_FUNC` 不带，属性不一致会触发 MSVC `C2375 重定义;不同的链接`；
工程里把 `PYBIND11_EXPORT` 置空对齐。

## 限制一：官方 `.pyd` 不能 drop-in

那批官方 `.pyd` 加载不了。原因是 `.pyd` 按**模块名**从 `python312.dll` 导入符号，
而静态链接后核心在 `Program.exe` 里；即便名字能对上，`.pyd` 自己去加载一份
`python312.dll` 也会变成**两个运行时**（`Py_None`、`_PyRuntime`、类型对象的数据段分裂），
必然崩溃或类型错乱。

| | 能否使用 | 例子 |
| --- | --- | --- |
| **纯 Python wheel**（`py3-none-any`） | ✅ | `requests`、`websockets`、`pyserial` |
| **平台 wheel**（`cp312-*-win_amd64`） | ❌ | `numpy`、`Pillow`、`lxml` |

装库方式不变：`pip install <pkg> --target "<运行目录>\source\Lib\site-packages"`。

## 限制二：`Program.exe` 不能改名

exe 会导出约 3000 个 CPython API 符号并产出 `Program.lib`，供用户自编的 `.pyd`
从**已加载的 exe** 导入符号。这个绑定靠 PE 导入表里的模块名，改名后 `.pyd` 会加载失败。

## 限制三：加 C 扩展要重编

- **常用扩展**：改 `cmake/PythonBuiltinModules.cmake` 的白名单表 + 重编 exe
- **用户自己的 C 扩展**：对着 `Program.lib` 编成 `.pyd`，放进 `source/Lib/site-packages/`

## 实测状态（2026-09-26）

::: tip 已验证
- `dumpbin /dependents` 无 `python312.dll` / `python3.dll`
- `sys.prefix` 指向 `<exe>\source`，`sys.path` 含 `source\Lib`
- `import init` 成功，框架注册了 `on_rpc` / `mcp_compile` 等 handler
- 14 个编进 exe 的扩展全部出现在 `sys.builtin_module_names`
- `pip install requests --target source\Lib\site-packages` 后 `import requests` 可用
- **真实连服回归通过**：`PlayStatus value: 3`（PlayerSpawn 正常进服），未被反作弊踢
  —— 即静态化没有破坏 MCP 校验链（rotor + umsgpack + RC4）
- 从零构建可复现：删除 `build/` 与生成的冻结模块后重建，`Program.exe` 与
  `python312core.lib` 的字节数与增量构建完全一致
:::

::: warning 未验证
- **用户自编 `.pyd` 从 exe 导入符号**：目前只有 `dumpbin /exports` 佐证 ——
  真实 `Program.exe` 导出 3096 个符号（含数据符号 `_Py_NoneStruct` / `PyExc_TypeError`），
  多于官方 `python312.dll` 的 1696 个。尚未用真实 `.pyd` 端到端跑过。
- **官方 wheel 兼容层**（一个只含导出转发表的极简 `python312.dll`，
  把符号转发到 `Program.exe`）—— 想法可行但未实现、未验证。
:::

## 未来可能的方向

上面两条未验证项如果都做完，理论上可以做到「默认完全自包含，但想要 numpy / Pillow 时
放一个几十 KB 的转发 DLL 就能用官方 wheel」。这是后话，不在当前实现范围内。

## 下一步

- [事件系统](/architecture/events)
- [部署](/guide/deploy)
