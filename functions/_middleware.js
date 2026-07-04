// functions/_middleware.js
// Middleware global untuk seluruh route di /functions.
// Menambahkan header keamanan dasar ke setiap response,
// dan menolak method yang tidak didukung secara umum.

export async function onRequest(context) {
  const { request, next } = context;

  // Batasi method HTTP yang diizinkan secara umum
  const allowedMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"];
  if (!allowedMethods.includes(request.method)) {
    return new Response(JSON.stringify({ success: false, error: "Method tidak diizinkan" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Preflight CORS sederhana (API ini hanya dipakai oleh frontend sendiri,
  // tapi kita tetap balas OPTIONS agar tidak error di browser)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
      },
    });
  }

  const response = await next();
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
