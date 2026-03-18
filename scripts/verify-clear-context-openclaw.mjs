import 'dotenv/config';

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const pin = process.env.SMOKE_PIN ?? process.env.AUTH_SHARED_PIN ?? '';
const expectedIdentity = 'tars';
const expectedSecret = '蓝色山丘';

const requestId = (label) => `req_${label}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

const fail = (stage, extra = {}) => {
  console.error(JSON.stringify({ ok: false, stage, ...extra }, null, 2));
  process.exit(1);
};

const asJson = async (response) => response.json().catch(() => null);

const createHeaders = (sessionToken, authToken = '') => ({
  'content-type': 'application/json',
  authorization: `Bearer ${sessionToken}`,
  ...(authToken ? { 'x-app-auth': authToken } : {}),
});

const sendText = async ({ sessionId, sessionToken, authToken, text, label }) => {
  const response = await fetch(`${base}/api/text/input`, {
    method: 'POST',
    headers: createHeaders(sessionToken, authToken),
    body: JSON.stringify({
      sessionId,
      text,
      requestId: requestId(label),
    }),
  });

  const payload = await asJson(response);
  if (!response.ok) {
    fail(label, { status: response.status, payload });
  }

  return payload;
};

const normalizeText = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const includesIdentity = (value) => normalizeText(value).includes(expectedIdentity);

const run = async () => {
  const authConfigResponse = await fetch(`${base}/api/auth/config`);
  const authConfigPayload = await asJson(authConfigResponse);
  if (!authConfigResponse.ok) {
    fail('auth-config', {
      status: authConfigResponse.status,
      payload: authConfigPayload,
    });
  }

  let authToken = '';
  if (authConfigPayload?.data?.enabled) {
    if (!/^\d{6}$/.test(pin)) {
      fail('unlock-input', {
        message: 'shared pin is required',
      });
    }

    const unlockResponse = await fetch(`${base}/api/auth/unlock`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ pin }),
    });
    const unlockPayload = await asJson(unlockResponse);
    if (!unlockResponse.ok) {
      fail('unlock', {
        status: unlockResponse.status,
        payload: unlockPayload,
      });
    }

    authToken = unlockPayload?.data?.authToken ?? '';
  }

  const createResponse = await fetch(`${base}/api/session/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { 'x-app-auth': authToken } : {}),
    },
    body: JSON.stringify({
      device: {
        type: 'tesla-browser',
        label: 'clear-context-smoke',
      },
    }),
  });
  const createPayload = await asJson(createResponse);
  if (!createResponse.ok) {
    fail('create', {
      status: createResponse.status,
      payload: createPayload,
    });
  }

  const sessionId = createPayload?.data?.session?.sessionId;
  const sessionToken = createPayload?.data?.sessionToken;
  if (!sessionId || !sessionToken) {
    fail('create-payload', { payload: createPayload });
  }

  const first = await sendText({
    sessionId,
    sessionToken,
    authToken,
    label: 'identity-before',
    text: '你叫什么名字？只回答名字本身，不要添加任何别的内容。',
  });
  const firstReply = first?.data?.assistantMessage?.content ?? '';
  if (!includesIdentity(firstReply)) {
    fail('identity-before-mismatch', {
      expected: expectedIdentity,
      actual: firstReply,
    });
  }

  const second = await sendText({
    sessionId,
    sessionToken,
    authToken,
    label: 'remember-secret',
    text: `记住：本轮对话暗号是“${expectedSecret}”。只回复：收到。`,
  });
  const secondReply = second?.data?.assistantMessage?.content ?? '';
  if (!secondReply.includes('收到')) {
    fail('remember-secret-mismatch', {
      expected: '收到',
      actual: secondReply,
    });
  }

  const third = await sendText({
    sessionId,
    sessionToken,
    authToken,
    label: 'secret-before-clear',
    text: '本轮对话暗号是什么？只回答暗号本身，不要添加任何别的内容。',
  });
  const thirdReply = third?.data?.assistantMessage?.content ?? '';
  if (!thirdReply.includes(expectedSecret)) {
    fail('secret-before-clear-mismatch', {
      expected: expectedSecret,
      actual: thirdReply,
    });
  }

  const clearResponse = await fetch(`${base}/api/session/clear`, {
    method: 'POST',
    headers: createHeaders(sessionToken, authToken),
    body: JSON.stringify({ sessionId }),
  });
  const clearPayload = await asJson(clearResponse);
  if (!clearResponse.ok) {
    fail('clear', {
      status: clearResponse.status,
      payload: clearPayload,
    });
  }

  const fourth = await sendText({
    sessionId,
    sessionToken,
    authToken,
    label: 'identity-after',
    text: '你叫什么名字？只回答名字本身，不要添加任何别的内容。',
  });
  const fourthReply = fourth?.data?.assistantMessage?.content ?? '';
  if (!includesIdentity(fourthReply)) {
    fail('identity-after-mismatch', {
      expected: expectedIdentity,
      actual: fourthReply,
    });
  }

  const fifth = await sendText({
    sessionId,
    sessionToken,
    authToken,
    label: 'secret-after-clear',
    text: '本轮对话暗号是什么？如果不知道，只回答：不知道。',
  });
  const fifthReply = fifth?.data?.assistantMessage?.content ?? '';
  if (fifthReply.includes(expectedSecret)) {
    fail('secret-after-clear-mismatch', {
      expected: '不知道',
      actual: fifthReply,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    base,
    sessionId,
    identityBefore: firstReply,
    rememberReply: secondReply,
    secretBeforeClear: thirdReply,
    clearPayload,
    identityAfter: fourthReply,
    secretAfterClear: fifthReply,
  }, null, 2));
};

run().catch((error) => {
  fail('crash', {
    error: error instanceof Error ? error.message : String(error),
  });
});
