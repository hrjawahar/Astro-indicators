// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/indicate.js
//  Cloudflare Pages Function — proxies Anthropic API for Dasha indications.
//  Streams the response back to the browser.
//
//  SETUP REQUIRED (one-time):
//  In Cloudflare Pages → Settings → Environment variables → add:
//    ANTHROPIC_API_KEY = sk-ant-...your key...
// ─────────────────────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured in Cloudflare environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), { status: 400 });
  }

  const { prompt } = body;
  if (!prompt || typeof prompt !== "string") {
    return new Response(JSON.stringify({ error: "Missing prompt." }), { status: 400 });
  }

  // Call Anthropic with streaming
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":         "application/json",
      "x-api-key":            apiKey,
      "anthropic-version":    "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-5",
      max_tokens: body.max_tokens || 4096,
      stream:     true,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: `Anthropic API error ${anthropicRes.status}: ${errText.slice(0, 200)}` }),
      { status: anthropicRes.status, headers: { "Content-Type": "application/json" } }
    );
  }

  // Stream the response body directly back to the browser
  return new Response(anthropicRes.body, {
    status: 200,
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
