import 'dotenv/config';
import { createHash, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';

const baseUrl = process.env.OPENCLAW_GATEWAY_URL ?? process.env.LLM_BASE_URL ?? 'ws://127.0.0.1:18789';
const apiKey = process.env.OPENCLAW_GATEWAY_TOKEN ?? process.env.LLM_API_KEY ?? '';
const agentId = process.env.OPENCLAW_AGENT_ID ?? 'main';
const prompt =
  process.env.SMOKE_TEXT ?? '你叫什么名字？只回答名字本身，不要添加任何别的内容。';
const expectedIdentity = (process.env.SMOKE_EXPECTED_IDENTITY ?? 'tars').trim().toLowerCase();
const sessionKey = `agent:${agentId}:probe_${Date.now()}`;
const connectRole = 'operator';
const connectScopes = ['operator.admin', 'operator.approvals', 'operator.pairing'];
const clientId = 'openclaw-probe';
const clientMode = 'probe';

const resolveGatewayPlatform = () => {
  if (process.platform === 'darwin') {
    return 'macos';
  }
  if (process.platform === 'win32') {
    return 'windows';
  }
  return process.platform;
};

const fail = (message, details) => {
  console.error(JSON.stringify({ ok: false, message, ...(details ? { details } : {}) }, null, 2));
  process.exit(1);
};

const normalizeGatewayUrl = (input) => {
  const parsed = new URL(input);
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  }
  if (parsed.pathname === '/v1/chat/completions') {
    parsed.pathname = '/';
    parsed.search = '';
  }
  return parsed.toString();
};

const parseMessageText = (value) => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => parseMessageText(entry)).join('');
  }
  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value;
  for (const key of ['text', 'content', 'delta', 'message', 'value']) {
    const candidate = parseMessageText(record[key]);
    if (candidate) {
      return candidate;
    }
  }

  return Object.values(record).map((entry) => parseMessageText(entry)).join('');
};

const request = (socket, method, params) =>
  new Promise((resolve, reject) => {
    const id = `${method}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const onMessage = (event) => {
      const frame = JSON.parse(String(event.data));
      if (frame?.type !== 'res' || frame.id !== id) {
        return;
      }
      socket.removeEventListener('message', onMessage);
      if (frame.ok) {
        resolve(frame.payload ?? null);
        return;
      }
      reject(new Error(frame.error?.message ?? `${method} failed`));
    };

    socket.addEventListener('message', onMessage);
    socket.send(JSON.stringify({
      type: 'req',
      id,
      method,
      ...(params === undefined ? {} : { params }),
    }));
  });

const createDeviceIdentity = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicJwk = publicKey.export({ format: 'jwk' });
  const privateJwk = privateKey.export({ format: 'jwk' });

  if (
    publicJwk.kty !== 'OKP' ||
    publicJwk.crv !== 'Ed25519' ||
    typeof publicJwk.x !== 'string' ||
    privateJwk.kty !== 'OKP' ||
    privateJwk.crv !== 'Ed25519' ||
    typeof privateJwk.d !== 'string'
  ) {
    throw new Error('failed to generate gateway device identity');
  }

  return {
    deviceId: createHash('sha256').update(Buffer.from(publicJwk.x, 'base64url')).digest('hex'),
    publicKey: publicJwk.x,
    privateKey: privateJwk.d,
  };
};

const createSignaturePayload = ({ deviceId, nonce, signedAtMs, token }) =>
  [
    'v2',
    deviceId,
    clientId,
    clientMode,
    connectRole,
    connectScopes.join(','),
    String(signedAtMs),
    token ?? '',
    nonce,
  ].join('|');

const signPayload = ({ publicKey, privateKey, payload }) =>
  sign(
    null,
    Buffer.from(payload, 'utf8'),
    createPrivateKey({
      key: {
        kty: 'OKP',
        crv: 'Ed25519',
        x: publicKey,
        d: privateKey,
      },
      format: 'jwk',
    }),
  ).toString('base64url');

const waitForChallenge = (socket) =>
  new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve('');
    }, 750);

    const onMessage = (event) => {
      const frame = JSON.parse(String(event.data));
      if (frame?.type !== 'event' || frame.event !== 'connect.challenge') {
        return;
      }

      socket.removeEventListener('message', onMessage);
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve(typeof frame.payload?.nonce === 'string' ? frame.payload.nonce : '');
    };

    socket.addEventListener('message', onMessage);
  });

const run = async () => {
  if (!apiKey) {
    fail('missing gateway token', {
      hint: 'Set OPENCLAW_GATEWAY_TOKEN or LLM_API_KEY before running smoke:openclaw:gateway.',
    });
  }

  const socket = new WebSocket(normalizeGatewayUrl(baseUrl));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('gateway open timeout')), 10000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('gateway open failed'));
    });
  }).catch((error) => fail('gateway connect failed', { error: error.message, baseUrl }));

  const device = createDeviceIdentity();
  const challengeNonce = await waitForChallenge(socket);
  const signedAt = Date.now();
  const signaturePayload = createSignaturePayload({
    deviceId: device.deviceId,
    nonce: challengeNonce,
    signedAtMs: signedAt,
    token: apiKey,
  });

  const hello = await request(socket, 'connect', {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: clientId,
      version: 'tesla-openclaw-gateway-probe/0.1.0',
      platform: resolveGatewayPlatform(),
      mode: clientMode,
    },
    role: connectRole,
    scopes: connectScopes,
    device: {
      id: device.deviceId,
      publicKey: device.publicKey,
      signature: signPayload({
        publicKey: device.publicKey,
        privateKey: device.privateKey,
        payload: signaturePayload,
      }),
      signedAt,
      nonce: challengeNonce,
    },
    caps: ['tool-events'],
    auth: {
      token: apiKey,
    },
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    userAgent: 'tesla-openclaw-gateway-probe/0.1.0',
  }).catch((error) => fail('gateway hello failed', { error: error.message }));

  if (hello?.type !== 'hello-ok') {
    fail('gateway hello failed', {
      error: 'unexpected hello payload',
      payload: hello,
    });
  }

  await request(socket, 'chat.subscribe', { sessionKey }).catch(() =>
    request(socket, 'chat.subscribe', { key: sessionKey }).catch(() => null),
  );

  let reply = '';
  const completion = new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const frame = JSON.parse(String(event.data));
      if (frame?.type !== 'event' || frame.event !== 'chat') {
        return;
      }

      const payload = frame.payload ?? {};
      if (payload.sessionKey !== sessionKey) {
        return;
      }

      if (payload.state === 'delta') {
        reply += parseMessageText(payload.message);
        return;
      }

      if (payload.state === 'final') {
        if (!reply) {
          reply = parseMessageText(payload.message);
        }
        socket.removeEventListener('message', onMessage);
        resolve();
        return;
      }

      if (payload.state === 'error' || payload.state === 'aborted') {
        socket.removeEventListener('message', onMessage);
        reject(new Error(payload.errorMessage ?? `chat ${payload.state}`));
      }
    };

    socket.addEventListener('message', onMessage);
  });

  await request(socket, 'chat.send', {
    sessionKey,
    message: prompt,
    deliver: true,
    idempotencyKey: `probe_${Date.now()}`,
  }).catch((error) => fail('chat.send failed', { error: error.message }));

  await completion.catch((error) => fail('chat completion failed', { error: error.message }));
  socket.close();

  const normalizedReply = reply.trim().toLowerCase();
  if (!normalizedReply) {
    fail('empty gateway reply', { sessionKey });
  }

  if (!normalizedReply.includes(expectedIdentity)) {
    fail('unexpected gateway identity', {
      expectedIdentity,
      actual: reply,
      sessionKey,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl: normalizeGatewayUrl(baseUrl),
    agentId,
    sessionKey,
    prompt,
    reply,
  }, null, 2));
};

run().catch((error) => {
  fail('gateway probe crashed', {
    error: error instanceof Error ? error.message : String(error),
  });
});
