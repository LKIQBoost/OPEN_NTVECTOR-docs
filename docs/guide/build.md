# 构建

> 从源码构建 NTVECTOR_Platform（Vector 客户端）的完整指南。
> 当前环境：**Python 3.12.2 静态嵌入运行时**（已从 Python 2.7 迁移）。

## 项目参数

| 项目 | 值 |
| --- | --- |
| 语言标准 | C++17 |
| 构建系统 | CMake（最低 3.20，兼容 CMake 4.x） |
| 目标平台 | **Windows (MSVC) 为主**；Linux x86_64 / Android ARM64 为历史支持 |
| 构建目标 | `Program`（Windows 下为 `Program.exe`） |
| 内嵌运行时 | Python **3.12.2**，从 `third_party/Python-3.12.2` 编出**静态**核心库链进 exe，运行时不需要 `python312.dll` |
| 依赖策略 | 第三方依赖随仓库提供并从源码编译，**无需包管理器、无需联网下载** |

## 获取源码

```bash
git clone https://github.com/LKIQBoost/OPEN_NTVECTOR.git
cd OPEN_NTVECTOR
```

仓库包含全部第三方 C/C++ 依赖源码（OpenSSL、jsoncpp、libdatachannel、libwebsockets、
SLikeNet、zlib）以及 CPython 的源码树，无需单独下载。

::: tip 仓库较大
历史里含 `libcrypto_static.lib`（57 MB）和 `third_party/Python-3.12.2`（剪裁后 59 MB）。
推送代码时如遇 `RPC failed; curl 65 ... Connection was reset`，先加大 HTTP 缓冲区：

```bash
git config http.postBuffer 524288000
```
:::

## Windows 构建

在项目根目录执行：

```bash
cmake -B build -G "Visual Studio 18 2026" -A x64
cmake --build build --config Release
```

- 生成器：`Visual Studio 18 2026`
- 架构：`x64`
- 产物：`build/application/Release/Program.exe`

::: warning 构建坑（必读）
1. **改 header 后 MSBuild 增量编译不会重编依赖它的 `.cpp`**（如 `engine_wrapper.h`），
   需 `touch` 该 `.cpp` 强制重编，否则部署的是旧代码。
2. 构建行为异常时优先 `rm -rf build` 重新 configure —— **不要复用损坏的旧 CMake 构建目录**。
3. 含中文注释的新增源码要存成 **UTF-8 带 BOM**，否则 MSVC 在 GBK 代码页下注释尾字节吞换行
   （`C4819` / `C2039`）。
:::

::: info 首次 configure 会多花几分钟
要从 `third_party/Python-3.12.2` 编静态 CPython 核心（先编 `_freeze_module` 生成冻结模块，
再编约 198 个核心源文件），另外 OpenSSL 也可能从源码编译。
产物和指纹缓存在 `build/_deps/python-static/`，之后 configure 直接命中缓存。
:::

也可以在 Visual Studio 中直接打开仓库根目录，使用 CMake 列表（Configure → Build）。

## CMake 选项

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `NTVECTOR_PY_HOST` | 自动探测 | 宿主 Python（≥ 3.10），仅用于生成冻结模块 |
| `NTVECTOR_PY_TOOLSET` | `${CMAKE_VS_PLATFORM_TOOLSET}`，否则 `v145` | MSVC 工具集。**必须显式**：CPython 的 `python.props` 对未知 VS 版本会静默回落到本机没装的 `v140` |
| `NTVECTOR_PY_WINSDK` | `${CMAKE_VS_WINDOWS_TARGET_PLATFORM_VERSION}`，否则 `10.0.26100.0` | Windows SDK 版本 |
| `NTVECTOR_PY_REBUILD` | `OFF` | 置 `ON` 强制重建静态 CPython 核心 |
| `ENABLE_NTUNISDK` | `OFF` | 启用 NtUniSdk 集成（Windows，可选） |

例：

```bash
cmake -B build -G "Visual Studio 18 2026" -A x64 ^
  -DNTVECTOR_PY_HOST=C:/path/to/python.exe ^
  -DNTVECTOR_PY_TOOLSET=v145
```

## 静态 CPython 核心是怎么来的

这一块是构建里唯一非显而易见的部分，排障时看这里。

**为什么要自己编**：Python 2.7 时代项目链的是静态 `python27.lib`（32 MB，由
`Python-2.7.18/PCbuild` 的 `pythoncore` 工程产出），运行时不需要 `python27.dll`。
CPython 官方在 **3.12 把 `PCbuild/pythoncore.vcxproj` 改成了直接产 DLL**，
所以要自己生成一份静态化副本。

**两步**：

1. 编 `_freeze_module`（它自包含、无 ProjectReference），其 AfterBuild 会生成
   `Python/frozen_modules/*.h` 与 `Python/deepfreeze/deepfreeze.c`
   —— 这两个**不在 python.org 的源码 tarball 里**（tarball 只有 README.txt），
   而 `pythoncore` 要编 `deepfreeze.c`，所以必须先跑这一步。
2. 读 `PCbuild/pythoncore.vcxproj`、打 **7 处补丁**、生成副本到
   `build/_deps/python-static/proj/pythoncore_static.vcxproj` 再构建。
   **不改 `third_party/` 里的源码。**

7 处补丁分别是：`ConfigurationType=StaticLibrary`、`TargetName=python312core`、
去掉 `_TriggerRegen` 与 `regen.targets` 导入、去掉 `PC/python_nt.rc`、
补 zlib 的 include 路径、相对 `..\` 路径绝对化、相对 `Import` 绝对化。

| 产物 | 路径 |
| --- | --- |
| 静态核心库 | `build/_deps/python-static/out/amd64/python312core.lib` |
| 打补丁的工程副本 | `build/_deps/python-static/proj/pythoncore_static.vcxproj` |
| 构建日志 | `build/_deps/python-static/{freeze,core}.log` |
| 生成物（已 gitignore） | `third_party/Python-3.12.2/Python/{frozen_modules/*.h,deepfreeze/deepfreeze.c}` |

构建缓存带**指纹**（`pythoncore.vcxproj` / `_freeze_module.vcxproj` / `pyconfig.h` /
工具集 / SDK 的 SHA1），任一变化会自动重编。

::: details 链接宏怎么分配（搞反的后果很隐蔽）
| 构建单元 | 宏 | 效果 |
| --- | --- | --- |
| `python312core.lib` | **保留** `Py_ENABLE_SHARED` + `Py_BUILD_CORE` | `Py_EXPORTED_SYMBOL` 非空 → API 带 `dllexport` 导出进 Program.exe |
| `Program.exe` 的应用 TU | `Py_NO_ENABLE_SHARED` | API 声明不是 `dllimport`，同映像内直接调用 |
| 用户自编 `.pyd` | 默认（`pyconfig.h` 自动给 `Py_ENABLE_SHARED`） | 按模块名从 `Program.exe` 导入 |

依据是 `Include/exports.h:6-9`：**`Py_ENABLE_SHARED` 没有定义时
`Py_EXPORTED_SYMBOL` 是空的**，核心若写成 `Py_NO_ENABLE_SHARED` 会得到**零导出**。
反过来应用侧若带 `Py_ENABLE_SHARED`，`PyAPI_FUNC` 就变成 `dllimport`，
会去找一个并不存在的 `python312.dll` 而链接失败。

`application/application.cpp` 顶部原来那句 `#define Py_ENABLE_SHARED` 已删除 ——
链接方式必须只由 CMake 决定。

另外 pybind11 的 `PYBIND11_EXPORT` 默认给 `PyInit_xxx` 挂 `__declspec(dllexport)`，
而静态侧 `PyMODINIT_FUNC` 不带，属性不一致会触发 MSVC `C2375 重定义;不同的链接`；
工程里把 `PYBIND11_EXPORT` 置空对齐。
:::

::: details third_party/Python-3.12.2 是剪裁过的
为控制仓库体积，已从 python.org 源码 tarball 中删去 `Doc/`、`Misc/`、`Mac/`、
`Lib/test/`、`PCbuild/obj/`（112 MB → 59 MB）。构建需要的东西都在，详见
`cmake/BuildPython312.cmake` 顶部的「必须保留」清单。
:::

## 其他平台

::: warning 以下为历史构建方式，目前未回归验证
`cmake/BuildPython312.cmake` 只对 `WIN32 AND MSVC` 生效（非该平台直接 `return()`），
其他平台会回落到 `application/CMakeLists.txt` 里的
`find_package(Python3 3.12 COMPONENTS Development REQUIRED)` + `Py_ENABLE_SHARED`
动态链接分支。

如需恢复 Linux / Android 的**静态**支持：
1. 让 `BuildPython312.cmake` 支持非 Windows：Linux 用 CPython 的
   `./configure --disable-shared` 产出 `libpython3.12.a`（Py2 时代的
   `BuildPython27.cmake` 就是这条路，可参考）；
2. 同步 `cmake/PythonBuiltinModules.cmake` 的白名单（部分模块是 Windows 专属，
   如 `winsound` / `_overlapped` / `_multiprocessing` 的源文件）；
3. 重新验证 OpenSSL / libdatachannel 等依赖在目标平台的构建。
:::

### Linux x86_64 原生编译（历史命令）

```bash
cmake -B build -DCMAKE_C_COMPILER=clang -DCMAKE_CXX_COMPILER=clang++
cmake --build build -j$(nproc)
```

### Android / Termux 原生编译（历史命令）

```bash
pkg install clang cmake make perl pkg-config
cmake -B build
cmake --build build -j$(nproc)
```

平台检测由 `cmake/Platform.cmake` 自动完成（检测到 Bionic libc 即进入 `PLATFORM_ANDROID`
分支），也可手动指定 `-DPLATFORM_ANDROID=ON`。

### 交叉编译（Windows → Linux，历史）

```bash
cmake -B build-linux-x64 \
  -DCMAKE_TOOLCHAIN_FILE=cmake/toolchains/linux-clang-x86_64.cmake \
  -DCMAKE_SYSROOT=/path/to/x86_64-linux-gnu-sysroot
cmake --build build-linux-x64
```

> 工具链文件默认 `-target x86_64-linux-gnu`、链接器用 `lld`；
> `CMAKE_SYSROOT` 需包含目标平台的 GNU 工具链头文件与库。

## 下一步

- [部署与目录布局](/guide/deploy)
- [常见问题](/guide/faq)
