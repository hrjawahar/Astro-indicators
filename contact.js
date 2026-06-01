// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/contact.js
//  Cloudflare Pages Function — emails a Contact Us submission to the owner.
//
//  SETUP (Cloudflare → Settings → Environment variables):
//    OWNER_EMAIL     = vidhurtss@gmail.com   (already set)
//    RESEND_API_KEY  = your Resend key       (set this up at resend.com)
//
//  Until RESEND_API_KEY is set, this returns ok so the form still confirms;
//  it just won't send the email yet.
// ─────────────────────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }

  const type    = String(body.type || "Others");
  const name    = String(body.name || "");
  const email   = String(body.email || "");
  const phone   = String(body.phone || "");
  const message = String(body.message || "");
  const mdWanted= String(body.mdWanted || "");

  if (!name.trim() || (!email.trim() && !phone.trim())) {
    return json({ error: "Please provide your name and a way to reach you." }, 400);
  }

  const ownerEmail = env.OWNER_EMAIL || "vidhurtss@gmail.com";
  const resendKey  = env.RESEND_API_KEY;

  // If email isn't configured yet, still succeed so the user gets confirmation.
  if (!resendKey) return json({ ok: true, emailed: false });

  const subject = "AstroIndicators Contact — " + type + (name ? " — " + name : "");
  const text =
    "New Contact Us submission\n\n" +
    "Type: " + type + "\n" +
    (mdWanted ? "MD period(s) requested: " + mdWanted + "  (Rs.100 per MD period)\n" : "") +
    "Name: " + name + "\n" +
    "Email: " + (email || "-") + "\n" +
    "Phone: " + (phone || "-") + "\n\n" +
    "Message:\n" + (message || "-") + "\n";

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "AstroIndicators <contact@astroindicators.com>",
        to: [ownerEmail],
        reply_to: email || undefined,
        subject: subject,
        text: text,
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return json({ ok: true, emailed: false, note: t.slice(0, 120) });
    }
  } catch (e) {
    return json({ ok: true, emailed: false });
  }

  return json({ ok: true, emailed: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
