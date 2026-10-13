// db.js - SQLite Database initialization & management for NAT-TEST UKK CSGS UI
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const DB_PATH = path.join(__dirname, 'nattest.db');
const db = new DatabaseSync(DB_PATH);

// Helper for secure password hashing with salt
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const check = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return check === hash;
}

function initDatabase() {
  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'PESERTA',
      phone TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL
    );
  `);

  // Registrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      registration_number TEXT UNIQUE NOT NULL,
      exam_period TEXT NOT NULL,
      exam_level TEXT NOT NULL,
      full_name TEXT NOT NULL,
      nik_ktp TEXT NOT NULL,
      gender TEXT NOT NULL,
      birth_place TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      postal_code TEXT DEFAULT '',
      certificate_delivery_address TEXT DEFAULT '',
      certificate_postal_code TEXT DEFAULT '',
      institution TEXT,
      photo_institution_path TEXT DEFAULT '',
      japanese_learning_period TEXT,
      photo_ktp_path TEXT,
      photo_pasfoto_path TEXT,
      payment_method TEXT,
      payment_amount INTEGER DEFAULT 500000,
      payment_status TEXT DEFAULT 'PENDING',
      payment_proof_path TEXT,
      exam_card_issued INTEGER DEFAULT 0,
      va_bank TEXT DEFAULT 'BNI',
      va_number TEXT DEFAULT '',
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Auto-migration for new registration columns if table already existed
  try {
    const regCols = db.prepare('PRAGMA table_info(registrations)').all().map(c => c.name);
    if (!regCols.includes('postal_code')) {
      db.exec('ALTER TABLE registrations ADD COLUMN postal_code TEXT DEFAULT "";');
    }
    if (!regCols.includes('certificate_delivery_address')) {
      db.exec('ALTER TABLE registrations ADD COLUMN certificate_delivery_address TEXT DEFAULT "";');
    }
    if (!regCols.includes('certificate_postal_code')) {
      db.exec('ALTER TABLE registrations ADD COLUMN certificate_postal_code TEXT DEFAULT "";');
    }
    if (!regCols.includes('photo_institution_path')) {
      db.exec('ALTER TABLE registrations ADD COLUMN photo_institution_path TEXT DEFAULT "";');
    }
    if (!regCols.includes('va_bank')) {
      db.exec('ALTER TABLE registrations ADD COLUMN va_bank TEXT DEFAULT "BNI";');
    }
    if (!regCols.includes('va_number')) {
      db.exec('ALTER TABLE registrations ADD COLUMN va_number TEXT DEFAULT "";');
    }
  } catch (err) {
    console.warn('Migration note for registrations columns:', err.message);
  }

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // CMS Content table for dynamic landing page sections
  db.exec(`
    CREATE TABLE IF NOT EXISTS cms_content (
      section_key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      content_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );
  `);

  // Static Pages table (Halaman Statik: Tentang Kami, Panduan, Syarat & Ketentuan, dll)
  db.exec(`
    CREATE TABLE IF NOT EXISTS static_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      summary TEXT,
      content TEXT NOT NULL,
      meta_title TEXT,
      meta_description TEXT,
      is_published INTEGER DEFAULT 1,
      view_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // System Settings table (Pengaturan Sistem, Kuota, Pembayaran & Operasional)
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      description TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  // Seed default Admin if not exists
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@csgs-ui.ac.id');
  if (!existingAdmin) {
    const { hash, salt } = hashPassword('admin123');
    db.prepare(`
      INSERT INTO users (name, email, password_hash, salt, role, phone, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Administrator UKK CSGS UI',
      'admin@csgs-ui.ac.id',
      hash,
      salt,
      'ADMIN',
      '081288889999',
      'ACTIVE',
      new Date().toISOString()
    );
    console.log('✔ Default Admin account created: admin@csgs-ui.ac.id / admin123');
  }

  // Seed demo Peserta if not exists
  const existingPeserta = db.prepare('SELECT id FROM users WHERE email = ?').get('budi.santoso@gmail.com');
  if (!existingPeserta) {
    const { hash, salt } = hashPassword('peserta123');
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, salt, role, phone, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Budi Santoso',
      'budi.santoso@gmail.com',
      hash,
      salt,
      'PESERTA',
      '081234567890',
      'ACTIVE',
      new Date().toISOString()
    );

    // Seed a sample registration for demo peserta
    db.prepare(`
      INSERT INTO registrations (
        user_id, registration_number, exam_period, exam_level, full_name, nik_ktp,
        gender, birth_place, birth_date, phone, address, postal_code,
        certificate_delivery_address, certificate_postal_code, institution,
        photo_institution_path, japanese_learning_period, payment_method, payment_amount,
        payment_status, exam_card_issued, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.lastInsertRowid,
      'NAT-2026-0601',
      'Gelombang 3 - Juni 2026',
      '4Q',
      'Budi Santoso',
      '3171012508990001',
      'L',
      'Jakarta',
      '1999-08-25', // Clean, valid birth date (No 1970!)
      '081234567890',
      'Jl. Margonda Raya No. 45, Beji, Kota Depok',
      '16424',
      'Jl. Margonda Raya No. 45, Beji, Kota Depok (Gedung FIB UI)',
      '16424',
      'Universitas Indonesia (Fakultas Ilmu Pengetahuan Budaya)',
      '/images/logo-csgs-ui.svg',
      '1 Tahun',
      'Virtual Account BNI',
      500000,
      'VERIFIED',
      1,
      new Date().toISOString()
    );
    console.log('✔ Demo Peserta account created: budi.santoso@gmail.com / peserta123');
  }

  // Seed initial Japanese-themed CMS content if empty
  seedInitialCmsContent();
}

function seedInitialCmsContent() {
  const getCms = db.prepare('SELECT section_key FROM cms_content WHERE section_key = ?');

  // 1. Hero & Announcement
  if (!getCms.get('hero')) {
    const heroData = {
      hero_badge: 'PENDAFTARAN RESMI 2026 / 2027 TERBUKA',
      hero_kanji: '日本語学力テスト・公式試験',
      hero_title: 'Ujian Standar Kemampuan Bahasa Jepang NAT-TEST',
      hero_subtitle: 'Diselenggarakan secara resmi oleh NAT-TEST Komite Pusat Jepang bekerjasama dengan Unit Kerja Khusus Center for Strategic and Global Studies (UKK CSGS) Universitas Indonesia.',
      announcement_bar: '📢 Pengumuman: Pendaftaran NAT-TEST Gelombang 3 (Juni 2026) dibuka hingga 15 Mei 2026. Kuota terbatas 350 peserta per gelombang!',
      target_link: '#jadwal',
      btn_primary_text: 'Daftar Ujian Sekarang',
      btn_secondary_text: 'Lihat Jadwal & Panduan'
    };
    db.prepare(`
      INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('hero', 'Pengaturan Hero & Banner Depan', 'Informasi utama di bagian atas website', JSON.stringify(heroData), new Date().toISOString(), 'System');
  }

  // 2. Info Jadwal Ujian
  if (!getCms.get('schedule')) {
    const scheduleData = {
      description: 'NAT-TEST diadakan 6 kali dalam setahun (setiap bulan genap). Ujian menguji kemampuan bahasa Jepang setara dengan standar JLPT (1Q setara N1 s/d 5Q setara N5).',
      schedules: [
        {
          id: 1,
          name: 'Gelombang 1 - Februari 2026',
          exam_date: '15 Februari 2026',
          registration_period: '1 Des 2025 - 15 Jan 2026',
          result_date: '05 Maret 2026',
          levels: ['5Q', '4Q', '3Q', '2Q', '1Q'],
          status: 'SELESAI', // 'BUKA', 'SEGERA', 'SELESAI', 'TUTUP'
          badge_color: 'gray'
        },
        {
          id: 2,
          name: 'Gelombang 2 - April 2026',
          exam_date: '12 April 2026',
          registration_period: '1 Feb 2026 - 15 Mar 2026',
          result_date: '02 Mei 2026',
          levels: ['5Q', '4Q', '3Q', '2Q', '1Q'],
          status: 'SELESAI',
          badge_color: 'gray'
        },
        {
          id: 3,
          name: 'Gelombang 3 - Juni 2026',
          exam_date: '14 Juni 2026',
          registration_period: '1 Apr 2026 - 15 Mei 2026',
          result_date: '04 Juli 2026',
          levels: ['5Q', '4Q', '3Q', '2Q', '1Q'],
          status: 'BUKA',
          badge_color: 'emerald'
        },
        {
          id: 4,
          name: 'Gelombang 4 - Agustus 2026',
          exam_date: '09 Agustus 2026',
          registration_period: '1 Jun 2026 - 15 Jul 2026',
          result_date: '29 Agustus 2026',
          levels: ['5Q', '4Q', '3Q', '2Q', '1Q'],
          status: 'SEGERA',
          badge_color: 'amber'
        },
        {
          id: 5,
          name: 'Gelombang 5 - Oktober 2026',
          exam_date: '11 Oktober 2026',
          registration_period: '1 Ags 2026 - 15 Sep 2026',
          result_date: '31 Oktober 2026',
          levels: ['5Q', '4Q', '3Q', '2Q', '1Q'],
          status: 'SEGERA',
          badge_color: 'amber'
        },
        {
          id: 6,
          name: 'Gelombang 6 - Desember 2026',
          exam_date: '13 Desember 2026',
          registration_period: '1 Okt 2026 - 15 Nov 2026',
          result_date: '02 Januari 2027',
          levels: ['5Q', '4Q', '3Q', '2Q', '1Q'],
          status: 'SEGERA',
          badge_color: 'amber'
        }
      ]
    };
    db.prepare(`
      INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('schedule', 'Jadwal Ujian NAT-TEST', 'Jadwal resmi pelaksanaan ujian sepanjang tahun', JSON.stringify(scheduleData), new Date().toISOString(), 'System');
  }

  // 3. Info Akses Lokasi Ujian
  if (!getCms.get('location')) {
    const locationData = {
      venue_name: 'Pusat Studi Jepang (PSJ) UI & Gedung CSGS UI',
      campus_name: 'Kampus Universitas Indonesia, Depok, Jawa Barat',
      address: 'Gedung Pusat Studi Jepang (PSJ UI), Jl. Lingkar Kampus UI, Pondok Cina, Beji, Kota Depok, Jawa Barat 16424',
      map_embed_url: 'https://maps.google.com/maps?q=Pusat+Studi+Jepang+Universitas+Indonesia&t=&z=15&ie=UTF8&iwloc=&output=embed',
      google_maps_link: 'https://maps.app.goo.gl/kX72fUvQWkH9G2Ue8',
      routes: [
        {
          mode: 'KRL Commuter Line',
          icon: 'train',
          title: 'Kereta Commuter Line (Paling Direkomendasikan)',
          steps: 'Turun di Stasiun Pondok Cina (POC) atau Stasiun Universitas Indonesia (UI). Dari Stasiun Pondok Cina berjarak sekitar 5-7 menit jalan kaki melalui gerbang pejalan kaki UI langsung menuju Pusat Studi Jepang.'
        },
        {
          mode: 'Bus Kuning (Bikun) UI',
          icon: 'bus',
          title: 'Transportasi Internal Kampus (Bikun)',
          steps: 'Jika naik dari halte utama UI / Asrama UI, naik Bus Kuning rute Merah/Biru dan turun di Halte Fakultas Ilmu Budaya (FIB) atau Halte Pusat Studi Jepang.'
        },
        {
          mode: 'Kendaraan Pribadi / Ojek Online',
          icon: 'car',
          title: 'Mobil, Motor & Transportasi Online',
          steps: 'Akses melalui Tol Cijago (Keluar Kukusan / Margonda Raya). Parkir tersedia di area Gedung Pusgiwa UI dan pelataran parkir Pusat Studi Jepang (PSJ UI).'
        }
      ],
      important_notes: [
        'Harap hadir di lokasi ujian minimal 45 menit sebelum sesi ujian dimulai untuk verifikasi berkas.',
        'Pintu gerbang ruang ujian ditutup tepat 15 menit sebelum ujian dimulai. Keterlambatan tidak ditoleransi.',
        'Penyelenggara menyediakan ruang tunggu khusus untuk pengantar di luar area steril ujian.'
      ]
    };
    db.prepare(`
      INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('location', 'Akses & Lokasi Ujian', 'Panduan transportasi dan lokasi pelaksanaan ujian di UI Depok', JSON.stringify(locationData), new Date().toISOString(), 'System');
  }

  // 4. Aturan Penggunaan Pakaian saat Ujian (Dress Code)
  if (!getCms.get('dresscode')) {
    const dresscodeData = {
      summary: 'Seluruh peserta ujian NAT-TEST wajib mengenakan pakaian yang rapi, bersih, sopan, dan mematuhi etika akademik ujian resmi.',
      allowed: [
        'Kemeja berkerah atau polo shirt rapi (disarankan berwarna putih atau warna polos yang rapi).',
        'Celana panjang bahan kain atau celana jeans rapi (tidak robek/sobek model ripped jeans).',
        'Bagi wanita yang memakai rok, panjang rok wajib di bawah lutut dan tetap sopan.',
        'Wajib memakai sepatu tertutup (sepatu sneakers / pantofel / flat shoes) beserta kaus kaki.',
        'Bagi yang mengenakan jilbab/hijab, wajib berpakaian rapi dan bersedia membuka sedikit area telinga/wajah saat pemeriksaan identitas oleh pengawas perempuan.'
      ],
      prohibited: [
        'DILARANG memakai kaos oblong (T-shirt tanpa kerah) atau singlet.',
        'DILARANG memakai celana pendek, hotpants, atau celana sobek-sobek (ripped jeans).',
        'DILARANG memakai sandal jepit, selop, atau sandal gunung jenis apa pun.',
        'DILARANG memakai jaket tebal, hoodie, atau topi di dalam ruang ujian (jaket harus dilepas dan diletakkan di gantungan/tas).',
        'DILARANG memakai kacamata hitam/rayban atau aksesoris logam mencolok.'
      ],
      special_rule: 'Peserta yang tidak mematuhi tata tertib pakaian TIDAK AKAN DIIZINKAN memasuki ruang ujian dan biaya ujian dinyatakan hangus.'
    };
    db.prepare(`
      INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('dresscode', 'Aturan Pakaian (Dress Code)', 'Ketentuan pakaian resmi bagi seluruh peserta ujian', JSON.stringify(dresscodeData), new Date().toISOString(), 'System');
  }

  // 5. ATK yang Wajib Dibawa
  if (!getCms.get('stationery')) {
    const stationeryData = {
      summary: 'Lembar Jawaban Komputer (LJK) NAT-TEST diperiksa menggunakan mesin pemindai optik standar Jepang. Kegagalan membawa pensil yang sesuai dapat mengakibatkan LJK tidak terbaca.',
      mandatory: [
        {
          name: 'Pensil 2B Asli / Berkualitas',
          desc: 'Pensil grafit 2B (bukan pensil mekanik runcing 0.5mm) untuk menghitamkan bulatan LJK secara pekat dan merata.',
          icon: 'pencil'
        },
        {
          name: 'Penghapus Khusus Pensil 2B',
          desc: 'Penghapus karet bersih berwarna hitam atau putih yang tidak merusak lembar kertas saat menghapus.',
          icon: 'eraser'
        },
        {
          name: 'Rautan Pensil Manual',
          desc: 'Rautan pensil kecil untuk memastikan mata pensil tetap tumpul bulat ideal (tidak terlalu tajam menusuk kertas).',
          icon: 'sharpener'
        },
        {
          name: 'Kartu Tanda Peserta Ujian (Cetak Fisik)',
          desc: 'Kartu ujian yang diunduh dari dashboard peserta, dicetak pada kertas HVS A4 ukuran penuh secara jelas dan tidak buram.',
          icon: 'id-card'
        },
        {
          name: 'Kartu Identitas Diri Asli (KTP / Paspor / Kartu Pelajar)',
          desc: 'Wajib membawa KTP Asli (atau Paspor Asli) fisik yang masih berlaku sesuai dengan identitas yang didaftarkan online.',
          icon: 'badge'
        }
      ],
      prohibited_on_desk: [
        'Telepon seluler (HP), tablet, laptop, dan semua jenis perangkat telekomunikasi (wajib dimatikan total dan ditaruh di dalam tas di depan kelas).',
        'Jam tangan pintar (smartwatch) jenis apa pun. Jam dinding resmi disediakan di setiap ruang ujian.',
        'Kamus cetak, kamus elektronik (denshi jisho), buku catatan, dan kertas buram pribadi.',
        'Correction pen / Tipp-Ex / Pita pengoreksi (tidak boleh digunakan pada LJK).',
        'Tempat pensil berbahan kain atau logam yang tidak transparan (alat tulis ditaruh langsung di meja).'
      ]
    };
    db.prepare(`
      INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('stationery', 'ATK & Perlengkapan Wajib Ujian', 'Daftar alat tulis wajib dan barang yang dilarang di meja ujian', JSON.stringify(stationeryData), new Date().toISOString(), 'System');
  }

  // 6. Info Cara Pembayaran
  if (!getCms.get('payment')) {
    const paymentData = {
      fee_structures: [
        { level: 'Level 5Q & 4Q (Setara N5 - N4)', fee: 500000, fee_text: 'Rp 500.000,-', desc: 'Tingkat Dasar (Pemula)' },
        { level: 'Level 3Q (Setara N3)', fee: 500000, fee_text: 'Rp 500.000,-', desc: 'Tingkat Menengah Bawah' },
        { level: 'Level 2Q & 1Q (Setara N2 - N1)', fee: 600000, fee_text: 'Rp 600.000,-', desc: 'Tingkat Lanjutan (Mahir)' }
      ],
      bank_accounts: [
        {
          bank: 'BNI (Bank Negara Indonesia)',
          account_number: '0382-990-1234',
          account_name: 'UKK CSGS UNIVERSITAS INDONESIA',
          type: 'Rekening Giro Resmi Universitas'
        },
        {
          bank: 'Mandiri Virtual Account',
          account_number: '8872-0812-XXXX',
          account_name: 'NAT-TEST UI (Otomatis per Peserta)',
          type: 'Virtual Account Verifikasi Cepat'
        },
        {
          bank: 'QRIS CSGS UI',
          account_number: 'NMID: ID1020267899981',
          account_name: 'UKK CSGS UI NAT-TEST',
          type: 'Semua E-Wallet & Mobile Banking'
        }
      ],
      steps: [
        {
          step: 1,
          title: 'Registrasi Akun & Pilih Gelombang',
          desc: 'Lengkapi formulir pendaftaran ujian dengan data diri yang sesuai KTP dan pilih level ujian yang diinginkan.'
        },
        {
          step: 2,
          title: 'Dapatkan Nomor Pembayaran / Rekening',
          desc: 'Sistem akan menerbitkan rincian kode bayar unik serta batas waktu pembayaran (maksimal 24 jam).'
        },
        {
          step: 3,
          title: 'Lakukan Transfer & Simpan Bukti',
          desc: 'Transfer tepat sesuai nominal ujian melalui ATM, Mobile Banking, atau QRIS resmi UKK CSGS UI.'
        },
        {
          step: 4,
          title: 'Unggah Bukti di Dashboard Peserta',
          desc: 'Masuk ke dashboard akun peserta, buka menu Pembayaran, dan unggah foto/struk bukti transfer Anda.'
        },
        {
          step: 5,
          title: 'Verifikasi & Unduh Kartu Ujian',
          desc: 'Tim admin CSGS UI akan memverifikasi dalam 1x24 jam kerja, setelah itu Kartu Tanda Peserta Ujian langsung aktif untuk diunduh dan dicetak.'
        }
      ],
      payment_policy: 'Biaya ujian yang sudah dibayarkan dan diverifikasi TIDAK DAPAT ditarik kembali (non-refundable) atau dipindahtangankan dengan alasan apa pun.'
    };
    db.prepare(`
      INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('payment', 'Tata Cara & Rincian Pembayaran', 'Panduan pembayaran biaya ujian NAT-TEST UKK CSGS UI', JSON.stringify(paymentData), new Date().toISOString(), 'System');
  }

  // 7. FAQ & Kontak
  if (!getCms.get('faq')) {
    const faqData = {
      faqs: [
        {
          q: 'Apakah sertifikat NAT-TEST diakui oleh Imigrasi dan Universitas di Jepang?',
          a: 'Ya, sertifikat NAT-TEST resmi diakui oleh Biro Imigrasi Kementerian Kehakiman Jepang (MOJ) untuk pengajuan Certificate of Eligibility (COE), visa studi bahasa ke Jepang, program Tokutei Ginou (Specified Skilled Worker), dan magang teknis.'
        },
        {
          q: 'Berapa lama hasil ujian diumumkan?',
          a: 'Hasil ujian dan skor lembar nilai (Score Report) diterbitkan kurang lebih 3 minggu setelah hari pelaksanaan ujian.'
        },
        {
          q: 'Bolehkah mendaftar 2 level ujian dalam satu gelombang?',
          a: 'Bisa, asalkan jam pelaksanaan level yang dipilih tidak bersamaan (misal level pagi 5Q/3Q/1Q dan level siang 4Q/2Q).'
        },
        {
          q: 'Bagaimana jika saya terlambat datang ke lokasi ujian?',
          a: 'Pintu ruang ujian ditutup tepat 15 menit sebelum ujian dimulai untuk pembacaan tata tertib. Peserta yang terlambat tidak diperkenankan masuk dalam sesi tersebut.'
        }
      ],
      contact: {
        office: 'Sekretariat NAT-TEST UKK CSGS UI, Pusat Studi Jepang (PSJ UI) Lt. 1, Kampus UI Depok',
        whatsapp: '+62 812-8888-9999',
        email: 'nattest@csgs-ui.ac.id',
        operational_hours: 'Senin - Jumat: 08.30 - 16.00 WIB (Kecuali Hari Libur Nasional)'
      }
    };
    db.prepare(`
      INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('faq', 'Tanya Jawab (FAQ) & Kontak Sekretariat', 'Informasi bantuan dan pertanyaan yang sering diajukan', JSON.stringify(faqData), new Date().toISOString(), 'System');
  }

  // 8. Card Layout Template for Printable Exam Card
  if (!getCms.get('card_layout')) {
    const cardLayoutData = {
      theme: 'red_classic', // 'red_classic', 'navy_gold', 'monochrome', 'compact_badge'
      orientation: 'landscape', // 'landscape' or 'portrait'
      paper_size: 'a4_half', // 'a4_half', 'a4_full', 'id_card'
      cards_per_page: 1, // 1 or 2
      header_title_jp: '日本語学力テスト・受験票',
      header_title_id: 'KARTU TANDA PESERTA UJIAN RESMI',
      committee_name: 'KOMITE PUSAT NAT-TEST JEPANG & UKK CSGS UNIVERSITAS INDONESIA',
      show_nat_logo: true,
      show_ui_logo: true,
      show_qr_code: true,
      show_barcode: true,
      show_photo: true,
      photo_position: 'left', // 'left' or 'right'
      photo_size: 'medium', // 'small', 'medium', 'large'
      show_stamp: true,
      stamp_text: '公式検印',
      show_signature: true,
      signatory_title: 'Ketua Pelaksana Ujian NAT-TEST UI',
      signatory_name: 'Dr. Dian Hapsari, M.Hum.',
      signatory_nip: 'NIP 197804152005012001',
      show_room_seat: true,
      default_room: 'Pusat Studi Jepang UI - Ruang 201',
      default_seat: 'K-024',
      default_time: '08.30 - 12.30 WIB',
      show_rules: true,
      rules_title: 'TATA TERTIB & INSTRUKSI WAJIB PESERTA UJIAN',
      rules: [
        'Wajib membawa Kartu Tanda Peserta Ujian fisik ini dan KTP/Paspor Asli yang masih berlaku.',
        'Wajib berpakaian rapi dan berkerah, celana bahan/panjang sopan, serta bersepatu tertutup (kaos oblong dan sandal dilarang).',
        'Wajib membawa Pensil 2B Asli dan penghapus khusus 2B untuk Lembar Jawaban Komputer (pensil mekanik dilarang).',
        'Pintu ruang ujian ditutup tepat 15 menit sebelum waktu ujian dimulai. Keterlambatan tidak ditoleransi.',
        'Dilarang membawa alat komunikasi, handphone, smartwatch, kalkulator, kamus, dan buku catatan ke meja ujian.'
      ],
      fields: {
        reg_number: { label: 'No. Registrasi / Ujian', show: true },
        full_name: { label: 'Nama Lengkap Peserta', show: true },
        nik: { label: 'NIK / No. Identitas', show: true },
        birth: { label: 'Tempat, Tanggal Lahir', show: true },
        level: { label: 'Level Ujian', show: true },
        period: { label: 'Gelombang / Periode', show: true },
        venue: { label: 'Lokasi Pelaksanaan', show: true },
        room_time: { label: 'Ruang, Kursi & Jam', show: true }
      }
    };
    db.prepare(`
      INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('card_layout', 'Pengaturan Layout Kartu Ujian', 'Template dan tata letak pencetakan kartu ujian resmi', JSON.stringify(cardLayoutData), new Date().toISOString(), 'System');
  }

  // 9. Main Header Navigation Menu
  if (!getCms.get('navigation')) {
    const navData = {
      menus: [
        { id: 1, label: 'Jadwal Ujian', url: '#jadwal', target: '_self', is_active: true },
        { id: 2, label: 'Akses Lokasi', url: '#lokasi', target: '_self', is_active: true },
        { id: 3, label: 'Aturan Pakaian', url: '#aturan-pakaian', target: '_self', is_active: true },
        { id: 4, label: 'ATK Wajib', url: '#atk-wajib', target: '_self', is_active: true },
        { id: 5, label: 'Biaya & Pembayaran', url: '#pembayaran', target: '_self', is_active: true },
        { id: 6, label: 'FAQ', url: '#faq', target: '_self', is_active: true }
      ]
    };
    db.prepare(`
      INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('navigation', 'Pengaturan Menu Navigasi Header', 'Daftar menu navigasi utama di header website', JSON.stringify(navData), new Date().toISOString(), 'System');
  }

  // 9B. Image Slider Halaman Depan (Maksimal 3 Gambar)
  if (!getCms.get('slider')) {
    const sliderData = {
      enabled: true,
      autoplay: true,
      interval_ms: 5000,
      slides: [
        {
          id: 1,
          image_url: '/images/slider-1.svg',
          badge: 'RESMI • TAHUN 2026',
          title: 'Pusat Ujian Resmi NAT-TEST Universitas Indonesia',
          subtitle: 'Ujian kemampuan bahasa Jepang standar internasional di Kampus UI Depok terakreditasi Tokyo.',
          btn_text: 'Daftar Ujian Sekarang',
          btn_link: '#jadwal',
          is_active: true
        },
        {
          id: 2,
          image_url: '/images/slider-2.svg',
          badge: 'LOKASI & FASILITAS STANDAR',
          title: 'Gedung Pusat Studi Jepang (PSJ) UI Depok',
          subtitle: 'Ruang ujian berpendingin udara, sound system listening akustik, dan akses 5 menit dari Stasiun KRL Pondok Cina.',
          btn_text: 'Cek Akses Lokasi',
          btn_link: '#lokasi',
          is_active: true
        },
        {
          id: 3,
          image_url: '/images/slider-3.svg',
          badge: 'STANDAR INTERNASIONAL MOJ',
          title: 'Sertifikasi Bahasa Jepang Diakui Imigrasi (MOJ)',
          subtitle: 'Syarat resmi pengajuan COE, visa studi bahasa (Ryugaku), visa kerja SSW Tokutei Ginou, dan beasiswa ke Jepang.',
          btn_text: 'Tentang NAT-TEST',
          btn_link: '/page/tentang-kami',
          is_active: true
        }
      ]
    };
    db.prepare(`
      INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('slider', 'Image Slider Halaman Depan (Maksimal 3 Gambar)', 'Banner slider promosi dan pengumuman visual di halaman depan', JSON.stringify(sliderData), new Date().toISOString(), 'System');
  }

  // 9C. Header Logo Settings (Ubah & Kurangi Logo Header)
  if (!getCms.get('header_logo')) {
    const headerLogoData = {
      logo_1: {
        enabled: true,
        url: '/images/logo-nat-test.svg',
        alt: 'NAT-TEST Official Logo',
        height: 48
      },
      logo_2: {
        enabled: true,
        url: '/images/logo-csgs-ui.svg',
        alt: 'UKK CSGS UI Logo',
        height: 48
      },
      show_divider: true,
      link_target: '/'
    };
    db.prepare(`
      INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('header_logo', 'Pengaturan Logo Header Website', 'Fasilitas mengubah dan mengurangi logo yang tampil di header', JSON.stringify(headerLogoData), new Date().toISOString(), 'System');
  }

  // 9D. Footer Settings & Text
  if (!getCms.get('footer')) {
    const footerData = {
      about_text: 'Penyelenggaraan resmi Ujian Standar Kemampuan Bahasa Jepang (NAT-TEST) Indonesia. Bekerjasama dengan Unit Kerja Khusus Center for Strategic and Global Studies (UKK CSGS) Universitas Indonesia di Pusat Studi Jepang Kampus UI Depok.',
      accreditation_text: 'Terakreditasi resmi untuk COE & Visa Studi ke Jepang oleh MOJ (Ministry of Justice Japan).',
      col2_title: 'Halaman Utama',
      col3_title: 'Informasi Resmi',
      col4_title: 'Sekretariat Pelaksana',
      contact_office: 'Gedung Pusat Studi Jepang (PSJ UI) Lt. 1, Kampus Universitas Indonesia, Depok, Jawa Barat 16424',
      contact_wa: '+62 812-8888-9999',
      contact_email: 'nattest@csgs-ui.ac.id',
      contact_hours: 'Senin - Jumat (08.30 - 16.00 WIB)',
      copyright_text: '© 2026 NAT-TEST Committee Japan & UKK CSGS Universitas Indonesia. All rights reserved.',
      logo_1: {
        enabled: true,
        url: '/images/logo-nat-test.svg',
        alt: 'NAT-TEST'
      },
      logo_2: {
        enabled: true,
        url: '/images/logo-csgs-ui.svg',
        alt: 'CSGS UI'
      },
      logo_3: {
        enabled: false,
        url: '',
        alt: ''
      }
    };
    db.prepare(`
      INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('footer', 'Pengaturan & Teks Footer Website', 'Informasi profil, kontak sekretariat, dan hak cipta di bagian bawah website', JSON.stringify(footerData), new Date().toISOString(), 'System');
  }

  // 9E. Website Font & Color Theme Settings
  if (!getCms.get('theme')) {
    const themeData = {
      preset: 'japan-red',
      font_family: 'Plus Jakarta Sans',
      font_url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap',
      primary_color: '#DC2626',
      primary_hover: '#B91C1C',
      primary_light: '#FEF2F2',
      primary_border: 'rgba(220, 38, 38, 0.25)',
      accent_color: '#D97706',
      dark_color: '#0F172A',
      radius_style: 'rounded-xl',
      enable_japanese_accents: true
    };
    db.prepare(`
      INSERT INTO cms_content (section_key, title, subtitle, content_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('theme', 'Pengaturan Font & Tema Warna (Color Theme)', 'Kustomisasi tipografi, skema warna, dan tampilan visual website', JSON.stringify(themeData), new Date().toISOString(), 'System');
  }

  // 10. Seed Default Static Pages
  const existingPagesCount = db.prepare('SELECT COUNT(*) as count FROM static_pages').get().count;
  if (existingPagesCount === 0) {
    const defaultPages = [
      {
        slug: 'tentang-kami',
        title: 'Tentang NAT-TEST & Kerjasama UKK CSGS Universitas Indonesia',
        subtitle: 'Standar Ujian Kemampuan Bahasa Jepang Resmi untuk Studi dan Karier Profesional di Jepang',
        summary: 'Mengenal profil NAT-TEST, standar sertifikasi internasional, dan peran Unit Kerja Khusus CSGS UI sebagai panitia pelaksana resmi di Indonesia.',
        content: `
          <div class="space-y-6">
            <p class="lead text-base text-slate-700 leading-relaxed font-medium">
              <strong>NAT-TEST (Nihongo Gakuryoku Test)</strong> adalah ujian standar internasional yang dirancang untuk mengukur dan menguji kemampuan bahasa Jepang bagi penutur non-asli. Ujian ini diselenggarakan secara resmi oleh <em>Senmon Kyouiku Publishing Co., Ltd. Tokyo, Jepang</em> dan diakui secara global.
            </p>

            <div class="p-5 rounded-2xl bg-red-50/70 border border-red-200 space-y-2">
              <h3 class="text-sm font-bold text-red-900 uppercase tracking-wider flex items-center gap-2">
                <span>🏛️</span> Kerjasama Resmi dengan Universitas Indonesia
              </h3>
              <p class="text-xs text-red-800 leading-relaxed">
                Di Indonesia, pelaksanaan ujian NAT-TEST diselenggarakan secara resmi bekerjasama dengan <strong>Unit Kerja Khusus Center for Strategic and Global Studies (UKK CSGS)</strong> Sekolah Kajian Stratejik dan Global Universitas Indonesia (SKSG UI). Seluruh kegiatan operasional, verifikasi peserta, hingga pelaksanaan ujian bertempat di Pusat Studi Jepang (PSJ), Kampus UI Depok.
              </p>
            </div>

            <h2 class="text-xl font-bold text-slate-900 pt-2">Pengakuan Internasional & Imigrasi Jepang</h2>
            <p class="text-sm text-slate-700 leading-relaxed">
              Sertifikat kelulusan NAT-TEST diakui secara resmi oleh <strong>Kementerian Kehakiman Jepang (Ministry of Justice / 出入国在留管理庁)</strong> sebagai bukti kemahiran bahasa Jepang yang setara dengan JLPT (Japanese Language Proficiency Test). Sertifikat ini dapat digunakan secara sah untuk:
            </p>
            <ul class="list-disc pl-6 space-y-2 text-sm text-slate-700">
              <li>Pengurusan <em>Certificate of Eligibility</em> (COE) visa pelajar (Ryugakusei).</li>
              <li>Persyaratan visa kerja keahlian spesifik <em>Tokutei Ginou (Specified Skilled Worker / SSW)</em> di Jepang.</li>
              <li>Persyaratan program magang teknis <em>Ginou Jisshuusei (Technical Intern Training)</em>.</li>
              <li>Standar seleksi penerimaan beasiswa dan rekrutmen perusahaan Jepang di Indonesia maupun di Jepang.</li>
            </ul>

            <h2 class="text-xl font-bold text-slate-900 pt-2">Tingkatan Level Ujian (1Q s.d. 5Q)</h2>
            <p class="text-sm text-slate-700 leading-relaxed">
              NAT-TEST memiliki lima tingkatan level yang berkorespondensi langsung dengan tingkatan JLPT:
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <span class="font-bold text-red-700">Level 5Q (Setara JLPT N5)</span>
                <p class="text-slate-600 mt-1">Tingkat dasar: Menguasai sekitar 800 kosakata dan 100 kanji dasar.</p>
              </div>
              <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <span class="font-bold text-red-700">Level 4Q (Setara JLPT N4)</span>
                <p class="text-slate-600 mt-1">Tingkat dasar lanjutan: Menguasai sekitar 1.500 kosakata dan 300 kanji.</p>
              </div>
              <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <span class="font-bold text-red-700">Level 3Q (Setara JLPT N3)</span>
                <p class="text-slate-600 mt-1">Tingkat menengah: Menguasai percakapan sehari-hari, 3.500 kosakata, dan 650 kanji.</p>
              </div>
              <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <span class="font-bold text-red-700">Level 2Q & 1Q (Setara JLPT N2 & N1)</span>
                <p class="text-slate-600 mt-1">Tingkat mahir & profesional: Kemampuan akademik dan bisnis tingkat tinggi di Jepang.</p>
              </div>
            </div>

            <h2 class="text-xl font-bold text-slate-900 pt-2">Jadwal Ujian yang Fleksibel (6x Setahun)</h2>
            <p class="text-sm text-slate-700 leading-relaxed">
              Berbeda dengan JLPT yang hanya diselenggarakan 2 kali dalam setahun, NAT-TEST diselenggarakan <strong>6 kali dalam setahun</strong> pada setiap bulan genap (Februari, April, Juni, Agustus, Oktober, dan Desember). Hal ini memberikan keleluasaan bagi para pembelajar untuk mengejar tenggat waktu pengajuan visa maupun beasiswa studi ke Jepang.
            </p>
          </div>
        `,
        meta_title: 'Tentang NAT-TEST & Kerjasama UKK CSGS UI',
        meta_description: 'Profil resmi NAT-TEST bekerjasama dengan UKK CSGS Universitas Indonesia.',
        is_published: 1
      },
      {
        slug: 'panduan-pendaftaran',
        title: 'Panduan Lengkap Pendaftaran Ujian NAT-TEST',
        subtitle: 'Petunjuk Langkah Demi Langkah dari Pembuatan Akun, Pembayaran, hingga Pencetakan Kartu Ujian',
        summary: 'Panduan komprehensif bagi calon peserta dalam menyelesaikan pendaftaran online, mengunggah berkas KTP & foto, verifikasi, dan mencetak kartu ujian.',
        content: `
          <div class="space-y-6">
            <p class="text-sm text-slate-700 leading-relaxed">
              Ikuti 6 langkah mudah berikut untuk menyelesaikan pendaftaran ujian NAT-TEST secara resmi:
            </p>

            <div class="space-y-4">
              <div class="p-4 rounded-2xl bg-white border border-slate-200 flex gap-4">
                <div class="w-8 h-8 rounded-full bg-red-600 text-white font-black text-sm flex items-center justify-center shrink-0">1</div>
                <div>
                  <h3 class="font-bold text-sm text-slate-900">Registrasi Akun Peserta</h3>
                  <p class="text-xs text-slate-600 mt-1">Buat akun baru menggunakan email aktif dan nomor WhatsApp yang dapat dihubungi. Pastikan nama lengkap sesuai dengan kartu identitas KTP/Paspor.</p>
                </div>
              </div>

              <div class="p-4 rounded-2xl bg-white border border-slate-200 flex gap-4">
                <div class="w-8 h-8 rounded-full bg-red-600 text-white font-black text-sm flex items-center justify-center shrink-0">2</div>
                <div>
                  <h3 class="font-bold text-sm text-slate-900">Pilih Gelombang Ujian & Level (5Q - 1Q)</h3>
                  <p class="text-xs text-slate-600 mt-1">Pilih periode gelombang yang sedang berstatus <strong>Buka</strong> dan level ujian yang sesuai dengan tingkat kemampuan atau kebutuhan sertifikasi Anda.</p>
                </div>
              </div>

              <div class="p-4 rounded-2xl bg-white border border-slate-200 flex gap-4">
                <div class="w-8 h-8 rounded-full bg-red-600 text-white font-black text-sm flex items-center justify-center shrink-0">3</div>
                <div>
                  <h3 class="font-bold text-sm text-slate-900">Isi Formulir Biodata & Unggah Dokumen (Maks. 2 MB)</h3>
                  <p class="text-xs text-slate-600 mt-1">Isi data identitas diri dengan teliti. Unggah foto scan KTP/Identitas dan Pasfoto resmi 3x4 berwarna dengan ukuran berkas <strong>maksimal 2 MB</strong>.</p>
                </div>
              </div>

              <div class="p-4 rounded-2xl bg-white border border-slate-200 flex gap-4">
                <div class="w-8 h-8 rounded-full bg-red-600 text-white font-black text-sm flex items-center justify-center shrink-0">4</div>
                <div>
                  <h3 class="font-bold text-sm text-slate-900">Pembayaran Biaya Ujian & Konfirmasi</h3>
                  <p class="text-xs text-slate-600 mt-1">Lakukan pembayaran ke rekening resmi Bank BNI Giro UKK CSGS UI atau Virtual Account yang tertera. Unggah bukti transfer pada dashboard Anda.</p>
                </div>
              </div>

              <div class="p-4 rounded-2xl bg-white border border-slate-200 flex gap-4">
                <div class="w-8 h-8 rounded-full bg-red-600 text-white font-black text-sm flex items-center justify-center shrink-0">5</div>
                <div>
                  <h3 class="font-bold text-sm text-slate-900">Verifikasi Panitia & Terbit Kartu Ujian</h3>
                  <p class="text-xs text-slate-600 mt-1">Panitia akan memverifikasi berkas dan pembayaran dalam waktu 1x24 jam kerja. Setelah status <strong>VERIFIED</strong>, Kartu Tanda Peserta Ujian akan langsung terbit.</p>
                </div>
              </div>

              <div class="p-4 rounded-2xl bg-white border border-slate-200 flex gap-4">
                <div class="w-8 h-8 rounded-full bg-red-600 text-white font-black text-sm flex items-center justify-center shrink-0">6</div>
                <div>
                  <h3 class="font-bold text-sm text-slate-900">Cetak Kartu Ujian & Hadir di PSJ UI Depok</h3>
                  <p class="text-xs text-slate-600 mt-1">Cetak kartu ujian fisik melalui fitur studio pencetakan dan bawa bersama KTP asli, pensil 2B, dan perlengkapan wajib pada hari H ujian.</p>
                </div>
              </div>
            </div>
          </div>
        `,
        meta_title: 'Panduan Pendaftaran NAT-TEST UI',
        meta_description: 'Cara dan alur pendaftaran ujian bahasa Jepang NAT-TEST di Universitas Indonesia.',
        is_published: 1
      },
      {
        slug: 'syarat-ketentuan',
        title: 'Syarat, Ketentuan & Tata Tertib Peserta Ujian',
        subtitle: 'Peraturan Resmi Pelaksanaan Ujian NAT-TEST di Kampus Universitas Indonesia Depok',
        summary: 'Ketentuan umum kepesertaan, aturan berpakaian, perlengkapan ujian wajib, larangan, serta kebijakan pembatalan dan diskualifikasi.',
        content: `
          <div class="space-y-6">
            <h2 class="text-xl font-bold text-slate-900">1. Ketentuan Umum Kepesertaan</h2>
            <ul class="list-disc pl-6 space-y-1.5 text-sm text-slate-700">
              <li>Terbuka untuk umum (Warga Negara Indonesia maupun WNA) tanpa batasan usia minimal.</li>
              <li>Data diri yang diisikan harus sesuai dengan kartu identitas resmi yang masih berlaku (KTP / Paspor / Kartu Pelajar).</li>
              <li>Peserta hanya diperkenankan mendaftar pada satu level dalam gelombang yang sama.</li>
            </ul>

            <h2 class="text-xl font-bold text-slate-900 pt-2">2. Tata Tertib Waktu & Kehadiran</h2>
            <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <span class="font-bold">⚠️ Perhatian Mengenai Keterlambatan:</span>
              <p>Peserta wajib hadir di lokasi ujian selambat-lambatnya 45 menit sebelum ujian dimulai. Pintu ruang ujian ditutup tepat 15 menit sebelum ujian dimulai. Peserta yang terlambat <strong>tidak diizinkan masuk dan dinyatakan gugur</strong>.</p>
            </div>

            <h2 class="text-xl font-bold text-slate-900 pt-2">3. Aturan Berpakaian (Dress Code)</h2>
            <ul class="list-disc pl-6 space-y-1.5 text-sm text-slate-700">
              <li>Pakaian rapi, sopan, dan berkerah (Kemeja, Polo Shirt berkerah, atau batik).</li>
              <li>Bawahan celana bahan panjang atau rok panjang sopan di bawah lutut.</li>
              <li>Wajib memakai sepatu tertutup (sneakers, pantofel).</li>
              <li><strong>Dilarang keras:</strong> Kaos oblong tanpa kerah, celana pendek, sandal jepit, dan topi/kacamata hitam di dalam ruangan.</li>
            </ul>

            <h2 class="text-xl font-bold text-slate-900 pt-2">4. Perlengkapan Alat Tulis Wajib & Terlarang</h2>
            <ul class="list-disc pl-6 space-y-1.5 text-sm text-slate-700">
              <li><strong>Wajib:</strong> Pensil 2B Asli khusus lembar jawaban komputer (LJK) dan penghapus khusus 2B.</li>
              <li><strong>Dilarang:</strong> Pensil mekanik, pulpen, correction pen (tipp-ex), dan kalkulator.</li>
              <li><strong>Barang terlarang di meja ujian:</strong> Handphone, smartwatch, earphone, kamus elektronik, serta catatan dalam bentuk apapun. Seluruh perangkat elektronik wajib dimatikan dan dimasukkan ke dalam tas di depan kelas.</li>
            </ul>

            <h2 class="text-xl font-bold text-slate-900 pt-2">5. Kebijakan Pembatalan & Pengembalian Dana</h2>
            <p class="text-sm text-slate-700 leading-relaxed">
              Biaya ujian yang telah disetorkan tidak dapat dikembalikan <em>(non-refundable)</em> dan tidak dapat dialihkan ke gelombang lain atau orang lain dengan alasan apapun, kecuali pelaksanaan ujian dibatalkan secara sepihak oleh panitia penyelenggara karena keadaan kahar <em>(force majeure)</em>.
            </p>
          </div>
        `,
        meta_title: 'Syarat & Ketentuan Ujian NAT-TEST UI',
        meta_description: 'Tata tertib resmi dan ketentuan peserta ujian NAT-TEST Universitas Indonesia.',
        is_published: 1
      },
      {
        slug: 'kebijakan-privasi',
        title: 'Kebijakan Privasi & Perlindungan Data Peserta',
        subtitle: 'Komitmen Keamanan dan Kerahasiaan Data Pribadi Berdasarkan Undang-Undang Perlindungan Data Pribadi (UU PDP)',
        summary: 'Kebijakan perlindungan data identitas, NIK, dan dokumen peserta NAT-TEST oleh Unit Kerja Khusus CSGS Universitas Indonesia.',
        content: `
          <div class="space-y-6">
            <p class="text-sm text-slate-700 leading-relaxed">
              Unit Kerja Khusus Center for Strategic and Global Studies (UKK CSGS) Universitas Indonesia selaku panitia pelaksana resmi NAT-TEST di Indonesia berkomitmen penuh untuk melindungi privasi dan keamanan data pribadi setiap pendaftar sesuai dengan <strong>Undang-Undang Nomor 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP)</strong>.
            </p>

            <h2 class="text-xl font-bold text-slate-900">1. Data Pribadi yang Kami Kumpulkan</h2>
            <ul class="list-disc pl-6 space-y-1.5 text-sm text-slate-700">
              <li>Data Identitas: Nama lengkap, Nomor Induk Kependudukan (NIK) / No. Paspor, tempat dan tanggal lahir, jenis kelamin.</li>
              <li>Data Kontak: Alamat email aktif, nomor telepon/WhatsApp, dan alamat domisili.</li>
              <li>Dokumen Digital: Foto scan KTP/Identitas, pasfoto resmi ukuran 3x4, dan bukti konfirmasi pembayaran.</li>
              <li>Data Akademik: Riwayat pembelajaran bahasa Jepang, institusi asal, nomor peserta, dan hasil penilaian ujian.</li>
            </ul>

            <h2 class="text-xl font-bold text-slate-900 pt-2">2. Tujuan Penggunaan Data</h2>
            <p class="text-sm text-slate-700 leading-relaxed">
              Data pribadi peserta hanya digunakan untuk kepentingan sah berikut:
            </p>
            <ul class="list-disc pl-6 space-y-1.5 text-sm text-slate-700">
              <li>Pendaftaran resmi dan verifikasi kepesertaan ujian NAT-TEST.</li>
              <li>Pencetakan Kartu Tanda Peserta Ujian resmi dengan barcode/QR identifikasi.</li>
              <li>Pencetakan sertifikat kelulusan dan transkrip nilai resmi oleh Komite Pusat NAT-TEST di Tokyo, Jepang.</li>
              <li>Verifikasi keabsahan sertifikat kepada pihak Imigrasi Jepang atau institusi penerima yang berwenang jika diminta secara resmi.</li>
            </ul>

            <h2 class="text-xl font-bold text-slate-900 pt-2">3. Kerahasiaan & Keamanan Data</h2>
            <p class="text-sm text-slate-700 leading-relaxed">
              Kami menerapkan standar keamanan teknis dan organisasi yang ketat untuk mencegah akses tanpa izin, kebocoran, atau manipulasi data. Kami <strong>tidak akan pernah menjual, menyewakan, atau membagikan</strong> data pribadi Anda kepada pihak ketiga manapun untuk tujuan pemasaran komersial.
            </p>
          </div>
        `,
        meta_title: 'Kebijakan Privasi NAT-TEST UI',
        meta_description: 'Kebijakan perlindungan data pribadi peserta NAT-TEST oleh UKK CSGS UI.',
        is_published: 1
      },
      {
        slug: 'kontak-layanan',
        title: 'Kontak Resmi & Layanan Sekretariat NAT-TEST UI',
        subtitle: 'Alamat Kantor Sekretariat, Jam Operasional, dan Pusat Bantuan Peserta',
        summary: 'Informasi narahubung resmi panitia pelaksana NAT-TEST UKK CSGS UI di Kampus UI Depok.',
        content: `
          <div class="space-y-6">
            <p class="text-sm text-slate-700 leading-relaxed">
              Sekretariat NAT-TEST UKK CSGS Universitas Indonesia siap membantu Anda terkait informasi pendaftaran, konfirmasi pembayaran, serta pengambilan sertifikat ujian.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
                <span class="text-xl">📍</span>
                <h3 class="font-bold text-sm text-slate-900">Alamat Kantor Sekretariat</h3>
                <p class="text-xs text-slate-600 leading-relaxed">
                  Gedung Pusat Studi Jepang (PSJ) Lantai 1<br>
                  Kampus Universitas Indonesia, Depok<br>
                  Jawa Barat, 16424 - Indonesia
                </p>
              </div>

              <div class="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
                <span class="text-xl">⏰</span>
                <h3 class="font-bold text-sm text-slate-900">Jam Layanan Operasional</h3>
                <p class="text-xs text-slate-600 leading-relaxed">
                  Senin - Jumat: 08.30 - 16.00 WIB<br>
                  Sabtu, Minggu & Hari Libur Nasional: Tutup<br>
                  <em>(Khusus hari pelaksanaan ujian: Buka pukul 07.00 - 17.00 WIB)</em>
                </p>
              </div>

              <div class="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
                <span class="text-xl">💬</span>
                <h3 class="font-bold text-sm text-slate-900">WhatsApp Helpdesk</h3>
                <p class="text-xs text-slate-600 leading-relaxed">
                  Hotline 1: <strong>+62 812-8888-9999</strong><br>
                  Hotline 2: <strong>+62 813-1234-5678</strong><br>
                  <em>(Hanya melayani pesan chat pada jam kerja)</em>
                </p>
              </div>

              <div class="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
                <span class="text-xl">✉️</span>
                <h3 class="font-bold text-sm text-slate-900">Email & Media Sosial</h3>
                <p class="text-xs text-slate-600 leading-relaxed">
                  Email: <strong>nattest.csgs@ui.ac.id</strong><br>
                  Web: <strong>csgs.ui.ac.id</strong><br>
                  Instagram: <strong>@nattest_ui</strong>
                </p>
              </div>
            </div>
          </div>
        `,
        meta_title: 'Kontak Resmi NAT-TEST UI',
        meta_description: 'Informasi kontak, alamat, dan helpdesk sekretariat NAT-TEST UKK CSGS UI.',
        is_published: 1
      }
    ];

    const insertPage = db.prepare(`
      INSERT INTO static_pages (slug, title, subtitle, summary, content, meta_title, meta_description, is_published, view_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const now = new Date().toISOString();
    for (const p of defaultPages) {
      insertPage.run(p.slug, p.title, p.subtitle, p.summary, p.content, p.meta_title, p.meta_description, p.is_published, now, now);
    }
    console.log('✔ Default Static Pages seeded successfully (5 pages).');
  }

  // 11. Seed Default System Settings
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM system_settings').get().count;
  if (settingsCount === 0) {
    const defaultSettings = [
      { key: 'app_name', val: 'Ujian Standar Kemampuan Bahasa Jepang NAT-TEST', cat: 'general', desc: 'Nama resmi aplikasi web' },
      { key: 'organizer_name', val: 'Unit Kerja Khusus Center for Strategic and Global Studies (UKK CSGS) Universitas Indonesia', cat: 'general', desc: 'Penyelenggara resmi di Indonesia' },
      { key: 'exam_venue', val: 'Gedung Pusat Studi Jepang (PSJ), Kampus UI Depok, Jawa Barat 16424', cat: 'general', desc: 'Lokasi resmi pelaksanaan ujian' },
      { key: 'contact_email', val: 'nattest.csgs@ui.ac.id', cat: 'contact', desc: 'Email resmi sekretariat NAT-TEST UI' },
      { key: 'contact_whatsapp', val: '+62 812-8888-9999', cat: 'contact', desc: 'Hotline WhatsApp resmi bantuan peserta' },
      { key: 'contact_hours', val: 'Senin - Jumat (08.30 - 16.00 WIB)', cat: 'contact', desc: 'Jam operasional layanan sekretariat' },
      { key: 'default_exam_fee', val: '500000', cat: 'payment', desc: 'Biaya ujian standar per peserta (Rupiah)' },
      { key: 'bank_name', val: 'Bank BNI (Bank Negara Indonesia)', cat: 'payment', desc: 'Nama bank penerima pembayaran resmi' },
      { key: 'bank_account_number', val: '988-0033-2026-0001', cat: 'payment', desc: 'Nomor rekening Giro resmi CSGS UI' },
      { key: 'bank_account_holder', val: 'UKK CSGS Universitas Indonesia - NAT-TEST', cat: 'payment', desc: 'Nama pemilik rekening resmi' },
      { key: 'current_wave', val: 'Gelombang 3 - Juni 2026', cat: 'exam', desc: 'Gelombang ujian yang sedang aktif dibuka' },
      { key: 'max_quota_per_wave', val: '350', cat: 'exam', desc: 'Batas kuota maksimal peserta per gelombang' },
      { key: 'registration_status', val: 'OPEN', cat: 'exam', desc: 'Status pendaftaran: OPEN (Buka), CLOSED (Tutup), MAINTENANCE (Pemeliharaan)' },
      { key: 'max_upload_size_mb', val: '2', cat: 'system', desc: 'Batas maksimal ukuran berkas upload KTP dan Pasfoto (MB)' },
      { key: 'auto_issue_card_on_verify', val: 'true', cat: 'system', desc: 'Otomatis terbitkan kartu ujian fisik saat diverifikasi' },
      { key: 'qris_enabled', val: 'true', cat: 'payment_qris', desc: 'Status aktivasi penerimaan pembayaran via QRIS' },
      { key: 'qris_merchant_name', val: 'NAT-TEST UKK CSGS UNIVERSITAS INDONESIA', cat: 'payment_qris', desc: 'Nama resmi merchant QRIS terdaftar di Bank Indonesia & ASPI' },
      { key: 'qris_nmid', val: 'ID1020261012345', cat: 'payment_qris', desc: 'National Merchant ID (NMID) QRIS' },
      { key: 'qris_image_url', val: '/images/qris-nat-test.svg', cat: 'payment_qris', desc: 'Path atau URL gambar barcode QRIS' },
      { key: 'qris_instructions', val: 'Buka aplikasi e-wallet (GoPay, OVO, DANA, ShopeePay) atau m-Banking (BCA, Mandiri, BNI, BRI), pilih menu Bayar/Scan QRIS, lalu arahkan kamera ke barcode QRIS resmi di atas.', cat: 'payment_qris', desc: 'Instruksi dan petunjuk pembayaran via QRIS bagi calon peserta' }
    ];

    const insertSetting = db.prepare(`
      INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const s of defaultSettings) {
      insertSetting.run(s.key, s.val, s.cat, s.desc, now);
    }
    console.log('✔ Default System Settings seeded successfully.');
  }

  // Ensure QRIS settings exist even if system_settings was previously initialized
  const qrisDefaults = [
    { key: 'qris_enabled', val: 'true', cat: 'payment_qris', desc: 'Status aktivasi penerimaan pembayaran via QRIS' },
    { key: 'qris_merchant_name', val: 'NAT-TEST UKK CSGS UNIVERSITAS INDONESIA', cat: 'payment_qris', desc: 'Nama resmi merchant QRIS terdaftar di Bank Indonesia & ASPI' },
    { key: 'qris_nmid', val: 'ID1020261012345', cat: 'payment_qris', desc: 'National Merchant ID (NMID) QRIS' },
    { key: 'qris_image_url', val: '/images/qris-nat-test.svg', cat: 'payment_qris', desc: 'Path atau URL gambar barcode QRIS' },
    { key: 'qris_instructions', val: 'Buka aplikasi e-wallet (GoPay, OVO, DANA, ShopeePay) atau m-Banking (BCA, Mandiri, BNI, BRI), pilih menu Bayar/Scan QRIS, lalu arahkan kamera ke barcode QRIS resmi di atas.', cat: 'payment_qris', desc: 'Instruksi dan petunjuk pembayaran via QRIS bagi calon peserta' }
  ];
  const checkSettingStmt = db.prepare('SELECT setting_key FROM system_settings WHERE setting_key = ?');
  const insertSingleSettingStmt = db.prepare('INSERT INTO system_settings (setting_key, setting_value, category, description, updated_at) VALUES (?, ?, ?, ?, ?)');
  // Ensure Virtual Account settings (BNI46, Mandiri, BRI) exist even if system_settings was previously initialized
  const vaDefaults = [
    { key: 'va_bni_enabled', val: 'true', cat: 'payment_va', desc: 'Status aktivasi saluran Virtual Account BNI46' },
    { key: 'va_bni_prefix', val: '9880033', cat: 'payment_va', desc: 'Prefix institusi Virtual Account BNI46 (988 + Kode CSGS UI 0033)' },
    { key: 'va_bni_merchant_name', val: 'NAT CSGS UI', cat: 'payment_va', desc: 'Nama Merchant / Biller Virtual Account BNI46' },
    { key: 'va_mandiri_enabled', val: 'true', cat: 'payment_va', desc: 'Status aktivasi saluran Virtual Account Bank Mandiri' },
    { key: 'va_mandiri_prefix', val: '88708', cat: 'payment_va', desc: 'Kode Perusahaan Mandiri Bill Payment CSGS UI' },
    { key: 'va_mandiri_merchant_name', val: 'NAT CSGS UI', cat: 'payment_va', desc: 'Nama Biller Mandiri Bill Payment' },
    { key: 'va_bri_enabled', val: 'true', cat: 'payment_va', desc: 'Status aktivasi saluran BRIVA (Virtual Account BRI)' },
    { key: 'va_bri_prefix', val: '12800', cat: 'payment_va', desc: 'Kode Institusi BRIVA CSGS Universitas Indonesia' },
    { key: 'va_bri_merchant_name', val: 'BRIVA NAT CSGS UI', cat: 'payment_va', desc: 'Nama Institusi Pembayaran BRIVA' }
  ];
  for (const v of vaDefaults) {
    if (!checkSettingStmt.get(v.key)) {
      insertSingleSettingStmt.run(v.key, v.val, v.cat, v.desc, new Date().toISOString());
    }
  }

  console.log('✔ CMS default content initialized.');
}

module.exports = {
  db,
  DB_PATH,
  hashPassword,
  verifyPassword,
  initDatabase
};
