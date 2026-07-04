// functions/api/auth/check.js
// Dipanggil oleh halaman dashboard admin untuk memastikan sesi masih valid,
// sekaligus mengambil ulang CSRF token untuk dipakai di form.

import { ok, unauthorized, serverError } from "../../../lib/response.js";
import { getSession } from "../../../lib/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const session = await getSession(request, env.DB);
    if (!session) return unauthorized();
    return ok({ username: session.username, csrfToken: session.csrf_token });
  } catch (err) {
    return serverError(err);
  }
}
