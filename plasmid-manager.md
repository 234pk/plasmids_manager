# Plasmid Manager 开发日志

## 2026-02-07 更新
- **功能移除**: 移除了 UniProt 弹窗查询功能，改为直接打开 UniProt 网页。
  - 修改 `index.html`: 将 U 按钮行为改为 `openExternalLink`。
  - 修改 `js/app.js`: 删除了 `showUniProtModal`, `uniProtModalData`, `openUniProtModal` 等相关代码。
  - 优化了 macOS 下的外部链接打开体验 (`main.js` 中的 `open -a` 逻辑)。
- **macOS 优化**:
  - 确认 `main.js` 包含 `window-all-closed` 和 `activate` 事件处理，符合 macOS 应用生命周期规范。
  - 确保 `package.json` 中包含 macOS 构建配置 (`dmg`, `zip`, `entitlements`)。
- **CI/CD**:
  - 更新 `.github/workflows/release.yml`，支持 GitHub Actions 自动构建和发布 Windows/macOS 版本。
