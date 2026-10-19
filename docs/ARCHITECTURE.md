# 工程结构

glyph-punch 是一个纯静态的 Vite + React + TypeScript 单页应用：没有后端、没有账号、没有网络请求。所有作品保存在浏览器 `localStorage`，导出通过本地 Canvas 完成。

## 模块

```text
src/
├── main.tsx          挂载 React，导入字体 CSS，套 ErrorBoundary
├── App.tsx           应用状态：作品列表、历史栈、交互编排、左栏与舞台
├── Artboard.tsx      画板渲染：原文、洞、纸片、拖拽、回填、飞行动画
├── layout.ts         排版引擎：断行、字号自适应、取字落点、纸片排布
├── holes.ts          打孔抖动：种子、jitter、洞的几何
├── exportPng.ts      Canvas 导出（与 DOM 共用布局与抖动参数）
├── fonts.ts          字体包注册表
├── storage.ts        localStorage 读写与旧数据迁移
├── types.ts          数据模型、比例、主题
├── ErrorBoundary.tsx 渲染异常兜底
└── styles.css        全部样式（暗色工作台 + 纸面）
```

`scripts/` 下是无头浏览器脚本：`visual-check.mjs` 做交互回归，`preview.mjs` 生成 README 预览图；`browser.mjs` 负责定位本机 Chrome/Edge 并检查 dev server。

## 数据流

```text
用户操作
  ↓
App 状态（works / currentId / past / future）
  ↓ useMemo
computeLayout(work) ──► BoardLayout
  ├── artW / artH / compTop
  ├── chars[]（Array.from(text)）
  └── layout.cells[]（每个字的 x / y / size）
  ↓
Artboard（DOM）──── 交互：点击、拖拽、回填
  ↓
exportPng（Canvas）─ 同一份 cells、同一组 jitter
```

关键不变量：**屏幕与导出是同一套几何**。`Artboard` 与 `exportPng` 都从 `BoardLayout` 和 `Tile.jitter` 读取位置、尺寸、旋转，不各自计算。

## 排版

- `charsOf` 把文本拆成字符数组，换行符也占一个字符，但不可打孔。
- `buildLines` 先按硬换行切分，再按每行容量折行；正好填满一行后再遇到换行不会多算空行。
- 字号优先取“最长行不折行”的值（上限 96），超出高度时退回“折行 + 二分查找”。
- 文本块在文字区域内垂直居中；文字区域高度为画板的 66%，创作区从 72% 开始。

## 打孔与纸片

每次取字生成一个新的 `PunchJitter`：

```ts
{ dx, dy, rot, scale, radius }
```

它被存进 `Tile.jitter`。洞的几何由 `holeGeometry(jitter, cell)` 计算，纸片的尺寸、旋转、初始偏移都用同一份 jitter，因此洞就是纸片被拿走后的形状。旧作品没有 jitter 时，用 `legacyJitter(charId, workId)` 生成稳定兜底。

## 排布

`alignTiles` 先按 y 聚类识别行（容差 0.9 字宽），再用最长行的自然宽度确定块宽，整块在创作区居中。三档只决定行在块内的摆法：贴左、居中、撑满。单字行在两端对齐时按块心居中。

## 持久化

`localStorage` 键为 `glyph-punch.v1`，结构：

```ts
{ works: Work[], currentId: string }
```

`loadStore` 会补全缺失的 `fontId` 与 `tile.jitter`，因此 0.3 之前保存的作品仍能打开。写入失败（配额、隐私模式）会被静默忽略，自动保存是尽力而为。

## 测试

- **Vitest**：排版、抖动、排布的纯函数测试，不依赖 DOM。
- **Playwright（本机 Chrome/Edge）**：点击取字、拖放、回填、全部放回、三档排布、导出下载的端到端检查，并抓取动效中间帧。
- **GitHub Actions**：lint、typecheck、unit test、build、产物上传。

## 约束

- 字体是完整的 CJK woff2 子集，构建产物较大，但浏览器只会按 unicode-range 下载用到的分片。
- 仅桌面端；触屏与移动端未适配。
- 不支持键盘逐字打孔，指针是主要输入方式。
