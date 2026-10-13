// public/js/user.js - Participant Dashboard, Exam Registration, Exam Card, and Password Change
document.addEventListener('DOMContentLoaded', async () => {
  const user = Auth.getUser();
  if (!user) {
    alert('Silakan masuk ke akun peserta terlebih dahulu.');
    window.location.href = '/';
    return;
  }

  // Set user greeting
  const greetingEl = document.getElementById('user-header-name');
  if (greetingEl) greetingEl.textContent = user.name;
  const emailEl = document.getElementById('user-header-email');
  if (emailEl) emailEl.textContent = user.email;

  setupUserBirthDate();
  setupUserUploadChecks();
  await loadMyRegistration();
  await loadPaymentSettings();
});

let myRegistration = null;

async function loadMyRegistration() {
  try {
    const res = await fetch('/api/registrations/my', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    const data = await res.json();
    if (!data.success) return;

    myRegistration = data.registration;

    if (myRegistration) {
      document.getElementById('section-registered-view').classList.remove('hidden');
      document.getElementById('section-unregistered-form').classList.add('hidden');
      renderRegistrationDetails(myRegistration);
    } else {
      document.getElementById('section-registered-view').classList.add('hidden');
      document.getElementById('section-unregistered-form').classList.remove('hidden');
    }
  } catch (err) {
    console.error('Error loading registration:', err);
  }
}

function renderRegistrationDetails(reg) {
  // Badges
  const regNumEl = document.getElementById('my-reg-number');
  if (regNumEl) regNumEl.textContent = reg.registration_number;

  const statusBadge = document.getElementById('my-reg-status-badge');
  if (statusBadge) {
    if (reg.payment_status === 'VERIFIED') {
      statusBadge.innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ Terverifikasi (Siap Ujian)</span>`;
    } else if (reg.payment_status === 'REJECTED') {
      statusBadge.innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">✕ Ditolak (Perlu Perbaikan)</span>`;
    } else {
      statusBadge.innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">⏳ Menunggu Verifikasi Pembayaran</span>`;
    }
  }

  // Personal data
  document.getElementById('my-reg-fullname').textContent = reg.full_name;
  document.getElementById('my-reg-nik').textContent = reg.nik_ktp;
  document.getElementById('my-reg-birth').textContent = `${reg.birth_place}, ${formatIndoDate(reg.birth_date)}`;
  document.getElementById('my-reg-phone').textContent = reg.phone;
  document.getElementById('my-reg-level').textContent = reg.exam_level;
  document.getElementById('my-reg-period').textContent = reg.exam_period;
  document.getElementById('my-reg-fee').textContent = `Rp ${Number(reg.payment_amount).toLocaleString('id-ID')}`;
  document.getElementById('my-reg-method').textContent = reg.payment_method;

  // Virtual Account & Payment Channel Info
  renderVirtualAccountDetails(reg);

  // Photos & Documents
  if (reg.photo_pasfoto_path) {
    document.getElementById('my-reg-pasfoto').src = reg.photo_pasfoto_path;
  }
  if (reg.photo_ktp_path) {
    document.getElementById('my-reg-ktp-link').href = reg.photo_ktp_path;
  }
  const instLink = document.getElementById('my-reg-inst-link');
  if (instLink) {
    if (reg.photo_institution_path) {
      instLink.href = reg.photo_institution_path;
      instLink.classList.remove('hidden');
    } else {
      instLink.classList.add('hidden');
    }
  }

  // Exam Card Section
  const cardSection = document.getElementById('exam-card-ready-box');
  if (reg.exam_card_issued || reg.payment_status === 'VERIFIED') {
    cardSection.classList.remove('hidden');
    populateExamCard(reg);
  } else {
    cardSection.classList.add('hidden');
  }

  // Payment proof box
  const proofBox = document.getElementById('payment-proof-uploaded-box');
  if (reg.payment_proof_path) {
    proofBox.classList.remove('hidden');
    document.getElementById('my-proof-img').src = reg.payment_proof_path;
  } else {
    proofBox.classList.add('hidden');
  }
}

function formatIndoDate(dateStr) {
  if (!dateStr || dateStr === '1970-01-01') return 'Tidak tercatat';
  try {
    const parts = dateStr.split('-');
    const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10)]} ${parts[0]}`;
  } catch (e) {
    return dateStr;
  }
}

function populateExamCard(reg) {
  document.getElementById('card-reg-number').textContent = reg.registration_number;
  document.getElementById('card-full-name').textContent = reg.full_name;
  document.getElementById('card-nik').textContent = reg.nik_ktp;
  document.getElementById('card-birth').textContent = `${reg.birth_place}, ${formatIndoDate(reg.birth_date)}`;
  document.getElementById('card-level').textContent = reg.exam_level;
  document.getElementById('card-period').textContent = reg.exam_period;
  if (reg.photo_pasfoto_path) {
    document.getElementById('card-photo').src = reg.photo_pasfoto_path;
  }
}

window.printExamCard = function() {
  window.print();
};

// -------------------------------------------------------------
// 2. BIRTH DATE INPUT SETTING (NO 1970-01-01)
// -------------------------------------------------------------
function setupUserBirthDate() {
  const dateInput = document.getElementById('new_reg_birth_date');
  const preview = document.getElementById('new_reg_birth_preview');

  if (!dateInput) return;

  dateInput.value = ''; // empty, prevent epoch 1970
  dateInput.min = '1950-01-01';
  dateInput.max = '2018-12-31';

  dateInput.addEventListener('change', () => {
    if (!dateInput.value) {
      if (preview) preview.textContent = '';
      return;
    }

    if (dateInput.value === '1970-01-01') {
      alert('Peringatan: Tanggal 1/1/1970 adalah tanggal default sistem. Harap pilih tanggal lahir Anda yang sebenarnya sesuai KTP.');
      dateInput.value = '';
      return;
    }

    const year = parseInt(dateInput.value.split('-')[0], 10);
    const age = new Date().getFullYear() - year;
    if (preview) {
      preview.innerHTML = `<span class="text-emerald-700 font-semibold">✓ Tanggal dipilih: ${formatIndoDate(dateInput.value)} (Usia: ${age} tahun)</span>`;
    }
  });
}

// -------------------------------------------------------------
// 3. FILE UPLOAD & 2MB STRICT CHECK
// -------------------------------------------------------------
const userFiles = {
  ktp: null,
  pasfoto: null,
  proof: null,
  inst: null
};

function setupUserUploadChecks() {
  const ktpInput = document.getElementById('new_reg_ktp_file');
  const fotoInput = document.getElementById('new_reg_foto_file');
  const proofInput = document.getElementById('payment_proof_file');
  const instInput = document.getElementById('new_reg_inst_file');

  if (ktpInput) ktpInput.addEventListener('change', (e) => validateAndStoreFile(e.target.files[0], 'ktp'));
  if (fotoInput) fotoInput.addEventListener('change', (e) => validateAndStoreFile(e.target.files[0], 'pasfoto'));
  if (proofInput) proofInput.addEventListener('change', (e) => validateAndStoreFile(e.target.files[0], 'proof'));
  if (instInput) instInput.addEventListener('change', (e) => validateAndStoreFile(e.target.files[0], 'inst'));
}

function validateAndStoreFile(file, type) {
  if (!file) return;

  const MAX_LIMIT = 2 * 1024 * 1024; // 2MB
  const statusEl = document.getElementById(`${type}_file_status`);
  const previewImg = document.getElementById(`${type}_file_preview`);

  // STRICT CHECK: Greater than 2MB
  if (file.size > MAX_LIMIT) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    alert(`Peringatan: Berkas "${file.name}" berukuran ${sizeMB} MB.\nBatas maksimum ukuran file yang diperbolehkan adalah 2 MB!\n\nMohon pilih atau kompres berkas Anda.`);

    const input = document.getElementById(type === 'proof' ? 'payment_proof_file' : (type === 'inst' ? 'new_reg_inst_file' : `new_reg_${type}_file`));
    if (input) input.value = '';

    if (statusEl) statusEl.innerHTML = `<span class="text-red-600 font-bold">✕ Melebihi 2 MB (${sizeMB} MB). Harap pilih file lain.</span>`;
    if (previewImg) previewImg.classList.add('hidden');
    userFiles[type] = null;
    return;
  }

  // Valid size (< 2MB)
  const sizeKB = (file.size / 1024).toFixed(1);
  const reader = new FileReader();

  reader.onload = (e) => {
    userFiles[type] = {
      filename: file.name,
      dataUrl: e.target.result,
      size: file.size
    };

    if (statusEl) {
      statusEl.innerHTML = `<span class="text-emerald-700 font-semibold">✓ ${file.name} (${sizeKB} KB / Max 2 MB - Valid)</span>`;
    }

    if (previewImg) {
      previewImg.src = e.target.result;
      previewImg.classList.remove('hidden');
    }
  };

  reader.readAsDataURL(file);
}

// Checkbox helper to copy address to certificate delivery address
window.toggleSameAddressDashboard = function() {
  const isChecked = document.getElementById('new_reg_same_address')?.checked;
  const domAddress = document.getElementById('new_reg_address')?.value || '';
  const domPostal = document.getElementById('new_reg_postal_code')?.value || '';
  const certAddrInput = document.getElementById('new_reg_cert_address');
  const certPostalInput = document.getElementById('new_reg_cert_postal_code');

  if (isChecked) {
    if (certAddrInput) certAddrInput.value = domAddress;
    if (certPostalInput) certPostalInput.value = domPostal;
  }
};

// -------------------------------------------------------------
// 4. SUBMIT NEW REGISTRATION FROM DASHBOARD
// -------------------------------------------------------------
window.handleDashboardRegister = async function(e) {
  e.preventDefault();

  const exam_period = document.getElementById('new_reg_period').value;
  const exam_level = document.getElementById('new_reg_level').value;
  const full_name = document.getElementById('new_reg_fullname').value;
  const nik_ktp = document.getElementById('new_reg_nik').value;
  const birth_place = document.getElementById('new_reg_birth_place').value;
  const birth_date = document.getElementById('new_reg_birth_date').value;
  const phone = document.getElementById('new_reg_phone').value;
  const gender = document.getElementById('new_reg_gender').value;
  const address = document.getElementById('new_reg_address').value;
  const postal_code = document.getElementById('new_reg_postal_code')?.value || '';
  const institution = document.getElementById('new_reg_institution').value;
  const cert_address = document.getElementById('new_reg_cert_address')?.value || address;
  const cert_postal = document.getElementById('new_reg_cert_postal_code')?.value || postal_code;
  const learning = document.getElementById('new_reg_learning').value;

  // Validation
  if (!nik_ktp || nik_ktp.trim().length < 6) {
    alert('Nomor NIK KTP wajib diisi secara valid.');
    return;
  }

  // Prevent 1970 date
  if (!birth_date || birth_date === '1970-01-01') {
    alert('Tanggal lahir tidak valid. Harap pilih tanggal lahir Anda sesuai KTP (bukan 1970).');
    return;
  }

  try {
    let ktpUrl = '';
    let pasfotoUrl = '';
    let instUrl = '';

    // Upload KTP if chosen
    if (userFiles.ktp) {
      const up = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({
          dataUrl: userFiles.ktp.dataUrl,
          filename: userFiles.ktp.filename,
          category: 'ktp'
        })
      });
      const upRes = await up.json();
      if (upRes.success) ktpUrl = upRes.fileUrl;
    }

    // Upload Pasfoto if chosen
    if (userFiles.pasfoto) {
      const up = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({
          dataUrl: userFiles.pasfoto.dataUrl,
          filename: userFiles.pasfoto.filename,
          category: 'pasfoto'
        })
      });
      const upRes = await up.json();
      if (upRes.success) pasfotoUrl = upRes.fileUrl;
    }

    // Upload Foto Institusi if chosen
    if (userFiles.inst) {
      const up = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({
          dataUrl: userFiles.inst.dataUrl,
          filename: userFiles.inst.filename,
          category: 'institusi'
        })
      });
      const upRes = await up.json();
      if (upRes.success) instUrl = upRes.fileUrl;
    }

    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({
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
        certificate_delivery_address: cert_address,
        certificate_postal_code: cert_postal,
        institution,
        japanese_learning_period: learning,
        photo_ktp_path: ktpUrl,
        photo_pasfoto_path: pasfotoUrl,
        photo_institution_path: instUrl,
        payment_method: document.getElementById('new_reg_payment_method')?.value || 'Virtual Account BNI46'
      })
    });

    const result = await res.json();
    if (result.success) {
      alert(`Pendaftaran ujian berhasil disimpan!\nNomor Pendaftaran: ${result.registration_number}\nSilakan selesaikan pembayaran biaya ujian.`);
      await loadMyRegistration();
    } else {
      alert(result.message || 'Gagal menyimpan pendaftaran.');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan.');
  }
};

// -------------------------------------------------------------
// 5. UPLOAD PAYMENT PROOF
// -------------------------------------------------------------
window.handleUploadProof = async function(e) {
  e.preventDefault();
  if (!myRegistration) return;

  if (!userFiles.proof) {
    alert('Silakan pilih berkas bukti transfer terlebih dahulu (Maksimal 2 MB).');
    return;
  }

  try {
    // Upload image
    const up = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({
        dataUrl: userFiles.proof.dataUrl,
        filename: userFiles.proof.filename,
        category: 'bukti_bayar'
      })
    });
    const upRes = await up.json();
    if (!upRes.success) {
      alert(upRes.message || 'Gagal mengunggah foto bukti bayar');
      return;
    }

    // Attach to registration
    const res = await fetch('/api/registrations/payment-proof', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({
        registration_id: myRegistration.id,
        payment_proof_path: upRes.fileUrl
      })
    });

    const result = await res.json();
    if (result.success) {
      alert('Bukti pembayaran berhasil diunggah! Admin UKK CSGS UI akan memverifikasi dalam 1x24 jam.');
      await loadMyRegistration();
    } else {
      alert(result.message || 'Gagal menyimpan bukti pembayaran');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan.');
  }
};

// -------------------------------------------------------------
// 6. UBAH PASSWORD FASILITAS
// -------------------------------------------------------------
window.handleUserChangePassword = async function(e) {
  e.preventDefault();
  const old_pass = document.getElementById('user_old_password').value;
  const new_pass = document.getElementById('user_new_password').value;
  const confirm_pass = document.getElementById('user_confirm_password').value;
  const errorEl = document.getElementById('user_pw_error');
  const successEl = document.getElementById('user_pw_success');

  if (errorEl) errorEl.classList.add('hidden');
  if (successEl) successEl.classList.add('hidden');

  if (new_pass.length < 6) {
    if (errorEl) {
      errorEl.textContent = 'Kata sandi baru minimal 6 karakter.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  if (new_pass !== confirm_pass) {
    if (errorEl) {
      errorEl.textContent = 'Konfirmasi kata sandi baru tidak sesuai.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  const res = await Auth.changePassword(old_pass, new_pass, confirm_pass);
  if (res.success) {
    if (successEl) {
      successEl.textContent = 'Kata sandi berhasil diperbarui!';
      successEl.classList.remove('hidden');
    }
    document.getElementById('form-user-change-password').reset();
  } else {
    if (errorEl) {
      errorEl.textContent = res.message || 'Gagal mengubah kata sandi.';
      errorEl.classList.remove('hidden');
    }
  }
};

// Tab switching in user dashboard
window.switchUserTab = function(tabName) {
  document.querySelectorAll('.user-tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.user-tab-btn').forEach(b => b.classList.remove('bg-red-600', 'text-white'));

  const content = document.getElementById(`user-tab-${tabName}`);
  const btn = document.getElementById(`user-btn-${tabName}`);

  if (content) content.classList.remove('hidden');
  if (btn) btn.classList.add('bg-red-600', 'text-white');
};

// Payment settings and QRIS loader in User Dashboard
async function loadPaymentSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (!data.success || !data.settings) return;

    const s = data.settings;

    // QRIS info
    const qrisBtn = document.getElementById('btn-paytab-qris');
    if (s.qris_enabled === 'false') {
      if (qrisBtn) qrisBtn.classList.add('hidden');
    } else {
      if (qrisBtn) qrisBtn.classList.remove('hidden');
      const qrisImg = document.getElementById('user-pay-qrisimg');
      if (qrisImg && s.qris_image_url) qrisImg.src = s.qris_image_url;

      const qrisDownload = document.getElementById('user-pay-qrisdownload');
      if (qrisDownload && s.qris_image_url) qrisDownload.href = s.qris_image_url;

      const qrisMerchant = document.getElementById('user-pay-qrismerchant');
      if (qrisMerchant && s.qris_merchant_name) qrisMerchant.textContent = s.qris_merchant_name;

      const qrisNmid = document.getElementById('user-pay-qrisnmid');
      if (qrisNmid && s.qris_nmid) qrisNmid.textContent = s.qris_nmid;

      const qrisInstruct = document.getElementById('user-pay-qrisinstruct');
      if (qrisInstruct && s.qris_instructions) qrisInstruct.textContent = s.qris_instructions;
    }
  } catch (err) {
    console.error('Error loading payment settings:', err);
  }
}

function renderVirtualAccountDetails(reg) {
  const vaEl = document.getElementById('user-va-number');
  const nameEl = document.getElementById('user-va-name');
  const amtEl = document.getElementById('user-va-amount');

  if (vaEl) vaEl.textContent = reg.va_number || '988003326000001';
  if (nameEl) nameEl.textContent = `NAT CSGS UI - ${reg.full_name || 'PESERTA'}`;
  if (amtEl) amtEl.textContent = `Rp ${Number(reg.payment_amount || 500000).toLocaleString('id-ID')}`;

  const currentBank = (reg.va_bank || 'BNI').toUpperCase();
  switchUserPaymentTab(currentBank, false);
}

window.switchUserPaymentTab = async function(channel, persist = true) {
  const upper = String(channel || 'BNI').toUpperCase();
  const btnBni = document.getElementById('btn-paytab-bni');
  const btnMandiri = document.getElementById('btn-paytab-mandiri');
  const btnBri = document.getElementById('btn-paytab-bri');
  const btnQris = document.getElementById('btn-paytab-qris');

  const payboxVa = document.getElementById('paybox-va');
  const payboxQris = document.getElementById('paybox-qris');

  const instructBni = document.getElementById('instruct-bni');
  const instructMandiri = document.getElementById('instruct-mandiri');
  const instructBri = document.getElementById('instruct-bri');

  const titleEl = document.getElementById('user-va-bank-title');
  const subtitleEl = document.getElementById('user-va-bank-subtitle');
  const iconEl = document.getElementById('user-va-badge-icon');
  const vaEl = document.getElementById('user-va-number');

  // Reset tab button styles
  const activeClass = 'px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white transition-all shadow-xs flex items-center justify-center gap-1.5 border border-slate-800';
  const inactiveClass = 'px-2.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 transition-all shadow-2xs flex items-center justify-center gap-1.5 border border-slate-300';

  if (btnBni) btnBni.className = inactiveClass;
  if (btnMandiri) btnMandiri.className = inactiveClass;
  if (btnBri) btnBri.className = inactiveClass;
  if (btnQris) btnQris.className = inactiveClass;

  if (upper.includes('QRIS')) {
    if (btnQris) btnQris.className = activeClass;
    if (payboxVa) payboxVa.classList.add('hidden');
    if (payboxQris) payboxQris.classList.remove('hidden');
  } else {
    if (payboxVa) payboxVa.classList.remove('hidden');
    if (payboxQris) payboxQris.classList.add('hidden');

    if (upper.includes('MANDIRI')) {
      if (btnMandiri) btnMandiri.className = activeClass;
      if (titleEl) titleEl.textContent = 'Virtual Account Bank Mandiri';
      if (subtitleEl) subtitleEl.textContent = 'Kode Perusahaan Mandiri Bill: 88708';
      if (iconEl) iconEl.textContent = '🏛️';
      if (instructBni) instructBni.classList.add('hidden');
      if (instructMandiri) instructMandiri.classList.remove('hidden');
      if (instructBri) instructBri.classList.add('hidden');
    } else if (upper.includes('BRI')) {
      if (btnBri) btnBri.className = activeClass;
      if (titleEl) titleEl.textContent = 'Virtual Account BRI (BRIVA)';
      if (subtitleEl) subtitleEl.textContent = 'Kode Institusi BRIVA CSGS UI: 12800';
      if (iconEl) iconEl.textContent = '💳';
      if (instructBni) instructBni.classList.add('hidden');
      if (instructMandiri) instructMandiri.classList.add('hidden');
      if (instructBri) instructBri.classList.remove('hidden');
    } else {
      if (btnBni) btnBni.className = activeClass;
      if (titleEl) titleEl.textContent = 'Virtual Account BNI46';
      if (subtitleEl) subtitleEl.textContent = 'Kode Institusi CSGS UI: 9880033';
      if (iconEl) iconEl.textContent = '🏦';
      if (instructBni) instructBni.classList.remove('hidden');
      if (instructMandiri) instructMandiri.classList.add('hidden');
      if (instructBri) instructBri.classList.add('hidden');
    }
  }

  // Persist switch to backend if requested and registered
  if (persist && myRegistration) {
    try {
      const res = await fetch('/api/registrations/switch-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({
          registration_id: myRegistration.id,
          channel: upper
        })
      });
      const d = await res.json();
      if (d.success) {
        myRegistration.va_bank = d.va_bank;
        myRegistration.va_number = d.va_number;
        myRegistration.payment_method = d.payment_method;

        if (document.getElementById('my-reg-method')) {
          document.getElementById('my-reg-method').textContent = d.payment_method;
        }
        if (d.va_number && vaEl) {
          vaEl.textContent = d.va_number;
        }

        const alertEl = document.getElementById('pay-switch-alert');
        const alertText = document.getElementById('pay-switch-alert-text');
        if (alertEl && alertText) {
          alertText.textContent = `✓ Berhasil dialihkan ke ${d.payment_method}.${d.va_number ? ` Nomor VA: ${d.va_number}` : ''}`;
          alertEl.classList.remove('hidden');
          setTimeout(() => alertEl.classList.add('hidden'), 5000);
        }
      }
    } catch (err) {
      console.error('Error switching payment channel:', err);
    }
  }
};

window.copyVaNumber = function() {
  const vaEl = document.getElementById('user-va-number');
  const btn = document.getElementById('btn-copy-va');
  if (!vaEl) return;
  const text = vaEl.textContent.trim();
  copyToClipboard(text, btn, '✓ Nomor VA Tersalin!');
};

window.copyFeeAmount = function() {
  const amtEl = document.getElementById('user-va-amount');
  const btn = document.getElementById('btn-copy-amount');
  if (!amtEl) return;
  const numOnly = (amtEl.textContent.replace(/[^0-9]/g, '') || '500000');
  copyToClipboard(numOnly, btn, '✓ Tersalin');
};

function copyToClipboard(text, btnElement, successMsg = '✓ Tersalin!') {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showCopyFeedback(btnElement, successMsg);
    }).catch(() => fallbackCopy(text, btnElement, successMsg));
  } else {
    fallbackCopy(text, btnElement, successMsg);
  }
}

function fallbackCopy(text, btnElement, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showCopyFeedback(btnElement, successMsg);
  } catch (_) {}
  document.body.removeChild(ta);
}

function showCopyFeedback(btnElement, successMsg) {
  if (!btnElement) return;
  const originalHtml = btnElement.innerHTML;
  btnElement.innerHTML = `<span>${successMsg}</span>`;
  btnElement.classList.add('bg-emerald-600', 'text-white');
  setTimeout(() => {
    btnElement.innerHTML = originalHtml;
    btnElement.classList.remove('bg-emerald-600');
  }, 2200);
}
