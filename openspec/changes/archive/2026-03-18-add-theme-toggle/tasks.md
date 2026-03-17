## 1. CSS 变量体系建立

- [x] 1.1 在 `web/styles/main.css` 顶部声明 `:root`（dark 默认）和 `[data-theme="light"]` 两套 CSS 自定义属性，覆盖背景色、文字色、边框色、按钮色、状态栏色等全部颜色
- [x] 1.2 将 `main.css` 中所有硬编码颜色值替换为对应 CSS 变量引用（`var(--color-*)`）
- [x] 1.3 目视 QA：在浏览器中切换 `document.documentElement.dataset.theme`，确认 light / dark 两套配色均无明显对比度问题

## 2. 防闪烁初始化脚本

- [x] 2.1 在 `web/index.html` `<head>` 末尾插入内联脚本：读取 `localStorage.getItem('theme')`，回落到 `prefers-color-scheme`，设置 `document.documentElement.dataset.theme`
- [x] 2.2 验证：硬刷新页面时不出现"先暗后亮"或"先亮后暗"的主题闪烁

## 3. AppState 与主题逻辑

- [x] 3.1 在 `web/src/app.ts`（或 state 类型定义处）的 `AppState` 中添加 `theme: 'light' | 'dark'` 字段，初始值从 `document.documentElement.dataset.theme` 读取
- [x] 3.2 在 `web/src/main.ts` 或 `app.ts` 中实现 `toggleTheme()` 方法：切换 `AppState.theme`、更新 `document.documentElement.dataset.theme`、写入 `localStorage`、触发 patch 渲染

## 4. 切换按钮 DOM 与图标

- [x] 4.1 在 `web/src/render.ts` 的 header 渲染逻辑中，于 `.status-bar` 右侧追加 `.icon-button.theme-toggle-button` 按钮
- [x] 4.2 实现太阳图标 SVG（dark 模式下显示，表示"切换到 light"）：`viewBox="0 0 20 20"`，stroke 线条风格，与 send / follow 图标一致
- [x] 4.3 实现月亮图标 SVG（light 模式下显示，表示"切换到 dark"）：同上风格
- [x] 4.4 在 `render.ts` patch 逻辑中，根据 `AppState.theme` 动态切换按钮内 SVG 内容及 `aria-label`
- [x] 4.5 在 `main.css` 中为 `.theme-toggle-button` 添加样式，尺寸与 `.follow-button`（56×56px）一致，背景色使用 CSS 变量

## 5. 事件绑定

- [x] 5.1 在 DOM refs 初始化或事件委托处，为 `.theme-toggle-button` 绑定 `click` 事件，调用 `toggleTheme()`
- [x] 5.2 手动测试：点击按钮 → 主题立即切换 → 刷新后主题保持 → 再次点击恢复

## 6. 质量校验

- [x] 6.1 运行 `npm run lint` 通过
- [x] 6.2 运行 `npm run typecheck` 通过
- [x] 6.3 运行 `npm test` 通过
- [x] 6.4 运行 `npm run build` 通过，无 TS / CSS 报错
