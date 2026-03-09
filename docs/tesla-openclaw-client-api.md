# Tesla 车机 OpenClaw 客户端 API 文档（MVP）

## 1. 文档目标

本文档定义 Tesla 车机 OpenClaw 客户端 MVP 所需的后端 API 契约。

当前 API 设计基于以下产品结论：

- Tesla 车机单端优先
- 语音输入是主入口
- 大字文本多轮显示是主输出
- TTS 不作为首版主链路前提
- 手机端协同不进入 MVP

本文档用于：

- 指导前后端并行开发
- 为 Codex 提供明确接口边界
- 作为验证原型与正式 MVP 的统一契约基础

---

## 2. 设计原则

1. **REST API 优先**
2. **JSON 为主，语音上传使用 multipart/form-data**
3. **返回结构统一**
4. **错误码统一**
5. **所有关键字段显式命名**
6. **支持 requestId 幂等**
7. **为后续可选 TTS 扩展保留字段，但不让其阻塞主链路**

---

## 3. 通用约定

## 3.1 Base URL

示例：

```text
https://your-domain.example.com/api
```

---

## 3.2 认证方式

MVP 推荐：

- 创建 session 后由服务端返回 `sessionToken`
- 后续请求通过 Header 传递

### Header

```http
Authorization: Bearer <sessionToken>
```

如 MVP 初期先不做严格鉴权，也至少要保留该字段位，方便后续无痛接入。

---

## 3.3 通用成功响应结构

对于返回 JSON 的接口，推荐统一使用：

```json
{
  "ok": true,
  "data": {}
}
```

---

## 3.4 通用错误响应结构

```json
{
  "ok": false,
  "error": {
    "code": "STRING_CODE",
    "message": "面向用户或开发者的错误描述",
    "retryable": true,
    "details": {}
  }
}
```

### 字段说明

- `code`: 稳定错误码
- `message`: 可读错误信息
- `retryable`: 是否建议前端允许重试
- `details`: 可选调试信息

---

## 3.5 通用错误码建议

### 会话相关
- `SESSION_NOT_FOUND`
- `SESSION_EXPIRED`
- `SESSION_UNAUTHORIZED`

### 请求相关
- `INVALID_REQUEST`
- `VALIDATION_FAILED`
- `UNSUPPORTED_MEDIA_TYPE`
- `REQUEST_CONFLICT`

### 语音相关
- `MIC_REQUIRED`
- `AUDIO_UPLOAD_FAILED`
- `AUDIO_FILE_INVALID`
- `ASR_FAILED`
- `ASR_TIMEOUT`

### 模型相关
- `LLM_FAILED`
- `LLM_TIMEOUT`
- `CONTEXT_BUILD_FAILED`

### 网络/系统相关
- `RATE_LIMITED`
- `INTERNAL_ERROR`
- `SERVICE_UNAVAILABLE`

### 可选 TTS 相关
- `TTS_FAILED`
- `TTS_TIMEOUT`

---

## 3.6 状态枚举

前端主状态建议与后端响应保持一致：

- `idle`
- `recording`
- `uploading`
- `transcribing`
- `thinking`
- `error`

可选扩展：

- `synthesizing`
- `playing`

---

## 4. 数据模型

## 4.1 Session

```json
{
  "sessionId": "sess_123",
  "status": "idle",
  "createdAt": "2026-03-09T11:00:00.000Z",
  "updatedAt": "2026-03-09T11:00:00.000Z"
}
```

### 字段说明

- `sessionId`: 会话唯一标识
- `status`: 当前会话状态
- `createdAt`: 创建时间
- `updatedAt`: 最近更新时间

---

## 4.2 Message

```json
{
  "messageId": "msg_123",
  "sessionId": "sess_123",
  "role": "assistant",
  "content": "你好，今天想聊什么？",
  "source": "llm",
  "createdAt": "2026-03-09T11:01:00.000Z"
}
```

### 字段说明

- `role`: `user` | `assistant` | `system`
- `content`: 纯文本内容
- `source`: `text` | `voice_asr` | `llm` | `system`

---

## 4.3 Voice Result

```json
{
  "requestId": "req_123",
  "sessionId": "sess_123",
  "transcript": "今天天气怎么样",
  "replyText": "今天上海多云，气温适中。",
  "status": "idle"
}
```

### 可选扩展字段

```json
{
  "audioUrl": "/api/audio/aud_123"
}
```

---

## 5. 接口定义

## 5.1 创建会话

### POST `/api/session/create`

创建一个新的对话会话。

### Request

#### Headers

```http
Content-Type: application/json
```

#### Body

```json
{
  "device": {
    "type": "tesla-browser",
    "label": "tesla-mcu2"
  }
}
```

### 字段说明

- `device.type`: 设备类型，MVP 可固定为 `tesla-browser`
- `device.label`: 可选，便于日志识别

### Response 200

```json
{
  "ok": true,
  "data": {
    "session": {
      "sessionId": "sess_123",
      "status": "idle",
      "createdAt": "2026-03-09T11:00:00.000Z",
      "updatedAt": "2026-03-09T11:00:00.000Z"
    },
    "sessionToken": "token_abc"
  }
}
```

### 错误

- `INVALID_REQUEST`
- `INTERNAL_ERROR`

---

## 5.2 获取会话信息

### GET `/api/session/:sessionId`

获取当前会话基础信息。

### Request

#### Headers

```http
Authorization: Bearer <sessionToken>
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "session": {
      "sessionId": "sess_123",
      "status": "idle",
      "createdAt": "2026-03-09T11:00:00.000Z",
      "updatedAt": "2026-03-09T11:05:00.000Z"
    }
  }
}
```

### 错误

- `SESSION_NOT_FOUND`
- `SESSION_UNAUTHORIZED`

---

## 5.3 文本输入

### POST `/api/text/input`

发送一条文本消息并获得 assistant 回复。

### Request

#### Headers

```http
Authorization: Bearer <sessionToken>
Content-Type: application/json
```

#### Body

```json
{
  "sessionId": "sess_123",
  "text": "帮我总结一下今天的待办",
  "requestId": "req_text_001"
}
```

### 字段说明

- `sessionId`: 当前会话 ID
- `text`: 用户输入文本
- `requestId`: 客户端请求 ID，用于幂等和日志

### Response 200

```json
{
  "ok": true,
  "data": {
    "requestId": "req_text_001",
    "sessionId": "sess_123",
    "userMessage": {
      "messageId": "msg_user_001",
      "sessionId": "sess_123",
      "role": "user",
      "content": "帮我总结一下今天的待办",
      "source": "text",
      "createdAt": "2026-03-09T11:10:00.000Z"
    },
    "assistantMessage": {
      "messageId": "msg_asst_001",
      "sessionId": "sess_123",
      "role": "assistant",
      "content": "今天你有三个重点待办：……",
      "source": "llm",
      "createdAt": "2026-03-09T11:10:03.000Z"
    },
    "status": "idle"
  }
}
```

### 错误

- `VALIDATION_FAILED`
- `SESSION_NOT_FOUND`
- `LLM_FAILED`
- `LLM_TIMEOUT`
- `INTERNAL_ERROR`

---

## 5.4 语音输入

### POST `/api/voice/input`

上传语音并完成：

```text
录音上传 -> ASR -> LLM -> 返回文本结果
```

### Request

#### Headers

```http
Authorization: Bearer <sessionToken>
Content-Type: multipart/form-data
```

#### Form Data

| 字段名 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| sessionId | string | 是 | 会话 ID |
| requestId | string | 是 | 请求唯一 ID，用于幂等 |
| audio | file | 是 | 录音文件 |
| mimeType | string | 否 | 音频 MIME 类型 |
| language | string | 否 | 识别语言，默认 `zh-CN` |

### 示例

- `audio`: `blob`
- `mimeType`: `audio/webm;codecs=opus`
- `language`: `zh-CN`

### Response 200

```json
{
  "ok": true,
  "data": {
    "requestId": "req_voice_001",
    "sessionId": "sess_123",
    "transcript": "今天天气怎么样",
    "userMessage": {
      "messageId": "msg_user_002",
      "sessionId": "sess_123",
      "role": "user",
      "content": "今天天气怎么样",
      "source": "voice_asr",
      "createdAt": "2026-03-09T11:12:00.000Z"
    },
    "assistantMessage": {
      "messageId": "msg_asst_002",
      "sessionId": "sess_123",
      "role": "assistant",
      "content": "今天上海多云，气温大约 18 到 24 度。",
      "source": "llm",
      "createdAt": "2026-03-09T11:12:04.000Z"
    },
    "status": "idle"
  }
}
```

### 可选扩展响应字段

```json
{
  "audioUrl": "/api/audio/aud_001"
}
```

### 幂等约定

如果同一个 `requestId` 已成功处理过，服务端应：

- 返回已有结果，或
- 返回明确冲突信息

推荐优先返回已有结果，避免前端重复提交导致重复消息。

### 错误

- `VALIDATION_FAILED`
- `SESSION_NOT_FOUND`
- `UNSUPPORTED_MEDIA_TYPE`
- `AUDIO_UPLOAD_FAILED`
- `AUDIO_FILE_INVALID`
- `ASR_FAILED`
- `ASR_TIMEOUT`
- `LLM_FAILED`
- `LLM_TIMEOUT`
- `REQUEST_CONFLICT`
- `INTERNAL_ERROR`

---

## 5.5 获取最近消息

### GET `/api/messages`

按会话获取最近消息列表。

### Query Parameters

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| sessionId | string | 是 | 会话 ID |
| limit | number | 否 | 返回条数，默认 8，最大建议 20 |

### 示例

```http
GET /api/messages?sessionId=sess_123&limit=8
```

### Response 200

```json
{
  "ok": true,
  "data": {
    "sessionId": "sess_123",
    "messages": [
      {
        "messageId": "msg_001",
        "sessionId": "sess_123",
        "role": "user",
        "content": "今天天气怎么样",
        "source": "voice_asr",
        "createdAt": "2026-03-09T11:12:00.000Z"
      },
      {
        "messageId": "msg_002",
        "sessionId": "sess_123",
        "role": "assistant",
        "content": "今天上海多云，气温大约 18 到 24 度。",
        "source": "llm",
        "createdAt": "2026-03-09T11:12:04.000Z"
      }
    ]
  }
}
```

### 错误

- `SESSION_NOT_FOUND`
- `SESSION_UNAUTHORIZED`
- `VALIDATION_FAILED`

---

## 5.6 健康检查

### GET `/api/health`

用于本地开发、部署探活和基础监控。

### Response 200

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "time": "2026-03-09T11:20:00.000Z"
  }
}
```

---

## 5.7 可选：获取音频文件

### GET `/api/audio/:audioId`

仅在后续启用 TTS 功能时需要。

### 说明

- MVP 首版可不实现
- 如果实现，建议返回标准音频流或 302 到静态资源

### Response

```http
200 OK
Content-Type: audio/mpeg
```

### 错误

- `AUDIO_FILE_INVALID`
- `SESSION_UNAUTHORIZED`
- `INTERNAL_ERROR`

---

## 6. 典型交互流程

## 6.1 页面初始化流程

```text
前端打开页面
 -> POST /api/session/create
 -> 保存 sessionId + sessionToken
 -> GET /api/messages?sessionId=...
 -> 渲染最近消息
```

---

## 6.2 文本对话流程

```text
用户输入文本
 -> POST /api/text/input
 -> 返回 userMessage + assistantMessage
 -> 前端更新消息区
```

---

## 6.3 语音对话流程

```text
用户点击录音
 -> 前端录音完成
 -> POST /api/voice/input (multipart)
 -> 服务端做 ASR + LLM
 -> 返回 transcript + userMessage + assistantMessage
 -> 前端更新消息区
```

---

## 7. 前端状态与接口对应关系

| 前端状态 | 触发时机 | 对应接口/行为 |
|---|---|---|
| idle | 空闲 | 无 |
| recording | 用户开始录音 | MediaRecorder |
| uploading | 录音结束后上传 | `POST /api/voice/input` |
| transcribing | 服务端识别中 | `/api/voice/input` 服务端内部阶段 |
| thinking | LLM 回复中 | `/api/voice/input` 或 `/api/text/input` 服务端内部阶段 |
| error | 任意失败 | 错误响应 |

说明：
- `transcribing` 与 `thinking` 在 MVP 中可由前端用阶段文案近似表示
- 若后续引入 SSE，可做更细粒度状态同步

---

## 8. 字段约束建议

## 8.1 文本长度

- `text`: 建议最大 4000 字符
- 超过限制返回 `VALIDATION_FAILED`

## 8.2 语音文件大小

- 建议首版限制在 10MB 内
- 超限返回 `AUDIO_FILE_INVALID` 或 `VALIDATION_FAILED`

## 8.3 limit 参数

- 默认 8
- 最大 20
- 超过上限时服务端截断或返回校验错误

---

## 9. 示例错误响应

## 9.1 语音文件格式不支持

```json
{
  "ok": false,
  "error": {
    "code": "UNSUPPORTED_MEDIA_TYPE",
    "message": "当前音频格式不受支持",
    "retryable": false,
    "details": {
      "mimeType": "audio/unknown"
    }
  }
}
```

## 9.2 ASR 超时

```json
{
  "ok": false,
  "error": {
    "code": "ASR_TIMEOUT",
    "message": "语音识别超时，请重试",
    "retryable": true,
    "details": {}
  }
}
```

## 9.3 LLM 失败

```json
{
  "ok": false,
  "error": {
    "code": "LLM_FAILED",
    "message": "回复生成失败，请稍后重试",
    "retryable": true,
    "details": {}
  }
}
```

---

## 10. 建议的服务端内部实现映射

虽然这不属于 HTTP 契约本身，但建议按以下分层实现：

- `session-service`
- `message-service`
- `asr-service`
- `llm-service`
- `tts-service`（可选）

### `/api/voice/input` 内部步骤建议

1. 校验 session
2. 校验 requestId
3. 接收与保存音频
4. 调用 ASR
5. 生成 userMessage
6. 组装上下文并调用 LLM
7. 生成 assistantMessage
8. 返回结果
9. 可选生成 TTS

---

## 11. MVP 阶段不建议加入的接口

以下接口暂不建议加入，避免过早复杂化：

- WebSocket 对话流接口
- 多设备配对接口
- 用户设置接口
- 历史搜索接口
- 会话摘要管理接口
- 录音分片流式上传接口
- 实时 partial transcript 接口

---

## 12. 一句话 API 原则

> API 先服务于“语音输入 + 大字文本多轮”这条主链路；扩展能力可以预留字段，但不要反过来绑架首版实现。