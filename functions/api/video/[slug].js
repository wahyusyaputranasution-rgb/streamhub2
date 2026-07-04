// functions/api/video/[slug].js
// GET /api/video/:slug -> detail video publik (hanya status "published")
// beserta daftar video terkait (kategori sama).

import { ok, notFound, serverError } from "../../../lib/response.js";
import { getVideoBySlug, getRelatedVideos } from "../../../lib/db.js";

export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const video = await getVideoBySlug(env.DB, params.slug, { publishedOnly: true });
    if (!video) return notFound("Video tidak ditemukan");

    const related = await getRelatedVideos(env.DB, video.category_id, video.id, 8);
    return ok({ video, related });
  } catch (err) {
    return serverError(err);
  }
}
