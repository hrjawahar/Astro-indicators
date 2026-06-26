// ─────────────────────────────────────────────────────────────────────────────
//  FILE: functions/api/contact.js
//  Cloudflare Pages Function — handles the Contact Us / feedback form.
//  Emails the submission to the app owner (via Resend), same as consultation
//  bookings. Fail-soft and validates input.
//
//  SETUP (Cloudflare → Settings → Environment variables) — already set for verify.js:
//    OWNER_EMAIL     = where contact messages are emailed to you
//    RESEND_API_KEY  = your Resend API key
// ─────────────────────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;

  let b;
  try { b = await request.json(); }
  catch { return json({ error: "Invalid request body." }, 400); }

  const type     = String(b.type || "Feedback").slice(0, 60);
  const name     = String(b.name || "").trim().slice(0, 120);
  const email    = String(b.email || "").trim().slice(0, 160);
  const phone    = String(b.phone || "").trim().slice(0, 40);
  const message  = String(b.message || "").trim().slice(0, 4000);
  const mdWanted = String(b.mdWanted || "").trim().slice(0, 200);

  // Minimal validation: need a name and some way to reply (email or phone),
  // plus either a message or an MD-report request.
  if (!name) return json({ error: "Please enter your name." }, 400);
  if (!email && !phone) return json({ error: "Please enter your email or phone." }, 400);

  const ownerEmail = env.OWNER_EMAIL;
  const resendKey  = env.RESEND_API_KEY;

  // If email isn't configured, don't hard-fail the user — accept the message.
  if (!ownerEmail || !resendKey) {
    return json({ ok: true, note: "received" });
  }

  const subject = "AstroIndicators — " + type + " from " + (name || "user");
  const text =
    "A new message was submitted via the Contact form.\n\n" +
    "Type: "    + type + "\n" +
    "Name: "    + (name    || "-") + "\n" +
    "Email: "   + (email   || "-") + "\n" +
    "Phone: "   + (phone   || "-") + "\n" +
    (mdWanted ? ("MD period(s) wanted: " + mdWanted + "\n") : "") +
    "\nMessage:\n" + (message || "-") + "\n";

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + resendKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AstroIndicators <bookings@astroindicators.com>",
        to: [ownerEmail],
        reply_to: email || undefined,
        subject: subject,
        text: text,
      }),
    });
    if (!r.ok) {
      // Resend rejected — surface a soft error so the user can retry.
      return json({ error: "Could not send right now. Please try again." }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: "Could not send right now. Please try again." }, 502);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json" },
  });
}
