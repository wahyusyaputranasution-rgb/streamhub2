// functions/api/videos/index.js
// GET  /api/videos  -> daftar video publik (published), mendukung filter kategori,
//                      pencarian, pagination, dan urutan (terbaru/populer).
//                      Bila diakses dengan sesi admin valid & ?admin=1, menampilkan semua status.
// POST /api/videos  -> membuat video baru (khusus admin, wajib CSRF token)

import { ok, fail, unauthorized, forbidden, serverError } from "../../../lib/response.js";
import { requireAuth, verifyCsrf } from "../../../lib/auth.js";
import { sanitizeText, isSafeUrl } from "../../../lib/security.js";
import { listVideos, generateUniqueSlug } from "../../../lib/db.js";
import { normalizeEmbedUrl } from "../../../lib/embed.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get("perPage") || "12", 10) || 12));
    const category = url.searchParams.get("category") || null;
    const search = url.searchParams.get("q") || null;
    const orderBy = url.searchParams.get("orderBy") === "views" ? "views" : "publish_date";
    const wantsAdminView = url.searchParams.get("admin") === "1";

    let includeAll = false;
    if (wantsAdminView) {
      const session = await requireAuth(request, env.DB);
      if (!session) return unauthorized();
      includeAll = true;
    }

    const result = await listVideos(env.DB, { page, perPage, categorySlug: category, search, orderBy, includeAll });
    return ok(result);
  } catch (err) {
    return serverError(err);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const session = await requireAuth(request, env.DB);
    if (!session) return unauthorized();
    if (!verifyCsrf(request, session)) return forbidden("Token CSRF tidak valid");

    const body = await request.json().catch(() => ({}));
    const title = sanitizeText((body.title || "").trim());
    const description = sanitizeText((body.description || "").trim());
    const categoryId = body.categoryId ? parseInt(body.categoryId, 10) : null;
    const rawEmbed = (body.embedUrl || "").trim();
    const thumbnailUrl = (body.thumbnailUrl || "").trim();
    const status = body.status === "published" ? "published" : "draft";
    const publishDate = body.publishDate || null;

    if (!title) return fail("Judul wajib diisi");
    if (!rawEmbed) return fail("Link embed wajib diisi");

    const embedUrl = normalizeEmbedUrl(rawEmbed);
    if (!embedUrl || !isSafeUrl(embedUrl)) return fail("Link embed tidak valid");
    if (thumbnailUrl && !isSafeUrl(thumbnailUrl)) return fail("Link thumbnail tidak valid");

    const slug = await generateUniqueSlug(env.DB, title);
    const finalPublishDate = status === "published" ? (publishDate || new Date().toISOString()) : publishDate;

    const result = await env.DB
      .prepare(
        `INSERT INTO videos (title, slug, description, category_id, embed_url, thumbnail_url, status, publish_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(title, slug, description, categoryId, embedUrl, thumbnailUrl, status, finalPublishDate)
      .run();

    return ok({ id: result.meta.last_row_id, slug }, { message: "Video berhasil dibuat" });
  } catch (err) {
    return serverError(err);
  }
}
