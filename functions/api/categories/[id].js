// functions/api/categories/[id].js
// PUT    -> update nama kategori (khusus admin, wajib CSRF token)
// DELETE -> hapus kategori (khusus admin, wajib CSRF token). Video yang
//           memakai kategori ini otomatis menjadi tanpa kategori (SET NULL).

import { ok, fail, notFound, unauthorized, forbidden, serverError } from "../../../lib/response.js";
import { requireAuth, verifyCsrf } from "../../../lib/auth.js";
import { sanitizeText } from "../../../lib/security.js";
import { generateUniqueCategorySlug } from "../../../lib/db.js";

export async function onRequestPut(context) {
  const { request, env, params } = context;
  try {
    const session = await requireAuth(request, env.DB);
    if (!session) return unauthorized();
    if (!verifyCsrf(request, session)) return forbidden("Token CSRF tidak valid");

    const id = parseInt(params.id, 10);
    const existing = await env.DB.prepare("SELECT id, name, slug FROM categories WHERE id = ?").bind(id).first();
    if (!existing) return notFound("Kategori tidak ditemukan");

    const body = await request.json().catch(() => ({}));
    const name = sanitizeText((body.name || "").trim());
    if (!name) return fail("Nama kategori wajib diisi");

    let slug = existing.slug;
    if (name !== existing.name) {
      slug = await generateUniqueCategorySlug(env.DB, name, id);
    }

    await env.DB.prepare("UPDATE categories SET name = ?, slug = ? WHERE id = ?").bind(name, slug, id).run();
    return ok({ id, name, slug }, { message: "Kategori berhasil diperbarui" });
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
    const existing = await env.DB.prepare("SELECT id FROM categories WHERE id = ?").bind(id).first();
    if (!existing) return notFound("Kategori tidak ditemukan");

    await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
    return ok(null, { message: "Kategori berhasil dihapus" });
  } catch (err) {
    return serverError(err);
  }
}
