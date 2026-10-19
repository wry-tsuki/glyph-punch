# 第三方资源与许可

本项目以 MIT 许可发布（见根目录 `LICENSE`），但内置字体与依赖遵循各自的许可。

## 字体

| 资源 | 用途 | 许可 | 来源 |
| --- | --- | --- | --- |
| 霞鹜文楷 LXGW WenKai | 默认正文字体 | SIL Open Font License 1.1 | [lxgw/LxgwWenKai](https://github.com/lxgw/LxgwWenKai) |
| 思源宋体 Noto Serif SC | 备选正文字体 | SIL Open Font License 1.1 | [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk) |

字体通过 npm 包 `lxgw-wenkai-webfont` 与 `@fontsource-variable/noto-serif-sc` 引入，woff2 分片随构建产物一起分发。OFL 允许嵌入与再分发，但修改字体文件本身需遵循 OFL 条款。

## 运行与构建依赖

| 依赖 | 许可 |
| --- | --- |
| React / React DOM | MIT |
| Vite | MIT |
| TypeScript | Apache-2.0 |
| @vitejs/plugin-react | MIT |
| Biome | MIT |
| Vitest | MIT |
| playwright-core | Apache-2.0 |

完整依赖树与版本见 `package-lock.json`。升级依赖时请确认新版本许可未发生变化。
