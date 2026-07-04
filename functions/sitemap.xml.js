// functions/sitemap.xml.js
// GET /sitemap.xml -> sitemap dinamis berisi halaman statis, kategori, dan semua video published

export async function onRequestGet(context) {
  const { env } = context;
  const siteUrl = (env.SITE_URL || "https://your-project.pages.dev").replace(/\/$/, "");

  const staticUrls = ["/", "/search/", "/category/"];

  let categories = [];
  let videos = [];
  try {
    const catRows = await env.DB.prepare("SELECT slug FROM categories").all();
    categories = catRows.results || [];
    const vidRows = await env.DB
      .prepare("SELECT slug, updated_at FROM videos WHERE status = 'published' ORDER BY publish_date DESC LIMIT 5000")
      .all();
    videos = vidRows.results || [];
  } catch {
    // Jika DB belum siap, tetap kembalikan sitemap dengan halaman statis saja
  }

  const urlEntries = [
    ...staticUrls.map((path) => `  <url><loc>${siteUrl}${path}</loc><changefreq>daily</changefreq></url>`),
    ...categories.map((c) => `  <url><loc>${siteUrl}/category/?slug=${encodeURIComponent(c.slug)}</loc><changefreq>daily</changefreq></url>`),
    ...videos.map(
      (v) =>
        `  <url><loc>${siteUrl}/watch/?slug=${encodeURIComponent(v.slug)}</loc><lastmod>${(v.updated_at || "").slice(0, 10)}</lastmod><changefreq>weekly</changefreq></url>`
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries.join("\n")}\n</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
