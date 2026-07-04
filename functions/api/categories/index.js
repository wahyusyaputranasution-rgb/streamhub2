// functions/api/categories/index.js
// GET  /api/categories -> daftar semua kategori (publik) beserta jumlah video published
// POST /api/categories -> membuat kategori baru (khusus admin, wajib CSRF token)

import { ok, fail, unauthorized, forbidden, serverError } from "../../../lib/response.js";
import { requireAuth, verifyCsrf } from "../../../lib/auth.js";
import { sanitizeText } from "../../../lib/security.js";
import { listCategories, generateUniqueCategorySlug } from "../../../lib/db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const categories = await listCategories(env.DB);
    return ok(categories);
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
    const name = sanitizeText((body.name || "").trim());
    if (!name) return fail("Nama kategori wajib diisi");

    const slug = await generateUniqueCategorySlug(env.DB, name);
    const result = await env.DB.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)").bind(name, slug).run();

    return ok({ id: result.meta.last_row_id, name, slug }, { message: "Kategori berhasil dibuat" });
  } catch (err) {
    return serverError(err);
  }
}
