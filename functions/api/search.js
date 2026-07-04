// functions/api/search.js
// GET /api/search?q=keyword -> pencarian realtime video published berdasarkan judul/deskripsi

import { ok, serverError } from "../../lib/response.js";
import { listVideos } from "../../lib/db.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get("perPage") || "16", 10) || 16));

    if (!q) return ok({ items: [], total: 0, page: 1, perPage, totalPages: 1 });

    const result = await listVideos(env.DB, { page, perPage, search: q, orderBy: "views" });
    return ok(result);
  } catch (err) {
    return serverError(err);
  }
}
