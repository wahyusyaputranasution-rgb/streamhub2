// functions/api/view/[id].js
// POST /api/view/:id -> menambah jumlah view video.
// Proteksi: 1 view dihitung per (video, IP) per 30 menit, memakai
// hash IP (bukan IP mentah) yang dicatat di tabel view_logs.

import { ok, notFound, serverError } from "../../../lib/response.js";
import { getClientIp, hashValue } from "../../../lib/security.js";

const WINDOW_MINUTES = 30;

export async function onRequestPost(context) {
  const { request, env, params } = context;
  try {
    const id = parseInt(params.id, 10);
    const video = await env.DB.prepare("SELECT id, views FROM videos WHERE id = ? AND status = 'published'").bind(id).first();
    if (!video) return notFound("Video tidak ditemukan");

    const ip = getClientIp(request);
    const ipHash = await hashValue(ip, env.SITE_NAME || "streamhub-pepper");

    // Cek spesifik kombinasi video_id + ip_hash dalam window waktu
    const dup = await env.DB
      .prepare(
        `SELECT id FROM view_logs WHERE video_id = ? AND ip_hash = ? AND viewed_at >= datetime('now', '-${WINDOW_MINUTES} minutes') LIMIT 1`
      )
      .bind(id, ipHash)
      .first();

    if (dup) {
      // Sudah dihitung baru-baru ini, jangan tambah lagi tapi tetap balas sukses
      return ok({ counted: false, views: video.views });
    }

    await env.DB.prepare("INSERT INTO view_logs (video_id, ip_hash) VALUES (?, ?)").bind(id, ipHash).run();
    await env.DB.prepare("UPDATE videos SET views = views + 1 WHERE id = ?").bind(id).run();

    return ok({ counted: true, views: video.views + 1 });
  } catch (err) {
    return serverError(err);
  }
}
