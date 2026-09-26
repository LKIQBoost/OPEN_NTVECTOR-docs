import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'zh-CN',
  title: 'OPEN_NTVECTOR',
  description: '标准网易我的世界基岩版机器人客户端 — 使用说明、架构与插件开发文档',

  // GitHub Pages 项目页部署：base 必须与仓库名一致。
  //   仓库 OPEN_NTVECTOR-docs  → https://<user>.github.io/OPEN_NTVECTOR-docs/  → base: '/OPEN_NTVECTOR-docs/'
  // 若改用根域页面（仓库名必须叫 <user>.github.io），把 base 改回 '/'。
  base: '/OPEN_NTVECTOR-docs/',

  cleanUrls: true,
  metaChunk: true,

  markdown: {
    lineNumbers: true,
    // 代码块里的中文注释不需要额外处理，VitePress 默认按 UTF-8 读取
  },

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '指南', link: '/guide/', activeMatch: '/guide/' },
      { text: '架构', link: '/architecture/', activeMatch: '/architecture/' },
      { text: '插件开发', link: '/plugin/', activeMatch: '/plugin/' },
      { text: 'Python API', link: '/api/', activeMatch: '/api/' },
      { text: '参考', link: '/reference/migration', activeMatch: '/reference/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '项目概览', link: '/guide/' },
            { text: '构建', link: '/guide/build' },
            { text: '部署', link: '/guide/deploy' },
            { text: '常见问题', link: '/guide/faq' },
          ],
        },
      ],
      '/architecture/': [
        {
          text: '架构',
          items: [
            { text: '整体架构', link: '/architecture/' },
            { text: 'Python 内嵌机制', link: '/architecture/python-runtime' },
            { text: '静态链接与扩展限制', link: '/architecture/static-linking' },
            { text: '事件系统', link: '/architecture/events' },
            { text: '关键数据包', link: '/architecture/packets' },
            { text: 'RPC 与反作弊校验', link: '/architecture/anti-cheat' },
          ],
        },
      ],
      '/plugin/': [
        {
          text: '插件开发',
          items: [
            { text: '快速开始', link: '/plugin/' },
            { text: '事件系统', link: '/plugin/events' },
            { text: 'engine API', link: '/plugin/engine' },
            { text: '模块与工具', link: '/plugin/modules' },
            { text: '协议数据包', link: '/plugin/protocol' },
            { text: '代码模板', link: '/plugin/templates' },
            { text: '常见问题', link: '/plugin/faq' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'Python 原生接口',
          items: [
            { text: '总览', link: '/api/' },
            { text: '接口参考', link: '/api/reference' },
            { text: '原生模块速查', link: '/api/native-modules' },
            { text: '结构化协议事件', link: '/api/structured-events' },
          ],
        },
      ],
      '/reference/': [
        {
          text: '参考',
          items: [
            { text: 'Py2 → Py3 迁移', link: '/reference/migration' },
          ],
        },
      ],
    },

    // 内置本地搜索（VitePress 1.x 默认主题自带，无需额外依赖）
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档',
          },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭',
            },
          },
        },
      },
    },

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    // lastUpdated 依赖 git 提交历史。本仓库当前不是 git 仓库，启用后会没有输出，
    // 所以先关掉；等 docs 目录纳入版本管理后再打开下面这段即可。
    // lastUpdated: {
    //   text: '最后更新于',
    //   formatOptions: { dateStyle: 'short', timeStyle: 'short' },
    // },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/LKIQBoost/OPEN_NTVECTOR' },
    ],

    footer: {
      message: '第三方库请参阅各自目录下的许可证文件',
      copyright: 'OPEN_NTVECTOR',
    },
  },
})
