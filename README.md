# StreamHub — Website Streaming Video di Cloudflare

Website streaming video modern yang berjalan sepenuhnya di **Cloudflare Pages + Pages Functions (Workers) + D1**.
Tidak menggunakan PHP, MySQL, Firebase, Supabase, maupun Cloudflare R2.

Thumbnail & video **tidak diupload**, cukup tempel URL (mis. dari imgur, TMDB, YouTube, Vimeo, dll).

---

## 1. Struktur Folder

```
project/
├── public/              # Semua file statis yang di-serve Cloudflare Pages
│   ├── index.html        # Home
│   ├── watch/index.html  # Watch (?slug=xxx)
│   ├── search/index.html # Search realtime
│   ├── category/index.html
│   ├── admin/login/index.html
│   ├── admin/dashboard/index.html
│   ├── 404.html
│   ├── css/               # style.css (public) & admin.css (dashboard)
│   ├── js/                 # Semua logic frontend (per halaman)
│   └── robots.txt
├── functions/            # Cloudflare Pages Functions (= Workers) — backend API
│   ├── api/auth/          # login, logout, check, setup
│   ├── api/videos/        # CRUD video
│   ├── api/video/[slug].js
│   ├── api/categories/    # CRUD kategori
│   ├── api/view/[id].js   # View counter + anti-spam
│   ├── api/search.js
│   ├── api/stats.js
│   ├── sitemap.xml.js
│   └── _middleware.js     # Header keamanan global
├── lib/                  # Kode bersama (auth, db, security, embed) — di-bundle otomatis
├── database/
│   ├── schema.sql
│   └── seed.sql
├── wrangler.toml
├── package.json
└── README.md
```

---

## 2. Cara Install

```bash
npm install
```

Ini hanya menginstal `wrangler` (CLI Cloudflare) sebagai dev dependency. Tidak ada framework build,
jadi tidak ada langkah build tambahan — folder `public/` sudah langsung bisa di-deploy.

---

## 3. Cara Membuat Database D1

1. Login ke akun Cloudflare via CLI:
   ```bash
   npx wrangler login
   ```
2. Buat database D1:
   ```bash
   npx wrangler d1 create streaming_db
   ```
   Perintah ini akan menampilkan `database_id`. Salin nilai tersebut ke file `wrangler.toml`
   pada bagian:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "streaming_db"
   database_id = "REPLACE_WITH_YOUR_DATABASE_ID"
   ```
3. Jalankan migrasi schema:
   ```bash
   # Untuk database remote (production)
   npx wrangler d1 execute streaming_db --remote --file=./database/schema.sql

   # Untuk testing lokal
   npx wrangler d1 execute streaming_db --local --file=./database/schema.sql
   ```
4. (Opsional) Isi data contoh:
   ```bash
   npx wrangler d1 execute streaming_db --remote --file=./database/seed.sql
   ```

---

## 4. Cara Deploy ke Cloudflare Pages

### Opsi A — Lewat CLI (tercepat)
```bash
npx wrangler pages deploy public --project-name=streamhub
```
Saat pertama kali, wrangler akan menanyakan apakah ingin membuat project Pages baru — pilih **Yes**.

Setelah deploy pertama, pastikan binding D1 terhubung ke project Pages tersebut lewat dashboard:
**Cloudflare Dashboard → Pages → (project Anda) → Settings → Functions → D1 database bindings**
→ tambahkan binding dengan nama variabel `DB` yang menunjuk ke database `streaming_db`.

### Opsi B — Lewat Git (Cloudflare Dashboard)
1. Push folder project ini ke repository Git (GitHub/GitLab).
2. Di Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build settings:
   - Framework preset: **None**
   - Build command: (kosongkan)
   - Build output directory: `public`
4. Setelah project dibuat, buka **Settings → Functions → D1 database bindings**, tambahkan
   binding `DB` → `streaming_db`.
5. Redeploy agar binding aktif.

---

## 5. Cara Login Admin (Setup Awal)

Belum ada admin dibuat otomatis demi keamanan. Buat admin pertama dengan memanggil endpoint
`/api/auth/setup` **satu kali saja** setelah deploy (endpoint ini otomatis terkunci setelah
ada satu admin di database):

```bash
curl -X POST https://domain-anda.pages.dev/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"PasswordKuatAnda123"}'
```

Setelah berhasil, buka `https://domain-anda.pages.dev/admin/login/` dan login dengan
username & password tersebut. Password minimal 8 karakter dan di-hash dengan PBKDF2 + salt
sebelum disimpan — tidak pernah disimpan dalam bentuk plain text.

**Mengganti password:** hitung ulang hash lewat endpoint `/api/auth/setup` tidak bisa dipakai lagi
setelah admin ada. Cara paling sederhana adalah menghapus baris admin di tabel `admins` lewat
`wrangler d1 execute streaming_db --remote --command="DELETE FROM admins WHERE username='admin'"`
lalu panggil ulang `/api/auth/setup`.

---

## 6. Cara Menambah Video

1. Login ke `/admin/dashboard/`.
2. Buka tab **Video** → klik **+ Tambah Video**.
3. Isi:
   - **Judul** — slug URL dibuat otomatis dari judul (dan otomatis unik bila ada duplikat).
   - **Deskripsi**
   - **Kategori** — pilih dari daftar kategori yang sudah dibuat di tab Kategori.
   - **Link Embed** — tempel link video dari provider (YouTube, Vimeo, Dailymotion, atau
     link embed generik seperti `https://domain.com/e/abcdef`). Sistem otomatis menormalkan
     link YouTube/Vimeo/Dailymotion biasa menjadi bentuk embed yang benar.
   - **Link Thumbnail** — tempel URL gambar (mis. dari imgur atau `image.tmdb.org`). Tidak ada
     upload file, cukup URL.
   - **Status** — Draft (belum tampil ke publik) atau Publish.
   - **Tanggal Publish** — opsional, default waktu saat ini bila status Publish.
4. Klik **Simpan**. Video langsung tampil di Home/Kategori/Search bila statusnya Publish.

---

## 7. Cara Backup Database

Ekspor seluruh isi database ke file SQL:

```bash
npx wrangler d1 export streaming_db --remote --output=backup.sql
```

Untuk restore ke database baru:

```bash
npx wrangler d1 execute streaming_db --remote --file=./backup.sql
```

Disarankan menjadwalkan backup berkala (mis. lewat cron di CI/CD Anda) karena Cloudflare D1
tidak menyediakan backup otomatis bawaan.

---

## 8. Keamanan yang Sudah Diterapkan

- **Validasi & sanitasi input** di setiap endpoint (`lib/security.js`, `sanitizeText`, `isSafeUrl`).
- **Proteksi XSS**: semua teks yang ditampilkan di-escape (`escapeHtml` di frontend & backend),
  serta header `X-Content-Type-Options`, `X-Frame-Options`.
- **CSRF Protection**: setiap request yang mengubah data (POST/PUT/DELETE) di panel admin wajib
  menyertakan header `X-CSRF-Token` yang cocok dengan token sesi aktif di D1.
- **Session admin**: cookie `HttpOnly`, `Secure`, `SameSite=Strict`, kedaluwarsa otomatis 7 hari.
- **Password hashing**: PBKDF2 (100.000 iterasi) + salt unik per admin, tanpa dependency eksternal.
- **Rate limiting**:
  - Login dibatasi 5 percobaan / 15 menit per IP (IP disimpan dalam bentuk hash, bukan mentah).
  - View counter dibatasi 1 hitungan / video / IP / 30 menit untuk mencegah spam refresh.
- **SQL Injection**: seluruh query memakai prepared statement D1 (`bind`), tidak ada string
  concatenation SQL.

---

## 9. Catatan Provider Embed

Field **Link Embed** menerima:
- Link YouTube biasa (`youtube.com/watch?v=...`, `youtu.be/...`) → otomatis dikonversi ke `/embed/...`
- Link Vimeo biasa (`vimeo.com/12345`) → otomatis dikonversi ke `player.vimeo.com/video/12345`
- Link Dailymotion biasa → otomatis dikonversi ke bentuk embed
- Link embed generik dari provider lain, mis. `https://domain.com/e/abcdef` → dipakai apa adanya
  selama berupa URL `http`/`https` yang valid.

---

## 10. Pengembangan Lokal

```bash
npm run dev
```

Ini menjalankan `wrangler pages dev` dengan binding D1 lokal, lengkap dengan hot-reload untuk
file statis dan Functions.
