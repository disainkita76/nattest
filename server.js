// server.js - Full-stack HTTP server for NAT-TEST UKK CSGS UI
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, DB_PATH, hashPassword, verifyPassword, initDatabase } = require('./db.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Megabytes strict limit

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

// Parse JSON request body helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Prevent payload overload (> 25MB to accommodate up to 5MB slider image uploads)
      if (body.length > 25 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({ raw: body });
      }
    });
    req.on('error', err => reject(err));
  });
}

// Send JSON response helper
function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(payload);
}

// Virtual Account Generator for BNI46, Mandiri, and BRI (BRIVA)
function generateVirtualAccount(bank, id) {
  const cleanId = String(id || 1).padStart(6, '0');
  const yearCode = '26'; // 2026 NAT-TEST UKK CSGS UI
  const upper = (bank || 'BNI').toUpperCase();
  if (upper.includes('MANDIRI')) {
    // Mandiri Bill Payment / Virtual Account (Corporate Code 88708 + 26 + ID)
    return `88708${yearCode}${cleanId}`;
  } else if (upper.includes('BRI')) {
    // BRI BRIVA (Institution Code 12800 + 26 + ID)
    return `12800${yearCode}${cleanId}`;
  } else {
    // BNI46 Virtual Account (Prefix 9880033 + 26 + ID)
    return `9880033${yearCode}${cleanId}`;
  }
}

// Authentication middleware helper
function authenticate(req) {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    // Check cookie
    const cookieHeader = req.headers['cookie'];
    if (cookieHeader) {
      const match = cookieHeader.match(/auth_token=([^;]+)/);
      if (match) token = match[1];
    }
  }

  // Also check query param ?token= (useful for direct file downloads like CSV and DB backup)
  if (!token && req.url) {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      const queryToken = parsed.searchParams.get('token');
      if (queryToken) token = queryToken.trim();
    } catch (_) {}
  }

  if (!token) return null;

  const session = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.name, u.email, u.role, u.phone, u.status
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token);

  if (!session) return null;

  // Check expiration
  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  if (session.status !== 'ACTIVE') {
    return null;
  }

  return session;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    return res.end();
  }

  // -------------------------------------------------------------
  // API ROUTING
  // -------------------------------------------------------------

  // --- 1. CMS CONTENT ENDPOINTS ---
  if (pathname === '/api/cms' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM cms_content').all();
    const cmsMap = {};
    for (const row of rows) {
      try {
        cmsMap[row.section_key] = {
          title: row.title,
          subtitle: row.subtitle,
          data: JSON.parse(row.content_json),
          updated_at: row.updated_at,
          updated_by: row.updated_by
        };
      } catch (e) {
        cmsMap[row.section_key] = {
          title: row.title,
          subtitle: row.subtitle,
          data: row.content_json
        };
      }
    }
    return sendJson(res, 200, { success: true, cms: cmsMap });
  }

  // Get specific CMS section
  if (pathname.startsWith('/api/cms/') && method === 'GET') {
    const sectionKey = pathname.split('/')[3];
    const row = db.prepare('SELECT * FROM cms_content WHERE section_key = ?').get(sectionKey);
    if (!row) {
      return sendJson(res, 404, { success: false, message: 'Section not found' });
    }
    return sendJson(res, 200, {
      success: true,
      section: {
        section_key: row.section_key,
        title: row.title,
        subtitle: row.subtitle,
        data: JSON.parse(row.content_json),
        updated_at: row.updated_at
      }
    });
  }

  // Update CMS section (Admin only)
  if (pathname.startsWith('/api/cms/') && (method === 'PUT' || method === 'POST')) {
    const user = authenticate(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'VERIFIKATOR')) {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak: Hanya Administrator yang diizinkan mengubah konten.' });
    }

    const sectionKey = pathname.split('/')[3];
    const body = await parseBody(req);
    const { title, subtitle, data } = body;

    if (!data) {
      return sendJson(res, 400, { success: false, message: 'Data konten tidak boleh kosong.' });
    }

    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    const existing = db.prepare('SELECT section_key FROM cms_content WHERE section_key = ?').get(sectionKey);

    if (existing) {
      db.prepare(`
        UPDATE cms_content 
        SET title = COALESCE(?, title), 
            subtitle = COALESCE(?, subtitle), 
            content_json = ?, 
            updated_at = ?, 
            updated_by = ?
        WHERE section_key = ?
      `).run(title ?? null, subtitle ?? null, jsonStr, new Date().toISOString(), user.name, sectionKey);
    } else {
      db.prepare(`
        INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(sectionKey, title || sectionKey, subtitle || '', jsonStr, new Date().toISOString(), user.name);
    }

    return sendJson(res, 200, {
      success: true,
      message: `Konten bagian '${sectionKey}' berhasil diperbarui!`,
      updated_at: new Date().toISOString()
    });
  }

  // --- 1B. STATIC PAGES ENDPOINTS (HALAMAN STATIK) ---

  // Get all published static pages (Public)
  if (pathname === '/api/pages' && method === 'GET') {
    const pages = db.prepare(`
      SELECT id, slug, title, subtitle, summary, meta_title, meta_description, is_published, view_count, created_at, updated_at
      FROM static_pages
      WHERE is_published = 1
      ORDER BY id ASC
    `).all();
    return sendJson(res, 200, { success: true, pages });
  }

  // Get specific static page by slug (Public)
  if (pathname.startsWith('/api/pages/') && method === 'GET') {
    const slug = decodeURIComponent(pathname.substring('/api/pages/'.length).trim());
    const page = db.prepare('SELECT * FROM static_pages WHERE slug = ?').get(slug);
    if (!page) {
      return sendJson(res, 404, { success: false, message: 'Halaman statik tidak ditemukan.' });
    }

    // Increment view count if published
    if (page.is_published) {
      db.prepare('UPDATE static_pages SET view_count = view_count + 1 WHERE id = ?').run(page.id);
    }

    return sendJson(res, 200, { success: true, page });
  }

  // Admin: Get all static pages including drafts
  if (pathname === '/api/admin/pages' && method === 'GET') {
    const user = authenticate(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'VERIFIKATOR')) {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak: Hanya Pengelola yang diizinkan.' });
    }

    const pages = db.prepare('SELECT * FROM static_pages ORDER BY id DESC').all();
    return sendJson(res, 200, { success: true, pages });
  }

  // Admin: Create new static page
  if (pathname === '/api/admin/pages' && method === 'POST') {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Hanya Administrator yang dapat membuat halaman statik baru.' });
    }

    const body = await parseBody(req);
    const { title, slug, subtitle, summary, content, meta_title, meta_description, is_published, add_to_nav } = body;

    if (!title || !content) {
      return sendJson(res, 400, { success: false, message: 'Judul dan isi konten halaman wajib diisi.' });
    }

    // Auto-generate clean slug if not provided
    let finalSlug = slug ? slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-') : title.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-');
    finalSlug = finalSlug.replace(/-+/g, '-').replace(/^-|-$/g, '');

    const existing = db.prepare('SELECT id FROM static_pages WHERE slug = ?').get(finalSlug);
    if (existing) {
      return sendJson(res, 400, { success: false, message: `Slug URL '${finalSlug}' sudah digunakan. Silakan gunakan slug lain.` });
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO static_pages (slug, title, subtitle, summary, content, meta_title, meta_description, is_published, view_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      finalSlug,
      title,
      subtitle || '',
      summary || '',
      content,
      meta_title || title,
      meta_description || summary || '',
      is_published !== undefined ? (is_published ? 1 : 0) : 1,
      now,
      now
    );

    // If add_to_nav requested, append to navigation CMS content automatically
    if (add_to_nav) {
      const navRow = db.prepare("SELECT content_json FROM cms_content WHERE section_key = 'navigation'").get();
      if (navRow) {
        try {
          const navData = JSON.parse(navRow.content_json);
          navData.menus = navData.menus || [];
          navData.menus.push({
            id: Date.now(),
            label: title,
            url: `/page/${finalSlug}`,
            target: '_self',
            is_active: true
          });
          db.prepare("UPDATE cms_content SET content_json = ?, updated_at = ? WHERE section_key = 'navigation'").run(
            JSON.stringify(navData),
            now
          );
        } catch (e) {
          console.error('Failed to append to nav menus:', e);
        }
      }
    }

    return sendJson(res, 201, {
      success: true,
      message: 'Halaman statik baru berhasil dibuat!',
      pageId: Number(result.lastInsertRowid),
      slug: finalSlug
    });
  }

  // Admin: Update static page
  if (pathname.match(/\/api\/admin\/pages\/(\d+)/) && (method === 'PUT' || method === 'POST')) {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Hanya Administrator yang dapat mengubah halaman statik.' });
    }

    const match = pathname.match(/\/api\/admin\/pages\/(\d+)/);
    const pageId = parseInt(match[1], 10);

    const body = await parseBody(req);
    const { title, slug, subtitle, summary, content, meta_title, meta_description, is_published } = body;

    const existingPage = db.prepare('SELECT * FROM static_pages WHERE id = ?').get(pageId);
    if (!existingPage) {
      return sendJson(res, 404, { success: false, message: 'Halaman statik tidak ditemukan.' });
    }

    let finalSlug = slug !== undefined ? slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-') : existingPage.slug;
    finalSlug = finalSlug.replace(/-+/g, '-').replace(/^-|-$/g, '');

    // Check if new slug conflicts with another page
    if (finalSlug !== existingPage.slug) {
      const conflict = db.prepare('SELECT id FROM static_pages WHERE slug = ? AND id != ?').get(finalSlug, pageId);
      if (conflict) {
        return sendJson(res, 400, { success: false, message: `Slug '${finalSlug}' sudah digunakan oleh halaman lain.` });
      }
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE static_pages
      SET title = COALESCE(?, title),
          slug = COALESCE(?, slug),
          subtitle = COALESCE(?, subtitle),
          summary = COALESCE(?, summary),
          content = COALESCE(?, content),
          meta_title = COALESCE(?, meta_title),
          meta_description = COALESCE(?, meta_description),
          is_published = COALESCE(?, is_published),
          updated_at = ?
      WHERE id = ?
    `).run(
      title ?? null,
      finalSlug ?? null,
      subtitle ?? null,
      summary ?? null,
      content ?? null,
      meta_title ?? null,
      meta_description ?? null,
      is_published !== undefined ? (is_published ? 1 : 0) : null,
      now,
      pageId
    );

    return sendJson(res, 200, {
      success: true,
      message: 'Halaman statik berhasil diperbarui!',
      slug: finalSlug
    });
  }

  // Admin: Delete static page
  if (pathname.match(/\/api\/admin\/pages\/(\d+)/) && method === 'DELETE') {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Hanya Administrator yang dapat menghapus halaman statik.' });
    }

    const match = pathname.match(/\/api\/admin\/pages\/(\d+)/);
    const pageId = parseInt(match[1], 10);

    db.prepare('DELETE FROM static_pages WHERE id = ?').run(pageId);
    return sendJson(res, 200, { success: true, message: 'Halaman statik berhasil dihapus.' });
  }

  // --- 2. AUTHENTICATION ENDPOINTS ---

  // Register Peserta
  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await parseBody(req);
    const { name, email, password, phone, birth_date } = body;

    if (!name || !email || !password) {
      return sendJson(res, 400, { success: false, message: 'Nama lengkap, email, dan kata sandi wajib diisi.' });
    }

    if (password.length < 6) {
      return sendJson(res, 400, { success: false, message: 'Kata sandi minimal 6 karakter demi keamanan akun Anda.' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendJson(res, 400, { success: false, message: 'Format alamat email tidak valid.' });
    }

    // Check if email already taken
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existingUser) {
      return sendJson(res, 400, { success: false, message: 'Alamat email ini sudah terdaftar. Silakan gunakan menu Masuk.' });
    }

    // Validate birth_date if provided (prevent 1970-01-01 / empty / invalid)
    if (birth_date) {
      if (birth_date === '1970-01-01' || birth_date === '1970-00-00') {
        return sendJson(res, 400, { success: false, message: 'Format tanggal lahir tidak boleh tanggal default 1970-01-01. Harap pilih tanggal lahir Anda yang sebenarnya.' });
      }
      const bYear = parseInt(birth_date.split('-')[0], 10);
      if (isNaN(bYear) || bYear < 1950 || bYear > 2018) {
        return sendJson(res, 400, { success: false, message: 'Tahun lahir harus antara 1950 sampai 2018.' });
      }
    }

    const { hash, salt } = hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, salt, role, phone, status, created_at)
      VALUES (?, ?, ?, ?, 'PESERTA', ?, 'ACTIVE', ?)
    `).run(name.trim(), email.toLowerCase().trim(), hash, salt, phone || '', new Date().toISOString());

    // Auto-create session
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
    db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
      token,
      result.lastInsertRowid,
      new Date().toISOString(),
      expiresAt
    );

    return sendJson(res, 201, {
      success: true,
      message: 'Pendaftaran akun berhasil!',
      token,
      user: {
        id: Number(result.lastInsertRowid),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role: 'PESERTA',
        phone: phone || ''
      }
    });
  }

  // Login (Supports User & Admin)
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const { email, password, required_role } = body;

    if (!email || !password) {
      return sendJson(res, 400, { success: false, message: 'Email dan kata sandi wajib diisi.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return sendJson(res, 401, { success: false, message: 'Email atau kata sandi tidak sesuai.' });
    }

    if (user.status !== 'ACTIVE') {
      return sendJson(res, 403, { success: false, message: 'Akun Anda sedang dinonaktifkan / disuspend. Hubungi administrator.' });
    }

    const isMatch = verifyPassword(password, user.password_hash, user.salt);
    if (!isMatch) {
      return sendJson(res, 401, { success: false, message: 'Email atau kata sandi tidak sesuai.' });
    }

    // Role check if logging in via admin portal
    if (required_role === 'ADMIN' && user.role !== 'ADMIN' && user.role !== 'VERIFIKATOR') {
      return sendJson(res, 403, {
        success: false,
        message: 'Akses ditolak: Akun Anda tidak memiliki hak akses Administrator ke portal ini.'
      });
    }

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
      token,
      user.id,
      new Date().toISOString(),
      expiresAt
    );

    return sendJson(res, 200, {
      success: true,
      message: 'Login berhasil!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });
  }

  // Current user info (/api/auth/me)
  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = authenticate(req);
    if (!user) {
      return sendJson(res, 401, { success: false, message: 'Tidak terautentikasi' });
    }

    // Get active registration for peserta
    let registration = null;
    if (user.role === 'PESERTA') {
      registration = db.prepare('SELECT * FROM registrations WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(user.id);
      if (registration && (!registration.va_number || registration.va_number === '') && registration.va_bank !== 'QRIS') {
        const bank = registration.va_bank || 'BNI';
        const va = generateVirtualAccount(bank, registration.id);
        db.prepare('UPDATE registrations SET va_bank = ?, va_number = ? WHERE id = ?').run(bank, va, registration.id);
        registration.va_bank = bank;
        registration.va_number = va;
      }
    }

    return sendJson(res, 200, {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      },
      registration
    });
  }

  // Logout
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    return sendJson(res, 200, { success: true, message: 'Berhasil logout' });
  }

  // Ubah Password (Peserta & Admin)
  if (pathname === '/api/auth/change-password' && method === 'POST') {
    const user = authenticate(req);
    if (!user) {
      return sendJson(res, 401, { success: false, message: 'Silakan login terlebih dahulu.' });
    }

    const body = await parseBody(req);
    const { old_password, new_password, confirm_password } = body;

    if (!old_password || !new_password) {
      return sendJson(res, 400, { success: false, message: 'Kata sandi lama dan baru wajib diisi.' });
    }

    if (new_password.length < 6) {
      return sendJson(res, 400, { success: false, message: 'Kata sandi baru minimal 6 karakter.' });
    }

    if (confirm_password && new_password !== confirm_password) {
      return sendJson(res, 400, { success: false, message: 'Konfirmasi kata sandi baru tidak cocok.' });
    }

    // Verify old password
    const userRow = db.prepare('SELECT password_hash, salt FROM users WHERE id = ?').get(user.id);
    if (!verifyPassword(old_password, userRow.password_hash, userRow.salt)) {
      return sendJson(res, 400, { success: false, message: 'Kata sandi lama yang Anda masukkan salah.' });
    }

    // Hash and update
    const { hash, salt } = hashPassword(new_password);
    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, user.id);

    return sendJson(res, 200, {
      success: true,
      message: 'Kata sandi Anda berhasil diperbarui!'
    });
  }

  // --- 3. ROLE & USER MANAGEMENT (ADMIN ONLY) ---

  // Get all users
  if (pathname === '/api/admin/users' && method === 'GET') {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak: Hanya Administrator yang diizinkan.' });
    }

    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.phone, u.status, u.created_at,
             (SELECT COUNT(*) FROM registrations r WHERE r.user_id = u.id) as registration_count
      FROM users u
      ORDER BY u.id DESC
    `).all();

    return sendJson(res, 200, { success: true, users });
  }

  // Create new user with custom role (Admin only)
  if (pathname === '/api/admin/users' && method === 'POST') {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak: Hanya Administrator yang diizinkan.' });
    }

    const body = await parseBody(req);
    const { name, email, password, role, phone, status } = body;

    if (!name || !email || !password) {
      return sendJson(res, 400, { success: false, message: 'Nama, email, dan kata sandi wajib diisi.' });
    }

    const validRoles = ['PESERTA', 'VERIFIKATOR', 'ADMIN'];
    const assignedRole = validRoles.includes(role) ? role : 'PESERTA';

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existingUser) {
      return sendJson(res, 400, { success: false, message: 'Email sudah terdaftar.' });
    }

    const { hash, salt } = hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, salt, role, phone, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), email.toLowerCase().trim(), hash, salt, assignedRole, phone || '', status || 'ACTIVE', new Date().toISOString());

    return sendJson(res, 201, {
      success: true,
      message: `User baru dengan role '${assignedRole}' berhasil dibuat!`,
      userId: Number(result.lastInsertRowid)
    });
  }

  // Update User Role & Status (Admin only)
  if (pathname.startsWith('/api/admin/users/') && method === 'PUT') {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak.' });
    }

    const targetUserId = parseInt(pathname.split('/')[4], 10);
    if (isNaN(targetUserId)) {
      return sendJson(res, 400, { success: false, message: 'ID pengguna tidak valid.' });
    }

    const body = await parseBody(req);
    const { role, status, name, phone } = body;

    const targetUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return sendJson(res, 404, { success: false, message: 'Pengguna tidak ditemukan.' });
    }

    // Don't allow changing your own role away from ADMIN to prevent lock-out
    if (user.id === targetUserId && role && role !== 'ADMIN') {
      return sendJson(res, 400, { success: false, message: 'Anda tidak dapat menghapus hak akses Admin milik Anda sendiri.' });
    }

    db.prepare(`
      UPDATE users 
      SET role = COALESCE(?, role),
          status = COALESCE(?, status),
          name = COALESCE(?, name),
          phone = COALESCE(?, phone)
      WHERE id = ?
    `).run(role ?? null, status ?? null, name ?? null, phone ?? null, targetUserId);

    return sendJson(res, 200, {
      success: true,
      message: 'Data pengguna dan role berhasil diperbarui!'
    });
  }

  // Reset user password by Admin
  if (pathname.match(/\/api\/admin\/users\/(\d+)\/reset-password/) && method === 'POST') {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak.' });
    }

    const match = pathname.match(/\/api\/admin\/users\/(\d+)\/reset-password/);
    const targetUserId = parseInt(match[1], 10);

    const body = await parseBody(req);
    const { new_password } = body;

    if (!new_password || new_password.length < 6) {
      return sendJson(res, 400, { success: false, message: 'Kata sandi baru minimal 6 karakter.' });
    }

    const { hash, salt } = hashPassword(new_password);
    db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, targetUserId);

    // Invalidate user sessions
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId);

    return sendJson(res, 200, {
      success: true,
      message: 'Kata sandi pengguna berhasil direset!'
    });
  }

  // Delete user (Admin only)
  if (pathname.startsWith('/api/admin/users/') && method === 'DELETE') {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak.' });
    }

    const targetUserId = parseInt(pathname.split('/')[4], 10);
    if (user.id === targetUserId) {
      return sendJson(res, 400, { success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);
    return sendJson(res, 200, { success: true, message: 'Pengguna berhasil dihapus.' });
  }

  // --- 4. UPLOAD HANDLER WITH STRICT 2MB VALIDATION ---
  if (pathname === '/api/upload' && method === 'POST') {
    const user = authenticate(req);
    if (!user) {
      return sendJson(res, 401, { success: false, message: 'Silakan login untuk mengunggah berkas.' });
    }

    const body = await parseBody(req);
    const { dataUrl, filename, category } = body; // category: 'ktp', 'pasfoto', 'bukti_bayar'

    if (!dataUrl || !filename) {
      return sendJson(res, 400, { success: false, message: 'Data berkas atau nama berkas tidak ditemukan.' });
    }

    // Check base64 format
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return sendJson(res, 400, { success: false, message: 'Format berkas Base64 tidak valid.' });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Strict 2MB check
    if (buffer.length > MAX_FILE_SIZE) {
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
      return sendJson(res, 400, {
        success: false,
        message: `Ukuran file melebihi batas maksimal 2 MB (Ukuran file Anda: ${sizeMB} MB). Harap kompres berkas atau pilih berkas di bawah 2 MB.`
      });
    }

    // Determine extension
    let ext = path.extname(filename).toLowerCase();
    if (!ext) {
      if (mimeType === 'image/jpeg') ext = '.jpg';
      else if (mimeType === 'image/png') ext = '.png';
      else if (mimeType === 'application/pdf') ext = '.pdf';
      else ext = '.jpg';
    }

    const safeFilename = `${category || 'doc'}_${user.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeFilename);

    fs.writeFileSync(filePath, buffer);

    return sendJson(res, 200, {
      success: true,
      message: 'Berkas berhasil diunggah!',
      fileUrl: `/uploads/${safeFilename}`,
      fileSize: buffer.length,
      fileSizeFormatted: `${(buffer.length / 1024).toFixed(1)} KB`
    });
  }

  // --- 5. REGISTRATION ENDPOINTS ---

  // Peserta submits exam registration
  if (pathname === '/api/registrations' && method === 'POST') {
    const user = authenticate(req);
    if (!user) {
      return sendJson(res, 401, { success: false, message: 'Silakan login terlebih dahulu untuk mendaftar.' });
    }

    const body = await parseBody(req);
    const {
      exam_period,
      exam_level,
      full_name,
      nik_ktp,
      gender,
      birth_place,
      birth_date,
      phone,
      address,
      postal_code,
      certificate_delivery_address,
      certificate_postal_code,
      institution,
      japanese_learning_period,
      photo_ktp_path,
      photo_pasfoto_path,
      photo_institution_path,
      payment_method
    } = body;

    // Strict validation: Required across all participant fields
    if (!exam_period || !exam_level || !full_name || !nik_ktp || !birth_date || !birth_place || !phone || !address) {
      return sendJson(res, 400, {
        success: false,
        message: 'Mohon lengkapi semua kolom wajib (Gelombang, Level, Nama, Nomor NIK KTP, Tempat/Tgl Lahir, HP, dan Alamat Domisili).'
      });
    }

    // Crucial check: Prevent 1970-01-01 epoch date bug!
    if (birth_date === '1970-01-01' || birth_date === '1970-00-00' || !birth_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return sendJson(res, 400, {
        success: false,
        message: 'Tanggal lahir tidak valid. Harap pilih tanggal lahir yang sesuai dengan KTP Anda (bukan tanggal default 1970).'
      });
    }

    const birthYear = parseInt(birth_date.split('-')[0], 10);
    if (birthYear < 1950 || birthYear > 2018) {
      return sendJson(res, 400, {
        success: false,
        message: 'Tahun lahir di luar batas wajar (1950 - 2018). Mohon periksa kembali input tanggal lahir Anda.'
      });
    }

    // Determine exam fee
    let paymentAmount = 500000;
    if (exam_level === '2Q' || exam_level === '1Q') {
      paymentAmount = 600000;
    }

    // Generate unique registration number
    const yearCode = new Date().getFullYear();
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const regNumber = `NAT-${yearCode}-${exam_level}-${randomHex}`;

    // Delivery address fallback if not explicitly separated
    const finalCertAddress = (certificate_delivery_address && certificate_delivery_address.trim()) ? certificate_delivery_address.trim() : address.trim();
    const finalCertPostal = (certificate_postal_code && certificate_postal_code.trim()) ? certificate_postal_code.trim() : (postal_code || '').trim();

    // Determine VA Bank from payment_method
    let vaBank = 'BNI';
    const methodUpper = (payment_method || '').toUpperCase();
    if (methodUpper.includes('MANDIRI')) {
      vaBank = 'MANDIRI';
    } else if (methodUpper.includes('BRI')) {
      vaBank = 'BRI';
    } else if (methodUpper.includes('QRIS')) {
      vaBank = 'QRIS';
    }

    const lastReg = db.prepare('SELECT MAX(id) as maxId FROM registrations').get();
    const nextId = (lastReg && lastReg.maxId ? lastReg.maxId : 0) + 1;
    const initialVaNumber = (vaBank === 'QRIS') ? '' : generateVirtualAccount(vaBank, nextId);

    const stmt = db.prepare(`
      INSERT INTO registrations (
        user_id, registration_number, exam_period, exam_level, full_name, nik_ktp,
        gender, birth_place, birth_date, phone, address, postal_code,
        certificate_delivery_address, certificate_postal_code, institution,
        photo_institution_path, japanese_learning_period, photo_ktp_path, photo_pasfoto_path,
        payment_method, payment_amount, payment_status, va_bank, va_number, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
    `);

    const result = stmt.run(
      user.id,
      regNumber,
      exam_period,
      exam_level,
      full_name.trim(),
      nik_ktp.trim(),
      gender || 'L',
      birth_place.trim(),
      birth_date,
      phone.trim(),
      address.trim(),
      (postal_code || '').trim(),
      finalCertAddress,
      finalCertPostal,
      (institution || '').trim(),
      photo_institution_path || '',
      japanese_learning_period || '',
      photo_ktp_path || '',
      photo_pasfoto_path || '',
      payment_method || 'Virtual Account BNI46',
      paymentAmount,
      vaBank,
      initialVaNumber,
      new Date().toISOString()
    );

    const newId = Number(result.lastInsertRowid);
    let finalVaNumber = initialVaNumber;
    if (newId !== nextId && vaBank !== 'QRIS') {
      finalVaNumber = generateVirtualAccount(vaBank, newId);
      db.prepare('UPDATE registrations SET va_number = ? WHERE id = ?').run(finalVaNumber, newId);
    }

    return sendJson(res, 201, {
      success: true,
      message: 'Pendaftaran ujian berhasil disimpan! Silakan lanjutkan proses pembayaran.',
      registration_number: regNumber,
      id: newId,
      va_bank: vaBank,
      va_number: finalVaNumber,
      payment_amount: paymentAmount
    });
  }

  // Peserta gets their own registration
  if (pathname === '/api/registrations/my' && method === 'GET') {
    const user = authenticate(req);
    if (!user) {
      return sendJson(res, 401, { success: false, message: 'Tidak terautentikasi' });
    }

    const registration = db.prepare('SELECT * FROM registrations WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(user.id);
    if (registration && (!registration.va_number || registration.va_number === '') && registration.va_bank !== 'QRIS') {
      const bank = registration.va_bank || 'BNI';
      const va = generateVirtualAccount(bank, registration.id);
      db.prepare('UPDATE registrations SET va_bank = ?, va_number = ? WHERE id = ?').run(bank, va, registration.id);
      registration.va_bank = bank;
      registration.va_number = va;
    }
    return sendJson(res, 200, { success: true, registration });
  }

  // Peserta switches payment channel (BNI, Mandiri, BRI, QRIS)
  if (pathname === '/api/registrations/switch-channel' && method === 'POST') {
    const user = authenticate(req);
    if (!user) {
      return sendJson(res, 401, { success: false, message: 'Tidak terautentikasi' });
    }

    const body = await parseBody(req);
    const { registration_id, channel } = body;

    if (!registration_id || !channel) {
      return sendJson(res, 400, { success: false, message: 'ID registrasi dan kanal pembayaran wajib disertakan.' });
    }

    const reg = db.prepare('SELECT * FROM registrations WHERE id = ? AND user_id = ?').get(registration_id, user.id);
    if (!reg) {
      return sendJson(res, 404, { success: false, message: 'Data pendaftaran tidak ditemukan.' });
    }

    const upperChannel = String(channel).toUpperCase();
    let newBank = 'BNI';
    let newMethod = 'Virtual Account BNI46';
    let newVaNumber = '';

    if (upperChannel.includes('MANDIRI')) {
      newBank = 'MANDIRI';
      newMethod = 'Virtual Account Mandiri';
      newVaNumber = generateVirtualAccount('MANDIRI', reg.id);
    } else if (upperChannel.includes('BRI')) {
      newBank = 'BRI';
      newMethod = 'Virtual Account BRI (BRIVA)';
      newVaNumber = generateVirtualAccount('BRI', reg.id);
    } else if (upperChannel.includes('QRIS')) {
      newBank = 'QRIS';
      newMethod = 'QRIS (Scan Barcode)';
      newVaNumber = '';
    } else {
      newBank = 'BNI';
      newMethod = 'Virtual Account BNI46';
      newVaNumber = generateVirtualAccount('BNI', reg.id);
    }

    db.prepare(`
      UPDATE registrations
      SET va_bank = ?, va_number = ?, payment_method = ?
      WHERE id = ? AND user_id = ?
    `).run(newBank, newVaNumber, newMethod, reg.id, user.id);

    return sendJson(res, 200, {
      success: true,
      message: `Metode pembayaran berhasil dialihkan ke ${newMethod}!`,
      va_bank: newBank,
      va_number: newVaNumber,
      payment_method: newMethod
    });
  }

  // Upload proof of payment
  if (pathname === '/api/registrations/payment-proof' && method === 'POST') {
    const user = authenticate(req);
    if (!user) {
      return sendJson(res, 401, { success: false, message: 'Tidak terautentikasi' });
    }

    const body = await parseBody(req);
    const { registration_id, payment_proof_path } = body;

    if (!registration_id || !payment_proof_path) {
      return sendJson(res, 400, { success: false, message: 'Data bukti pembayaran tidak lengkap.' });
    }

    db.prepare(`
      UPDATE registrations 
      SET payment_proof_path = ?, payment_status = 'PENDING'
      WHERE id = ? AND user_id = ?
    `).run(payment_proof_path, registration_id, user.id);

    return sendJson(res, 200, {
      success: true,
      message: 'Bukti pembayaran berhasil diunggah. Menunggu verifikasi admin UKK CSGS UI.'
    });
  }

  // Admin: Get all registrations
  if (pathname === '/api/admin/registrations' && method === 'GET') {
    const user = authenticate(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'VERIFIKATOR')) {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak.' });
    }

    const statusFilter = parsedUrl.searchParams.get('status');
    const levelFilter = parsedUrl.searchParams.get('level');

    let query = `
      SELECT r.*, u.email as user_email
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (statusFilter && statusFilter !== 'ALL') {
      query += ` AND r.payment_status = ?`;
      params.push(statusFilter);
    }
    if (levelFilter && levelFilter !== 'ALL') {
      query += ` AND r.exam_level = ?`;
      params.push(levelFilter);
    }

    query += ` ORDER BY r.id DESC`;

    const registrations = db.prepare(query).all(...params);
    return sendJson(res, 200, { success: true, registrations });
  }

  // Admin: Update registration verification status
  if (pathname.match(/\/api\/admin\/registrations\/(\d+)\/status/) && method === 'PUT') {
    const user = authenticate(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'VERIFIKATOR')) {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak.' });
    }

    const match = pathname.match(/\/api\/admin\/registrations\/(\d+)\/status/);
    const regId = parseInt(match[1], 10);

    const body = await parseBody(req);
    const { status, issue_card, notes } = body; // status: 'VERIFIED', 'REJECTED', 'PENDING'

    db.prepare(`
      UPDATE registrations 
      SET payment_status = COALESCE(?, payment_status),
          exam_card_issued = COALESCE(?, exam_card_issued),
          notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(status ?? null, issue_card !== undefined ? (issue_card ? 1 : 0) : null, notes ?? null, regId);

    return sendJson(res, 200, {
      success: true,
      message: `Status pendaftaran ID #${regId} berhasil diubah menjadi ${status}!`
    });
  }

  // Admin statistics
  if (pathname === '/api/admin/stats' && method === 'GET') {
    const user = authenticate(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'VERIFIKATOR')) {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak.' });
    }

    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'PESERTA'").get().count;
    const totalRegs = db.prepare('SELECT COUNT(*) as count FROM registrations').get().count;
    const verifiedRegs = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE payment_status = 'VERIFIED'").get().count;
    const pendingRegs = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE payment_status = 'PENDING'").get().count;
    const totalRevenue = db.prepare("SELECT SUM(payment_amount) as total FROM registrations WHERE payment_status = 'VERIFIED'").get().total || 0;

    return sendJson(res, 200, {
      success: true,
      stats: {
        totalUsers,
        totalRegs,
        verifiedRegs,
        pendingRegs,
        totalRevenue
      }
    });
  }

  // --- 6. SYSTEM SETTINGS ENDPOINTS ---

  // Public operational settings (Safe non-sensitive: bank info, QRIS, fees, wave, contact)
  if (pathname === '/api/settings' && method === 'GET') {
    const publicKeys = [
      'app_name', 'organizer_name', 'exam_venue', 'current_wave', 'registration_status',
      'max_quota_per_wave', 'default_exam_fee', 'max_upload_size_mb',
      'bank_name', 'bank_account_number', 'bank_account_holder',
      'qris_enabled', 'qris_merchant_name', 'qris_nmid', 'qris_image_url', 'qris_instructions',
      'va_bni_enabled', 'va_bni_prefix', 'va_bni_merchant_name',
      'va_mandiri_enabled', 'va_mandiri_prefix', 'va_mandiri_merchant_name',
      'va_bri_enabled', 'va_bri_prefix', 'va_bri_merchant_name',
      'contact_email', 'contact_whatsapp', 'contact_hours'
    ];
    const placeholders = publicKeys.map(() => '?').join(',');
    const rows = db.prepare(`SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`).all(...publicKeys);
    const settings = {};
    for (const r of rows) {
      settings[r.setting_key] = r.setting_value;
    }
    return sendJson(res, 200, { success: true, settings });
  }

  // Get all settings (Admin only)
  if (pathname === '/api/admin/settings' && method === 'GET') {
    const user = authenticate(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'VERIFIKATOR')) {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak.' });
    }

    const rows = db.prepare('SELECT setting_key, setting_value, category, description, updated_at FROM system_settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.setting_key] = r.setting_value;
    }

    return sendJson(res, 200, { success: true, settings, rows });
  }

  // Update settings (Admin only)
  if (pathname === '/api/admin/settings' && (method === 'PUT' || method === 'POST')) {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Hanya Administrator yang dapat mengubah pengaturan sistem.' });
    }

    const body = await parseBody(req);
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return sendJson(res, 400, { success: false, message: 'Data pengaturan tidak valid.' });
    }

    const now = new Date().toISOString();
    const updateStmt = db.prepare(`
      INSERT INTO system_settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at
    `);

    for (const [key, val] of Object.entries(settings)) {
      updateStmt.run(key, String(val), now);
    }

    return sendJson(res, 200, {
      success: true,
      message: 'Pengaturan sistem berhasil disimpan!'
    });
  }

  // --- 7. BACKUP & RESTORE DATABASE ENDPOINTS ---

  // Database info & health
  if (pathname === '/api/admin/backup/info' && method === 'GET') {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak.' });
    }

    let dbSize = 0;
    let lastModified = null;
    try {
      const stats = fs.statSync(DB_PATH);
      dbSize = stats.size;
      lastModified = stats.mtime.toISOString();
    } catch (e) {
      console.error('Error reading DB stat:', e);
    }

    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalRegs = db.prepare('SELECT COUNT(*) as count FROM registrations').get().count;
    const totalPages = db.prepare('SELECT COUNT(*) as count FROM static_pages').get().count;
    const totalCms = db.prepare('SELECT COUNT(*) as count FROM cms_content').get().count;

    return sendJson(res, 200, {
      success: true,
      info: {
        dbPath: DB_PATH,
        dbSize,
        dbSizeFormatted: `${(dbSize / 1024).toFixed(1)} KB`,
        lastModified,
        tableStats: {
          users: totalUsers,
          registrations: totalRegs,
          static_pages: totalPages,
          cms_content: totalCms
        }
      }
    });
  }

  // Download SQLite Database file (.db)
  if (pathname === '/api/admin/backup/db' && method === 'GET') {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Hanya Administrator yang dapat mengunduh backup database.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const filename = `nattest_backup_${todayStr}.db`;

    fs.stat(DB_PATH, (err, stats) => {
      if (err) {
        return sendJson(res, 500, { success: false, message: 'Gagal membaca berkas database.' });
      }

      res.writeHead(200, {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': stats.size,
        'Cache-Control': 'no-cache'
      });

      const stream = fs.createReadStream(DB_PATH);
      stream.pipe(res);
    });
    return;
  }

  // Export full JSON backup
  if (pathname === '/api/admin/backup/json' && method === 'GET') {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak.' });
    }

    const users = db.prepare('SELECT id, name, email, role, phone, status, created_at FROM users').all();
    const registrations = db.prepare('SELECT * FROM registrations').all();
    const cmsContent = db.prepare('SELECT * FROM cms_content').all();
    const staticPages = db.prepare('SELECT * FROM static_pages').all();
    const settings = db.prepare('SELECT * FROM system_settings').all();

    const backupData = {
      app: 'NAT-TEST Official UKK CSGS UI',
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      version: '1.0',
      data: {
        users,
        registrations,
        cms_content: cmsContent,
        static_pages: staticPages,
        system_settings: settings
      }
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const todayStr = new Date().toISOString().slice(0, 10);
    const filename = `nattest_export_data_${todayStr}.json`;

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache'
    });
    res.end(jsonStr);
    return;
  }

  // Restore database from JSON backup
  if (pathname === '/api/admin/backup/restore' && method === 'POST') {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak: Hanya Administrator yang dapat memulihkan database.' });
    }

    const body = await parseBody(req);
    const { backupData } = body;

    if (!backupData || !backupData.data) {
      return sendJson(res, 400, { success: false, message: 'Format data backup tidak valid.' });
    }

    const { registrations, cms_content, static_pages, system_settings } = backupData.data;

    // Restore cms_content if present
    if (Array.isArray(cms_content)) {
      const stmt = db.prepare(`
        INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(section_key) DO UPDATE SET title = excluded.title, subtitle = excluded.subtitle, content_json = excluded.content_json, updated_at = excluded.updated_at
      `);
      for (const c of cms_content) {
        stmt.run(c.section_key, c.title, c.subtitle ?? '', c.content_json, c.updated_at, c.updated_by ?? 'Restore');
      }
    }

    // Restore static_pages if present
    if (Array.isArray(static_pages)) {
      const stmt = db.prepare(`
        INSERT INTO static_pages (slug, title, subtitle, summary, content, meta_title, meta_description, is_published, view_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET title = excluded.title, subtitle = excluded.subtitle, summary = excluded.summary, content = excluded.content, is_published = excluded.is_published, updated_at = excluded.updated_at
      `);
      for (const p of static_pages) {
        stmt.run(p.slug, p.title, p.subtitle ?? '', p.summary ?? '', p.content, p.meta_title ?? '', p.meta_description ?? '', p.is_published ?? 1, p.view_count ?? 0, p.created_at, p.updated_at);
      }
    }

    // Restore system_settings if present
    if (Array.isArray(system_settings)) {
      const stmt = db.prepare(`
        INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at
      `);
      for (const s of system_settings) {
        stmt.run(s.setting_key, s.setting_value, s.category ?? 'general', s.description ?? '', s.updated_at);
      }
    }

    return sendJson(res, 200, {
      success: true,
      message: 'Pemulihan data backup berhasil diproses!'
    });
  }

  // Optimize (VACUUM) Database
  if (pathname === '/api/admin/backup/vacuum' && method === 'POST') {
    const user = authenticate(req);
    if (!user || user.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak.' });
    }

    try {
      db.exec('VACUUM;');
      return sendJson(res, 200, { success: true, message: 'Database SQLite berhasil dioptimasi (VACUUM)!' });
    } catch (e) {
      return sendJson(res, 500, { success: false, message: 'Gagal mengoptimasi database: ' + e.message });
    }
  }

  // --- 8. TRANSACTION REPORTS ENDPOINTS (HARIAN & BULANAN) ---

  // Daily Report
  if (pathname === '/api/admin/reports/daily' && method === 'GET') {
    const user = authenticate(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'VERIFIKATOR')) {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak.' });
    }

    // Default to today
    const dateParam = parsedUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);

    const transactions = db.prepare(`
      SELECT r.id, r.registration_number, r.full_name, r.nik_ktp, r.gender, r.exam_level, r.exam_period,
             r.payment_method, r.payment_amount, r.payment_status, r.created_at,
             u.email, u.phone
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      WHERE r.created_at LIKE ?
      ORDER BY r.id DESC
    `).all(`${dateParam}%`);

    const totalCount = transactions.length;
    const verifiedCount = transactions.filter(t => t.payment_status === 'VERIFIED').length;
    const pendingCount = transactions.filter(t => t.payment_status === 'PENDING').length;
    const rejectedCount = transactions.filter(t => t.payment_status === 'REJECTED').length;
    const totalRevenue = transactions
      .filter(t => t.payment_status === 'VERIFIED')
      .reduce((sum, t) => sum + (t.payment_amount || 0), 0);

    // Level breakdown
    const levelCounts = {};
    for (const t of transactions) {
      levelCounts[t.exam_level] = (levelCounts[t.exam_level] || 0) + 1;
    }

    // Payment method breakdown
    const methodCounts = {};
    for (const t of transactions) {
      const m = t.payment_method || 'Virtual Account';
      methodCounts[m] = (methodCounts[m] || 0) + 1;
    }

    return sendJson(res, 200, {
      success: true,
      report_type: 'daily',
      date: dateParam,
      summary: {
        totalRegistrations: totalCount,
        verifiedCount,
        pendingCount,
        rejectedCount,
        totalRevenue,
        totalRevenueFormatted: `Rp ${totalRevenue.toLocaleString('id-ID')}`
      },
      levelCounts,
      methodCounts,
      transactions
    });
  }

  // Monthly Report
  if (pathname === '/api/admin/reports/monthly' && method === 'GET') {
    const user = authenticate(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'VERIFIKATOR')) {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak.' });
    }

    const now = new Date();
    const yearParam = parsedUrl.searchParams.get('year') || String(now.getFullYear());
    const monthParam = (parsedUrl.searchParams.get('month') || String(now.getMonth() + 1)).padStart(2, '0');
    const monthPrefix = `${yearParam}-${monthParam}`;

    const transactions = db.prepare(`
      SELECT r.id, r.registration_number, r.full_name, r.nik_ktp, r.gender, r.exam_level, r.exam_period,
             r.payment_method, r.payment_amount, r.payment_status, r.created_at,
             u.email, u.phone
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      WHERE r.created_at LIKE ?
      ORDER BY r.id DESC
    `).all(`${monthPrefix}%`);

    const totalCount = transactions.length;
    const verifiedCount = transactions.filter(t => t.payment_status === 'VERIFIED').length;
    const pendingCount = transactions.filter(t => t.payment_status === 'PENDING').length;
    const rejectedCount = transactions.filter(t => t.payment_status === 'REJECTED').length;
    const totalRevenue = transactions
      .filter(t => t.payment_status === 'VERIFIED')
      .reduce((sum, t) => sum + (t.payment_amount || 0), 0);

    // Daily breakdown for charts and table
    const dailyMap = {};
    const daysInMonth = new Date(parseInt(yearParam, 10), parseInt(monthParam, 10), 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
      dailyMap[dayStr] = { day: dayStr, dateNum: d, total: 0, verified: 0, pending: 0, revenue: 0 };
    }

    for (const t of transactions) {
      const day = t.created_at ? t.created_at.slice(0, 10) : null;
      if (day && dailyMap[day]) {
        dailyMap[day].total += 1;
        if (t.payment_status === 'VERIFIED') {
          dailyMap[day].verified += 1;
          dailyMap[day].revenue += (t.payment_amount || 0);
        } else if (t.payment_status === 'PENDING') {
          dailyMap[day].pending += 1;
        }
      }
    }

    const dailyBreakdown = Object.values(dailyMap);

    // Level breakdown
    const levelCounts = {};
    for (const t of transactions) {
      levelCounts[t.exam_level] = (levelCounts[t.exam_level] || 0) + 1;
    }

    // Method breakdown
    const methodCounts = {};
    for (const t of transactions) {
      const m = t.payment_method || 'Virtual Account';
      methodCounts[m] = (methodCounts[m] || 0) + 1;
    }

    return sendJson(res, 200, {
      success: true,
      report_type: 'monthly',
      year: yearParam,
      month: monthParam,
      monthPrefix,
      summary: {
        totalRegistrations: totalCount,
        verifiedCount,
        pendingCount,
        rejectedCount,
        totalRevenue,
        totalRevenueFormatted: `Rp ${totalRevenue.toLocaleString('id-ID')}`,
        verificationRate: totalCount > 0 ? ((verifiedCount / totalCount) * 100).toFixed(1) : '0',
        avgDaily: (totalCount / daysInMonth).toFixed(1)
      },
      dailyBreakdown,
      levelCounts,
      methodCounts,
      transactions
    });
  }

  // Export Transactions to CSV
  if (pathname === '/api/admin/reports/export' && method === 'GET') {
    const user = authenticate(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'VERIFIKATOR')) {
      return sendJson(res, 403, { success: false, message: 'Akses ditolak.' });
    }

    const type = parsedUrl.searchParams.get('type') || 'daily';
    let filterPattern = '';
    let filename = '';

    if (type === 'monthly') {
      const now = new Date();
      const year = parsedUrl.searchParams.get('year') || String(now.getFullYear());
      const month = (parsedUrl.searchParams.get('month') || String(now.getMonth() + 1)).padStart(2, '0');
      filterPattern = `${year}-${month}%`;
      filename = `laporan_transaksi_nattest_${year}_${month}.csv`;
    } else {
      const date = parsedUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
      filterPattern = `${date}%`;
      filename = `laporan_transaksi_nattest_${date}.csv`;
    }

    const rows = db.prepare(`
      SELECT r.id, r.registration_number, r.full_name, r.nik_ktp, r.gender, r.exam_level, r.exam_period,
             r.payment_method, r.payment_amount, r.payment_status, r.created_at,
             u.email, u.phone
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      WHERE r.created_at LIKE ?
      ORDER BY r.id DESC
    `).all(filterPattern);

    const headers = [
      'No',
      'No. Registrasi',
      'Nama Peserta',
      'NIK KTP',
      'Email',
      'WhatsApp',
      'Level Ujian',
      'Gelombang',
      'Biaya Ujian (Rp)',
      'Metode Pembayaran',
      'Status Verifikasi',
      'Tanggal Transaksi'
    ];

    const escapeCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvLines = [headers.map(escapeCsv).join(',')];

    rows.forEach((r, idx) => {
      csvLines.push([
        idx + 1,
        r.registration_number,
        r.full_name,
        r.nik_ktp,
        r.email,
        r.phone,
        r.exam_level,
        r.exam_period,
        r.payment_amount,
        r.payment_method,
        r.payment_status,
        r.created_at
      ].map(escapeCsv).join(','));
    });

    const csvContent = '\uFEFF' + csvLines.join('\r\n');

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache'
    });
    res.end(csvContent);
    return;
  }

  // -------------------------------------------------------------
  // STATIC FILE SERVING
  // -------------------------------------------------------------

  let relativePath = pathname === '/' ? '/index.html' : pathname;
  // Route aliases
  if (pathname === '/admin' || pathname === '/admin/' || pathname === '/login-admin') {
    relativePath = '/admin-login.html';
  } else if (pathname === '/admin/dashboard') {
    relativePath = '/admin-dashboard.html';
  } else if (pathname === '/dashboard' || pathname === '/user/dashboard') {
    relativePath = '/user-dashboard.html';
  } else if (pathname === '/cetak-kartu' || pathname === '/cetak' || pathname === '/print-card') {
    relativePath = '/cetak-kartu.html';
  } else if (pathname.startsWith('/page/') || pathname.startsWith('/pages/') || pathname.startsWith('/p/')) {
    relativePath = '/page.html';
  } else if (pathname === '/pengaturan' || pathname === '/backup' || pathname === '/pengaturan-backup') {
    relativePath = '/pengaturan-backup.html';
  } else if (pathname === '/laporan' || pathname === '/laporan-transaksi' || pathname === '/transaksi') {
    relativePath = '/laporan-transaksi.html';
  }

  const safePath = path.normalize(path.join(PUBLIC_DIR, relativePath));

  // Security check against directory traversal
  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback for 404
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const fileStream = fs.createReadStream(safePath);
    fileStream.pipe(res);
  });
});

// Initialize database then start server
initDatabase();

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🌸 NAT-TEST & UKK CSGS UI Server Berjalan Lancar!`);
  console.log(`🌐 URL Utama      : http://localhost:${PORT}`);
  console.log(`👤 Portal Peserta : http://localhost:${PORT}/dashboard`);
  console.log(`🔒 Portal Admin   : http://localhost:${PORT}/admin-login.html`);
  console.log(`====================================================`);
});
