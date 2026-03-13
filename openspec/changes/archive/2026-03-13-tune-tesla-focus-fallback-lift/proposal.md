## Why

Tesla 真机在输入框 focus 且浏览器缺少可靠 viewport 信号时，当前 `focus-fallback` 抬升量仍然偏小，导致输入法面板弹出后 composer 只露出少量区域，textarea 大半仍被遮挡，违背现有主屏交互 spec 对输入可达性的要求。

## What Changes

- 提高 `focus-fallback` 的保守抬升量，使 Tesla 真机在缺少可靠 viewport 信号时仍能把 textarea 与发送动作抬到可操作区域。
- 保留对超短视口的保护，避免低高度 fallback 设备被过度底部留白反向挤爆。
- 补充单元测试覆盖新的 Tesla fallback 区间和超短视口保护。
- 把当前结论记录为临时修复，而不是最终 keyboard avoidance 方案。

## Impact

- 影响 `web/src/ui-state.ts` 中的 keyboard fallback 计算。
- 影响 `web/src/__tests__/ui-state.test.ts` 的预期值与覆盖范围。
