// functions/api/auth/setup.js
// Endpoint sekali pakai untuk membuat akun admin PERTAMA.
// Setelah ada satu admin di database, endpoint ini otomatis terkunci
// dan akan selalu menolak permintaan berikutnya.

import { ok, fail, serverError } from "../../../lib/response.js";
import { generateSalt, hashPassword } from "../../../lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const existing = await env.DB.prepare("SELECT COUNT(*) AS c FROM admins").first();
    if (existing && existing.c > 0) {
      return fail("Setup sudah pernah dilakukan. Endpoint ini terkunci demi keamanan.", 403);
    }

    const body = await request.json().catch(() => ({}));
    const username = (body.username || "").trim();
    const password = body.password || "";

    if (username.length < 3) return fail("Username minimal 3 karakter");
    if (password.length < 8) return fail("Password minimal 8 karakter");

    const salt = generateSalt();
    const hash = await hashPassword(password, salt);

    await env.DB.prepare("INSERT INTO admins (username, password_hash, salt) VALUES (?, ?, ?)")
      .bind(username, hash, salt)
      .run();

    return ok({ username }, { message: "Admin berhasil dibuat. Silakan login." });
  } catch (err) {
    return serverError(err);
  }
}

export async function onRequestGet(context) {
  const { env } = context;
  const existing = await env.DB.prepare("SELECT COUNT(*) AS c FROM admins").first();
  return ok({ setupCompleted: existing && existing.c > 0 });
}
