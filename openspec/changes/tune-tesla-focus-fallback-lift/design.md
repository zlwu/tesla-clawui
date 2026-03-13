## Summary

这次不是重做 keyboard avoidance 信号链路，而是收紧一个已经证实不够的兜底参数。现有 `layout viewport` 和 `visualViewport` 路径继续保持不变，只调整最后一层 `focus-fallback` 的抬升强度。

当前收口是临时修复，不把新的固定值视作最终真值。它的目标是先恢复 Tesla 真机可用性，再为后续基于真实运行时信号的修复留出空间。

## Design

### 1. 提高 Tesla fallback 抬升量

当 Tesla 真机缺少可靠 viewport 信号时，系统输入法面板的覆盖高度明显高于当前 `220px` 最小抬升量。新的 fallback 需要默认给出更强的底部 inset，优先保证 textarea、发送动作和就近状态区真正进入可操作区域。

### 2. 保留超短视口保护

对于极短的 fallback 视口，仍保留额外裁剪，避免固定高度 shell 被过度底部 padding 挤爆。但这个保护只服务于超短视口，不能再次削弱 Tesla 常规高度上的 fallback。

## Analysis Findings

### 1. iOS Safari 正常不代表 fallback 正确

iOS Safari 上键盘抬升正常，说明现有 keyboard avoidance 在可用 `layout viewport` 或 `visualViewport` 信号存在时基本成立。该平台更可能命中真实 viewport 信号路径，而不是最后一层 `focus-fallback`。

### 2. Tesla 问题集中在 fallback 路径

Tesla 真机仍出现输入框大面积被遮挡，更符合“浏览器没有提供足够可靠的 viewport 信号，页面被迫退回 `focus-fallback`”的特征。也就是说，当前问题更像是最后一层兜底不够，而不是前两层布局公式在所有平台都失效。

### 3. 当前固定值仍然属于经验型参数

由于 Tesla 真机不一定暴露真实键盘高度，`focus-fallback` 的数值目前仍是保守经验值，而不是从 Web API 直接精确计算出来的结果。这使它适合作为临时止血，但不适合作为长期最终方案。

## Follow-up Plan

### 1. 先做运行时观测，而不是继续盲调常量

后续修复应先在 Tesla 与 iOS Safari 上采样以下运行时数据：

- `window.innerHeight`
- `window.visualViewport?.height`
- `window.visualViewport?.offsetTop`
- 最终命中的 `keyboardAvoidanceSource`
- 最终应用的 `keyboardInset`

目标是先确认 Tesla 真机究竟是完全缺少可靠 viewport 信号，还是已有信号但阈值或触发时机不对。

### 2. 根据信号质量决定后续方案

- 如果 Tesla 真机仍缺少可靠 viewport 信号，则考虑在 `focus-fallback` 上增加“有上限的自适应抬升”校正，而不是继续只调固定常量。
- 如果 Tesla 真机其实存在可用信号，则优先修正 signal selection、settle timing 或阈值判断，避免误退回 `focus-fallback`。

### 3. 保持单一路径补偿原则

无论后续采用哪种方案，都必须继续遵守现有设计要求：`layout viewport`、`visualViewport` 和 `focus-fallback` 只能命中单一路径，不能为了修 Tesla 再引入双重补偿。

## Validation

- 单测验证高视口 fallback 会得到更高的 inset。
- 单测验证中等高度 Tesla fallback 不再被误裁。
- 单测验证超短视口仍保留保护。
