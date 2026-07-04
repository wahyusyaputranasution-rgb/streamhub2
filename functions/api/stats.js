// functions/api/stats.js
// GET /api/stats -> statistik dashboard admin (khusus admin login)

import { ok, unauthorized, serverError } from "../../lib/response.js";
import { requireAuth } from "../../lib/auth.js";
import { getStats } from "../../lib/db.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const session = await requireAuth(request, env.DB);
    if (!session) return unauthorized();

    const stats = await getStats(env.DB);
    return ok(stats);
  } catch (err) {
    return serverError(err);
  }
}
