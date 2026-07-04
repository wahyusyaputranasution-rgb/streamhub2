// functions/api/videos/[id].js
// GET    -> detail video by id (khusus admin, dipakai form edit)
// PUT    -> update video (khusus admin, wajib CSRF token)
// DELETE -> hapus video (khusus admin, wajib CSRF token)

import { ok, fail, notFound, unauthorized, forbidden, serverError } from "../../../lib/response.js";
import { requireAuth, verifyCsrf } from "../../../lib/auth.js";
import { sanitizeText, isSafeUrl } from "../../../lib/security.js";
import { getVideoById, generateUniqueSlug } from "../../../lib/db.js";
import { normalizeEmbedUrl } from "../../../lib/embed.js";

export async function onRequestGet(context) {
  const { request, env, params } = context;
  try {
    const session = await requireAuth(request, env.DB);
    if (!session) return unauthorized();

    const id = parseInt(params.id, 10);
    const video = await getVideoById(env.DB, id);
    if (!video) return notFound("Video tidak ditemukan");
    return ok(video);
  } catch (err) {
    return serverError(err);
  }
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  try {
    const session = await requireAuth(request, env.DB);
    if (!session) return unauthorized();
    if (!verifyCsrf(request, session)) return forbidden("Token CSRF tidak valid");

    const id = parseInt(params.id, 10);
    const existing = await getVideoById(env.DB, id);
    if (!existing) return notFound("Video tidak ditemukan");

    const body = await request.json().catch(() => ({}));
    const title = sanitizeText((body.title || "").trim());
    const description = sanitizeText((body.description || "").trim());
    const categoryId = body.categoryId ? parseInt(body.categoryId, 10) : null;
    const rawEmbed = (body.embedUrl || "").trim();
    const thumbnailUrl = (body.thumbnailUrl || "").trim();
    const status = body.status === "published" ? "published" : "draft";
    const publishDate = body.publishDate || existing.publish_date;

    if (!title) return fail("Judul wajib diisi");
    if (!rawEmbed) return fail("Link embed wajib diisi");

    const embedUrl = normalizeEmbedUrl(rawEmbed);
    if (!embedUrl || !isSafeUrl(embedUrl)) return fail("Link embed tidak valid");
    if (thumbnailUrl && !isSafeUrl(thumbnailUrl)) return fail("Link thumbnail tidak valid");

    let slug = existing.slug;
    if (title !== existing.title) {
      slug = await generateUniqueSlug(env.DB, title, id);
    }

    const finalPublishDate = status === "published" ? (publishDate || new Date().toISOString()) : publishDate;

    await env.DB
      .prepare(
        `UPDATE videos SET title = ?, slug = ?, description = ?, category_id = ?, embed_url = ?,
         thumbnail_url = ?, status = ?, publish_date = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(title, slug, description, categoryId, embedUrl, thumbnailUrl, status, finalPublishDate, id)
      .run();

    return ok({ id, slug }, { message: "Video berhasil diperbarui" });
  } catch (err) {
    return serverError(err);
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  try {
    const session = await requireAuth(request, env.DB);
    if (!session) return unauthorized();
    if (!verifyCsrf(request, session)) return forbidden("Token CSRF tidak valid");

    const id = parseInt(params.id, 10);
    const existing = await getVideoById(env.DB, id);
    if (!existing) return notFound("Video tidak ditemukan");

    await env.DB.prepare("DELETE FROM videos WHERE id = ?").bind(id).run();
    return ok(null, { message: "Video berhasil dihapus" });
  } catch (err) {
    return serverError(err);
  }
}
