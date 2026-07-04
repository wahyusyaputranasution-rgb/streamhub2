// functions/api/auth/login.js
// Login admin dengan proteksi rate limiting (maks 5 percobaan / 15 menit / IP)
// dan sesi berbasis cookie HttpOnly + CSRF token terpisah.

import { fail, serverError, tooManyRequests, json } from "../../../lib/response.js";
import { verifyPassword, createSession } from "../../../lib/auth.js";
import { hashValue, getClientIp, checkRateLimit, recordAttempt, buildCookie } from "../../../lib/security.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const ip = getClientIp(request);
    const ipHash = await hashValue(ip, env.SITE_NAME || "streamhub-pepper");

    const { allowed } = await checkRateLimit(env.DB, {
      table: "login_attempts",
      timeColumn: "attempted_at",
      keyColumn: "ip_hash",
      keyValue: ipHash,
      windowMinutes: 15,
      maxAttempts: 5,
    });
    if (!allowed) {
      return tooManyRequests("Terlalu banyak percobaan login. Coba lagi dalam 15 menit.");
    }

    const body = await request.json().catch(() => ({}));
    const username = (body.username || "").trim();
    const password = body.password || "";

    if (!username || !password) {
      await recordAttempt(env.DB, { table: "login_attempts", keyColumn: "ip_hash", keyValue: ipHash });
      return fail("Username dan password wajib diisi", 400);
    }

    const admin = await env.DB.prepare("SELECT id, username, password_hash, salt FROM admins WHERE username = ?")
      .bind(username)
      .first();

    if (!admin) {
      await recordAttempt(env.DB, { table: "login_attempts", keyColumn: "ip_hash", keyValue: ipHash });
      return fail("Username atau password salah", 401);
    }

    const valid = await verifyPassword(password, admin.salt, admin.password_hash);
    if (!valid) {
      await recordAttempt(env.DB, { table: "login_attempts", keyColumn: "ip_hash", keyValue: ipHash });
      return fail("Username atau password salah", 401);
    }

    const { sessionId, csrfToken, maxAge } = await createSession(env.DB, admin.id);

    return json(
      { success: true, data: { username: admin.username, csrfToken } },
      {
        status: 200,
        headers: { "Set-Cookie": buildCookie("session", sessionId, { maxAge }) },
      }
    );
  } catch (err) {
    return serverError(err);
  }
}
