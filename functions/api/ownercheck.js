// Owner-key check — lets the owner page confirm their key WITHOUT ever revealing the secret.
// Returns only two booleans: whether the server has OWNER_REPORT_KEY configured, and whether the
// supplied key matches (constant-time). Never echoes the value. Separate from the discount key.
import { safeEqual } from "../utils/discount-lib.js";

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const key = String(body.key || "");
  const ownerKey = env.OWNER_REPORT_KEY;
  const configured = !!(ownerKey && ownerKey.length >= 16);
  let match = false;
  if (configured && key) match = safeEqual(key, ownerKey);
  if (!match) await new Promise(r => setTimeout(r, 300));  // blunt guessing a little
  return json({ configured, match });
}
