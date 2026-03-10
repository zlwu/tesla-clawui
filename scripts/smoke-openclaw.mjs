const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const prompt =
  process.env.SMOKE_TEXT ?? '请用一句话说明你现在已经通过本地 OpenClaw Gateway 在回复。';
const requestId = `req_openclaw_smoke_${Date.now()}`;

const fail = (message, details) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message,
        ...(details ? { details } : {}),
      },
      null,
      2,
    ),
  );
  process.exit(1);
};

const run = async () => {
  const createResponse = await fetch(`${baseUrl}/api/session/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      device: {
        type: 'tesla-browser',
        label: 'openclaw-smoke',
      },
    }),
  });

  const createPayload = await createResponse.json().catch(() => null);

  if (!createResponse.ok) {
    fail('session create failed', {
      status: createResponse.status,
      payload: createPayload,
    });
  }

  const sessionId = createPayload?.data?.session?.sessionId;
  const sessionToken = createPayload?.data?.sessionToken;

  if (!sessionId || !sessionToken) {
    fail('session create returned incomplete payload', { payload: createPayload });
  }

  const startedAt = Date.now();
  const textResponse = await fetch(`${baseUrl}/api/text/input`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      sessionId,
      text: prompt,
      requestId,
    }),
  });
  const durationMs = Date.now() - startedAt;
  const textPayload = await textResponse.json().catch(() => null);

  if (!textResponse.ok) {
    fail('text input failed', {
      status: textResponse.status,
      payload: textPayload,
      durationMs,
    });
  }

  const reply = textPayload?.data?.assistantMessage?.content;

  if (!reply || typeof reply !== 'string') {
    fail('assistant reply missing', {
      payload: textPayload,
      durationMs,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        sessionId,
        requestId,
        durationMs,
        reply,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  fail('smoke script crashed', {
    error: error instanceof Error ? error.message : String(error),
  });
});
