// test_suite.js - Comprehensive Verification Test Suite
const http = require('node:http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);

    if (options.body) {
      const payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING NAT-TEST SYSTEM TESTS ---');
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  // 1. Landing page check
  const home = await request('/');
  assert(home.status === 200 && typeof home.body === 'string' && home.body.includes('NAT-TEST'), 'Landing page loads with HTTP 200');
  assert(home.body.includes('logo-nat-test.svg') && home.body.includes('logo-csgs-ui.svg'), 'Both NAT-TEST and UKK CSGS UI logos exist');
  assert(home.body.includes('Portal Pengelola'), 'Hidden admin portal link exists in footer');

  // 2. CMS API check
  const cms = await request('/api/cms');
  assert(cms.status === 200 && cms.body.success === true, 'GET /api/cms returns success');
  assert(cms.body.cms.hero && cms.body.cms.schedule && cms.body.cms.location && cms.body.cms.dresscode && cms.body.cms.stationery && cms.body.cms.payment, 'All required CMS sections exist in database');

  // 3. User Login
  const userLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'budi.santoso@gmail.com', password: 'peserta123' }
  });
  assert(userLogin.status === 200 && userLogin.body.user.role === 'PESERTA', 'Demo peserta can login successfully');
  const userToken = userLogin.body.token;

  // 4. Admin Login
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'admin@csgs-ui.ac.id', password: 'admin123', required_role: 'ADMIN' }
  });
  assert(adminLogin.status === 200 && adminLogin.body.user.role === 'ADMIN', 'Admin can login to admin portal');
  const adminToken = adminLogin.body.token;

  // 5. Regular user trying to login as admin portal should be blocked
  const userFakeAdmin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'budi.santoso@gmail.com', password: 'peserta123', required_role: 'ADMIN' }
  });
  assert(userFakeAdmin.status === 403, 'Regular peserta is strictly blocked from Admin portal');

  // 6. Test Prevention of 1970-01-01 Birth Date bug
  const invalidDateReg = await request('/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: {
      exam_period: 'Gelombang 3 - Juni 2026',
      exam_level: '4Q',
      full_name: 'Budi Santoso',
      nik_ktp: '3171012508990001',
      birth_place: 'Jakarta',
      birth_date: '1970-01-01', // BUG TEST: epoch fallback
      phone: '081234567890'
    }
  });
  assert(invalidDateReg.status === 400 && invalidDateReg.body.message.includes('1970'), 'System strictly rejects invalid 1970-01-01 birth date');

  // 7. Test Valid Registration with NIK, Postal Code, Certificate Delivery Address, and Institution
  const validReg = await request('/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: {
      exam_period: 'Gelombang 3 - Juni 2026',
      exam_level: '3Q',
      full_name: 'Budi Santoso',
      nik_ktp: '3171012508990001',
      birth_place: 'Jakarta',
      birth_date: '2001-08-25',
      phone: '081234567890',
      address: 'Jl. Margonda Raya No. 45, Beji, Depok',
      postal_code: '16424',
      certificate_delivery_address: 'Jl. Margonda Raya No. 45, Beji, Depok (Gedung FIB UI)',
      certificate_postal_code: '16424',
      institution: 'Universitas Indonesia'
    }
  });
  assert(validReg.status === 201 && validReg.body.registration_number.startsWith('NAT-2026-3Q-'), 'Valid registration succeeds with unique registration number, NIK, postal code, certificate address, and institution');

  // 7B. Test Registration With Institution Photo
  const regWithInst = await request('/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: {
      exam_period: 'Gelombang 3 - Juni 2026',
      exam_level: '5Q',
      full_name: 'Dewi Lestari',
      nik_ktp: '3276015505000002',
      birth_place: 'Bandung',
      birth_date: '2000-05-12',
      phone: '081298765432',
      address: 'Jl. Dago No. 10, Bandung',
      postal_code: '40135',
      certificate_delivery_address: 'Jl. Dago No. 10, Bandung',
      certificate_postal_code: '40135',
      institution: 'Institut Teknologi Bandung',
      photo_institution_path: '/uploads/institusi_sample.jpg'
    }
  });
  assert(regWithInst.status === 201 && regWithInst.body.registration_number.startsWith('NAT-2026-5Q-'), 'Registration with full NIK, delivery address, and institution photo succeeds properly');

  // 8. Test 2MB Max File Upload Validation
  // Create a simulated payload > 2.1 MB
  const largeBuffer = Buffer.alloc(2.2 * 1024 * 1024, 'a');
  const largeBase64 = `data:image/jpeg;base64,${largeBuffer.toString('base64')}`;

  const oversizedUpload = await request('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: {
      dataUrl: largeBase64,
      filename: 'ktp-terlalu-besar.jpg',
      category: 'ktp'
    }
  });
  assert(oversizedUpload.status === 400 && oversizedUpload.body.message.includes('2 MB'), 'Upload > 2MB is strictly rejected by server');

  // Test valid upload (< 2MB)
  const smallBuffer = Buffer.from('RIFF....WEBPVP8.....test-image-content');
  const smallBase64 = `data:image/jpeg;base64,${smallBuffer.toString('base64')}`;

  const validUpload = await request('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: {
      dataUrl: smallBase64,
      filename: 'ktp-valid.jpg',
      category: 'ktp'
    }
  });
  assert(validUpload.status === 200 && validUpload.body.fileUrl.startsWith('/uploads/'), 'Upload < 2MB succeeds and returns URL');

  // 9. Test Role Management (Admin only)
  const usersList = await request('/api/admin/users', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(usersList.status === 200 && Array.isArray(usersList.body.users), 'Admin can view user list');

  // Add new Verifikator
  const testEmail = `verifikator_${Date.now()}@csgs-ui.ac.id`;
  const createUser = await request('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: {
      name: 'Petugas Verifikasi UI',
      email: testEmail,
      password: 'password123',
      role: 'VERIFIKATOR',
      phone: '081299991111'
    }
  });
  assert(createUser.status === 201 && createUser.body.success === true, 'Admin can create user with specific role (VERIFIKATOR)');

  // Change role of newly created user to ADMIN
  const changeRole = await request(`/api/admin/users/${createUser.body.userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: { role: 'ADMIN', status: 'ACTIVE' }
  });
  assert(changeRole.status === 200, 'Admin can update user role dynamically');

  // 10. Test CMS Update Live Reflection
  const currentHero = cms.body.cms.hero.data;
  currentHero.announcement_bar = '📢 PENGUMUMAN TERBARU: Pendaftaran Gelombang 3 Resmi Diperpanjang!';

  const updateCms = await request('/api/cms/hero', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: {
      title: 'Pengaturan Hero & Banner Depan',
      data: currentHero
    }
  });
  assert(updateCms.status === 200, 'Admin can update CMS section content');

  // Verify reflection
  const updatedCmsCheck = await request('/api/cms');
  assert(updatedCmsCheck.body.cms.hero.data.announcement_bar.includes('Resmi Diperpanjang'), 'Updated CMS content is immediately live in GET /api/cms');

  // 11. Test Fasilitas Ubah Password
  const changePass = await request('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: {
      old_password: 'peserta123',
      new_password: 'pesertaBaru456',
      confirm_password: 'pesertaBaru456'
    }
  });
  assert(changePass.status === 200 && changePass.body.success === true, 'Change password facility works properly');

  // Revert password back so demo stays working
  await request('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: {
      old_password: 'pesertaBaru456',
      new_password: 'peserta123',
      confirm_password: 'peserta123'
    }
  });

  // 12. Test Fasilitas Manajemen Main Menu Header (Tambah, Ubah, Kurang/Hapus)
  const navCheck = await request('/api/cms');
  assert(navCheck.body.cms.navigation && Array.isArray(navCheck.body.cms.navigation.data.menus), 'Header navigation menus exist in CMS');
  
  const originalMenus = navCheck.body.cms.navigation.data.menus;
  const newCustomMenu = { id: 999, label: 'Panduan Ujian & Sertifikat', url: '/panduan.html', target: '_blank', is_active: true };
  const updatedMenuList = [...originalMenus, newCustomMenu];

  // Admin updates navigation menu with added item
  const updateNavRes = await request('/api/cms/navigation', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: {
      title: 'Pengaturan Menu Navigasi Header',
      subtitle: 'Daftar menu navigasi utama di header website',
      data: { menus: updatedMenuList }
    }
  });
  assert(updateNavRes.status === 200, 'Admin can add and update header navigation menus');

  // Verify reflection in CMS API
  const navVerification = await request('/api/cms');
  const hasNewMenu = navVerification.body.cms.navigation.data.menus.some(m => m.label === 'Panduan Ujian & Sertifikat');
  assert(hasNewMenu, 'Added navigation menu is immediately reflected in GET /api/cms');

  // Test reducing/deleting menu item
  const reducedMenuList = originalMenus.filter(m => m.url !== '#faq');
  const deleteNavRes = await request('/api/cms/navigation', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: {
      title: 'Pengaturan Menu Navigasi Header',
      subtitle: 'Daftar menu navigasi utama di header website',
      data: { menus: reducedMenuList }
    }
  });
  assert(deleteNavRes.status === 200, 'Admin can reduce/delete navigation menu item');

  // Test reordering menu items (e.g. moving last item to first position)
  const reorderedMenus = [
    originalMenus[originalMenus.length - 1],
    ...originalMenus.slice(0, originalMenus.length - 1)
  ];
  const reorderNavRes = await request('/api/cms/navigation', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: {
      title: 'Pengaturan Menu Navigasi Header',
      subtitle: 'Daftar menu navigasi utama di header website',
      data: { menus: reorderedMenus }
    }
  });
  assert(reorderNavRes.status === 200, 'Admin can reorder header navigation menu positions');

  // Verify reordered reflection
  const reorderVerify = await request('/api/cms');
  assert(
    reorderVerify.body.cms.navigation.data.menus[0].label === originalMenus[originalMenus.length - 1].label,
    'Reordered menu sequence is immediately reflected in GET /api/cms'
  );

  // Restore original menu list
  await request('/api/cms/navigation', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: {
      title: 'Pengaturan Menu Navigasi Header',
      subtitle: 'Daftar menu navigasi utama di header website',
      data: { menus: originalMenus }
    }
  });

  // 13. Test Fasilitas Halaman Statik (Official Static Pages)
  const publicPages = await request('/api/pages');
  assert(publicPages.status === 200 && Array.isArray(publicPages.body.pages) && publicPages.body.pages.length >= 5, 'Public can view published static pages list');

  const pageRouteCheck = await request('/page/tentang-kami');
  assert(pageRouteCheck.status === 200 && typeof pageRouteCheck.body === 'string' && pageRouteCheck.body.includes('page.js'), 'Static page URL route (/page/:slug) serves page.html with HTTP 200');

  const singlePage = await request('/api/pages/tentang-kami');
  assert(singlePage.status === 200 && singlePage.body.page && singlePage.body.page.title.includes('NAT-TEST'), 'Public can view single static page details by slug');

  // Admin access to static pages
  const adminPagesList = await request('/api/admin/pages', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminPagesList.status === 200 && Array.isArray(adminPagesList.body.pages), 'Admin can view all static pages list');

  // Peserta blocked from creating static page
  const userBlockedPage = await request('/api/admin/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: { title: 'Halaman Terlarang', content: 'Konten' }
  });
  assert(userBlockedPage.status === 403, 'Regular peserta is strictly blocked from creating static pages');

  // Admin creates new static page
  const createPageRes = await request('/api/admin/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: {
      title: 'Panduan Sertifikat & Transkrip Nilai',
      slug: 'panduan-sertifikat',
      subtitle: 'Informasi pengiriman sertifikat resmi dari Tokyo',
      summary: 'Penjelasan tata cara penerbitan sertifikat kelulusan.',
      content: '<h2>Penerbitan Sertifikat</h2><p>Sertifikat dikirimkan langsung dari Senmon Kyouiku Publishing Tokyo.</p>',
      is_published: 1
    }
  });
  assert(createPageRes.status === 201 && createPageRes.body.slug === 'panduan-sertifikat', 'Admin can create new static page');
  const newPageId = createPageRes.body.pageId;

  // Admin updates static page
  const updatePageRes = await request(`/api/admin/pages/${newPageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: {
      title: 'Panduan Sertifikat & Transkrip Nilai Resmi',
      summary: 'Ringkasan yang diperbarui'
    }
  });
  assert(updatePageRes.status === 200, 'Admin can update static page');

  // Admin deletes static page
  const deletePageRes = await request(`/api/admin/pages/${newPageId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(deletePageRes.status === 200, 'Admin can delete static page');

  // --- 11. System Settings Tests ---
  const userBlockedSettings = await request('/api/admin/settings', {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  assert(userBlockedSettings.status === 403, 'Regular peserta is strictly blocked from settings API');

  const adminGetSettings = await request('/api/admin/settings', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminGetSettings.status === 200 && adminGetSettings.body.settings.app_name !== undefined, 'Admin can read system settings');
  assert(adminGetSettings.body.settings.bank_name && adminGetSettings.body.settings.current_wave, 'System settings contain bank and wave configurations');

  const adminUpdateSettings = await request('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: {
      settings: {
        max_quota_per_wave: 400,
        bank_name: 'Bank BNI Syariah UI'
      }
    }
  });
  assert(adminUpdateSettings.status === 200 && adminUpdateSettings.body.success === true, 'Admin can update system settings');

  // Verify settings persisted
  const verifySettings = await request('/api/admin/settings', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(verifySettings.body.settings.max_quota_per_wave === '400', 'Updated system setting persisted in SQLite');

  // QRIS Payment Settings Test
  const publicSettingsRes = await request('/api/settings');
  assert(publicSettingsRes.status === 200 && publicSettingsRes.body.settings.qris_enabled !== undefined, 'Public GET /api/settings returns active QRIS settings');
  assert(publicSettingsRes.body.settings.qris_merchant_name && publicSettingsRes.body.settings.qris_nmid, 'Public QRIS settings contain merchant name and NMID');

  const adminUpdateQris = await request('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: {
      settings: {
        qris_merchant_name: 'NAT-TEST CSGS UNIVERSITAS INDONESIA RESMI',
        qris_nmid: 'ID1020261012999'
      }
    }
  });
  assert(adminUpdateQris.status === 200, 'Admin can update QRIS payment settings');

  const qrisSvgRes = await request('/images/qris-nat-test.svg');
  assert(qrisSvgRes.status === 200 && typeof qrisSvgRes.body === 'string' && qrisSvgRes.body.includes('QRIS'), 'QRIS SVG graphic asset exists and serves with HTTP 200');

  // Verify Pagination UI Elements in Admin Dashboard
  const adminDashboardHtml = await request('/admin/dashboard');
  assert(adminDashboardHtml.status === 200 && adminDashboardHtml.body.includes('id="reg-pagination-controls"') && adminDashboardHtml.body.includes('id="filter-reg-pagesize"'), 'Admin Dashboard contains registration paging controls and page size selector');
  assert(adminDashboardHtml.body.includes('id="user-pagination-controls"') && adminDashboardHtml.body.includes('id="filter-user-pagesize"'), 'Admin Dashboard contains user management paging controls and page size selector');

  // --- 12. Backup Center & Database Info Tests ---
  const userBlockedBackup = await request('/api/admin/backup/info', {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  assert(userBlockedBackup.status === 403, 'Regular peserta is strictly blocked from backup info API');

  const adminBackupInfo = await request('/api/admin/backup/info', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminBackupInfo.status === 200 && adminBackupInfo.body.info?.dbSize !== undefined, 'Admin can view database backup statistics & file size');
  assert(adminBackupInfo.body.info?.tableStats?.registrations !== undefined, 'Backup info includes table record counters');

  const adminJsonBackup = await request('/api/admin/backup/json', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminJsonBackup.status === 200 && adminJsonBackup.body.data && Array.isArray(adminJsonBackup.body.data.registrations), 'Admin can download structured JSON database export');

  const adminDbBackup = await request('/api/admin/backup/db', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminDbBackup.status === 200 && adminDbBackup.headers['content-disposition']?.includes('.db'), 'Admin can download raw SQLite binary database (.db)');

  const adminVacuum = await request('/api/admin/backup/vacuum', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminVacuum.status === 200 && adminVacuum.body.success === true, 'Admin can execute database VACUUM optimization');

  // --- 13. Transaction Reports (Harian & Bulanan) Tests ---
  const userBlockedDailyReport = await request('/api/admin/reports/daily?date=2026-10-12', {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  assert(userBlockedDailyReport.status === 403, 'Regular peserta is strictly blocked from daily report API');

  const todayStr = new Date().toISOString().slice(0, 10);
  const adminDailyReport = await request(`/api/admin/reports/daily?date=${todayStr}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminDailyReport.status === 200 && adminDailyReport.body.report_type === 'daily', 'Admin can fetch daily transaction report');
  assert(adminDailyReport.body.summary && adminDailyReport.body.summary.totalRegistrations !== undefined, 'Daily report includes summary metrics');
  assert(adminDailyReport.body.levelCounts !== undefined && adminDailyReport.body.methodCounts !== undefined, 'Daily report includes level and payment method breakdowns');

  const adminMonthlyReport = await request('/api/admin/reports/monthly?year=2026&month=10', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminMonthlyReport.status === 200 && adminMonthlyReport.body.report_type === 'monthly', 'Admin can fetch monthly transaction report');
  assert(Array.isArray(adminMonthlyReport.body.dailyBreakdown) && adminMonthlyReport.body.dailyBreakdown.length > 25, 'Monthly report includes full month daily trend breakdown');
  assert(adminMonthlyReport.body.summary.avgDaily !== undefined && adminMonthlyReport.body.summary.verificationRate !== undefined, 'Monthly report includes avg daily and verification rate');

  const adminExportCsvDaily = await request(`/api/admin/reports/export?type=daily&date=${todayStr}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminExportCsvDaily.status === 200 && typeof adminExportCsvDaily.body === 'string' && adminExportCsvDaily.body.includes('No. Registrasi'), 'Admin can export daily report as CSV with standard columns');

  const adminExportCsvMonthly = await request('/api/admin/reports/export?type=monthly&year=2026&month=10', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminExportCsvMonthly.status === 200 && typeof adminExportCsvMonthly.body === 'string' && adminExportCsvMonthly.body.includes('Biaya Ujian (Rp)'), 'Admin can export monthly report as CSV');

  // --- 14. HTML Pages Delivery Tests ---
  const settingsPage = await request('/pengaturan-backup');
  assert(settingsPage.status === 200 && typeof settingsPage.body === 'string' && settingsPage.body.includes('Pengaturan Sistem & Backup Database'), 'Pengaturan & Backup page served on /pengaturan-backup');

  const reportsPage = await request('/laporan-transaksi');
  assert(reportsPage.status === 200 && typeof reportsPage.body === 'string' && reportsPage.body.includes('Laporan Transaksi Pendaftaran'), 'Laporan Transaksi page served on /laporan-transaksi');

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED!`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
