# 贡献指南

感谢你愿意参与 glyph-punch。这是一个纯前端、无后端的桌面端创作工具，所有数据保存在浏览器本地。

## 开发环境

- Node.js >= 22.12（见 `.nvmrc`）
- npm 11+
- Chrome 或 Edge（仅视觉脚本需要）

```bash
npm ci
npm run dev        # http://localhost:5173
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run typecheck` | 仅类型检查 |
| `npm run lint` | Biome 静态检查 |
| `npm run format` | Biome 格式化 |
| `npm run check` | 格式化 + lint + import 排序检查 |
| `npm test` | Vitest 单元测试 |
| `npm run visual` | 无头浏览器交互回归（需先启动 dev server） |
| `npm run shot` | 重新生成 `docs/preview.png` |

## 代码约定

- TypeScript strict，不使用 `any`；跨模块的数据结构放在 `src/types.ts`
- 纯计算逻辑（排版、抖动、对齐）必须保持无 DOM 依赖，便于单元测试与 Canvas 导出复用
- 样式集中在 `src/styles.css`；新增交互请同时补 hover / focus-visible / disabled 状态
- 所有动效必须尊重 `prefers-reduced-motion`
- 提交前运行 `npm run check && npm test && npm run build`

## 提交流程

1. 从 `main` 开分支：`feat/xxx`、`fix/xxx` 或 `docs/xxx`
2. 提交信息用 Conventional Commits 前缀（`feat:` / `fix:` / `docs:` / `chore:` / `refactor:`），正文写清“为什么”
3. 涉及界面的改动附截图；涉及导出的改动附 PNG 对比
4. 开 PR，填写模板中的检查项；CI 必须全绿

## 领域约定

- 「洞」与「纸片」是同一块料：旋转、尺寸、偏移必须来自同一个 `PunchJitter`
- 原文区只做自动排版，不提供对齐选项；所有排布动作都属于创作区
- 文案避免内部黑话，优先使用用户能直接理解的动作词

更完整的决策记录见 [docs/PRD.md](docs/PRD.md)，工程结构见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。
