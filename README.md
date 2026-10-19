# glyph-punch

把古诗文打成孔。被挖下的字变成纸片，落在下方的创作区，你可以把它们重新拼成一句话。

[![CI](https://github.com/wry-tsuki/glyph-punch/actions/workflows/ci.yml/badge.svg)](https://github.com/wry-tsuki/glyph-punch/actions/workflows/ci.yml)
[![version](https://img.shields.io/badge/version-0.7.2-c9b98f)](CHANGELOG.md)
[![license](https://img.shields.io/badge/license-MIT-3e5d7c)](LICENSE)

![工作台预览](docs/preview.png)

## 这是什么

一个桌面端的**古诗文打孔器**。导入一段诗文，逐字点击打孔，字离开原位、变成一张纸片；纸片在创作区自由摆放，拖回原文区就回到原来的洞。作品按 3:4 / 1:1 / 9:16 画板导出为 PNG。

它不是背诵填空工具。约束来自原文（只能用被挖下的字），自由来自摆放——你是在用一首诗的字，写另一句话。

## 能做什么

- 粘贴文本、保留换行；字号自动适配，保证诗句不折行
- 点击原文取字：纸片从洞口飞出，落到创作区随机位置并避开已有纸片
- 从原文拖字到创作区，松手位置就是落点
- 每次取字重新掷抖动，洞与纸片共用同一次结果；纸片字号与原文一致
- 点击纸片或拖回原文区都能回填；「全部放回原文」会逐张飞回
- 创作区三档排布：左对齐 / 居中对齐 / 两端对齐，块宽由最长行决定且整块居中
- 3:4 / 1:1 / 9:16 画板；四套双色主题；两套字体包
- 多作品、本地自动保存、撤销 / 重做
- 1x PNG 导出，Canvas 独立渲染，与屏幕同一套几何
- 所有动效尊重 `prefers-reduced-motion`

## 快速开始

需要 Node.js >= 22.12（见 `.nvmrc`）。

```bash
npm ci
npm run dev       # http://localhost:5173
```

生产构建：

```bash
npm run build     # 输出到 dist/
npm run preview   # 本地预览构建产物
```

## 脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run typecheck` | 仅 TypeScript 检查 |
| `npm run lint` | Biome 静态检查 |
| `npm run format` | Biome 格式化 |
| `npm run check` | 格式化 + lint + import 排序检查 |
| `npm test` | Vitest 单元测试 |
| `npm run visual` | 无头浏览器交互回归（需先启动 dev server） |
| `npm run shot` | 重新生成 `docs/preview.png` |

视觉脚本默认使用本机 Chrome/Edge；可用 `CHROME_PATH` 指定浏览器，用 `BASE_URL` 指定服务地址。

## 结构

```text
src/
├── App.tsx           应用状态、作品列表、历史栈、左栏与舞台
├── Artboard.tsx      画板：原文、洞、纸片、拖拽与回填
├── layout.ts         排版引擎：断行、字号自适应、落点与排布
├── holes.ts          打孔抖动与洞的几何
├── exportPng.ts      Canvas 导出（与 DOM 共用坐标）
├── fonts.ts          字体包注册表
├── storage.ts        localStorage 持久化与迁移
├── types.ts          数据模型、比例、主题
├── ErrorBoundary.tsx 渲染异常兜底
└── *.test.ts         纯函数单元测试
docs/
├── PRD.md            需求、决策与路线图
├── ARCHITECTURE.md   模块、数据流与不变量
└── THIRD_PARTY.md    字体与依赖许可
scripts/              无头浏览器回归与预览图生成
```

## 几个刻意的取舍

- **洞占位，文本不回流**：打孔不改变排版，相邻的孔通过抖动自然连成一条毛边。
- **洞与纸片是同一块料**：旋转、尺寸、偏移同源；移动只改位置，不改形状。
- **排布是显式动作**：拖动时不做磁吸，觉得乱了再点左 / 居中 / 两端；结果带轻微随机噪声。
- **屏幕与导出同源**：DOM 负责交互，Canvas 用同一份布局与 jitter 重绘，像素与字体可控。

## 测试与 CI

- 20 个 Vitest 单元测试覆盖排版、抖动范围、洞片一致性、三档排布、随机落点与本地存储迁移
- Playwright 脚本覆盖取字、拖放、回填、全部放回、排布与 PNG 下载
- GitHub Actions 运行 `check → typecheck → test → build`，并上传构建产物

## 部署

构建产物是纯静态文件（`base: './'`），可以放到任意静态托管。

GitHub Pages：先在仓库 **Settings → Pages** 将 Source 设为 **GitHub Actions**，再手动运行 `Deploy to GitHub Pages` workflow。部署 workflow 默认不随 push 触发，避免未启用 Pages 时反复失败。

## 已知限制

- 长文（如《赤壁赋》全文）会把字号压到十几像素，纸片随之变小、难以拖拽
- 两套字体都是完整 CJK 分片，`dist` 体积约 20MB+，浏览器按需下载子集
- 仅桌面端，触屏与移动端未适配
- 不支持键盘逐字打孔
- 0.x 阶段本地数据格式仍可能变动，重要作品请同时导出 PNG

## 路线

- **v0.8**：JSON 导出 / 导入、自定义配色、作品缩略图
- **v1.0**：交互与数据格式稳定、移动端基础适配
- **v2**：AI 按提示词挖字、分享链接

## 文档

- [需求与决策](docs/PRD.md)
- [工程结构](docs/ARCHITECTURE.md)
- [变更记录](CHANGELOG.md)
- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)
- [第三方许可](docs/THIRD_PARTY.md)

## 许可

代码以 [MIT](LICENSE) 发布。内置字体（霞鹜文楷、思源宋体）为 SIL OFL 1.1，详见 [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md)。
