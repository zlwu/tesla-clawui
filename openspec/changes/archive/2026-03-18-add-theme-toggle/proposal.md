## Why

Tesla 车机长时间使用时，白天强光下默认深色界面反差可能过低，夜间行车时全白背景会刺眼影响驾驶安全。需要支持根据系统偏好自动切换明暗主题，同时保留手动覆盖按钮，让驾驶员在不同光照环境下都能获得舒适的阅读体验。

## What Changes

- 新增 CSS 变量驱动的明/暗双主题体系，覆盖消息区、composer、PIN 页、顶栏等全部界面元素
- 监听 `prefers-color-scheme` 媒体查询，页面加载时自动应用系统主题
- 在顶栏右侧（或主界面固定位置）添加主题切换按钮（图标与现有顶栏图标风格一致）
- 用户手动切换后，偏好持久化至 `localStorage`，刷新后保持用户选择
- 若用户从未手动切换，始终跟随系统偏好

## Capabilities

### New Capabilities

- `theme-toggle`: 主题切换能力——CSS 变量双主题体系、系统自动检测、手动切换按钮、localStorage 持久化

### Modified Capabilities

- `tesla-chat-ui`: 消息区、composer、顶栏等全局 UI 样式需适配明暗双主题

## Impact

- `client/src/styles/` 或现有内联 CSS：重构为 CSS 自定义属性（`--color-*` 变量），在 `:root` 与 `[data-theme="light"]` / `[data-theme="dark"]` 上分别声明
- `client/src/main.ts`（或 App 初始化入口）：添加主题初始化逻辑（读 localStorage → 检测系统偏好 → 设置 `document.documentElement` data 属性）
- 顶栏 DOM：新增图标按钮，与现有返回/菜单图标视觉风格保持一致（SVG 线条风格，同等尺寸）
- 不涉及后端、数据库或 API 变更
- 不引入额外第三方依赖
