# Tesla OpenClaw 当前状态

## 当前进度

- Phase 0：完成
- Phase 1：完成
- Phase 2：完成
- Phase 3：完成
- Phase 4：完成
- 网页录音 / ASR 主链路：已移除
- 本地 Chromium 验证：完成
- 生产模式本地验证：完成
- Tesla 真机验证：主链路通过（带瑕疵）

## 当前已实现能力

- 创建 session
- 文本输入闭环
- 真实 OpenClaw LLM 主链路
- 最近消息恢复
- 显式前端状态机
- 错误码统一
- requestId 幂等
- 基础链路日志与耗时埋点
- 弱网失败提示与手动重试
- Fastify 单服务托管前端页面与 API
- 开发态统一入口 `npm run dev`
- 单一底部 composer 输入区
- 发送按钮固定在输入框右侧
- 系统语音输入提示已并入输入框 placeholder

## 本地已验证项

本地浏览器已验证通过：

1. 页面可打开
2. session 可自动建立
3. 文本消息可发送并收到回复
4. 连续多轮上下文正常
5. 刷新后最近消息仍可恢复
6. 断网后会进入错误态
7. 恢复网络后可点击“重试上一步”

本地真实 provider 已验证通过：

1. `OpenRouter LLM`
2. 生产模式下首页与 API 同样可用
3. 本地 OpenClaw Gateway HTTP chat endpoint 已完成真实 `/api/text/input` 联调
4. `npm run smoke:openclaw` 已完成真实 OpenClaw 主链路验证

当前推荐 LLM 主链路为：

1. `OpenClaw Gateway LLM`
2. `OpenRouter LLM` 仅保留为可回退路径

当前登录门禁为：

1. `.env` 驱动的 shared PIN
2. 前端先输入 6 位 PIN 解锁
3. 解锁后再创建和恢复当前设备 session
4. 当前不提供多用户账号体系

当前 PIN 输入交互已经收口为：

1. 6 格数字输入
2. 每输入一位自动跳到下一格
3. Backspace 可回退到上一格
4. 支持一次性粘贴 6 位数字

## 接手后本地工程校验

以下命令已在当前代码上通过：

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

## 当前真机发现

Tesla 真机上已经确认：

1. 浏览器网页麦克风权限不可用
2. 系统键盘语音输入法可用
3. 长按系统语音键输入可作为同类主路径
4. 当前主链路已可完成发送与多轮显示
5. 已补充 Tesla 专项键盘避让兜底：优先依赖 `visualViewport`，失效时按 focus 触发保守上移

因此当前 MVP 真机主链路已调整为：

```text
系统语音输入法 / 长按系统语音键输入 -> 文本框 -> 发送 -> 大字文本多轮显示
```

网页内录音在 Tesla 真机上不再视为首要验证前提。
当前代码主线已经彻底移除网页录音按钮、语音上传接口与 ASR 配置要求。

## 当前真机结论

当前真机验证结论为：

`Proceed with Caveats`

理由：

1. 主链路已可用
2. 系统语音输入路径成立
3. 页面可完成会话、输入、发送、显示与继续对话
4. 输入面板遮挡已加专门兜底，但仍需继续做 Tesla 真机回归确认

## 当前 UI 收口结果

当前输入区已经按真机发现收口为：

1. 底部单一 composer
2. 发送按钮固定在输入框最右侧
3. 系统语音输入提示整合进输入框 placeholder
4. 头部副标题已移除，避免焦点切换时的视觉抖动

当前消息区滚动与布局也已经收口为：

1. composer 采用真实占位底栏，不再覆盖消息列表
2. 初始进入页面时默认定位到最新消息
3. 文本 streaming 期间默认跟随到底部
4. 用户手动上滑查看历史后，停止强制自动跟随
5. 输入框 focus 时启用 Tesla 专项保守底部留白；blur 后撤销留白并回到底部

当前渲染层已完成的工程收口：

1. `renderApp()` 已切到固定 auth/chat 壳体 + 局部 patch
2. textarea、PIN 输入框和 message list 节点已保持稳定，不再按整页 `innerHTML` 重建
3. assistant 消息按 `messageId` 做 keyed patch，streaming 时只更新对应消息节点
4. 重构边界仍限定在渲染层，不改现有状态机、SSE 协议和 OpenClaw 主链路

## 外网访问说明

- 已验证可通过 `cloudflared` quick tunnel 暴露当前单服务入口
- `trycloudflare.com` 临时地址不稳定，只适合临时测试
- 不应把临时隧道方案写入正式产品设计

## 下一步建议

1. 文本 SSE streaming 已完成，assistant 回复支持边输出边显示
2. assistant 消息的受控 Markdown 子集渲染已完成，当前优先保证安全和可读性，不扩展为完整富文本
3. Tesla 键盘避让兼容已进入代码主线，下一步以真机回归为主
4. 不再以网页内录音能力作为 Tesla 真机首版前提，项目主线固定为系统语音输入法 + 文本发送
5. 下一步继续以 Tesla 真机回归为主，重点验证键盘避让和消息滚动在真实设备上的稳定性
