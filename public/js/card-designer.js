// public/js/card-designer.js - Interactive Exam Card Layout & Print Studio
document.addEventListener('DOMContentLoaded', async () => {
  await initCardDesigner();
});

let currentLayout = null;
let defaultLayout = null;
let participantsList = [];
let selectedParticipant = null;
let isBatchMode = false;

// Barcode & QR SVG Generator helpers
function generateBarcodeSvg(text) {
  // Generate clean aesthetic code-128 style bars
  let bars = '';
  let x = 10;
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const pattern = [(charCode % 3) + 1, ((charCode >> 1) % 2) + 1, ((charCode >> 2) % 3) + 1, 1];
    pattern.forEach((w, idx) => {
      if (idx % 2 === 0) {
        bars += `<rect x="${x}" y="0" width="${w * 1.5}" height="32" fill="#0F172A" />`;
      }
      x += (w * 1.5) + 1.2;
    });
  }
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + 10} 42" class="h-10 w-auto">
      ${bars}
      <text x="${(x + 10) / 2}" y="40" font-family="monospace" font-size="8" font-weight="bold" fill="#334155" text-anchor="middle">${text}</text>
    </svg>
  `;
}

function generateQrCodeSvg(text) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="w-16 h-16 border border-slate-300 p-1 bg-white rounded">
      <path d="M10 10 h30 v30 h-30 z M15 15 v20 h20 v-20 z M20 20 h10 v10 h-10 z" fill="#0F172A"/>
      <path d="M60 10 h30 v30 h-30 z M65 15 v20 h20 v-20 z M70 20 h10 v10 h-10 z" fill="#0F172A"/>
      <path d="M10 60 h30 v30 h-30 z M15 65 v20 h20 v-20 z M20 70 h10 v10 h-10 z" fill="#0F172A"/>
      <path d="M45 10 h5 v15 h-5 z M45 30 h10 v10 h-10 z M10 45 h15 v5 h-15 z M30 45 h15 v15 h-15 z" fill="#0F172A"/>
      <path d="M60 45 h20 v10 h-20 z M85 45 h5 v5 h-5 z M60 60 h10 v15 h-10 z M75 60 h15 v25 h-15 z" fill="#0F172A"/>
      <path d="M45 60 h10 v30 h-10 z M10 85 h5 v5 h-5 z M25 85 h10 v5 h-10 z M60 85 h10 v5 h-10 z" fill="#0F172A"/>
    </svg>
  `;
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

async function initCardDesigner() {
  // 1. Fetch layout template from CMS API
  try {
    const res = await fetch('/api/cms/card_layout');
    const data = await res.json();
    if (data.success && data.section?.data) {
      currentLayout = JSON.parse(JSON.stringify(data.section.data));
      defaultLayout = JSON.parse(JSON.stringify(data.section.data));
    }
  } catch (e) {
    console.warn('Gagal memuat layout CMS, menggunakan fallback');
  }

  if (!currentLayout) {
    currentLayout = getFallbackLayout();
    defaultLayout = getFallbackLayout();
  }

  // 2. Fetch participant data
  await loadParticipantData();

  // 3. Populate sidebar controls with layout values
  populateControls();

  // 4. Attach event listeners
  setupControlListeners();

  // 5. Initial Render
  renderPreview();
}

function getFallbackLayout() {
  return {
    theme: 'red_classic',
    orientation: 'landscape',
    paper_size: 'a4_half',
    cards_per_page: 1,
    header_title_jp: '日本語学力テスト・受験票',
    header_title_id: 'KARTU TANDA PESERTA UJIAN RESMI',
    committee_name: 'KOMITE PUSAT NAT-TEST JEPANG & UKK CSGS UNIVERSITAS INDONESIA',
    show_nat_logo: true,
    show_ui_logo: true,
    show_qr_code: true,
    show_barcode: true,
    show_photo: true,
    photo_position: 'left',
    photo_size: 'medium',
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
}

async function loadParticipantData() {
  const user = Auth.getUser();
  const token = Auth.getToken();

  // Mock sample participant for fallback
  const mockPeserta = {
    id: 1,
    registration_number: 'NAT-2026-4Q-0824',
    full_name: 'Budi Santoso',
    nik_ktp: '3171012508990001',
    gender: 'L',
    birth_place: 'Jakarta',
    birth_date: '1999-08-25',
    phone: '081234567890',
    exam_level: '4Q',
    exam_period: 'Gelombang 3 - Juni 2026',
    photo_pasfoto_path: '/images/logo-nat-test.svg',
    payment_status: 'VERIFIED'
  };

  participantsList = [mockPeserta];

  if (user && token) {
    if (user.role === 'ADMIN' || user.role === 'VERIFIKATOR') {
      // Show admin batch options
      document.getElementById('admin-actions-bar')?.classList.remove('hidden');
      document.getElementById('admin-batch-toggle')?.classList.remove('hidden');

      try {
        const res = await fetch('/api/admin/registrations', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.registrations?.length > 0) {
          participantsList = data.registrations;
        }
      } catch (err) {
        console.error('Error fetching admin registrations:', err);
      }
    } else {
      // Regular peserta
      try {
        const res = await fetch('/api/registrations/my', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.registration) {
          participantsList = [data.registration];
        }
      } catch (err) {
        console.error('Error fetching participant registration:', err);
      }
    }
  }

  // Populate participant select dropdown
  const selectEl = document.getElementById('select-participant');
  if (selectEl) {
    selectEl.innerHTML = participantsList.map((p, idx) => `
      <option value="${idx}">
        ${p.registration_number} - ${p.full_name} (${p.exam_level})
      </option>
    `).join('');

    selectEl.addEventListener('change', (e) => {
      selectedParticipant = participantsList[parseInt(e.target.value, 10)] || participantsList[0];
      renderPreview();
    });
  }

  selectedParticipant = participantsList[0];
}

// -------------------------------------------------------------
// CONTROL FORM POPULATION & EVENT HANDLERS
// -------------------------------------------------------------
function populateControls() {
  const cl = currentLayout;

  // Theme
  const themeInput = document.getElementById('layout-theme');
  if (themeInput) themeInput.value = cl.theme || 'red_classic';

  // Orientation
  const orientInput = document.getElementById('layout-orientation');
  if (orientInput) orientInput.value = cl.orientation || 'landscape';

  // Cards per page
  const perPageInput = document.getElementById('layout-cards-per-page');
  if (perPageInput) perPageInput.value = cl.cards_per_page || 1;

  // Header & Logos
  const checkNatLogo = document.getElementById('check-nat-logo');
  if (checkNatLogo) checkNatLogo.checked = !!cl.show_nat_logo;

  const checkUiLogo = document.getElementById('check-ui-logo');
  if (checkUiLogo) checkUiLogo.checked = !!cl.show_ui_logo;

  const headerJp = document.getElementById('input-header-jp');
  if (headerJp) headerJp.value = cl.header_title_jp || '';

  const headerId = document.getElementById('input-header-id');
  if (headerId) headerId.value = cl.header_title_id || '';

  const commName = document.getElementById('input-committee');
  if (commName) commName.value = cl.committee_name || '';

  // Photo
  const checkPhoto = document.getElementById('check-photo');
  if (checkPhoto) checkPhoto.checked = !!cl.show_photo;

  const photoPos = document.getElementById('layout-photo-pos');
  if (photoPos) photoPos.value = cl.photo_position || 'left';

  const photoSize = document.getElementById('layout-photo-size');
  if (photoSize) photoSize.value = cl.photo_size || 'medium';

  // Security elements: Stamp, QR, Barcode, Signature
  const checkBarcode = document.getElementById('check-barcode');
  if (checkBarcode) checkBarcode.checked = !!cl.show_barcode;

  const checkQr = document.getElementById('check-qr');
  if (checkQr) checkQr.checked = !!cl.show_qr_code;

  const checkStamp = document.getElementById('check-stamp');
  if (checkStamp) checkStamp.checked = !!cl.show_stamp;

  const stampText = document.getElementById('input-stamp-text');
  if (stampText) stampText.value = cl.stamp_text || '公式検印';

  const checkSign = document.getElementById('check-signature');
  if (checkSign) checkSign.checked = !!cl.show_signature;

  const signTitle = document.getElementById('input-sign-title');
  if (signTitle) signTitle.value = cl.signatory_title || '';

  const signName = document.getElementById('input-sign-name');
  if (signName) signName.value = cl.signatory_name || '';

  const signNip = document.getElementById('input-sign-nip');
  if (signNip) signNip.value = cl.signatory_nip || '';

  // Room & Seat
  const inputRoom = document.getElementById('input-default-room');
  if (inputRoom) inputRoom.value = cl.default_room || '';

  const inputSeat = document.getElementById('input-default-seat');
  if (inputSeat) inputSeat.value = cl.default_seat || '';

  const inputTime = document.getElementById('input-default-time');
  if (inputTime) inputTime.value = cl.default_time || '';

  // Fields checkboxes
  const fields = cl.fields || {};
  Object.keys(fields).forEach(key => {
    const chk = document.getElementById(`field-chk-${key}`);
    if (chk) chk.checked = !!fields[key].show;
  });

  // Rules
  const checkRules = document.getElementById('check-rules');
  if (checkRules) checkRules.checked = !!cl.show_rules;

  const rulesTitle = document.getElementById('input-rules-title');
  if (rulesTitle) rulesTitle.value = cl.rules_title || '';

  const rulesText = document.getElementById('input-rules-list');
  if (rulesText) rulesText.value = (cl.rules || []).join('\n');

  // Custom Logos preview
  const prevLogoNat = document.getElementById('preview-logo-nat');
  if (prevLogoNat) prevLogoNat.src = cl.custom_nat_logo || '/images/logo-nat-test.svg';

  const prevLogoUi = document.getElementById('preview-logo-ui');
  if (prevLogoUi) prevLogoUi.src = cl.custom_ui_logo || '/images/logo-csgs-ui.svg';

  // Custom Signature preview
  const prevSig = document.getElementById('preview-signature-img');
  const prevSigEmpty = document.getElementById('preview-signature-empty');
  if (prevSig && prevSigEmpty) {
    if (cl.custom_signature_img) {
      prevSig.src = cl.custom_signature_img;
      prevSig.classList.remove('hidden');
      prevSigEmpty.classList.add('hidden');
    } else {
      prevSig.classList.add('hidden');
      prevSigEmpty.classList.remove('hidden');
    }
  }
}

function setupControlListeners() {
  const updateLayoutAndRender = () => {
    readControlsIntoLayout();
    renderPreview();
  };

  // Listen to all inputs, selects, textareas in layout sidebar
  const sidebar = document.getElementById('layout-sidebar');
  if (sidebar) {
    sidebar.querySelectorAll('input:not([type="file"]), select, textarea').forEach(el => {
      el.addEventListener('input', updateLayoutAndRender);
      el.addEventListener('change', updateLayoutAndRender);
    });
  }

  // Image Upload Handlers for Logo 1, Logo 2, and Signature
  setupImageUploadHandler('upload-logo-nat', 'preview-logo-nat', (dataUrl) => {
    currentLayout.custom_nat_logo = dataUrl;
    renderPreview();
  });

  setupImageUploadHandler('upload-logo-ui', 'preview-logo-ui', (dataUrl) => {
    currentLayout.custom_ui_logo = dataUrl;
    renderPreview();
  });

  setupImageUploadHandler('upload-signature-img', 'preview-signature-img', (dataUrl) => {
    currentLayout.custom_signature_img = dataUrl;
    const prevSig = document.getElementById('preview-signature-img');
    const prevSigEmpty = document.getElementById('preview-signature-empty');
    if (prevSig) prevSig.classList.remove('hidden');
    if (prevSigEmpty) prevSigEmpty.classList.add('hidden');
    renderPreview();
  });
}

function setupImageUploadHandler(inputId, previewImgId, onLoadedCallback) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const MAX_LIMIT = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_LIMIT) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      alert(`Peringatan: Ukuran berkas "${file.name}" (${sizeMB} MB) melebihi batas maksimal 2 MB!\nSilakan pilih atau kompres berkas Anda.`);
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const preview = document.getElementById(previewImgId);
      if (preview) {
        preview.src = dataUrl;
        preview.classList.remove('hidden');
      }
      onLoadedCallback(dataUrl);
    };
    reader.readAsDataURL(file);
  });
}

window.resetNatLogo = function () {
  currentLayout.custom_nat_logo = null;
  const input = document.getElementById('upload-logo-nat');
  if (input) input.value = '';
  const prev = document.getElementById('preview-logo-nat');
  if (prev) prev.src = '/images/logo-nat-test.svg';
  renderPreview();
};

window.resetUiLogo = function () {
  currentLayout.custom_ui_logo = null;
  const input = document.getElementById('upload-logo-ui');
  if (input) input.value = '';
  const prev = document.getElementById('preview-logo-ui');
  if (prev) prev.src = '/images/logo-csgs-ui.svg';
  renderPreview();
};

window.resetSignatureImg = function () {
  currentLayout.custom_signature_img = null;
  const input = document.getElementById('upload-signature-img');
  if (input) input.value = '';
  const prev = document.getElementById('preview-signature-img');
  const prevEmpty = document.getElementById('preview-signature-empty');
  if (prev) prev.classList.add('hidden');
  if (prevEmpty) prevEmpty.classList.remove('hidden');
  renderPreview();
};

function readControlsIntoLayout() {
  const cl = currentLayout;

  cl.theme = document.getElementById('layout-theme')?.value || 'red_classic';
  cl.orientation = document.getElementById('layout-orientation')?.value || 'landscape';
  cl.cards_per_page = parseInt(document.getElementById('layout-cards-per-page')?.value || '1', 10);

  cl.show_nat_logo = document.getElementById('check-nat-logo')?.checked ?? true;
  cl.show_ui_logo = document.getElementById('check-ui-logo')?.checked ?? true;
  cl.header_title_jp = document.getElementById('input-header-jp')?.value || '';
  cl.header_title_id = document.getElementById('input-header-id')?.value || '';
  cl.committee_name = document.getElementById('input-committee')?.value || '';

  cl.show_photo = document.getElementById('check-photo')?.checked ?? true;
  cl.photo_position = document.getElementById('layout-photo-pos')?.value || 'left';
  cl.photo_size = document.getElementById('layout-photo-size')?.value || 'medium';

  cl.show_barcode = document.getElementById('check-barcode')?.checked ?? true;
  cl.show_qr_code = document.getElementById('check-qr')?.checked ?? true;
  cl.show_stamp = document.getElementById('check-stamp')?.checked ?? true;
  cl.stamp_text = document.getElementById('input-stamp-text')?.value || '公式検印';

  cl.show_signature = document.getElementById('check-signature')?.checked ?? true;
  cl.signatory_title = document.getElementById('input-sign-title')?.value || '';
  cl.signatory_name = document.getElementById('input-sign-name')?.value || '';
  cl.signatory_nip = document.getElementById('input-sign-nip')?.value || '';

  cl.default_room = document.getElementById('input-default-room')?.value || '';
  cl.default_seat = document.getElementById('input-default-seat')?.value || '';
  cl.default_time = document.getElementById('input-default-time')?.value || '';

  if (!cl.fields) cl.fields = {};
  [
    'reg_number', 'full_name', 'nik', 'birth',
    'level', 'period', 'venue', 'room_time'
  ].forEach(key => {
    if (!cl.fields[key]) cl.fields[key] = { label: key, show: true };
    const chk = document.getElementById(`field-chk-${key}`);
    if (chk) cl.fields[key].show = chk.checked;
  });

  cl.show_rules = document.getElementById('check-rules')?.checked ?? true;
  cl.rules_title = document.getElementById('input-rules-title')?.value || '';
  const rulesLines = document.getElementById('input-rules-list')?.value || '';
  cl.rules = rulesLines.split('\n').map(l => l.trim()).filter(Boolean);
}

// -------------------------------------------------------------
// RENDER LIVE PREVIEW CANVAS
// -------------------------------------------------------------
function renderPreview() {
  const container = document.getElementById('print-preview-container');
  if (!container) return;

  const targetParticipants = isBatchMode ? participantsList : [selectedParticipant || participantsList[0]];

  container.innerHTML = targetParticipants.map((p, index) => {
    return buildCardHtml(p, currentLayout, index);
  }).join('');
}

function buildCardHtml(p, layout, index) {
  // Theme styles
  let themeBorder = 'border-2 border-red-600';
  let themeBg = 'bg-white';
  let headerBorder = 'border-b-2 border-red-600';
  let titleColor = 'text-red-700';
  let badgeColor = 'bg-red-50 text-red-700 border-red-200';
  let stampBorder = 'border-red-600 text-red-600';

  if (layout.theme === 'navy_gold') {
    themeBorder = 'border-2 border-blue-900 ring-2 ring-amber-400';
    headerBorder = 'border-b-2 border-amber-500';
    titleColor = 'text-blue-950';
    badgeColor = 'bg-amber-50 text-amber-900 border-amber-300';
    stampBorder = 'border-amber-600 text-amber-700';
  } else if (layout.theme === 'monochrome') {
    themeBorder = 'border-2 border-slate-900';
    headerBorder = 'border-b-2 border-slate-900';
    titleColor = 'text-slate-950';
    badgeColor = 'bg-slate-100 text-slate-900 border-slate-300';
    stampBorder = 'border-slate-800 text-slate-800';
  } else if (layout.theme === 'compact_badge') {
    themeBorder = 'border-2 border-slate-800 shadow-md';
    headerBorder = 'border-b border-slate-300';
    titleColor = 'text-slate-900';
  }

  // Photo size
  let photoDimensions = 'w-24 h-32';
  if (layout.photo_size === 'small') photoDimensions = 'w-20 h-28';
  if (layout.photo_size === 'large') photoDimensions = 'w-28 h-36';

  const photoHtml = layout.show_photo ? `
    <div class="flex flex-col items-center justify-center shrink-0">
      <div class="${photoDimensions} rounded-lg border-2 border-slate-300 overflow-hidden bg-slate-100 shadow-xs mb-1.5">
        <img src="${p.photo_pasfoto_path || '/images/logo-nat-test.svg'}" class="w-full h-full object-cover" alt="Foto Peserta" />
      </div>
      ${layout.show_stamp ? `
        <div class="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 ${stampBorder} text-[10px] font-bold font-jp leading-none tracking-tighter text-center shadow-xs bg-white mt-0.5">
          ${layout.stamp_text || '公式'}
        </div>
      ` : ''}
    </div>
  ` : '';

  // Fields table items
  const f = layout.fields || {};
  const dataRows = [];

  if (f.reg_number?.show) {
    dataRows.push(`
      <tr class="border-b border-slate-100">
        <td class="py-1 text-slate-500 font-medium w-36">${f.reg_number.label}:</td>
        <td class="py-1 font-mono font-black text-sm text-red-600">${p.registration_number || 'NAT-2026-XXXX'}</td>
      </tr>
    `);
  }

  if (f.full_name?.show) {
    dataRows.push(`
      <tr class="border-b border-slate-100">
        <td class="py-1 text-slate-500 font-medium">${f.full_name.label}:</td>
        <td class="py-1 font-extrabold text-slate-900 uppercase text-xs sm:text-sm">${p.full_name || '-'}</td>
      </tr>
    `);
  }

  if (f.nik?.show) {
    dataRows.push(`
      <tr class="border-b border-slate-100">
        <td class="py-1 text-slate-500 font-medium">${f.nik.label}:</td>
        <td class="py-1 font-mono text-slate-800 text-xs">${p.nik_ktp || '-'}</td>
      </tr>
    `);
  }

  if (f.birth?.show) {
    dataRows.push(`
      <tr class="border-b border-slate-100">
        <td class="py-1 text-slate-500 font-medium">${f.birth.label}:</td>
        <td class="py-1 text-slate-900 font-medium text-xs">${p.birth_place || 'Jakarta'}, ${formatIndoDate(p.birth_date)}</td>
      </tr>
    `);
  }

  if (f.level?.show || f.period?.show) {
    dataRows.push(`
      <tr class="border-b border-slate-100">
        <td class="py-1 text-slate-500 font-medium">Level & Gelombang:</td>
        <td class="py-1 font-bold text-slate-900 text-xs">
          ${f.level?.show ? `<span class="px-2 py-0.5 rounded text-xs font-black ${badgeColor} border mr-1.5">${p.exam_level || '4Q'}</span>` : ''}
          ${f.period?.show ? `<span>${p.exam_period || 'Gelombang 3 - Juni 2026'}</span>` : ''}
        </td>
      </tr>
    `);
  }

  if (f.venue?.show) {
    dataRows.push(`
      <tr class="border-b border-slate-100">
        <td class="py-1 text-slate-500 font-medium">${f.venue.label}:</td>
        <td class="py-1 font-semibold text-slate-900 text-xs">Pusat Studi Jepang (PSJ) UI, Kampus UI Depok</td>
      </tr>
    `);
  }

  if (f.room_time?.show) {
    dataRows.push(`
      <tr class="border-b border-slate-100">
        <td class="py-1 text-slate-500 font-medium">${f.room_time.label}:</td>
        <td class="py-1 text-slate-900 font-bold text-xs">
          <span>${layout.default_room || 'Ruang PSJ 201'}</span> • Kursi: <span class="text-red-700">${layout.default_seat || 'K-024'}</span> • <span class="text-slate-600 font-normal">${layout.default_time || '08.30 WIB'}</span>
        </td>
      </tr>
    `);
  }

  // Barcode / QR Section
  const securityCodes = `
    <div class="flex items-center gap-3">
      ${layout.show_qr_code ? generateQrCodeSvg(p.registration_number || 'NAT-TEST') : ''}
      ${layout.show_barcode ? generateBarcodeSvg(p.registration_number || 'NAT-2026-0601') : ''}
    </div>
  `;

  // Signatory Section
  const signatoryHtml = layout.show_signature ? `
    <div class="text-right text-[11px] space-y-0.5">
      <div class="text-slate-500 text-[10px]">Depok, Panitia Pelaksana Resmi</div>
      <div class="font-bold text-slate-800">${layout.signatory_title || 'Ketua Pelaksana'}</div>
      <div class="h-12 flex items-center justify-end pr-2">
        ${layout.custom_signature_img ? `
          <img src="${layout.custom_signature_img}" class="h-12 max-w-[130px] object-contain" alt="Tanda Tangan Pejabat" />
        ` : `
          <!-- Stylized Signature Mark -->
          <svg class="h-8 w-24 text-slate-800" viewBox="0 0 100 35" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 25 C 20 5, 25 35, 45 15 C 60 5, 55 30, 80 18 C 90 15, 95 25, 98 10" stroke-linecap="round"/>
          </svg>
        `}
      </div>
      <div class="font-extrabold text-slate-900 underline">${layout.signatory_name || 'Dr. Dian Hapsari, M.Hum.'}</div>
      <div class="font-mono text-[9px] text-slate-500">${layout.signatory_nip || 'NIP 197804152005012001'}</div>
    </div>
  ` : '';

  // Rules List
  const rulesHtml = layout.show_rules && layout.rules?.length > 0 ? `
    <div class="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-600 leading-normal">
      <div class="font-bold text-slate-800 uppercase tracking-wider mb-1">${layout.rules_title || 'TATA TERTIB PESERTA UJIAN:'}</div>
      <ol class="list-decimal pl-4 space-y-0.5">
        ${layout.rules.map(r => `<li>${r}</li>`).join('')}
      </ol>
    </div>
  ` : '';

  const isLandscape = layout.orientation === 'landscape';

  return `
    <div class="printable-card-item relative ${themeBg} rounded-2xl p-6 sm:p-7 ${themeBorder} shadow-sm my-4 mx-auto overflow-hidden print-page" style="max-width: ${isLandscape ? '820px' : '620px'};">
      
      <!-- Top Decorative Ribbon -->
      <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-amber-500"></div>

      <!-- Header Section -->
      <div class="flex items-center justify-between pb-3.5 mb-4 ${headerBorder}">
        <!-- Dual Logos -->
        <div class="flex items-center gap-3">
          ${layout.show_nat_logo ? `<img src="${layout.custom_nat_logo || '/images/logo-nat-test.svg'}" class="h-10 sm:h-11 w-auto max-w-[130px] object-contain" alt="Logo Utama" />` : ''}
          ${layout.show_ui_logo ? `<img src="${layout.custom_ui_logo || '/images/logo-csgs-ui.svg'}" class="h-10 sm:h-11 w-auto max-w-[130px] object-contain" alt="Logo Mitra" />` : ''}
        </div>

        <!-- Titles -->
        <div class="text-right">
          <div class="font-jp text-xs font-bold text-red-600 tracking-wider">${layout.header_title_jp}</div>
          <h2 class="text-sm sm:text-base font-black ${titleColor} tracking-tight uppercase">${layout.header_title_id}</h2>
          <div class="text-[9px] text-slate-500 font-mono tracking-tighter uppercase">${layout.committee_name}</div>
        </div>
      </div>

      <!-- Main Body -->
      <div class="flex ${layout.photo_position === 'right' ? 'flex-row-reverse' : 'flex-row'} items-start gap-5">
        <!-- Photo column -->
        ${photoHtml}

        <!-- Data details table column -->
        <div class="flex-1 overflow-x-auto">
          <table class="w-full text-left text-xs">
            <tbody>
              ${dataRows.join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Security / Footer Area: Barcode & Signature -->
      <div class="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-end justify-between gap-4">
        <div>
          ${securityCodes}
        </div>
        <div>
          ${signatoryHtml}
        </div>
      </div>

      <!-- Rules Box -->
      ${rulesHtml}

      <!-- Bottom verified note -->
      <div class="mt-3 text-center text-[9px] text-slate-400 font-mono">
        Diterbitkan secara digital oleh Sistem Pendaftaran NAT-TEST UKK CSGS UI • ID Verifikasi: ${p.registration_number || 'NAT-TEST'} • Lembar Asli
      </div>

    </div>
  `;
}

// -------------------------------------------------------------
// SAVE LAYOUT TEMPLATE TO CMS (ADMIN ONLY)
// -------------------------------------------------------------
window.saveCardLayoutTemplate = async function () {
  const user = Auth.getUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'VERIFIKATOR')) {
    alert('Hanya Administrator yang memiliki wewenang menyimpan template layout resmi.');
    return;
  }

  readControlsIntoLayout();

  try {
    const res = await fetch('/api/cms/card_layout', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({
        title: 'Pengaturan Layout Kartu Ujian',
        subtitle: 'Template dan tata letak pencetakan kartu ujian resmi',
        data: currentLayout
      })
    });

    const result = await res.json();
    if (result.success) {
      alert('Template layout kartu ujian berhasil disimpan sebagai standar resmi!');
    } else {
      alert(result.message || 'Gagal menyimpan template.');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan.');
  }
};

// Reset Layout
window.resetCardLayout = function () {
  if (!confirm('Kembalikan tata letak kartu ujian ke pengaturan bawaan awal?')) return;
  currentLayout = JSON.parse(JSON.stringify(defaultLayout));
  populateControls();
  renderPreview();
};

// Batch Print Toggle
window.toggleBatchMode = function (isBatch) {
  isBatchMode = isBatch;
  const selectBox = document.getElementById('select-participant-wrapper');
  if (selectBox) {
    if (isBatch) selectBox.classList.add('opacity-40', 'pointer-events-none');
    else selectBox.classList.remove('opacity-40', 'pointer-events-none');
  }
  renderPreview();
};

// Trigger Print Dialog
window.triggerPrintCard = function () {
  window.print();
};
