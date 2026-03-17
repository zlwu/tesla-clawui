## Context

当前 `web/styles/main.css` 使用硬编码颜色值（`#202123`、`#f7f7f8`、`#fff` 等），无主题抽象层。UI 通过 `web/src/render.ts` 动态生成 DOM，图标为内联 SVG（`viewBox="0 0 20 20"`，`stroke="currentColor"`，28×28px）。Tesla MCU2 浏览器为 Chromium 79 左右，支持 CSS 自定义属性和 `prefers-color-scheme` 媒体查询，`localStorage` 读写正常。

## Goals / Non-Goals

**Goals:**
- 将全局颜色提取为 CSS 自定义属性（`--color-*`），建立 light / dark 双主题
- 页面加载时按 localStorage 偏好 → 系统偏好顺序确定初始主题，无闪烁
- 顶栏右侧添加主题切换图标按钮，与现有 send / follow 按钮视觉语言一致
- 用户手动切换后写入 `localStorage`，刷新后保持

**Non-Goals:**
- 不引入 CSS-in-JS、主题框架或 React
- 不做组件级动态换肤，只做全局 CSS 变量切换
- 不扩展为多主题（除 light/dark 两档外）
- 不改动后端或 API

## Decisions

### 1. 主题实现：CSS 自定义属性 + `data-theme` 属性

在 `:root` 声明 dark（默认）变量，在 `[data-theme="light"]` 上覆盖 light 值；切换时只改 `document.documentElement.dataset.theme`。

**选择理由：** Tesla Chromium 79 完整支持 CSS 变量；单一 `data-*` 属性切换无重排，比 class 切换更语义化，比 `<link>` 切换更快（无 FOUC 风险）。

**替代方案：** 注入第二张样式表 → 需要额外 HTTP 请求且有 FOUC 风险，放弃。

### 2. 默认主题：dark

产品定位（大字文本、车机夜间使用场景为主），dark 作为 `:root` 默认值，light 作为覆盖。若 JS 未执行则保持 dark。

### 3. 初始化时序：`<head>` 内联脚本防闪烁

在 `index.html` `<head>` 末尾插入一段极小内联脚本，在 CSS 解析完成后、body 渲染前设置 `data-theme`，消除"先暗后亮"闪烁（FOUC）。

```html
<script>
  (function(){
    var s = localStorage.getItem('theme');
    var t = s === 'light' || s === 'dark' ? s
          : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
  })();
</script>
```

### 4. 切换按钮：顶栏 `status-bar` 右侧追加

在 `render.ts` 中的 `app-header` 渲染逻辑里，于 `.status-bar` 右侧追加一个 `.icon-button.theme-toggle-button`，尺寸与 follow-button（56×56px）保持一致，SVG 同 `viewBox="0 0 20 20"`，`stroke="currentColor"`，无 fill。

图标语义：light 模式显示"月亮"图标（切换到 dark），dark 模式显示"太阳"图标（切换到 light）。

### 5. 状态管理：`AppState` 扩展

在现有 `AppState` 中加入 `theme: 'light' | 'dark'` 字段，使主题成为可观测状态，与消息列表、连接状态等一起走 patch 渲染路径，避免独立命令式更新。

## Risks / Trade-offs

- [FOUC 风险] 内联脚本在 `<head>` 执行，依赖 `localStorage` 同步读取；Tesla MCU2 `localStorage` 已验证可用，风险低。→ 若 `localStorage` 不可用则静默降级为系统偏好。
- [颜色变量迁移工作量] 现有 CSS 约 500 行，需逐一替换硬编码颜色为变量；可通过搜索替换批量处理，但需目视 QA 校验 light 主题下对比度。
- [图标复杂度] 月亮/太阳 SVG 需手工绘制以匹配 stroke 线条风格；使用几何简化图形即可，无需精细插图。
- [系统偏好变化响应] `matchMedia` 事件监听可选；首版不做实时跟随（用户刷新后才更新），保持实现简单。
