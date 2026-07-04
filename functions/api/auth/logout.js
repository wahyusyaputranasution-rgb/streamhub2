// functions/api/auth/logout.js

import { json, serverError } from "../../../lib/response.js";
import { destroySession } from "../../../lib/auth.js";
import { parseCookies, clearCookie } from "../../../lib/security.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const cookies = parseCookies(request);
    if (cookies.session) {
      await destroySession(env.DB, cookies.session);
    }
    return json(
      { success: true, data: null },
      { status: 200, headers: { "Set-Cookie": clearCookie("session") } }
    );
  } catch (err) {
    return serverError(err);
  }
}
