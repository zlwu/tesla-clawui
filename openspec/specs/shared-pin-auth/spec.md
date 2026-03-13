## Purpose

定义 shared PIN 门禁能力，保证当前登录模型保持为轻量、单环境、适合 Tesla 触屏的解锁流程。

## Requirements

### Requirement: Shared PIN 门禁
当认证开启时，客户端 MUST 在创建或恢复 Tesla 聊天会话之前先通过 shared PIN 流程完成门禁校验。

#### Scenario: 启动时开启认证
- **WHEN** 部署配置中启用了 `AUTH_ENABLED`
- **THEN** 客户端 MUST 先完成 PIN 解锁，之后才能进入聊天界面

#### Scenario: 启动时关闭认证
- **WHEN** 当前环境关闭了认证
- **THEN** 客户端 MUST 允许用户直接进入聊天流程，而不显示 PIN 提示

### Requirement: 六位数字解锁体验
shared PIN 流程 MUST 使用适合 Tesla 触屏输入的六位数字交互。

#### Scenario: 逐位输入 PIN
- **WHEN** 用户输入单个数字
- **THEN** UI MUST 只接受数字输入，并在六个输入格之间按预期推进

#### Scenario: 修正或粘贴 PIN
- **WHEN** 用户删除数字或一次性粘贴 PIN
- **THEN** UI MUST 支持回退修正和完整六位粘贴，且不破坏当前解锁流程

### Requirement: 解锁接口契约
后端 MUST 提供轻量解锁接口，为 shared PIN 门禁返回带时效的 auth token 以及客户端所需配置。

#### Scenario: 获取认证配置
- **WHEN** 客户端请求认证初始化数据
- **THEN** 后端 MUST 返回是否开启认证以及预期 PIN 长度

#### Scenario: 使用正确 PIN 解锁
- **WHEN** 客户端提交有效 PIN
- **THEN** 后端 MUST 返回 auth token 和过期时间，供后续受保护操作使用

#### Scenario: 使用错误 PIN 解锁
- **WHEN** 客户端提交无效 PIN
- **THEN** 后端 MUST 返回稳定的认证错误，并且 MUST NOT 创建聊天会话
