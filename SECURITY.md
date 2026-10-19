# 安全策略

## 支持范围

当前处于 0.x 预览阶段，仅维护 `main` 分支的最新版本。

## 报告问题

glyph-punch 是纯静态前端应用，没有服务端、账号体系或网络上传。作品数据保存在浏览器 `localStorage`，导出通过本地 Canvas 完成。

如果你发现以下类型的问题，请通过 GitHub 的 [Private vulnerability reporting](https://github.com/wry-tsuki/glyph-punch/security/advisories/new) 私下报告，不要公开开 Issue：

- 可被恶意文本触发的脚本注入或 DOM 注入
- 导出流程中的数据泄露
- 依赖链中的已知高危漏洞

请在报告中附上复现步骤、浏览器版本与影响范围。会在 7 天内确认收到，并在修复后致谢（如你愿意）。
