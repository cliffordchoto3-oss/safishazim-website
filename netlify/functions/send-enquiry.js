// Netlify Function equivalent of send-enquiry.php (the PHP/Bluehost version of
// this form handler). Netlify is static hosting with no PHP, so the contact
// form on a Netlify-hosted copy of the site posts here instead, via
// /.netlify/functions/send-enquiry (see js/main.js).
//
// Email is sent through Resend (https://resend.com) rather than SMTP, since a
// plain HTTP API call is the simplest thing a serverless function can do
// reliably — no mail server, no stored SMTP password. This needs ONE secret,
// set as a Netlify environment variable (Site settings -> Environment
// variables), never committed to the repo:
//
//   RESEND_API_KEY        - from resend.com, after verifying a sending domain
//                            (or use their shared onboarding domain to test)
//   NOTIFY_EMAIL           - defaults to sales@safisha.co.zw if unset
//   FROM_EMAIL              - the "from" address Resend sends as; must be on a
//                            domain verified in Resend (defaults to
//                            no-reply@safishazim.com)
//
// The optional WhatsApp Business Cloud API ping mirrors the PHP version: it
// silently does nothing until WHATSAPP_ENABLED=true plus a token and phone
// number ID are set as environment variables too, so no enquiry is ever lost
// over WhatsApp being unconfigured — email is the path that must always work.

exports.handler = async (event) => {
  const jsonHeaders = { "Content-Type": "application/json" };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: "method_not_allowed" }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: "invalid_json" }) };
  }

  const name = (data.name || "").trim();
  const phone = (data.phone || "").trim();
  const email = (data.email || "").trim();
  const interest = (data.interest || "").trim();
  const message = (data.message || "").trim();

  if (name === "" || message === "" || (phone === "" && email === "")) {
    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: "missing_fields" }) };
  }
  const emailLooksValid = email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailLooksValid) {
    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: "invalid_email" }) };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "sales@safisha.co.zw";
  const FROM_EMAIL = process.env.FROM_EMAIL || "no-reply@safishazim.com";

  const subject = `Website enquiry from ${name}`;
  const textBody =
    `New enquiry from the safishazim.com website:\n\n` +
    `Name: ${name}\n` +
    `Phone: ${phone}\n` +
    `Email: ${email}\n` +
    `Interested in: ${interest}\n\n` +
    `Message:\n${message}\n`;

  let emailSent = false;
  let emailError = null;

  if (!RESEND_API_KEY) {
    // Not configured yet — tell the caller plainly rather than pretending it worked,
    // so the site's own "email us directly" fallback message shows instead.
    emailError = "email_not_configured";
  } else {
    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `Safisha Industries Website <${FROM_EMAIL}>`,
          to: [NOTIFY_EMAIL],
          reply_to: email !== "" ? email : undefined,
          subject,
          text: textBody,
        }),
      });
      emailSent = resendRes.ok;
      if (!emailSent) {
        emailError = `resend_http_${resendRes.status}`;
      }
    } catch (e) {
      emailError = "resend_request_failed";
    }
  }

  // WhatsApp ping — bonus channel, never allowed to affect the response below.
  await notifyWhatsApp({ name, phone, email, interest, message }).catch(() => {});

  if (emailSent) {
    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  }
  return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ ok: false, error: emailError || "mail_failed" }) };
};

async function notifyWhatsApp({ name, phone, email, interest, message }) {
  const enabled = process.env.WHATSAPP_ENABLED === "true";
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const notifyNumber = process.env.WHATSAPP_NOTIFY_NUMBER || "263772164975";
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "website_enquiry_notify";
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";

  if (!enabled || !token || !phoneId) return;

  const contact = phone !== "" ? phone : email;
  const snippet = message.length > 150 ? message.slice(0, 150) + "…" : message;

  const payload = {
    messaging_product: "whatsapp",
    to: notifyNumber,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: name || "—" },
            { type: "text", text: contact || "—" },
            { type: "text", text: interest || "General enquiry" },
            { type: "text", text: snippet || "—" },
          ],
        },
      ],
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // fail fast, never delay the customer's reply
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
