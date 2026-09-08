import { createClient } from 'npm:@supabase/supabase-js@2.100.1';
const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
  if (!allowed.includes(origin))
    return new Response(JSON.stringify({ error: 'Origin denied' }), {
      status: 403,
      headers,
    });
  headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Headers'] =
    'authorization, apikey, content-type, x-client-info';
  headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  const reply = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), { status, headers });
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  const authorization = req.headers.get('authorization') || '';
  if (!/^Bearer [^ ]+$/.test(authorization))
    return reply(401, { error: 'Authentication required' });
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data: auth, error: authError } = await db.auth.getUser(
    authorization.slice(7),
  );
  if (authError || !auth.user) return reply(401, { error: 'Invalid session' });
  try {
    const { data: admitted, error: rateError } =
      await db.rpc('claim_ai_request');
    if (rateError) return reply(503, { error: 'Rate limiter unavailable' });
    if (!admitted) return reply(429, { error: 'Try again later' });
    if (Number(req.headers.get('content-length')) > 40000)
      return reply(413, { error: 'Payload too large' });
    const reader = req.body?.getReader();
    if (!reader) return reply(400, { error: 'Body required' });
    let length = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 40000) {
        await reader.cancel();
        return reply(413, { error: 'Payload too large' });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (
      !Array.isArray(payload.messages) ||
      payload.messages.length < 1 ||
      payload.messages.length > 12 ||
      payload.messages.some(
        (m: Record<string, unknown>) =>
          !m ||
          !['system', 'user', 'assistant'].includes(String(m.role)) ||
          typeof m.content !== 'string' ||
          m.content.length > 24000,
      )
    )
      return reply(400, { error: 'Invalid messages' });
    const key = Deno.env.get('AI_API_KEY');
    const model = Deno.env.get('AI_MODEL');
    if (!key || !model)
      return reply(503, { error: 'AI service not configured' });
    const upstream = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: payload.messages,
          max_tokens: 1500,
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(25000),
      },
    );
    if (!upstream.ok) return reply(502, { error: 'AI provider unavailable' });
    const data = await upstream.json();
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string')
      return reply(502, { error: 'Empty response' });
    return reply(200, { text });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'finance-ai-failed',
        kind: error instanceof Error ? error.name : 'unknown',
      }),
    );
    return reply(error instanceof SyntaxError ? 400 : 503, {
      error: 'Unable to complete request',
    });
  }
});
