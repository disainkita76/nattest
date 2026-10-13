// public/js/settings-backup.js - Settings & Backup Controller
document.addEventListener('DOMContentLoaded', async () => {
  const user = Auth.getUser();
  if (!user || user.role !== 'ADMIN') {
    alert('Akses ditolak: Hanya Administrator yang diizinkan mengakses halaman pengaturan & backup.');
    window.location.href = '/admin-login.html';
    return;
  }

  await loadSettingsData();
  await loadDatabaseInfo();
});

function showAlert(message, isSuccess = true) {
  const container = document.getElementById('alert-container');
  if (!container) return;

  container.className = isSuccess
    ? 'p-4 rounded-2xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300'
    : 'p-4 rounded-2xl text-xs font-semibold bg-red-50 text-red-800 border border-red-300';
  container.textContent = message;
  container.classList.remove('hidden');

  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => {
    container.classList.add('hidden');
  }, 6000);
}

async function loadSettingsData() {
  try {
    const res = await fetch('/api/admin/settings', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    const data = await res.json();
    if (!data.success || !data.settings) return;

    const s = data.settings;
    setVal('set_app_name', s.app_name);
    setVal('set_organizer_name', s.organizer_name);
    setVal('set_exam_venue', s.exam_venue);
    setVal('set_current_wave', s.current_wave);
    setVal('set_registration_status', s.registration_status || 'OPEN');
    setVal('set_max_quota_per_wave', s.max_quota_per_wave || 350);
    setVal('set_default_exam_fee', s.default_exam_fee || 500000);
    setVal('set_max_upload_size_mb', s.max_upload_size_mb || 2);
    setVal('set_auto_issue_card_on_verify', s.auto_issue_card_on_verify || 'true');
    setVal('set_bank_name', s.bank_name);
    setVal('set_bank_account_number', s.bank_account_number);
    setVal('set_bank_account_holder', s.bank_account_holder);
    setVal('set_contact_email', s.contact_email);
    setVal('set_contact_whatsapp', s.contact_whatsapp);
    setVal('set_contact_hours', s.contact_hours);

    // QRIS Settings
    setVal('set_qris_enabled', s.qris_enabled || 'true');
    setVal('set_qris_merchant_name', s.qris_merchant_name || 'NAT-TEST UKK CSGS UNIVERSITAS INDONESIA');
    setVal('set_qris_nmid', s.qris_nmid || 'ID1020261012345');
    setVal('set_qris_image_url', s.qris_image_url || '/images/qris-nat-test.svg');
    setVal('set_qris_instructions', s.qris_instructions || '');
    updateQrisPreview();

    // Virtual Account Settings (BNI, Mandiri, BRI)
    setVal('set_va_bni_enabled', s.va_bni_enabled || 'true');
    setVal('set_va_bni_prefix', s.va_bni_prefix || '9880033');
    setVal('set_va_bni_merchant_name', s.va_bni_merchant_name || 'NAT CSGS UI');

    setVal('set_va_mandiri_enabled', s.va_mandiri_enabled || 'true');
    setVal('set_va_mandiri_prefix', s.va_mandiri_prefix || '88708');
    setVal('set_va_mandiri_merchant_name', s.va_mandiri_merchant_name || 'NAT CSGS UI');

    setVal('set_va_bri_enabled', s.va_bri_enabled || 'true');
    setVal('set_va_bri_prefix', s.va_bri_prefix || '12800');
    setVal('set_va_bri_merchant_name', s.va_bri_merchant_name || 'BRIVA NAT CSGS UI');
  } catch (err) {
    console.error('Error load settings:', err);
  }
}

function updateQrisPreview() {
  const isEnabled = document.getElementById('set_qris_enabled')?.value === 'true';
  const merchant = document.getElementById('set_qris_merchant_name')?.value || 'NAT-TEST UKK CSGS UNIVERSITAS INDONESIA';
  const nmid = document.getElementById('set_qris_nmid')?.value || 'ID1020261012345';
  const imgUrl = document.getElementById('set_qris_image_url')?.value || '/images/qris-nat-test.svg';

  const previewMerchant = document.getElementById('qris-preview-merchant');
  if (previewMerchant) previewMerchant.textContent = merchant;

  const previewNmid = document.getElementById('qris-preview-nmid');
  if (previewNmid) previewNmid.textContent = nmid;

  const previewImg = document.getElementById('qris-preview-img');
  if (previewImg) previewImg.src = imgUrl;

  const badge = document.getElementById('qris-preview-badge');
  if (badge) {
    if (isEnabled) {
      badge.className = 'px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300';
      badge.textContent = '✓ QRIS Aktif';
    } else {
      badge.className = 'px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-200 text-slate-700 border border-slate-300';
      badge.textContent = '✕ QRIS Nonaktif';
    }
  }
}

async function handleQrisImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert('Ukuran file melebihi batas 2 MB. Harap pilih gambar di bawah 2 MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({
          dataUrl: e.target.result,
          filename: file.name,
          category: 'qris'
        })
      });
      const data = await res.json();
      if (data.success && data.fileUrl) {
        document.getElementById('set_qris_image_url').value = data.fileUrl;
        updateQrisPreview();
        showAlert('✔ Gambar QRIS berhasil diunggah! Jangan lupa klik Simpan Pengaturan.', true);
      } else {
        alert('Gagal mengunggah gambar: ' + (data.message || 'Error'));
      }
    } catch (err) {
      console.error('Error upload QRIS image:', err);
      alert('Terjadi kesalahan saat mengunggah gambar.');
    }
  };
  reader.readAsDataURL(file);
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) {
    el.value = val;
  }
}

async function loadDatabaseInfo() {
  try {
    const res = await fetch('/api/admin/backup/info', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    const data = await res.json();
    if (!data.success || !data.info) return;

    const info = data.info;
    const sizeEl = document.getElementById('db-size-text');
    if (sizeEl) sizeEl.textContent = info.dbSizeFormatted;

    const modEl = document.getElementById('db-modified-text');
    if (modEl && info.lastModified) {
      modEl.textContent = new Date(info.lastModified).toLocaleString('id-ID');
    }

    if (info.tableStats) {
      setText('db-count-regs', info.tableStats.registrations);
      setText('db-count-users', info.tableStats.users);
      setText('db-count-pages', info.tableStats.static_pages);
      setText('db-count-cms', info.tableStats.cms_content);
    }
  } catch (err) {
    console.error('Error load DB info:', err);
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val !== undefined ? val : '0';
}

window.handleSaveSettings = async function(e) {
  e.preventDefault();

  const settingsPayload = {
    app_name: document.getElementById('set_app_name').value.trim(),
    organizer_name: document.getElementById('set_organizer_name').value.trim(),
    exam_venue: document.getElementById('set_exam_venue').value.trim(),
    current_wave: document.getElementById('set_current_wave').value.trim(),
    registration_status: document.getElementById('set_registration_status').value,
    max_quota_per_wave: document.getElementById('set_max_quota_per_wave').value,
    default_exam_fee: document.getElementById('set_default_exam_fee').value,
    max_upload_size_mb: document.getElementById('set_max_upload_size_mb').value,
    auto_issue_card_on_verify: document.getElementById('set_auto_issue_card_on_verify').value,
    bank_name: document.getElementById('set_bank_name').value.trim(),
    bank_account_number: document.getElementById('set_bank_account_number').value.trim(),
    bank_account_holder: document.getElementById('set_bank_account_holder').value.trim(),
    contact_email: document.getElementById('set_contact_email').value.trim(),
    contact_whatsapp: document.getElementById('set_contact_whatsapp').value.trim(),
    contact_hours: document.getElementById('set_contact_hours').value.trim(),
    qris_enabled: document.getElementById('set_qris_enabled') ? document.getElementById('set_qris_enabled').value : 'true',
    qris_merchant_name: document.getElementById('set_qris_merchant_name') ? document.getElementById('set_qris_merchant_name').value.trim() : '',
    qris_nmid: document.getElementById('set_qris_nmid') ? document.getElementById('set_qris_nmid').value.trim() : '',
    qris_image_url: document.getElementById('set_qris_image_url') ? document.getElementById('set_qris_image_url').value.trim() : '/images/qris-nat-test.svg',
    qris_instructions: document.getElementById('set_qris_instructions') ? document.getElementById('set_qris_instructions').value.trim() : '',
    va_bni_enabled: document.getElementById('set_va_bni_enabled') ? document.getElementById('set_va_bni_enabled').value : 'true',
    va_bni_prefix: document.getElementById('set_va_bni_prefix') ? document.getElementById('set_va_bni_prefix').value.trim() : '9880033',
    va_bni_merchant_name: document.getElementById('set_va_bni_merchant_name') ? document.getElementById('set_va_bni_merchant_name').value.trim() : 'NAT CSGS UI',
    va_mandiri_enabled: document.getElementById('set_va_mandiri_enabled') ? document.getElementById('set_va_mandiri_enabled').value : 'true',
    va_mandiri_prefix: document.getElementById('set_va_mandiri_prefix') ? document.getElementById('set_va_mandiri_prefix').value.trim() : '88708',
    va_mandiri_merchant_name: document.getElementById('set_va_mandiri_merchant_name') ? document.getElementById('set_va_mandiri_merchant_name').value.trim() : 'NAT CSGS UI',
    va_bri_enabled: document.getElementById('set_va_bri_enabled') ? document.getElementById('set_va_bri_enabled').value : 'true',
    va_bri_prefix: document.getElementById('set_va_bri_prefix') ? document.getElementById('set_va_bri_prefix').value.trim() : '12800',
    va_bri_merchant_name: document.getElementById('set_va_bri_merchant_name') ? document.getElementById('set_va_bri_merchant_name').value.trim() : 'BRIVA NAT CSGS UI'
  };

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({ settings: settingsPayload })
    });
    const result = await res.json();
    if (result.success) {
      showAlert('✔ Seluruh pengaturan sistem berhasil disimpan dan langsung aktif di sistem!', true);
    } else {
      showAlert('✕ Gagal menyimpan pengaturan: ' + (result.message || 'Error'), false);
    }
  } catch (err) {
    console.error('Error saving settings:', err);
    showAlert('✕ Terjadi kesalahan jaringan saat menyimpan pengaturan.', false);
  }
};

window.downloadSqliteBackup = async function() {
  try {
    const res = await fetch('/api/admin/backup/db', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    if (!res.ok) {
      alert('Gagal mengunduh backup database SQLite.');
      return;
    }
    const blob = await res.blob();
    const todayStr = new Date().toISOString().slice(0, 10);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nattest_backup_${todayStr}.db`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error download SQLite:', err);
    alert('Terjadi kesalahan saat mengunduh berkas database.');
  }
};

window.downloadJsonBackup = async function() {
  try {
    const res = await fetch('/api/admin/backup/json', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    if (!res.ok) {
      alert('Gagal mengekspor data backup JSON.');
      return;
    }
    const blob = await res.blob();
    const todayStr = new Date().toISOString().slice(0, 10);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nattest_export_data_${todayStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error download JSON:', err);
    alert('Terjadi kesalahan saat mengekspor data JSON.');
  }
};

window.handleRestoreDatabase = function() {
  const fileInput = document.getElementById('restore-file-input');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert('Harap pilih berkas backup format JSON (.json) terlebih dahulu.');
    return;
  }

  const file = fileInput.files[0];
  if (!confirm(`PERINGATAN PEMULIHAN:\nApakah Anda yakin ingin memulihkan basis data dari berkas "${file.name}"?\nData yang ada akan diperbarui sesuai isi berkas cadangan.`)) {
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsedData = JSON.parse(e.target.result);
      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({ backupData: parsedData })
      });
      const result = await res.json();
      if (result.success) {
        alert('Pemulihan database berhasil diproses!\nHalaman akan dimuat ulang.');
        window.location.reload();
      } else {
        alert('Gagal memulihkan database: ' + (result.message || 'Format tidak sesuai'));
      }
    } catch (parseErr) {
      alert('Berkas yang dipilih bukan berkas JSON yang valid: ' + parseErr.message);
    }
  };
  reader.readAsText(file);
};

window.runDatabaseVacuum = async function() {
  if (!confirm('Jalankan proses optimasi penyimpanan (VACUUM) pada database SQLite?')) return;

  try {
    const res = await fetch('/api/admin/backup/vacuum', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    const result = await res.json();
    if (result.success) {
      showAlert('✔ ' + result.message, true);
      await loadDatabaseInfo();
    } else {
      showAlert('✕ ' + result.message, false);
    }
  } catch (err) {
    console.error('Error vacuum:', err);
    showAlert('✕ Gagal menjalankan optimasi.', false);
  }
};

window.updateQrisPreview = updateQrisPreview;
window.handleQrisImageUpload = handleQrisImageUpload;
