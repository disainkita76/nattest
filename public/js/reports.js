// public/js/reports.js - NAT-TEST UKK CSGS UI Transaction Reports Controller
let currentMode = 'daily';
let currentDailyDate = '';
let currentMonthlyMonth = '';
let currentMonthlyYear = '';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  const user = Auth.getUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'VERIFIKATOR')) {
    alert('Akses ditolak: Hanya Administrator atau Verifikator yang diizinkan mengakses laporan transaksi.');
    window.location.href = '/admin-login.html';
    return;
  }

  // Initialize dates
  initDateSelectors();

  // Load initial daily report
  await loadDailyReport();
});

function initDateSelectors() {
  const now = new Date();
  
  // Daily date default: today YYYY-MM-DD local
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  currentDailyDate = `${year}-${month}-${day}`;

  const inputDate = document.getElementById('input-daily-date');
  if (inputDate) {
    inputDate.value = currentDailyDate;
  }

  // Monthly defaults
  currentMonthlyMonth = month;
  currentMonthlyYear = String(year);

  const selectMonth = document.getElementById('select-monthly-month');
  if (selectMonth) {
    selectMonth.value = currentMonthlyMonth;
  }

  const selectYear = document.getElementById('select-monthly-year');
  if (selectYear) {
    selectYear.value = currentMonthlyYear;
  }

  // Print signature date
  const printSig = document.getElementById('print-signature-date');
  if (printSig) {
    printSig.textContent = formatIndoDateLong(now);
  }
}

function switchReportMode(mode) {
  currentMode = mode;
  const btnDaily = document.getElementById('btn-mode-daily');
  const btnMonthly = document.getElementById('btn-mode-monthly');
  const filterDaily = document.getElementById('filter-daily-container');
  const filterMonthly = document.getElementById('filter-monthly-container');
  const chartSection = document.getElementById('monthly-chart-section');
  const tableTitle = document.getElementById('table-title');
  const tableSubtitle = document.getElementById('table-subtitle');

  if (mode === 'daily') {
    if (btnDaily) {
      btnDaily.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 shadow-xs transition-all';
    }
    if (btnMonthly) {
      btnMonthly.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition-all';
    }
    if (filterDaily) filterDaily.classList.remove('hidden');
    if (filterMonthly) filterMonthly.classList.add('hidden');
    if (chartSection) chartSection.classList.add('hidden');
    if (tableTitle) tableTitle.textContent = 'Rincian Transaksi Pendaftaran Harian';
    if (tableSubtitle) tableSubtitle.textContent = 'Daftar transaksi pendaftaran peserta yang masuk pada tanggal terpilih.';

    loadDailyReport();
  } else {
    if (btnDaily) {
      btnDaily.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition-all';
    }
    if (btnMonthly) {
      btnMonthly.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 shadow-xs transition-all';
    }
    if (filterDaily) filterDaily.classList.add('hidden');
    if (filterMonthly) filterMonthly.classList.remove('hidden');
    if (chartSection) chartSection.classList.remove('hidden');
    if (tableTitle) tableTitle.textContent = 'Rincian Transaksi Pendaftaran Bulanan';
    if (tableSubtitle) tableSubtitle.textContent = 'Daftar seluruh transaksi pendaftaran peserta pada bulan terpilih.';

    loadMonthlyReport();
  }
}

function setTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  currentDailyDate = `${year}-${month}-${day}`;

  const inputDate = document.getElementById('input-daily-date');
  if (inputDate) {
    inputDate.value = currentDailyDate;
  }
  loadDailyReport();
}

async function loadDailyReport() {
  const inputDate = document.getElementById('input-daily-date');
  if (inputDate && inputDate.value) {
    currentDailyDate = inputDate.value;
  }

  const periodBadge = document.getElementById('report-period-badge');
  if (periodBadge) {
    periodBadge.textContent = `Harian: ${formatIndoDateShort(currentDailyDate)}`;
  }

  // Update print elements
  const printTitle = document.getElementById('print-report-title');
  if (printTitle) {
    printTitle.textContent = 'LAPORAN REKAPITULASI TRANSAKSI PENDAFTARAN HARIAN';
  }
  const printPeriod = document.getElementById('print-report-period');
  if (printPeriod) {
    printPeriod.textContent = `Tanggal Transaksi: ${formatIndoDateLong(currentDailyDate)}`;
  }

  try {
    const res = await fetch(`/api/admin/reports/daily?date=${encodeURIComponent(currentDailyDate)}`, {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });

    if (res.status === 401 || res.status === 403) {
      alert('Sesi login telah berakhir atau akses ditolak.');
      window.location.href = '/admin-login.html';
      return;
    }

    const data = await res.json();
    if (!data.success) {
      alert('Gagal memuat data laporan: ' + (data.message || 'Error'));
      return;
    }

    renderKpis(data.summary);
    renderLevelDistribution(data.levelCounts || {}, data.summary.totalRegistrations);
    renderMethodDistribution(data.methodCounts || {}, data.summary.totalRegistrations);
    renderTransactionsTable(data.transactions || []);
  } catch (err) {
    console.error('Error load daily report:', err);
  }
}

async function loadMonthlyReport() {
  const selectMonth = document.getElementById('select-monthly-month');
  const selectYear = document.getElementById('select-monthly-year');
  if (selectMonth) currentMonthlyMonth = selectMonth.value;
  if (selectYear) currentMonthlyYear = selectYear.value;

  const monthIdx = parseInt(currentMonthlyMonth, 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || currentMonthlyMonth;

  const periodBadge = document.getElementById('report-period-badge');
  if (periodBadge) {
    periodBadge.textContent = `Bulanan: ${monthName} ${currentMonthlyYear}`;
  }

  // Update print elements
  const printTitle = document.getElementById('print-report-title');
  if (printTitle) {
    printTitle.textContent = 'LAPORAN REKAPITULASI TRANSAKSI PENDAFTARAN BULANAN';
  }
  const printPeriod = document.getElementById('print-report-period');
  if (printPeriod) {
    printPeriod.textContent = `Periode Bulan: ${monthName} ${currentMonthlyYear}`;
  }

  const chartMonthName = document.getElementById('chart-month-name');
  if (chartMonthName) {
    chartMonthName.textContent = `${monthName} ${currentMonthlyYear}`;
  }

  try {
    const res = await fetch(`/api/admin/reports/monthly?year=${encodeURIComponent(currentMonthlyYear)}&month=${encodeURIComponent(currentMonthlyMonth)}`, {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });

    if (res.status === 401 || res.status === 403) {
      alert('Sesi login telah berakhir atau akses ditolak.');
      window.location.href = '/admin-login.html';
      return;
    }

    const data = await res.json();
    if (!data.success) {
      alert('Gagal memuat data laporan: ' + (data.message || 'Error'));
      return;
    }

    renderKpis(data.summary);
    renderLevelDistribution(data.levelCounts || {}, data.summary.totalRegistrations);
    renderMethodDistribution(data.methodCounts || {}, data.summary.totalRegistrations);
    renderMonthlyChart(data.dailyBreakdown || [], monthName);
    renderTransactionsTable(data.transactions || []);
  } catch (err) {
    console.error('Error load monthly report:', err);
  }
}

function renderKpis(summary) {
  const elTotal = document.getElementById('kpi-total-regs');
  const elVerified = document.getElementById('kpi-verified-regs');
  const elPending = document.getElementById('kpi-pending-regs');
  const elRevenue = document.getElementById('kpi-total-revenue');
  const elRate = document.getElementById('kpi-rate-text');

  if (elTotal) elTotal.textContent = summary.totalRegistrations ?? 0;
  if (elVerified) elVerified.textContent = summary.verifiedCount ?? 0;
  if (elPending) elPending.textContent = summary.pendingCount ?? 0;
  if (elRevenue) {
    elRevenue.textContent = summary.totalRevenueFormatted || `Rp ${(summary.totalRevenue || 0).toLocaleString('id-ID')}`;
  }

  if (elRate) {
    const rate = summary.verificationRate !== undefined
      ? summary.verificationRate
      : (summary.totalRegistrations > 0 ? ((summary.verifiedCount / summary.totalRegistrations) * 100).toFixed(1) : '0');
    elRate.textContent = `${rate}% terverifikasi`;
  }
}

function renderLevelDistribution(levelCounts, total) {
  const container = document.getElementById('level-breakdown-container');
  if (!container) return;

  const levels = ['5Q', '4Q', '3Q', '2Q', '1Q'];
  const levelColors = {
    '5Q': 'border-emerald-200 bg-emerald-50 text-emerald-800',
    '4Q': 'border-cyan-200 bg-cyan-50 text-cyan-800',
    '3Q': 'border-blue-200 bg-blue-50 text-blue-800',
    '2Q': 'border-amber-200 bg-amber-50 text-amber-800',
    '1Q': 'border-red-200 bg-red-50 text-red-800'
  };

  container.innerHTML = levels.map(lvl => {
    const count = levelCounts[lvl] || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const colorClass = levelColors[lvl] || 'border-slate-200 bg-slate-50 text-slate-800';

    return `
      <div class="p-3 rounded-2xl border ${colorClass} flex flex-col items-center justify-center">
        <span class="font-extrabold text-sm">${lvl}</span>
        <span class="text-lg font-black mt-0.5">${count}</span>
        <span class="text-[10px] opacity-75 font-semibold">${pct}%</span>
      </div>
    `;
  }).join('');
}

function renderMethodDistribution(methodCounts, total) {
  const container = document.getElementById('method-breakdown-container');
  if (!container) return;

  const entries = Object.entries(methodCounts);
  if (entries.length === 0) {
    container.innerHTML = `
      <div class="p-4 text-center text-slate-400 italic">
        Belum ada transaksi pembayaran pada periode ini.
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map(([method, count]) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-red-600"></span>
          <span class="font-bold text-slate-800">${escapeHtml(method)}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-black text-slate-900">${count} Peserta</span>
          <span class="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">${pct}%</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderMonthlyChart(dailyBreakdown, monthName) {
  const container = document.getElementById('monthly-bars-container');
  if (!container) return;

  if (dailyBreakdown.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-slate-400 italic">Tidak ada data harian untuk ditampilkan.</div>`;
    return;
  }

  // Calculate max total for scaling
  const maxTotal = Math.max(...dailyBreakdown.map(d => d.total), 5);
  const chartHeightPx = 110;

  const barsHtml = dailyBreakdown.map(d => {
    const heightPx = d.total > 0 ? Math.max(Math.round((d.total / maxTotal) * chartHeightPx), 8) : 4;
    const isToday = isDateCurrentDay(d.day);
    const hasData = d.total > 0;
    
    // Bar styling
    let barColor = 'bg-slate-200';
    if (hasData) {
      barColor = d.verified > 0 ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-gradient-to-t from-amber-500 to-amber-300';
    }
    if (isToday) {
      barColor = 'bg-gradient-to-t from-red-600 to-rose-400';
    }

    const tooltip = `Tgl ${d.dateNum}: ${d.total} Pendaftar (${d.verified} Terverifikasi, Rp ${(d.revenue || 0).toLocaleString('id-ID')})`;

    return `
      <div class="flex flex-col items-center gap-1 group flex-1 min-w-[20px] max-w-[36px]" title="${tooltip}">
        <div class="w-full flex items-end justify-center h-[120px] pb-1">
          <div class="w-full rounded-t-md ${barColor} transition-all duration-300 group-hover:opacity-80 relative flex items-center justify-center" style="height: ${heightPx}px;">
            ${d.total > 0 ? `<span class="hidden group-hover:block absolute -top-5 bg-slate-900 text-white text-[9px] font-mono font-bold px-1 py-0.5 rounded shadow z-10 whitespace-nowrap">${d.total}</span>` : ''}
          </div>
        </div>
        <span class="text-[10px] font-mono font-semibold ${isToday ? 'text-red-600 font-extrabold' : 'text-slate-400'}">${d.dateNum}</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="flex items-end justify-between gap-1 border-b border-slate-200 pb-2">
      ${barsHtml}
    </div>
    <div class="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
      <div class="flex items-center gap-4">
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded bg-emerald-500"></span> Terverifikasi</span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded bg-amber-400"></span> Menunggu</span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded bg-red-600"></span> Hari Ini</span>
      </div>
      <span class="italic text-[10px]">Arahkan kursor pada batang tanggal untuk detail pendaftar</span>
    </div>
  `;
}

function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('report-transactions-tbody');
  const badge = document.getElementById('table-records-badge');

  if (badge) {
    badge.textContent = `${transactions.length} Data Transaksi`;
  }

  if (!tbody) return;

  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-12 text-center text-slate-400">
          <div class="text-3xl mb-2">📜</div>
          <p class="font-bold text-slate-700">Tidak ada riwayat transaksi pada periode ini.</p>
          <p class="text-xs text-slate-400 mt-0.5">Silakan ganti tanggal atau bulan untuk melihat transaksi lainnya.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions.map((t, idx) => {
    const formattedFee = `Rp ${(t.payment_amount || 0).toLocaleString('id-ID')}`;
    const levelBadge = renderLevelPill(t.exam_level);
    const statusBadge = renderStatusPill(t.payment_status);
    const dateFormatted = formatIndoDateTime(t.created_at);

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
        <td class="py-3 px-4 text-center font-mono text-slate-400 font-bold">${idx + 1}</td>
        <td class="py-3 px-4 font-mono font-bold text-slate-900">${escapeHtml(t.registration_number || '-')}</td>
        <td class="py-3 px-4">
          <div class="font-bold text-slate-900">${escapeHtml(t.full_name || '-')}</div>
          <div class="text-[10px] text-slate-400">${escapeHtml(t.email || '')} ${t.phone ? `• ${escapeHtml(t.phone)}` : ''}</div>
        </td>
        <td class="py-3 px-4 text-center">${levelBadge}</td>
        <td class="py-3 px-4 text-slate-700 font-medium">${escapeHtml(t.exam_period || '-')}</td>
        <td class="py-3 px-4 text-right font-mono font-bold text-slate-900">${formattedFee}</td>
        <td class="py-3 px-4 text-slate-700">${escapeHtml(t.payment_method || 'Virtual Account')}</td>
        <td class="py-3 px-4 text-center">${statusBadge}</td>
        <td class="py-3 px-4 text-slate-500 font-mono text-[11px]">${dateFormatted}</td>
      </tr>
    `;
  }).join('');
}

function renderLevelPill(level) {
  const map = {
    '5Q': 'bg-emerald-100 text-emerald-800 border-emerald-300',
    '4Q': 'bg-cyan-100 text-cyan-800 border-cyan-300',
    '3Q': 'bg-blue-100 text-blue-800 border-blue-300',
    '2Q': 'bg-amber-100 text-amber-800 border-amber-300',
    '1Q': 'bg-red-100 text-red-800 border-red-300'
  };
  const cls = map[level] || 'bg-slate-100 text-slate-800 border-slate-300';
  return `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${cls}">${escapeHtml(level || '-')}</span>`;
}

function renderStatusPill(status) {
  if (status === 'VERIFIED') {
    return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">Terverifikasi</span>`;
  }
  if (status === 'PENDING') {
    return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">Menunggu</span>`;
  }
  if (status === 'REJECTED') {
    return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">Ditolak</span>`;
  }
  return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-300">${escapeHtml(status || '-')}</span>`;
}

async function exportReportCsv() {
  try {
    let url = `/api/admin/reports/export?type=${currentMode}`;
    let filename = '';

    if (currentMode === 'monthly') {
      url += `&year=${encodeURIComponent(currentMonthlyYear)}&month=${encodeURIComponent(currentMonthlyMonth)}`;
      filename = `laporan_transaksi_nattest_${currentMonthlyYear}_${currentMonthlyMonth}.csv`;
    } else {
      url += `&date=${encodeURIComponent(currentDailyDate)}`;
      filename = `laporan_transaksi_nattest_${currentDailyDate}.csv`;
    }

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });

    if (!res.ok) {
      alert('Gagal mengekspor laporan CSV.');
      return;
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (err) {
    console.error('Error export CSV:', err);
    alert('Terjadi kesalahan saat mengekspor laporan.');
  }
}

// Helpers
function formatIndoDateShort(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length < 3) return dateStr;
  const monthIdx = parseInt(parts[1], 10) - 1;
  return `${parseInt(parts[2], 10)} ${MONTH_NAMES[monthIdx] || parts[1]} ${parts[0]}`;
}

function formatIndoDateLong(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatIndoDateTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()] ? MONTH_NAMES[d.getMonth()].slice(0, 3) : '';
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${mins}`;
}

function isDateCurrentDay(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr === today;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Expose globals for inline HTML event handlers
window.switchReportMode = switchReportMode;
window.loadDailyReport = loadDailyReport;
window.loadMonthlyReport = loadMonthlyReport;
window.setTodayDate = setTodayDate;
window.exportReportCsv = exportReportCsv;
