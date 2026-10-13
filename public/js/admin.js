// public/js/admin.js - Admin Command Center, User & Role Management, CMS Editor
document.addEventListener('DOMContentLoaded', async () => {
  const user = Auth.getUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'VERIFIKATOR')) {
    window.location.href = '/admin-login.html';
    return;
  }

  // Display admin info in header
  const adminNameEl = document.getElementById('admin-header-name');
  if (adminNameEl) adminNameEl.textContent = user.name;
  const adminRoleEl = document.getElementById('admin-header-role');
  if (adminRoleEl) adminRoleEl.textContent = user.role;

  // Initial load
  await loadAdminStats();
  await loadRegistrations();
  await loadUserManagement();
  await loadCmsEditorData();
  await loadAdminStaticPages();

  setupAdminTabs();
});

// -------------------------------------------------------------
// 1. TABS MANAGEMENT
// -------------------------------------------------------------
function setupAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('bg-red-600', 'text-white'));
      btn.classList.add('bg-red-600', 'text-white');

      const targetTab = btn.getAttribute('data-tab');
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
      const activeEl = document.getElementById(`tab-${targetTab}`);
      if (activeEl) activeEl.classList.remove('hidden');
    });
  });
}

// -------------------------------------------------------------
// 2. STATS & REGISTRATIONS
// -------------------------------------------------------------
async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    const data = await res.json();
    if (data.success && data.stats) {
      document.getElementById('stat-total-users').textContent = data.stats.totalUsers;
      document.getElementById('stat-total-regs').textContent = data.stats.totalRegs;
      document.getElementById('stat-verified-regs').textContent = data.stats.verifiedRegs;
      document.getElementById('stat-pending-regs').textContent = data.stats.pendingRegs;
      document.getElementById('stat-revenue').textContent = `Rp ${Number(data.stats.totalRevenue).toLocaleString('id-ID')}`;
    }
  } catch (err) {
    console.error('Error stats:', err);
  }
}

let allRegistrations = [];
let regCurrentPage = 1;
let regPageSize = 10;
let regSearchKeyword = '';
let regTotalPages = 1;

async function loadRegistrations() {
  const statusFilter = document.getElementById('filter-reg-status')?.value || 'ALL';
  const levelFilter = document.getElementById('filter-reg-level')?.value || 'ALL';

  try {
    const res = await fetch(`/api/admin/registrations?status=${statusFilter}&level=${levelFilter}`, {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    const data = await res.json();
    if (!data.success) return;

    allRegistrations = data.registrations || [];
    regCurrentPage = 1;
    applyRegFiltersAndPagination();
  } catch (err) {
    console.error('Error loading registrations:', err);
  }
}

function handleRegSearch(event) {
  regSearchKeyword = (event.target.value || '').trim().toLowerCase();
  const clearBtn = document.getElementById('btn-clear-reg-search');
  if (clearBtn) {
    if (regSearchKeyword) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  regCurrentPage = 1;
  applyRegFiltersAndPagination();
}

function clearRegSearch() {
  const searchInput = document.getElementById('filter-reg-search');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('btn-clear-reg-search');
  if (clearBtn) clearBtn.classList.add('hidden');
  regSearchKeyword = '';
  regCurrentPage = 1;
  applyRegFiltersAndPagination();
}

function changeRegPageSize(event) {
  regPageSize = parseInt(event.target.value, 10) || 10;
  regCurrentPage = 1;
  applyRegFiltersAndPagination();
}

function goToRegPage(page) {
  if (page < 1 || page > regTotalPages) return;
  regCurrentPage = page;
  applyRegFiltersAndPagination();
}

function applyRegFiltersAndPagination() {
  // Filter by search keyword
  let filtered = allRegistrations;
  if (regSearchKeyword) {
    filtered = allRegistrations.filter(r => {
      const name = (r.full_name || '').toLowerCase();
      const num = (r.registration_number || '').toLowerCase();
      const institution = (r.institution || '').toLowerCase();
      return name.includes(regSearchKeyword) || num.includes(regSearchKeyword) || nik.includes(regSearchKeyword) || email.includes(regSearchKeyword) || phone.includes(regSearchKeyword) || institution.includes(regSearchKeyword);
    });
  }

  const totalItems = filtered.length;
  regTotalPages = Math.max(1, Math.ceil(totalItems / regPageSize));

  if (regCurrentPage > regTotalPages) {
    regCurrentPage = regTotalPages;
  }
  if (regCurrentPage < 1) {
    regCurrentPage = 1;
  }

  const startIndex = (regCurrentPage - 1) * regPageSize;
  const endIndex = Math.min(startIndex + regPageSize, totalItems);
  const pageItems = filtered.slice(startIndex, endIndex);

  renderRegistrationsTable(pageItems);
  renderRegPagination(totalItems, startIndex, endIndex);
}

function renderRegPagination(totalItems, startIndex, endIndex) {
  const startEl = document.getElementById('reg-paging-start');
  const endEl = document.getElementById('reg-paging-end');
  const totalEl = document.getElementById('reg-paging-total');

  if (startEl) startEl.textContent = totalItems === 0 ? 0 : startIndex + 1;
  if (endEl) endEl.textContent = endIndex;
  if (totalEl) totalEl.textContent = totalItems;

  const btnFirst = document.getElementById('reg-btn-first');
  const btnPrev = document.getElementById('reg-btn-prev');
  const btnNext = document.getElementById('reg-btn-next');
  const btnLast = document.getElementById('reg-btn-last');

  if (btnFirst) btnFirst.disabled = regCurrentPage <= 1;
  if (btnPrev) btnPrev.disabled = regCurrentPage <= 1;
  if (btnNext) btnNext.disabled = regCurrentPage >= regTotalPages;
  if (btnLast) btnLast.disabled = regCurrentPage >= regTotalPages;

  const numbersContainer = document.getElementById('reg-page-numbers');
  if (!numbersContainer) return;

  let pages = [];
  const maxButtons = 5;
  let startPage = Math.max(1, regCurrentPage - 2);
  let endPage = Math.min(regTotalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    pages.push(p);
  }

  numbersContainer.innerHTML = pages.map(p => {
    const isActive = p === regCurrentPage;
    const cls = isActive
      ? 'px-3 py-1 rounded-lg text-xs font-bold bg-red-600 text-white shadow-2xs'
      : 'px-3 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors';
    return `<button type="button" onclick="goToRegPage(${p})" class="${cls}">${p}</button>`;
  }).join('');
}

function renderRegistrationsTable(regs) {
  const tbody = document.getElementById('registrations-tbody');
  if (!tbody) return;

  if (regs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">Belum ada data pendaftaran yang sesuai.</td></tr>`;
    return;
  }

  tbody.innerHTML = regs.map(r => {
    let statusBadge = '';
    if (r.payment_status === 'VERIFIED') {
      statusBadge = '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">Terverifikasi</span>';
    } else if (r.payment_status === 'REJECTED') {
      statusBadge = '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800">Ditolak</span>';
    } else {
      statusBadge = '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800">Menunggu Verifikasi</span>';
    }

    const cardBadge = r.exam_card_issued 
      ? '<span class="text-emerald-600 font-bold text-xs">✓ Diterbitkan</span>' 
      : '<span class="text-slate-400 text-xs">Belum</span>';

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
        <td class="py-3 px-4 font-mono font-bold text-xs text-slate-800">${r.registration_number}</td>
        <td class="py-3 px-4">
          <div class="font-bold text-sm text-slate-900">${r.full_name}</div>
          <div class="text-xs text-slate-500">${r.user_email} • NIK: <span class="font-mono font-bold text-slate-700">${r.nik_ktp || '-'}</span></div>
          ${r.institution ? `<div class="text-[11px] text-slate-600 mt-0.5">🏫 ${r.institution}</div>` : ''}
        </td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded font-black text-xs bg-red-50 text-red-700 border border-red-200">${r.exam_level}</span>
          <div class="text-xs text-slate-600 mt-1">${r.exam_period}</div>
        </td>
        <td class="py-3 px-4 font-mono text-xs text-slate-600">${r.birth_date}</td>
        <td class="py-3 px-4">${statusBadge}</td>
        <td class="py-3 px-4">${cardBadge}</td>
        <td class="py-3 px-4 text-right">
          <button onclick="openVerificationModal(${r.id})" class="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-red-600 transition-colors">
            Detail & Proses
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.handleRegSearch = handleRegSearch;
window.clearRegSearch = clearRegSearch;
window.changeRegPageSize = changeRegPageSize;
window.goToRegPage = goToRegPage;

// Verification Modal
let currentRegItem = null;

window.openVerificationModal = function(id) {
  const item = allRegistrations.find(r => r.id === id);
  if (!item) return;

  currentRegItem = item;
  document.getElementById('modal-reg-num').textContent = item.registration_number;
  document.getElementById('modal-reg-name').textContent = item.full_name;
  document.getElementById('modal-reg-nik').textContent = item.nik_ktp || '-';
  document.getElementById('modal-reg-birth').textContent = `${item.birth_place}, ${item.birth_date}`;
  document.getElementById('modal-reg-phone').textContent = item.phone;
  document.getElementById('modal-reg-institution').textContent = item.institution || '-';
  document.getElementById('modal-reg-address').textContent = `${item.address || '-'}${item.postal_code ? ` (Kode Pos: ${item.postal_code})` : ''}`;
  document.getElementById('modal-reg-cert-address').textContent = `${item.certificate_delivery_address || item.address || '-'}${item.certificate_postal_code ? ` (Kode Pos: ${item.certificate_postal_code})` : ''}`;
  document.getElementById('modal-reg-level').textContent = `${item.exam_level} (${item.exam_period})`;
  document.getElementById('modal-reg-amount').textContent = `Rp ${Number(item.payment_amount).toLocaleString('id-ID')}`;
  document.getElementById('modal-reg-method').textContent = item.payment_method;

  // Virtual Account Info
  const vaBadge = document.getElementById('modal-va-bank-badge');
  const vaNum = document.getElementById('modal-va-number');
  const vaStatus = document.getElementById('modal-va-status-text');
  if (vaBadge) vaBadge.textContent = item.va_bank ? `VA ${item.va_bank}` : 'VA BNI';
  if (vaNum) vaNum.textContent = item.va_number || (item.va_bank === 'QRIS' ? 'QRIS Standar BI' : '-');
  if (vaStatus) vaStatus.textContent = item.va_bank === 'QRIS' ? 'Pembayaran via QRIS' : `Kanal ${item.va_bank || 'BNI'} Otomatis`;

  // Images: KTP, Pasfoto, Bukti Bayar, and Institusi
  const ktpImg = document.getElementById('modal-ktp-img');
  if (item.photo_ktp_path) {
    ktpImg.src = item.photo_ktp_path;
    ktpImg.classList.remove('hidden');
    document.getElementById('modal-ktp-empty').classList.add('hidden');
  } else {
    ktpImg.classList.add('hidden');
    document.getElementById('modal-ktp-empty').classList.remove('hidden');
  }

  const fotoImg = document.getElementById('modal-foto-img');
  if (item.photo_pasfoto_path) {
    fotoImg.src = item.photo_pasfoto_path;
    fotoImg.classList.remove('hidden');
    document.getElementById('modal-foto-empty').classList.add('hidden');
  } else {
    fotoImg.classList.add('hidden');
    document.getElementById('modal-foto-empty').classList.remove('hidden');
  }

  const instImg = document.getElementById('modal-institution-img');
  if (instImg) {
    if (item.photo_institution_path) {
      instImg.src = item.photo_institution_path;
      instImg.classList.remove('hidden');
      document.getElementById('modal-institution-empty').classList.add('hidden');
    } else {
      instImg.classList.add('hidden');
      document.getElementById('modal-institution-empty').classList.remove('hidden');
    }
  }

  const proofImg = document.getElementById('modal-proof-img');
  if (item.payment_proof_path) {
    proofImg.src = item.payment_proof_path;
    proofImg.classList.remove('hidden');
    document.getElementById('modal-proof-empty').classList.add('hidden');
  } else {
    proofImg.classList.add('hidden');
    document.getElementById('modal-proof-empty').classList.remove('hidden');
  }

  document.getElementById('modal-status-select').value = item.payment_status;
  document.getElementById('modal-card-issued').checked = !!item.exam_card_issued;
  document.getElementById('modal-notes').value = item.notes || '';

  document.getElementById('verification-modal').classList.remove('hidden');
};

window.closeVerificationModal = function() {
  document.getElementById('verification-modal').classList.add('hidden');
};

window.saveVerificationStatus = async function() {
  if (!currentRegItem) return;

  const status = document.getElementById('modal-status-select').value;
  const issueCard = document.getElementById('modal-card-issued').checked;
  const notes = document.getElementById('modal-notes').value;

  try {
    const res = await fetch(`/api/admin/registrations/${currentRegItem.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({
        status,
        issue_card: issueCard,
        notes
      })
    });
    const result = await res.json();
    if (result.success) {
      alert('Status pendaftaran berhasil diperbarui!');
      closeVerificationModal();
      await loadRegistrations();
      await loadAdminStats();
    } else {
      alert(result.message || 'Gagal update status');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan');
  }
};

// -------------------------------------------------------------
// 3. USER & ROLE MANAGEMENT
// -------------------------------------------------------------
let allUsersList = [];
let userCurrentPage = 1;
let userPageSize = 10;
let userSearchKeyword = '';
let userTotalPages = 1;

async function loadUserManagement() {
  try {
    const res = await fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    const data = await res.json();
    if (!data.success) return;

    allUsersList = data.users || [];
    userCurrentPage = 1;
    applyUserFiltersAndPagination();
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

function handleUserSearch(event) {
  userSearchKeyword = (event.target.value || '').trim().toLowerCase();
  const clearBtn = document.getElementById('btn-clear-user-search');
  if (clearBtn) {
    if (userSearchKeyword) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  userCurrentPage = 1;
  applyUserFiltersAndPagination();
}

function clearUserSearch() {
  const searchInput = document.getElementById('filter-user-search');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('btn-clear-user-search');
  if (clearBtn) clearBtn.classList.add('hidden');
  userSearchKeyword = '';
  userCurrentPage = 1;
  applyUserFiltersAndPagination();
}

function changeUserPageSize(event) {
  userPageSize = parseInt(event.target.value, 10) || 10;
  userCurrentPage = 1;
  applyUserFiltersAndPagination();
}

function goToUserPage(page) {
  if (page < 1 || page > userTotalPages) return;
  userCurrentPage = page;
  applyUserFiltersAndPagination();
}

function filterUserTable() {
  userCurrentPage = 1;
  applyUserFiltersAndPagination();
}

function applyUserFiltersAndPagination() {
  const roleFilter = document.getElementById('filter-user-role')?.value || 'ALL';

  let filtered = allUsersList;
  if (roleFilter !== 'ALL') {
    filtered = filtered.filter(u => u.role === roleFilter);
  }

  if (userSearchKeyword) {
    filtered = filtered.filter(u => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      const id = String(u.id || '');
      return name.includes(userSearchKeyword) || email.includes(userSearchKeyword) || phone.includes(userSearchKeyword) || id.includes(userSearchKeyword);
    });
  }

  const totalItems = filtered.length;
  userTotalPages = Math.max(1, Math.ceil(totalItems / userPageSize));

  if (userCurrentPage > userTotalPages) {
    userCurrentPage = userTotalPages;
  }
  if (userCurrentPage < 1) {
    userCurrentPage = 1;
  }

  const startIndex = (userCurrentPage - 1) * userPageSize;
  const endIndex = Math.min(startIndex + userPageSize, totalItems);
  const pageItems = filtered.slice(startIndex, endIndex);

  renderUsersTable(pageItems);
  renderUserPagination(totalItems, startIndex, endIndex);
}

function renderUserPagination(totalItems, startIndex, endIndex) {
  const startEl = document.getElementById('user-paging-start');
  const endEl = document.getElementById('user-paging-end');
  const totalEl = document.getElementById('user-paging-total');

  if (startEl) startEl.textContent = totalItems === 0 ? 0 : startIndex + 1;
  if (endEl) endEl.textContent = endIndex;
  if (totalEl) totalEl.textContent = totalItems;

  const btnFirst = document.getElementById('user-btn-first');
  const btnPrev = document.getElementById('user-btn-prev');
  const btnNext = document.getElementById('user-btn-next');
  const btnLast = document.getElementById('user-btn-last');

  if (btnFirst) btnFirst.disabled = userCurrentPage <= 1;
  if (btnPrev) btnPrev.disabled = userCurrentPage <= 1;
  if (btnNext) btnNext.disabled = userCurrentPage >= userTotalPages;
  if (btnLast) btnLast.disabled = userCurrentPage >= userTotalPages;

  const numbersContainer = document.getElementById('user-page-numbers');
  if (!numbersContainer) return;

  let pages = [];
  const maxButtons = 5;
  let startPage = Math.max(1, userCurrentPage - 2);
  let endPage = Math.min(userTotalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    pages.push(p);
  }

  numbersContainer.innerHTML = pages.map(p => {
    const isActive = p === userCurrentPage;
    const cls = isActive
      ? 'px-3 py-1 rounded-lg text-xs font-bold bg-red-600 text-white shadow-2xs'
      : 'px-3 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors';
    return `<button type="button" onclick="goToUserPage(${p})" class="${cls}">${p}</button>`;
  }).join('');
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">Belum ada akun pengguna yang sesuai dengan kriteria pencarian/filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    let roleBadge = '';
    if (u.role === 'ADMIN') {
      roleBadge = '<span class="px-2.5 py-1 text-xs font-black rounded-full bg-red-100 text-red-800 border border-red-300">ADMINISTRATOR</span>';
    } else if (u.role === 'VERIFIKATOR') {
      roleBadge = '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-300">VERIFIKATOR</span>';
    } else {
      roleBadge = '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">PESERTA</span>';
    }

    const statusBadge = u.status === 'ACTIVE'
      ? '<span class="text-emerald-600 font-bold text-xs">Aktif</span>'
      : '<span class="text-rose-600 font-bold text-xs">Suspended</span>';

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
        <td class="py-3 px-4 font-mono text-xs text-slate-500">#${u.id}</td>
        <td class="py-3 px-4">
          <div class="font-bold text-sm text-slate-900">${u.name}</div>
          <div class="text-xs text-slate-500">${u.email}</div>
        </td>
        <td class="py-3 px-4">${roleBadge}</td>
        <td class="py-3 px-4 text-xs text-slate-600">${u.phone || '-'}</td>
        <td class="py-3 px-4">${statusBadge}</td>
        <td class="py-3 px-4 text-xs text-slate-500">${u.registration_count} Ujian</td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="openEditRoleModal(${u.id})" class="px-2.5 py-1 text-xs font-medium rounded bg-slate-100 hover:bg-slate-200 text-slate-800" title="Ubah Role & Status">
              Ubah Role
            </button>
            <button onclick="promptResetPassword(${u.id}, '${u.name}')" class="px-2.5 py-1 text-xs font-medium rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200" title="Reset Sandi">
              Reset Sandi
            </button>
            <button onclick="confirmDeleteUser(${u.id}, '${u.name}')" class="px-2.5 py-1 text-xs font-medium rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200" title="Hapus User">
              Hapus
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.filterUserTable = filterUserTable;
window.handleUserSearch = handleUserSearch;
window.clearUserSearch = clearUserSearch;
window.changeUserPageSize = changeUserPageSize;
window.goToUserPage = goToUserPage;

// Modal Tambah User Baru
window.openAddUserModal = function() {
  document.getElementById('add-user-modal').classList.remove('hidden');
};
window.closeAddUserModal = function() {
  document.getElementById('add-user-modal').classList.add('hidden');
};

window.handleAddUserSubmit = async function(e) {
  e.preventDefault();
  const name = document.getElementById('new_user_name').value;
  const email = document.getElementById('new_user_email').value;
  const password = document.getElementById('new_user_password').value;
  const role = document.getElementById('new_user_role').value;
  const phone = document.getElementById('new_user_phone').value;

  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({ name, email, password, role, phone })
    });
    const result = await res.json();
    if (result.success) {
      alert(`User ${name} dengan role ${role} berhasil ditambahkan!`);
      closeAddUserModal();
      await loadUserManagement();
    } else {
      alert(result.message || 'Gagal menambahkan user');
    }
  } catch (err) {
    alert('Terjadi kesalahan sistem');
  }
};

// Ubah Role Modal
let editingUser = null;

window.openEditRoleModal = function(id) {
  const user = allUsersList.find(u => u.id === id);
  if (!user) return;
  editingUser = user;

  document.getElementById('edit-role-name').textContent = user.name;
  document.getElementById('edit-role-email').textContent = user.email;
  document.getElementById('edit-user-role-select').value = user.role;
  document.getElementById('edit-user-status-select').value = user.status;

  document.getElementById('edit-role-modal').classList.remove('hidden');
};

window.closeEditRoleModal = function() {
  document.getElementById('edit-role-modal').classList.add('hidden');
};

window.handleSaveRoleChange = async function() {
  if (!editingUser) return;

  const newRole = document.getElementById('edit-user-role-select').value;
  const newStatus = document.getElementById('edit-user-status-select').value;

  try {
    const res = await fetch(`/api/admin/users/${editingUser.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({ role: newRole, status: newStatus })
    });
    const result = await res.json();
    if (result.success) {
      alert('Role dan status pengguna berhasil diperbarui!');
      closeEditRoleModal();
      await loadUserManagement();
    } else {
      alert(result.message || 'Gagal update role');
    }
  } catch (err) {
    alert('Gagal menghubungi server');
  }
};

window.promptResetPassword = async function(id, name) {
  const newPass = prompt(`Masukkan kata sandi baru untuk pengguna "${name}" (minimal 6 karakter):`);
  if (!newPass) return;

  if (newPass.length < 6) {
    alert('Kata sandi harus minimal 6 karakter.');
    return;
  }

  try {
    const res = await fetch(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({ new_password: newPass })
    });
    const result = await res.json();
    if (result.success) {
      alert(`Kata sandi untuk ${name} berhasil direset! Pengguna dapat login dengan sandi baru.`);
    } else {
      alert(result.message || 'Gagal reset sandi');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan');
  }
};

window.confirmDeleteUser = async function(id, name) {
  if (!confirm(`Apakah Anda yakin ingin menghapus user "${name}"?\nTindakan ini tidak dapat dibatalkan.`)) return;

  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    const result = await res.json();
    if (result.success) {
      alert('Pengguna berhasil dihapus.');
      await loadUserManagement();
    } else {
      alert(result.message || 'Gagal menghapus pengguna.');
    }
  } catch (err) {
    alert('Terjadi kesalahan');
  }
};

// -------------------------------------------------------------
// 4. CMS EDITOR FOR LANDING PAGE
// -------------------------------------------------------------
let loadedCmsSections = {};

async function loadCmsEditorData() {
  try {
    const res = await fetch('/api/cms');
    const result = await res.json();
    if (!result.success || !result.cms) return;

    loadedCmsSections = result.cms;

    // Populate Hero Form
    if (result.cms.hero?.data) {
      const d = result.cms.hero.data;
      document.getElementById('cms_hero_announcement').value = d.announcement_bar || '';
      document.getElementById('cms_hero_badge').value = d.hero_badge || '';
      document.getElementById('cms_hero_title').value = d.hero_title || '';
      document.getElementById('cms_hero_subtitle').value = d.hero_subtitle || '';
    }

    // Populate Location Form
    if (result.cms.location?.data) {
      const d = result.cms.location.data;
      document.getElementById('cms_loc_venue').value = d.venue_name || '';
      document.getElementById('cms_loc_address').value = d.address || '';
      document.getElementById('cms_loc_map_embed').value = d.map_embed_url || '';
      document.getElementById('cms_loc_map_link').value = d.google_maps_link || '';
    }

    // Populate Dresscode Form
    if (result.cms.dresscode?.data) {
      const d = result.cms.dresscode.data;
      document.getElementById('cms_dresscode_summary').value = d.summary || '';
      document.getElementById('cms_dresscode_allowed').value = (d.allowed || []).join('\n');
      document.getElementById('cms_dresscode_prohibited').value = (d.prohibited || []).join('\n');
      document.getElementById('cms_dresscode_special').value = d.special_rule || '';
    }

    // Populate Stationery Form
    if (result.cms.stationery?.data) {
      const d = result.cms.stationery.data;
      document.getElementById('cms_stationery_summary').value = d.summary || '';
      document.getElementById('cms_stationery_prohibited').value = (d.prohibited_on_desk || []).join('\n');
    }

    // Populate Payment Form
    if (result.cms.payment?.data) {
      const d = result.cms.payment.data;
      document.getElementById('cms_payment_policy').value = d.payment_policy || '';
    }

    // Render schedule editor table
    renderScheduleEditorTable();

    // Populate Header Logo Editor
    populateHeaderLogoForm(result.cms.header_logo?.data);

    // Populate Image Slider Editor (Max 3 Images)
    populateSliderForm(result.cms.slider?.data);

    // Render FAQ Editor List
    renderFaqEditorList(result.cms.faq);

    // Populate Footer Editor
    populateFooterForm(result.cms.footer?.data);

    // Render Navigation Menu Table
    if (result.cms.navigation?.data?.menus) {
      currentNavMenus = JSON.parse(JSON.stringify(result.cms.navigation.data.menus));
    } else {
      currentNavMenus = [
        { id: 1, label: 'Jadwal Ujian', url: '#jadwal', target: '_self', is_active: true },
        { id: 2, label: 'Akses Lokasi', url: '#lokasi', target: '_self', is_active: true },
        { id: 3, label: 'Aturan Pakaian', url: '#aturan-pakaian', target: '_self', is_active: true },
        { id: 4, label: 'ATK Wajib', url: '#atk-wajib', target: '_self', is_active: true },
        { id: 5, label: 'Biaya & Pembayaran', url: '#pembayaran', target: '_self', is_active: true },
        { id: 6, label: 'FAQ', url: '#faq', target: '_self', is_active: true }
      ];
    }
    renderNavMenusTable();
  } catch (err) {
    console.error('Error loading CMS data:', err);
  }
}

// -------------------------------------------------------------
// NAVIGATION MENU EDITOR (TAMBAH, EDIT, HAPUS, URUTKAN)
// -------------------------------------------------------------
// -------------------------------------------------------------
// NAVIGATION MENU EDITOR & REORDERING (TAMBAH, EDIT, HAPUS, URUTKAN)
// -------------------------------------------------------------
let currentNavMenus = [];
let draggedNavIndex = null;

function renderNavPreviewStrip() {
  const preview = document.getElementById('cms-nav-preview-strip');
  if (!preview) return;

  if (currentNavMenus.length === 0) {
    preview.innerHTML = '<span class="text-xs text-slate-400 italic">Belum ada menu yang dikonfigurasi.</span>';
    return;
  }

  const itemsHtml = currentNavMenus.map((item, index) => {
    const isActive = item.is_active !== false;
    return `
      <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
        isActive
          ? 'bg-white text-slate-800 border border-slate-300 shadow-2xs hover:border-red-400'
          : 'bg-slate-100 text-slate-400 border border-dashed border-slate-300 opacity-60'
      }">
        <span class="w-4 h-4 rounded-full ${isActive ? 'bg-red-600 text-white' : 'bg-slate-300 text-slate-600'} text-[10px] flex items-center justify-center font-black">${index + 1}</span>
        <span>${item.label}</span>
        ${!isActive ? '<span class="text-[9px] uppercase tracking-wider text-slate-400">(Nonaktif)</span>' : ''}
      </div>
    `;
  }).join('<span class="text-slate-300 text-xs font-bold">→</span>');

  preview.innerHTML = itemsHtml;
}

function renderNavMenusTable() {
  const tbody = document.getElementById('cms-nav-menus-tbody');
  if (!tbody) return;

  renderNavPreviewStrip();

  if (currentNavMenus.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">Belum ada menu navigasi. Klik "+ Tambah Menu Baru" di atas.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentNavMenus.map((item, index) => {
    const isActive = item.is_active !== false;
    const statusBadge = isActive
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Aktif</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">Nonaktif</span>`;

    // Generate position dropdown options
    const positionOptions = currentNavMenus.map((_, pIdx) => {
      const pos = pIdx + 1;
      return `<option value="${pos}" ${pos === index + 1 ? 'selected' : ''}>Posisi #${pos}${pos === 1 ? ' (Awal)' : ''}${pos === currentNavMenus.length ? ' (Akhir)' : ''}</option>`;
    }).join('');

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-all select-none"
          draggable="true"
          data-index="${index}"
          ondragstart="handleNavDragStart(event, ${index})"
          ondragover="handleNavDragOver(event, ${index})"
          ondragleave="handleNavDragLeave(event)"
          ondrop="handleNavDrop(event, ${index})"
          ondragend="handleNavDragEnd(event)">
        
        <!-- Drag Handle -->
        <td class="py-2.5 px-3 text-center drag-handle text-slate-400 hover:text-red-600 font-bold text-base transition-colors" title="Klik dan geser (drag & drop) untuk memindahkan urutan baris menu ini">
          ⠿
        </td>

        <!-- Position Dropdown / Order Number -->
        <td class="py-2.5 px-3 text-center">
          <select onchange="changeMenuPosition(${index}, parseInt(this.value, 10))" class="px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono font-bold text-center text-xs text-slate-800 focus:ring-2 focus:ring-red-500 outline-none shadow-2xs" title="Pindah posisi urutan langsung">
            ${positionOptions}
          </select>
        </td>

        <!-- Menu Label -->
        <td class="py-2.5 px-3">
          <div class="font-bold text-slate-900">${item.label}</div>
        </td>

        <!-- Target Link -->
        <td class="py-2.5 px-3 font-mono text-xs text-red-600 bg-red-50/50 rounded inline-block my-1.5 px-2 py-0.5">${item.url}</td>

        <!-- Window Target -->
        <td class="py-2.5 px-3 font-mono text-slate-500 text-[11px]">${item.target === '_blank' ? 'Tab Baru (_blank)' : 'Halaman Ini (_self)'}</td>

        <!-- Active Toggle -->
        <td class="py-2.5 px-3 text-center">
          <button onclick="toggleMenuItemActive(${index})" class="cursor-pointer" title="Klik untuk ubah status aktif">
            ${statusBadge}
          </button>
        </td>

        <!-- Actions & Quick Reordering -->
        <td class="py-2.5 px-3 text-right">
          <div class="flex items-center justify-end gap-1">
            <button onclick="moveMenuItemToTop(${index})" ${index === 0 ? 'disabled class="opacity-20 cursor-not-allowed p-1"' : 'class="p-1 hover:bg-slate-200 rounded text-slate-700 font-bold"'} title="Pindah ke Paling Atas / Posisi 1">
              ⤒
            </button>
            <button onclick="moveMenuItemUp(${index})" ${index === 0 ? 'disabled class="opacity-20 cursor-not-allowed p-1"' : 'class="p-1 hover:bg-slate-200 rounded text-slate-700 font-bold"'} title="Naikkan 1 Posisi (▲)">
              ▲
            </button>
            <button onclick="moveMenuItemDown(${index})" ${index === currentNavMenus.length - 1 ? 'disabled class="opacity-20 cursor-not-allowed p-1"' : 'class="p-1 hover:bg-slate-200 rounded text-slate-700 font-bold"'} title="Turunkan 1 Posisi (▼)">
              ▼
            </button>
            <button onclick="moveMenuItemToBottom(${index})" ${index === currentNavMenus.length - 1 ? 'disabled class="opacity-20 cursor-not-allowed p-1"' : 'class="p-1 hover:bg-slate-200 rounded text-slate-700 font-bold"'} title="Pindah ke Paling Bawah">
              ⤓
            </button>
            <button onclick="openEditMenuModal(${index})" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-[11px] ml-1">
              ✏️ Edit
            </button>
            <button onclick="deleteMenuItem(${index})" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded font-semibold text-[11px]">
              🗑️ Hapus
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// HTML5 Drag and Drop Handlers for Table Rows
window.handleNavDragStart = function(e, index) {
  draggedNavIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(index));
  const row = e.currentTarget;
  setTimeout(() => row.classList.add('nav-row-dragging'), 0);
};

window.handleNavDragOver = function(e, index) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const row = e.currentTarget;
  if (!row.classList.contains('nav-row-drag-over')) {
    row.classList.add('nav-row-drag-over');
  }
};

window.handleNavDragLeave = function(e) {
  e.currentTarget.classList.remove('nav-row-drag-over');
};

window.handleNavDrop = async function(e, targetIndex) {
  e.preventDefault();
  e.currentTarget.classList.remove('nav-row-drag-over');
  
  if (draggedNavIndex === null || draggedNavIndex === targetIndex) return;

  const [movedItem] = currentNavMenus.splice(draggedNavIndex, 1);
  currentNavMenus.splice(targetIndex, 0, movedItem);
  draggedNavIndex = null;

  renderNavMenusTable();
  await saveCmsNavigation(false);
};

window.handleNavDragEnd = function(e) {
  draggedNavIndex = null;
  document.querySelectorAll('#cms-nav-menus-tbody tr').forEach(row => {
    row.classList.remove('nav-row-dragging');
    row.classList.remove('nav-row-drag-over');
  });
};

// Direct Position Jump
window.changeMenuPosition = async function(oldIndex, targetPosition) {
  const targetIndex = targetPosition - 1;
  if (oldIndex === targetIndex || targetIndex < 0 || targetIndex >= currentNavMenus.length) return;

  const [movedItem] = currentNavMenus.splice(oldIndex, 1);
  currentNavMenus.splice(targetIndex, 0, movedItem);

  renderNavMenusTable();
  await saveCmsNavigation(false);
};

window.moveMenuItemToTop = async function(index) {
  if (index <= 0) return;
  const [movedItem] = currentNavMenus.splice(index, 1);
  currentNavMenus.unshift(movedItem);
  renderNavMenusTable();
  await saveCmsNavigation(false);
};

window.moveMenuItemToBottom = async function(index) {
  if (index >= currentNavMenus.length - 1) return;
  const [movedItem] = currentNavMenus.splice(index, 1);
  currentNavMenus.push(movedItem);
  renderNavMenusTable();
  await saveCmsNavigation(false);
};

window.moveMenuItemUp = async function(index) {
  if (index <= 0) return;
  const temp = currentNavMenus[index];
  currentNavMenus[index] = currentNavMenus[index - 1];
  currentNavMenus[index - 1] = temp;
  renderNavMenusTable();
  await saveCmsNavigation(false);
};

window.moveMenuItemDown = async function(index) {
  if (index >= currentNavMenus.length - 1) return;
  const temp = currentNavMenus[index];
  currentNavMenus[index] = currentNavMenus[index + 1];
  currentNavMenus[index + 1] = temp;
  renderNavMenusTable();
  await saveCmsNavigation(false);
};

// Alphabetical Sorting Tools (A-Z & Z-A)
window.sortNavMenusAlphabetical = async function(direction = 'asc') {
  if (currentNavMenus.length <= 1) return;

  currentNavMenus.sort((a, b) => {
    const cmp = (a.label || '').localeCompare(b.label || '', 'id', { sensitivity: 'base' });
    return direction === 'asc' ? cmp : -cmp;
  });

  renderNavMenusTable();
  await saveCmsNavigation(true);
};

// Reset to Recommended Standard Sequence
window.resetNavMenusDefaultOrder = async function() {
  const defaultOrderUrls = ['#jadwal', '#lokasi', '#aturan-pakaian', '#atk-wajib', '#pembayaran', '#faq'];
  
  currentNavMenus.sort((a, b) => {
    let idxA = defaultOrderUrls.indexOf(a.url);
    let idxB = defaultOrderUrls.indexOf(b.url);
    if (idxA === -1) idxA = 999;
    if (idxB === -1) idxB = 999;
    if (idxA !== idxB) return idxA - idxB;
    return (a.label || '').localeCompare(b.label || '', 'id');
  });

  renderNavMenusTable();
  await saveCmsNavigation(true);
};

window.openAddMenuModal = function() {
  document.getElementById('nav-menu-modal-title').textContent = 'Tambah Menu Navigasi Baru';
  document.getElementById('menu_edit_id').value = '';
  document.getElementById('menu_label').value = '';
  document.getElementById('menu_url').value = '#';
  document.getElementById('menu_target').value = '_self';
  document.getElementById('menu_active').value = 'true';

  // Populate Position dropdown
  const posSelect = document.getElementById('menu_position');
  if (posSelect) {
    const count = currentNavMenus.length;
    let opts = '';
    for (let i = 1; i <= count; i++) {
      opts += `<option value="${i}">Posisi #${i}${i === 1 ? ' (Paling Awal)' : ''}</option>`;
    }
    opts += `<option value="${count + 1}" selected>Posisi #${count + 1} (Paling Akhir - Rekomendasi)</option>`;
    posSelect.innerHTML = opts;
  }

  document.getElementById('nav-menu-modal').classList.remove('hidden');
};

window.openEditMenuModal = function(index) {
  const item = currentNavMenus[index];
  if (!item) return;

  document.getElementById('nav-menu-modal-title').textContent = `Ubah Menu: ${item.label}`;
  document.getElementById('menu_edit_id').value = String(index);
  document.getElementById('menu_label').value = item.label || '';
  document.getElementById('menu_url').value = item.url || '';
  document.getElementById('menu_target').value = item.target || '_self';
  document.getElementById('menu_active').value = item.is_active !== false ? 'true' : 'false';

  // Populate Position dropdown
  const posSelect = document.getElementById('menu_position');
  if (posSelect) {
    const count = currentNavMenus.length;
    let opts = '';
    for (let i = 1; i <= count; i++) {
      opts += `<option value="${i}" ${i === index + 1 ? 'selected' : ''}>Posisi #${i}${i === 1 ? ' (Paling Awal)' : ''}${i === count ? ' (Paling Akhir)' : ''}</option>`;
    }
    posSelect.innerHTML = opts;
  }

  document.getElementById('nav-menu-modal').classList.remove('hidden');
};

window.closeNavMenuModal = function() {
  document.getElementById('nav-menu-modal').classList.add('hidden');
};

window.handleNavMenuSubmit = async function(e) {
  e.preventDefault();
  const editIndexStr = document.getElementById('menu_edit_id').value;
  const label = document.getElementById('menu_label').value.trim();
  const url = document.getElementById('menu_url').value.trim();
  const target = document.getElementById('menu_target').value;
  const is_active = document.getElementById('menu_active').value === 'true';
  const chosenPos = parseInt(document.getElementById('menu_position')?.value || '1', 10);

  if (!label || !url) {
    alert('Nama label menu dan URL tujuan wajib diisi.');
    return;
  }

  if (editIndexStr !== '') {
    // Edit existing item
    const oldIdx = parseInt(editIndexStr, 10);
    if (currentNavMenus[oldIdx]) {
      const updatedItem = {
        ...currentNavMenus[oldIdx],
        label,
        url,
        target,
        is_active
      };

      // Remove from old position and insert at new target position
      currentNavMenus.splice(oldIdx, 1);
      const newIdx = Math.max(0, Math.min(chosenPos - 1, currentNavMenus.length));
      currentNavMenus.splice(newIdx, 0, updatedItem);
    }
  } else {
    // Add new item at chosen position
    const newItem = {
      id: Date.now(),
      label,
      url,
      target,
      is_active
    };
    const targetIdx = Math.max(0, Math.min(chosenPos - 1, currentNavMenus.length));
    currentNavMenus.splice(targetIdx, 0, newItem);
  }

  closeNavMenuModal();
  renderNavMenusTable();

  // Auto-save to CMS
  await saveCmsNavigation(false);
};

window.toggleMenuItemActive = async function(index) {
  if (!currentNavMenus[index]) return;
  currentNavMenus[index].is_active = !currentNavMenus[index].is_active;
  renderNavMenusTable();
  await saveCmsNavigation(false);
};

window.deleteMenuItem = async function(index) {
  const item = currentNavMenus[index];
  if (!item) return;

  if (!confirm(`Hapus menu "${item.label}" dari header navigasi website?`)) return;

  currentNavMenus.splice(index, 1);
  renderNavMenusTable();
  await saveCmsNavigation(true);
};

window.saveCmsNavigation = async function(showAlert = true) {
  try {
    const res = await fetch('/api/cms/navigation', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({
        title: 'Pengaturan Menu Navigasi Header',
        subtitle: 'Daftar menu navigasi utama di header website',
        data: { menus: currentNavMenus }
      })
    });
    const result = await res.json();
    if (result.success) {
      if (showAlert) {
        alert('Menu navigasi header berhasil disimpan dan langsung diperbarui di Halaman Depan!');
      }
    } else {
      alert(result.message || 'Gagal menyimpan menu navigasi');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan saat menyimpan menu.');
  }
};

// Save Hero
window.saveCmsHero = async function() {
  const current = loadedCmsSections.hero?.data || {};
  const updated = {
    ...current,
    announcement_bar: document.getElementById('cms_hero_announcement').value,
    hero_badge: document.getElementById('cms_hero_badge').value,
    hero_title: document.getElementById('cms_hero_title').value,
    hero_subtitle: document.getElementById('cms_hero_subtitle').value
  };

  await saveCmsSection('hero', 'Pengaturan Hero & Banner Depan', 'Informasi utama bagian atas', updated);
};

// Save Location
window.saveCmsLocation = async function() {
  const current = loadedCmsSections.location?.data || {};
  const updated = {
    ...current,
    venue_name: document.getElementById('cms_loc_venue').value,
    address: document.getElementById('cms_loc_address').value,
    map_embed_url: document.getElementById('cms_loc_map_embed').value,
    google_maps_link: document.getElementById('cms_loc_map_link').value
  };

  await saveCmsSection('location', 'Akses & Lokasi Ujian', 'Panduan lokasi di UI Depok', updated);
};

// Save Dresscode
window.saveCmsDresscode = async function() {
  const current = loadedCmsSections.dresscode?.data || {};
  const allowed = document.getElementById('cms_dresscode_allowed').value.split('\n').map(s => s.trim()).filter(Boolean);
  const prohibited = document.getElementById('cms_dresscode_prohibited').value.split('\n').map(s => s.trim()).filter(Boolean);

  const updated = {
    ...current,
    summary: document.getElementById('cms_dresscode_summary').value,
    allowed,
    prohibited,
    special_rule: document.getElementById('cms_dresscode_special').value
  };

  await saveCmsSection('dresscode', 'Aturan Pakaian (Dress Code)', 'Ketentuan pakaian resmi', updated);
};

// Save Stationery
window.saveCmsStationery = async function() {
  const current = loadedCmsSections.stationery?.data || {};
  const prohibited = document.getElementById('cms_stationery_prohibited').value.split('\n').map(s => s.trim()).filter(Boolean);

  const updated = {
    ...current,
    summary: document.getElementById('cms_stationery_summary').value,
    prohibited_on_desk: prohibited
  };

  await saveCmsSection('stationery', 'ATK & Perlengkapan Wajib Ujian', 'Alat tulis wajib dan terlarang', updated);
};

// Save Payment Policy
window.saveCmsPayment = async function() {
  const current = loadedCmsSections.payment?.data || {};
  const updated = {
    ...current,
    payment_policy: document.getElementById('cms_payment_policy').value
  };

  await saveCmsSection('payment', 'Tata Cara & Rincian Pembayaran', 'Panduan pembayaran biaya ujian', updated);
};

async function saveCmsSection(sectionKey, title, subtitle, data) {
  try {
    const res = await fetch(`/api/cms/${sectionKey}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({ title, subtitle, data })
    });
    const result = await res.json();
    if (result.success) {
      alert(`Konten '${title}' berhasil disimpan dan langsung diperbarui di Halaman Depan!`);
      await loadCmsEditorData();
    } else {
      alert(result.message || 'Gagal menyimpan konten');
    }
  } catch (err) {
    alert('Terjadi kesalahan jaringan saat menyimpan konten.');
  }
}

// Schedule CMS Table Editor
function renderScheduleEditorTable() {
  const schedContainer = document.getElementById('cms-schedules-list');
  if (!schedContainer) return;

  const schedules = loadedCmsSections.schedule?.data?.schedules || [];
  schedContainer.innerHTML = schedules.map((item, index) => `
    <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="font-bold text-slate-900">${item.name}</div>
        <div class="text-xs text-slate-500">Ujian: <strong class="text-slate-800">${item.exam_date}</strong> • Pendaftaran: ${item.registration_period}</div>
      </div>
      <div class="flex items-center gap-3">
        <select onchange="updateScheduleStatus(${index}, this.value)" class="px-2.5 py-1 text-xs rounded border border-slate-300 bg-white font-semibold">
          <option value="BUKA" ${item.status === 'BUKA' ? 'selected' : ''}>Pendaftaran Buka</option>
          <option value="SEGERA" ${item.status === 'SEGERA' ? 'selected' : ''}>Segera Hadir</option>
          <option value="SELESAI" ${item.status === 'SELESAI' ? 'selected' : ''}>Selesai</option>
        </select>
        <button onclick="deleteScheduleItem(${index})" class="text-red-600 hover:text-red-800 text-xs font-semibold px-2 py-1">Hapus</button>
      </div>
    </div>
  `).join('');
}

window.addNewSchedulePrompt = async function() {
  const name = prompt('Nama Gelombang (Contoh: Gelombang 7 - Januari 2027):');
  if (!name) return;
  const exam_date = prompt('Tanggal Ujian (Contoh: 17 Januari 2027):');
  if (!exam_date) return;
  const registration_period = prompt('Periode Pendaftaran (Contoh: 1 Nov 2026 - 20 Des 2026):');
  if (!registration_period) return;
  const result_date = prompt('Tanggal Hasil Ujian (Contoh: 05 Februari 2027):');

  const current = loadedCmsSections.schedule?.data || { schedules: [] };
  const schedules = current.schedules || [];

  schedules.push({
    id: Date.now(),
    name,
    exam_date,
    registration_period,
    result_date: result_date || '3 Minggu setelah ujian',
    levels: ['5Q', '4Q', '3Q', '2Q', '1Q'],
    status: 'BUKA',
    badge_color: 'emerald'
  });

  current.schedules = schedules;
  await saveCmsSection('schedule', 'Jadwal Ujian NAT-TEST', 'Jadwal resmi pelaksanaan ujian', current);
  renderScheduleEditorTable();
};

window.updateScheduleStatus = async function(index, newStatus) {
  const current = loadedCmsSections.schedule?.data;
  if (!current || !current.schedules[index]) return;

  current.schedules[index].status = newStatus;
  await saveCmsSection('schedule', 'Jadwal Ujian NAT-TEST', 'Jadwal resmi pelaksanaan ujian', current);
};

window.deleteScheduleItem = async function(index) {
  if (!confirm('Hapus jadwal gelombang ini?')) return;
  const current = loadedCmsSections.schedule?.data;
  if (!current || !current.schedules[index]) return;

  current.schedules.splice(index, 1);
  await saveCmsSection('schedule', 'Jadwal Ujian NAT-TEST', 'Jadwal resmi pelaksanaan ujian', current);
  renderScheduleEditorTable();
};

// -------------------------------------------------------------
// 4B. HEADER LOGO CMS MANAGEMENT (UBAH & KURANGI LOGO)
// -------------------------------------------------------------
function populateHeaderLogoForm(logoData) {
  const d = logoData || {
    logo_1: {
      enabled: true,
      url: '/images/logo-nat-test.svg',
      alt: 'NAT-TEST Official Logo'
    },
    logo_2: {
      enabled: true,
      url: '/images/logo-csgs-ui.svg',
      alt: 'UKK CSGS UI Logo'
    },
    show_divider: true
  };

  const l1Check = document.getElementById('cms_logo1_enabled');
  const l1Url = document.getElementById('cms_logo1_url');
  const l1Alt = document.getElementById('cms_logo1_alt');
  const l2Check = document.getElementById('cms_logo2_enabled');
  const l2Url = document.getElementById('cms_logo2_url');
  const l2Alt = document.getElementById('cms_logo2_alt');

  if (l1Check) l1Check.checked = d.logo_1 ? d.logo_1.enabled !== false : true;
  if (l1Url) l1Url.value = d.logo_1?.url || '/images/logo-nat-test.svg';
  if (l1Alt) l1Alt.value = d.logo_1?.alt || 'NAT-TEST Official Logo';

  if (l2Check) l2Check.checked = d.logo_2 ? d.logo_2.enabled !== false : true;
  if (l2Url) l2Url.value = d.logo_2?.url || '/images/logo-csgs-ui.svg';
  if (l2Alt) l2Alt.value = d.logo_2?.alt || 'UKK CSGS UI Logo';

  updateHeaderLogoPreview();
}

window.updateHeaderLogoPreview = function() {
  const l1Check = document.getElementById('cms_logo1_enabled');
  const l1Url = document.getElementById('cms_logo1_url');
  const l2Check = document.getElementById('cms_logo2_enabled');
  const l2Url = document.getElementById('cms_logo2_url');

  const p1 = document.getElementById('admin_preview_logo1');
  const p2 = document.getElementById('admin_preview_logo2');
  const div = document.getElementById('admin_preview_logo_divider');

  const show1 = l1Check ? l1Check.checked : true;
  const show2 = l2Check ? l2Check.checked : true;

  if (p1) {
    p1.style.display = show1 ? 'block' : 'none';
    if (show1) p1.src = l1Url?.value.trim() || '/images/logo-nat-test.svg';
  }

  if (p2) {
    p2.style.display = show2 ? 'block' : 'none';
    if (show2) p2.src = l2Url?.value.trim() || '/images/logo-csgs-ui.svg';
  }

  if (div) {
    // Show divider only if both logos are visible
    div.style.display = (show1 && show2) ? 'block' : 'none';
  }
};

window.handleUploadHeaderLogo = function(event, logoNum) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert(`Ukuran file logo terlalu besar (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maksimal 2 MB.`);
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const input = document.getElementById(`cms_logo${logoNum}_url`);
    if (input) {
      input.value = dataUrl;
      updateHeaderLogoPreview();
    }
  };
  reader.readAsDataURL(file);
};

window.resetDefaultHeaderLogos = function() {
  if (!confirm('Kembalikan logo header ke pengaturan standar (Logo 1 NAT-TEST & Logo 2 CSGS UI aktif)?')) return;

  const l1Check = document.getElementById('cms_logo1_enabled');
  const l1Url = document.getElementById('cms_logo1_url');
  const l1Alt = document.getElementById('cms_logo1_alt');
  const l2Check = document.getElementById('cms_logo2_enabled');
  const l2Url = document.getElementById('cms_logo2_url');
  const l2Alt = document.getElementById('cms_logo2_alt');

  if (l1Check) l1Check.checked = true;
  if (l1Url) l1Url.value = '/images/logo-nat-test.svg';
  if (l1Alt) l1Alt.value = 'NAT-TEST Official Logo';

  if (l2Check) l2Check.checked = true;
  if (l2Url) l2Url.value = '/images/logo-csgs-ui.svg';
  if (l2Alt) l2Alt.value = 'UKK CSGS UI Logo';

  updateHeaderLogoPreview();
};

window.saveCmsHeaderLogo = async function() {
  const l1Check = document.getElementById('cms_logo1_enabled');
  const l1Url = document.getElementById('cms_logo1_url');
  const l1Alt = document.getElementById('cms_logo1_alt');
  const l2Check = document.getElementById('cms_logo2_enabled');
  const l2Url = document.getElementById('cms_logo2_url');
  const l2Alt = document.getElementById('cms_logo2_alt');

  const show1 = l1Check ? l1Check.checked : true;
  const show2 = l2Check ? l2Check.checked : true;

  if (!show1 && !show2) {
    if (!confirm('Peringatan: Anda menonaktifkan kedua logo. Header website tidak akan menampilkan logo apapun. Lanjutkan simpan?')) {
      return;
    }
  }

  const payload = {
    logo_1: {
      enabled: show1,
      url: l1Url?.value.trim() || '/images/logo-nat-test.svg',
      alt: l1Alt?.value.trim() || 'NAT-TEST Official Logo'
    },
    logo_2: {
      enabled: show2,
      url: l2Url?.value.trim() || '/images/logo-csgs-ui.svg',
      alt: l2Alt?.value.trim() || 'UKK CSGS UI Logo'
    },
    show_divider: show1 && show2
  };

  await saveCmsSection('header_logo', 'Pengaturan Logo Header Website', 'Konfigurasi branding logo 1 dan logo 2 di header', payload);
};

// -------------------------------------------------------------
// 4C. IMAGE SLIDER CMS MANAGEMENT (MAKSIMAL 3 GAMBAR)
// -------------------------------------------------------------
let currentSlides = [];

function populateSliderForm(sliderData) {
  const enabledSelect = document.getElementById('cms_slider_enabled');
  const autoplaySelect = document.getElementById('cms_slider_autoplay');
  const intervalInput = document.getElementById('cms_slider_interval');

  const isEnabled = sliderData?.enabled !== false;
  const isAutoplay = sliderData?.autoplay !== false;
  const intervalSec = Math.round((sliderData?.interval_ms || 5000) / 1000);

  if (enabledSelect) enabledSelect.value = isEnabled ? 'true' : 'false';
  if (autoplaySelect) autoplaySelect.value = isAutoplay ? 'true' : 'false';
  if (intervalInput) intervalInput.value = String(intervalSec || 5);

  if (sliderData && Array.isArray(sliderData.slides)) {
    // Strictly clamp to maximum 3 slides
    currentSlides = JSON.parse(JSON.stringify(sliderData.slides)).slice(0, 3);
  } else {
    currentSlides = [
      {
        id: 1,
        image_url: '/images/slider-1.svg',
        badge: 'RESMI • TAHUN 2026',
        title: 'Pusat Ujian Resmi NAT-TEST UI Depok',
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
    ];
  }

  renderAdminSlidesList();
}

function syncSlidesFromDom() {
  const updated = [];
  for (let i = 0; i < currentSlides.length && i < 3; i++) {
    const imgUrl = document.getElementById(`slide_input_img_${i}`)?.value.trim() ?? currentSlides[i].image_url;
    const badge = document.getElementById(`slide_input_badge_${i}`)?.value.trim() ?? currentSlides[i].badge;
    const title = document.getElementById(`slide_input_title_${i}`)?.value.trim() ?? currentSlides[i].title;
    const subtitle = document.getElementById(`slide_input_subtitle_${i}`)?.value.trim() ?? currentSlides[i].subtitle;
    const btnText = document.getElementById(`slide_input_btntext_${i}`)?.value.trim() ?? currentSlides[i].btn_text;
    const btnLink = document.getElementById(`slide_input_btnlink_${i}`)?.value.trim() ?? currentSlides[i].btn_link;
    const isActive = document.getElementById(`slide_input_active_${i}`) ? document.getElementById(`slide_input_active_${i}`).checked : currentSlides[i].is_active;

    updated.push({
      id: currentSlides[i].id || (Date.now() + i),
      image_url: imgUrl,
      badge: badge,
      title: title,
      subtitle: subtitle,
      btn_text: btnText,
      btn_link: btnLink,
      is_active: isActive !== false
    });
  }
  currentSlides = updated.slice(0, 3);
}

function renderAdminSlidesList() {
  const container = document.getElementById('cms-slides-editor-container');
  const countBadge = document.getElementById('cms-slider-count-badge');
  const limitMsg = document.getElementById('cms-slider-limit-msg');
  const btnAdd = document.getElementById('btn-add-slider-item');

  // Strict clamp
  if (currentSlides.length > 3) {
    currentSlides = currentSlides.slice(0, 3);
  }

  // Update header indicators
  if (countBadge) {
    countBadge.textContent = `${currentSlides.length} / 3`;
  }

  if (btnAdd) {
    if (currentSlides.length >= 3) {
      btnAdd.disabled = true;
      btnAdd.className = 'px-3.5 py-1.5 rounded-xl bg-slate-200 text-slate-400 font-bold text-xs cursor-not-allowed opacity-60 flex items-center gap-1';
      btnAdd.title = 'Maksimal 3 banner gambar telah tercapai. Kurangi atau hapus slide untuk menambah baru.';
    } else {
      btnAdd.disabled = false;
      btnAdd.className = 'px-3.5 py-1.5 rounded-xl btn-japan font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer';
      btnAdd.title = `Tambah banner baru (Tersedia kuota ${3 - currentSlides.length} lagi)`;
    }
  }

  if (limitMsg) {
    if (currentSlides.length >= 3) {
      limitMsg.innerHTML = '<span class="text-amber-700 font-bold">⚠️ Batas maksimal 3 gambar telah terisi.</span> Hapus slide jika ingin mengganti.';
    } else if (currentSlides.length === 0) {
      limitMsg.innerHTML = '<span class="text-slate-500 font-semibold">Slider kosong. Tambahkan minimal 1 gambar.</span>';
    } else {
      limitMsg.innerHTML = `<span class="text-emerald-700 font-bold">✓ Kuota tersedia:</span> Masih dapat menambahkan ${3 - currentSlides.length} gambar lagi.`;
    }
  }

  if (!container) return;

  if (currentSlides.length === 0) {
    container.innerHTML = `
      <div class="p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-3 bg-slate-50/50">
        <div class="text-3xl">🖼️</div>
        <p class="text-xs text-slate-600 font-semibold">Belum ada slide gambar yang ditambahkan ke image slider.</p>
        <button onclick="addNewSlideItem()" class="px-4 py-2 rounded-xl btn-japan font-bold text-xs shadow-sm">
          + Tambah Gambar Slide Sekarang (Maksimal 3)
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = currentSlides.map((s, index) => {
    const isActive = s.is_active !== false;
    return `
      <div class="p-4 rounded-2xl border ${isActive ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50/70 opacity-75'} shadow-2xs space-y-3 transition-all">
        <!-- Header bar for slide -->
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full ${isActive ? 'bg-red-600 text-white' : 'bg-slate-300 text-slate-600'} font-black text-xs flex items-center justify-center">${index + 1}</span>
            <span class="font-extrabold text-slate-900 text-sm">Slide #${index + 1}</span>
            ${!isActive ? '<span class="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-600 font-bold">NONAKTIF</span>' : ''}
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="moveSlideUp(${index})" ${index === 0 ? 'disabled class="opacity-25 cursor-not-allowed p-1 text-slate-400 text-xs"' : 'class="p-1 hover:bg-slate-100 rounded text-slate-700 font-bold text-xs"'} title="Pindahkan ke atas (▲)">
              ▲
            </button>
            <button onclick="moveSlideDown(${index})" ${index === currentSlides.length - 1 ? 'disabled class="opacity-25 cursor-not-allowed p-1 text-slate-400 text-xs"' : 'class="p-1 hover:bg-slate-100 rounded text-slate-700 font-bold text-xs"'} title="Pindahkan ke bawah (▼)">
              ▼
            </button>
            <label class="inline-flex items-center gap-1 text-xs cursor-pointer ml-2">
              <input type="checkbox" id="slide_input_active_${index}" ${isActive ? 'checked' : ''} onchange="toggleSlideActiveState(${index}, this.checked)" class="rounded text-red-600 focus:ring-red-500 w-4 h-4" />
              <span class="font-bold text-slate-700">Tampilkan</span>
            </label>
            <button onclick="deleteSlideItem(${index})" class="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs ml-2 transition-colors flex items-center gap-1" title="Hapus slide ini (kurangi jumlah slider)">
              <span>🗑️ Hapus Slide</span>
            </button>
          </div>
        </div>

        <!-- Slide details grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Column 1: Image Preview & Path/Upload -->
          <div class="space-y-2">
            <label class="block font-bold text-slate-700 text-xs">Pratinjau Banner Slide #${index + 1}:</label>
            <div class="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center">
              <img id="admin_slide_preview_${index}" src="${s.image_url}" alt="Preview Slide #${index + 1}" class="w-full h-full object-cover" onerror="this.src='/images/slider-1.svg'" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 text-[11px] mb-1">Path / URL Gambar Banner:</label>
              <div class="flex gap-1.5">
                <input type="text" id="slide_input_img_${index}" value="${s.image_url}" oninput="updateSlidePreviewImg(${index}, this.value)" class="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-300 font-mono text-[11px]" placeholder="/images/slider-1.svg" />
                <label class="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shrink-0 transition-colors flex items-center gap-1" title="Upload gambar banner dari komputer">
                  <span>📁 Upload</span>
                  <input type="file" accept="image/*" onchange="handleUploadSlideImage(event, ${index})" class="hidden" />
                </label>
              </div>
              <p class="text-[10px] text-slate-400 mt-1">Maks 5MB (SVG, PNG, JPG). Rasio ideal 16:9 / 21:9.</p>
            </div>
          </div>

          <!-- Column 2 & 3: Content Fields -->
          <div class="md:col-span-2 space-y-2.5 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Badge Kategori / Label Atas:</label>
                <input type="text" id="slide_input_badge_${index}" value="${s.badge || ''}" class="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold" placeholder="Contoh: RESMI • TAHUN 2026" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Judul Utama Slide:</label>
                <input type="text" id="slide_input_title_${index}" value="${s.title || ''}" class="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold" placeholder="Judul banner" />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Subjudul / Deskripsi Banner:</label>
              <textarea id="slide_input_subtitle_${index}" rows="2" class="w-full p-2 rounded-xl border border-slate-300 text-xs" placeholder="Deskripsi informasi banner">${s.subtitle || ''}</textarea>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Teks Tombol CTA (Opsional):</label>
                <input type="text" id="slide_input_btntext_${index}" value="${s.btn_text || ''}" class="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs" placeholder="Contoh: Daftar Ujian Sekarang" />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Link Target Tombol CTA:</label>
                <input type="text" id="slide_input_btnlink_${index}" value="${s.btn_link || ''}" class="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono" placeholder="Contoh: #jadwal atau /page/tentang-kami" />
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.addNewSlideItem = function() {
  syncSlidesFromDom();

  if (currentSlides.length >= 3) {
    alert('Maksimal slide banner di halaman depan adalah 3 gambar. Silakan kurangi atau ubah slide yang sudah ada.');
    return;
  }

  const nextIdx = currentSlides.length + 1;
  currentSlides.push({
    id: Date.now(),
    image_url: `/images/slider-${((nextIdx - 1) % 3) + 1}.svg`,
    badge: 'INFORMASI TERBARU',
    title: `Banner Informasi NAT-TEST #${nextIdx}`,
    subtitle: 'Informasi resmi pelaksanaan ujian kemampuan bahasa Jepang di Universitas Indonesia Depok.',
    btn_text: 'Pelajari Selengkapnya',
    btn_link: '#jadwal',
    is_active: true
  });

  renderAdminSlidesList();
};

window.deleteSlideItem = function(index) {
  syncSlidesFromDom();

  if (!confirm(`Hapus slide #${index + 1}? Jumlah gambar slider akan dikurangi menjadi ${currentSlides.length - 1} slide.`)) {
    return;
  }

  currentSlides.splice(index, 1);
  renderAdminSlidesList();
};

window.moveSlideUp = function(index) {
  if (index <= 0) return;
  syncSlidesFromDom();
  const temp = currentSlides[index];
  currentSlides[index] = currentSlides[index - 1];
  currentSlides[index - 1] = temp;
  renderAdminSlidesList();
};

window.moveSlideDown = function(index) {
  if (index >= currentSlides.length - 1) return;
  syncSlidesFromDom();
  const temp = currentSlides[index];
  currentSlides[index] = currentSlides[index + 1];
  currentSlides[index + 1] = temp;
  renderAdminSlidesList();
};

window.toggleSlideActiveState = function(index, checked) {
  if (currentSlides[index]) {
    currentSlides[index].is_active = checked;
    renderAdminSlidesList();
  }
};

window.updateSlidePreviewImg = function(index, val) {
  const preview = document.getElementById(`admin_slide_preview_${index}`);
  if (preview) {
    preview.src = val || '/images/slider-1.svg';
  }
  if (currentSlides[index]) {
    currentSlides[index].image_url = val;
  }
};

window.handleUploadSlideImage = function(event, index) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert(`Ukuran banner terlalu besar (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maksimal 5 MB untuk gambar slider.`);
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const input = document.getElementById(`slide_input_img_${index}`);
    if (input) input.value = dataUrl;
    const preview = document.getElementById(`admin_slide_preview_${index}`);
    if (preview) preview.src = dataUrl;
    if (currentSlides[index]) currentSlides[index].image_url = dataUrl;
  };
  reader.readAsDataURL(file);
};

window.saveCmsSlider = async function() {
  syncSlidesFromDom();

  // Enforce max 3 items
  const finalSlides = currentSlides.slice(0, 3);

  const enabledSelect = document.getElementById('cms_slider_enabled');
  const autoplaySelect = document.getElementById('cms_slider_autoplay');
  const intervalInput = document.getElementById('cms_slider_interval');

  const intervalSec = Math.max(2, Math.min(30, parseInt(intervalInput?.value || '5', 10)));

  const payload = {
    enabled: enabledSelect ? enabledSelect.value === 'true' : true,
    autoplay: autoplaySelect ? autoplaySelect.value === 'true' : true,
    interval_ms: intervalSec * 1000,
    slides: finalSlides
  };

  currentSlides = finalSlides;
  await saveCmsSection('slider', 'Pengaturan Image Slider Halaman Depan', 'Banner promosi visual di bagian teratas website (maksimal 3 gambar)', payload);
};

// -------------------------------------------------------------
// 4D. FAQ (PERTANYAAN YANG SERING DIAJUKAN) MANAGEMENT
// -------------------------------------------------------------
let loadedFaqs = [];

function renderFaqEditorList(faqCms) {
  const container = document.getElementById('cms-faqs-list');
  const countBadge = document.getElementById('cms-faq-count-badge');
  const titleInput = document.getElementById('cms_faq_title');
  const subtitleInput = document.getElementById('cms_faq_subtitle');
  const officeInput = document.getElementById('cms_faq_contact_office');
  const waInput = document.getElementById('cms_faq_contact_wa');
  const emailInput = document.getElementById('cms_faq_contact_email');
  const hoursInput = document.getElementById('cms_faq_contact_hours');

  const faqData = faqCms?.data || faqCms || {};

  if (titleInput) titleInput.value = faqCms?.title || 'Pertanyaan yang Sering Diajukan (FAQ)';
  if (subtitleInput) subtitleInput.value = faqCms?.subtitle || 'Informasi penting seputar sertifikasi NAT-TEST, pengakuan imigrasi, dan teknis ujian';

  if (faqData.contact) {
    if (officeInput) officeInput.value = faqData.contact.office || '';
    if (waInput) waInput.value = faqData.contact.whatsapp || '';
    if (emailInput) emailInput.value = faqData.contact.email || '';
    if (hoursInput) hoursInput.value = faqData.contact.operational_hours || '';
  }

  if (Array.isArray(faqData.faqs)) {
    loadedFaqs = JSON.parse(JSON.stringify(faqData.faqs));
  } else if (!loadedFaqs || loadedFaqs.length === 0) {
    loadedFaqs = [
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
    ];
  }

  if (countBadge) countBadge.textContent = loadedFaqs.length;
  if (!container) return;

  if (loadedFaqs.length === 0) {
    container.innerHTML = `
      <div class="p-6 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50">
        <p class="text-xs text-slate-500 font-semibold">Belum ada daftar pertanyaan FAQ. Klik "+ Tambah Pertanyaan Baru" di atas.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = loadedFaqs.map((faq, index) => {
    const hasImage = Boolean(faq.image_url);
    return `
      <div class="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-2.5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex items-start gap-2.5 flex-1 min-w-[240px]">
            <span class="w-6 h-6 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">${index + 1}</span>
            <div class="space-y-1.5 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h4 class="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug">${faq.q}</h4>
                ${hasImage ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">🖼️ Ada Gambar</span>' : ''}
              </div>
              <p class="text-xs text-slate-600 leading-relaxed whitespace-pre-line line-clamp-2">${faq.a}</p>
              ${hasImage ? `
                <div class="pt-1 flex items-center gap-2">
                  <img src="${faq.image_url}" alt="Thumbnail FAQ" class="h-12 w-auto max-w-[100px] object-contain rounded-lg border border-slate-200 bg-slate-50 p-0.5 shadow-2xs" />
                  <span class="text-[10px] text-slate-400">Gambar ilustrasi terlampir</span>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button onclick="moveFaqUp(${index})" ${index === 0 ? 'disabled class="opacity-25 cursor-not-allowed p-1 text-slate-400 text-xs"' : 'class="p-1 hover:bg-slate-100 rounded text-slate-700 font-bold text-xs"'} title="Pindahkan ke atas (▲)">
              ▲
            </button>
            <button onclick="moveFaqDown(${index})" ${index === loadedFaqs.length - 1 ? 'disabled class="opacity-25 cursor-not-allowed p-1 text-slate-400 text-xs"' : 'class="p-1 hover:bg-slate-100 rounded text-slate-700 font-bold text-xs"'} title="Pindahkan ke bawah (▼)">
              ▼
            </button>
            <button onclick="openEditFaqModal(${index})" class="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs ml-1 transition-colors flex items-center gap-1" title="Ubah pertanyaan, jawaban, atau gambar">
              ✏️ Edit
            </button>
            <button onclick="deleteFaqItem(${index})" class="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs transition-colors flex items-center gap-1" title="Hapus pertanyaan ini">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.updateFaqImagePreview = function(url) {
  const box = document.getElementById('faq_form_image_preview_box');
  const img = document.getElementById('faq_form_image_preview');
  const clearBtn = document.getElementById('btn-clear-faq-img');

  if (url && url.trim()) {
    if (img) img.src = url.trim();
    if (box) box.classList.remove('hidden');
    if (clearBtn) clearBtn.classList.remove('hidden');
  } else {
    if (img) img.src = '';
    if (box) box.classList.add('hidden');
    if (clearBtn) clearBtn.classList.add('hidden');
  }
};

window.clearFaqImage = function() {
  const urlInput = document.getElementById('faq_form_image_url');
  const fileInput = document.getElementById('faq_form_image_file');
  if (urlInput) urlInput.value = '';
  if (fileInput) fileInput.value = '';
  updateFaqImagePreview('');
};

window.handleUploadFaqImage = function(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert(`Ukuran gambar terlalu besar (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maksimal 5 MB untuk gambar FAQ.`);
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    const urlInput = document.getElementById('faq_form_image_url');
    if (urlInput) urlInput.value = dataUrl;
    updateFaqImagePreview(dataUrl);
  };
  reader.readAsDataURL(file);
};

window.openAddFaqModal = function() {
  document.getElementById('faq-modal-title').textContent = 'Tambah Pertanyaan FAQ Baru';
  document.getElementById('faq_edit_index').value = '-1';
  document.getElementById('faq_form_question').value = '';
  document.getElementById('faq_form_answer').value = '';
  document.getElementById('faq_form_image_url').value = '';
  const fileInput = document.getElementById('faq_form_image_file');
  if (fileInput) fileInput.value = '';
  updateFaqImagePreview('');
  document.getElementById('faq-item-modal').classList.remove('hidden');
};

window.openEditFaqModal = function(index) {
  const item = loadedFaqs[index];
  if (!item) return;

  document.getElementById('faq-modal-title').textContent = `Ubah Pertanyaan FAQ #${index + 1}`;
  document.getElementById('faq_edit_index').value = String(index);
  document.getElementById('faq_form_question').value = item.q || '';
  document.getElementById('faq_form_answer').value = item.a || '';
  document.getElementById('faq_form_image_url').value = item.image_url || '';
  const fileInput = document.getElementById('faq_form_image_file');
  if (fileInput) fileInput.value = '';
  updateFaqImagePreview(item.image_url || '');
  document.getElementById('faq-item-modal').classList.remove('hidden');
};

window.closeFaqModal = function() {
  document.getElementById('faq-item-modal').classList.add('hidden');
};

window.handleFaqModalSubmit = async function(e) {
  e.preventDefault();
  const editIndexStr = document.getElementById('faq_edit_index').value;
  const q = document.getElementById('faq_form_question').value.trim();
  const a = document.getElementById('faq_form_answer').value.trim();
  const image_url = document.getElementById('faq_form_image_url')?.value.trim() || null;

  if (!q || !a) {
    alert('Pertanyaan dan jawaban wajib diisi.');
    return;
  }

  const editIndex = parseInt(editIndexStr, 10);
  const newItem = {
    q,
    a,
    image_url: image_url || null
  };

  if (editIndex >= 0 && editIndex < loadedFaqs.length) {
    loadedFaqs[editIndex] = newItem;
  } else {
    loadedFaqs.push(newItem);
  }

  closeFaqModal();
  renderFaqEditorList({ data: { faqs: loadedFaqs } });
  await saveCmsFaqAll(false);
};

window.deleteFaqItem = async function(index) {
  const item = loadedFaqs[index];
  if (!item) return;

  if (!confirm(`Hapus pertanyaan: "${item.q}"?`)) return;

  loadedFaqs.splice(index, 1);
  renderFaqEditorList({ data: { faqs: loadedFaqs } });
  await saveCmsFaqAll(false);
};

window.moveFaqUp = async function(index) {
  if (index <= 0) return;
  const temp = loadedFaqs[index];
  loadedFaqs[index] = loadedFaqs[index - 1];
  loadedFaqs[index - 1] = temp;
  renderFaqEditorList({ data: { faqs: loadedFaqs } });
  await saveCmsFaqAll(false);
};

window.moveFaqDown = async function(index) {
  if (index >= loadedFaqs.length - 1) return;
  const temp = loadedFaqs[index];
  loadedFaqs[index] = loadedFaqs[index + 1];
  loadedFaqs[index + 1] = temp;
  renderFaqEditorList({ data: { faqs: loadedFaqs } });
  await saveCmsFaqAll(false);
};

window.saveCmsFaqAll = async function(showAlert = true) {
  const title = document.getElementById('cms_faq_title')?.value.trim() || 'Pertanyaan yang Sering Diajukan (FAQ)';
  const subtitle = document.getElementById('cms_faq_subtitle')?.value.trim() || 'Informasi penting seputar sertifikasi NAT-TEST, pengakuan imigrasi, dan teknis ujian';

  const office = document.getElementById('cms_faq_contact_office')?.value.trim() || 'Sekretariat NAT-TEST UKK CSGS UI, Pusat Studi Jepang (PSJ UI) Lt. 1, Kampus UI Depok';
  const whatsapp = document.getElementById('cms_faq_contact_wa')?.value.trim() || '+62 812-8888-9999';
  const email = document.getElementById('cms_faq_contact_email')?.value.trim() || 'nattest@csgs-ui.ac.id';
  const operational_hours = document.getElementById('cms_faq_contact_hours')?.value.trim() || 'Senin - Jumat: 08.30 - 16.00 WIB (Kecuali Hari Libur Nasional)';

  const payload = {
    faqs: loadedFaqs,
    contact: {
      office,
      whatsapp,
      email,
      operational_hours
    }
  };

  try {
    const res = await fetch('/api/cms/faq', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({
        title,
        subtitle,
        data: payload
      })
    });
    const result = await res.json();
    if (result.success) {
      if (showAlert) {
        alert('Seluruh pertanyaan FAQ dan informasi kontak berhasil disimpan dan langsung diperbarui di Halaman Depan!');
      }
    } else {
      alert(result.message || 'Gagal menyimpan FAQ.');
    }
  } catch (err) {
    console.error('Error saving FAQ:', err);
    alert('Terjadi kesalahan jaringan saat menyimpan FAQ.');
  }
};

// -------------------------------------------------------------
// 4E. FOOTER CMS MANAGEMENT
// -------------------------------------------------------------
function populateFooterForm(footerData) {
  const d = footerData || {
    about_text: 'Penyelenggaraan resmi Ujian Standar Kemampuan Bahasa Jepang (NAT-TEST) Indonesia. Bekerjasama dengan Unit Kerja Khusus Center for Strategic and Global Studies (UKK CSGS) Universitas Indonesia di Pusat Studi Jepang Kampus UI Depok.',
    accreditation_text: 'Terakreditasi resmi untuk COE & Visa Studi ke Jepang oleh MOJ (Ministry of Justice Japan).',
    col2_title: 'Halaman Utama',
    col3_title: 'Informasi Resmi',
    col4_title: 'Sekretariat Pelaksana',
    contact_office: 'Gedung Pusat Studi Jepang (PSJ UI) Lt. 1, Kampus Universitas Indonesia, Depok, Jawa Barat 16424',
    contact_wa: '+62 812-8888-9999',
    contact_email: 'nattest@csgs-ui.ac.id',
    contact_hours: 'Senin - Jumat (08.30 - 16.00 WIB)',
    copyright_text: '© 2026 NAT-TEST Committee Japan & UKK CSGS Universitas Indonesia. All rights reserved.'
  };

  const aboutEl = document.getElementById('cms_footer_about');
  const accredEl = document.getElementById('cms_footer_accreditation');
  const col2El = document.getElementById('cms_footer_col2_title');
  const col3El = document.getElementById('cms_footer_col3_title');
  const col4El = document.getElementById('cms_footer_col4_title');
  const officeEl = document.getElementById('cms_footer_contact_office');
  const waEl = document.getElementById('cms_footer_contact_wa');
  const emailEl = document.getElementById('cms_footer_contact_email');
  const hoursEl = document.getElementById('cms_footer_contact_hours');
  const copyEl = document.getElementById('cms_footer_copyright');

  if (aboutEl) aboutEl.value = d.about_text || '';
  if (accredEl) accredEl.value = d.accreditation_text || '';
  if (col2El) col2El.value = d.col2_title || 'Halaman Utama';
  if (col3El) col3El.value = d.col3_title || 'Informasi Resmi';
  if (col4El) col4El.value = d.col4_title || 'Sekretariat Pelaksana';
  if (officeEl) officeEl.value = d.contact_office || '';
  if (waEl) waEl.value = d.contact_wa || '';
  if (emailEl) emailEl.value = d.contact_email || '';
  if (hoursEl) hoursEl.value = d.contact_hours || '';
  if (copyEl) copyEl.value = d.copyright_text || '';
}

window.populateFooterForm = populateFooterForm;

window.saveCmsFooter = async function() {
  const payload = {
    about_text: document.getElementById('cms_footer_about')?.value.trim() || '',
    accreditation_text: document.getElementById('cms_footer_accreditation')?.value.trim() || '',
    col2_title: document.getElementById('cms_footer_col2_title')?.value.trim() || 'Halaman Utama',
    col3_title: document.getElementById('cms_footer_col3_title')?.value.trim() || 'Informasi Resmi',
    col4_title: document.getElementById('cms_footer_col4_title')?.value.trim() || 'Sekretariat Pelaksana',
    contact_office: document.getElementById('cms_footer_contact_office')?.value.trim() || '',
    contact_wa: document.getElementById('cms_footer_contact_wa')?.value.trim() || '',
    contact_email: document.getElementById('cms_footer_contact_email')?.value.trim() || '',
    contact_hours: document.getElementById('cms_footer_contact_hours')?.value.trim() || '',
    copyright_text: document.getElementById('cms_footer_copyright')?.value.trim() || ''
  };

  await saveCmsSection('footer', 'Pengaturan & Teks Footer Website', 'Informasi profil, kontak sekretariat, dan hak cipta di bagian bawah website', payload);
};

// -------------------------------------------------------------
// 5. CHANGE ADMIN PASSWORD
// -------------------------------------------------------------
window.handleAdminChangePassword = async function(e) {
  e.preventDefault();
  const old_pass = document.getElementById('admin_old_pass').value;
  const new_pass = document.getElementById('admin_new_pass').value;
  const confirm_pass = document.getElementById('admin_confirm_pass').value;

  if (new_pass !== confirm_pass) {
    alert('Konfirmasi kata sandi baru tidak cocok!');
    return;
  }

  const res = await Auth.changePassword(old_pass, new_pass, confirm_pass);
  if (res.success) {
    alert('Kata sandi Admin berhasil diperbarui!');
    document.getElementById('form-admin-change-password').reset();
  } else {
    alert(res.message || 'Gagal mengubah kata sandi');
  }
};

// -------------------------------------------------------------
// 6. STATIC PAGES MANAGEMENT (HALAMAN STATIK)
// -------------------------------------------------------------
let loadedAdminPages = [];

window.loadAdminStaticPages = async function() {
  const tbody = document.getElementById('admin-pages-tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/admin/pages', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    const data = await res.json();
    if (!data.success || !Array.isArray(data.pages)) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">Gagal memuat daftar halaman statik.</td></tr>`;
      return;
    }

    loadedAdminPages = data.pages;

    // Update counters
    const totalEl = document.getElementById('stat-total-pages');
    const pubEl = document.getElementById('stat-published-pages');
    const draftEl = document.getElementById('stat-draft-pages');
    const badgeEl = document.getElementById('pages-count-badge');

    const pubCount = loadedAdminPages.filter(p => p.is_published === 1 || p.is_published === true).length;
    const draftCount = loadedAdminPages.length - pubCount;

    if (totalEl) totalEl.textContent = loadedAdminPages.length;
    if (pubEl) pubEl.textContent = pubCount;
    if (draftEl) draftEl.textContent = draftCount;
    if (badgeEl) badgeEl.textContent = `${loadedAdminPages.length} Halaman`;

    if (loadedAdminPages.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">Belum ada halaman statik. Klik "+ Buat Halaman Statik Baru" di atas.</td></tr>`;
      return;
    }

    tbody.innerHTML = loadedAdminPages.map((p, idx) => {
      const isPub = p.is_published === 1 || p.is_published === true;
      const statusBadge = isPub
        ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Diterbitkan</span>`
        : `<span class="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">Draf</span>`;

      const updatedDate = p.updated_at ? new Date(p.updated_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }) : '-';

      return `
        <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
          <td class="py-3 px-4 font-mono font-bold text-center text-slate-400">${idx + 1}</td>
          <td class="py-3 px-4">
            <div class="font-bold text-slate-900 text-xs sm:text-sm">${p.title}</div>
            ${p.subtitle ? `<div class="text-[11px] text-slate-500 line-clamp-1">${p.subtitle}</div>` : ''}
            ${p.summary ? `<div class="text-[10px] text-slate-400 line-clamp-1 italic">${p.summary}</div>` : ''}
          </td>
          <td class="py-3 px-4">
            <a href="/page/${p.slug}" target="_blank" class="font-mono text-xs text-red-600 hover:underline bg-red-50/60 px-2 py-0.5 rounded inline-block">
              /page/${p.slug}
            </a>
          </td>
          <td class="py-3 px-4 text-center">
            ${statusBadge}
          </td>
          <td class="py-3 px-4 text-center font-mono text-xs text-slate-600">
            ${p.view_count || 0}
          </td>
          <td class="py-3 px-4 text-slate-500 text-xs">
            ${updatedDate}
          </td>
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <a href="/page/${p.slug}" target="_blank" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors" title="Buka Halaman Live di Tab Baru">
                👁️ Buka ↗
              </a>
              <button onclick="openEditStaticPageModal(${p.id})" class="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition-colors">
                ✏️ Edit
              </button>
              <button onclick="deleteStaticPage(${p.id}, '${p.title.replace(/'/g, "\\'")}')" class="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] transition-colors">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error load static pages:', err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-red-500">Gagal memuat halaman statik.</td></tr>`;
  }
};

window.openCreateStaticPageModal = function() {
  document.getElementById('static-page-modal-title').textContent = 'Buat Halaman Statik Baru';
  document.getElementById('page_edit_id').value = '';
  document.getElementById('page_form_title').value = '';
  document.getElementById('page_form_slug').value = '';
  document.getElementById('page_form_subtitle').value = '';
  document.getElementById('page_form_summary').value = '';
  document.getElementById('page_form_content').value = '';
  document.getElementById('page_form_published').value = '1';

  const navWrapper = document.getElementById('add-to-nav-wrapper');
  if (navWrapper) navWrapper.classList.remove('hidden');
  const navCheck = document.getElementById('page_form_add_nav');
  if (navCheck) navCheck.checked = false;

  document.getElementById('static-page-modal').classList.remove('hidden');
};

window.openEditStaticPageModal = function(id) {
  const page = loadedAdminPages.find(p => p.id === id);
  if (!page) return;

  document.getElementById('static-page-modal-title').textContent = `Ubah Halaman Statik: ${page.title}`;
  document.getElementById('page_edit_id').value = String(page.id);
  document.getElementById('page_form_title').value = page.title || '';
  document.getElementById('page_form_slug').value = page.slug || '';
  document.getElementById('page_form_subtitle').value = page.subtitle || '';
  document.getElementById('page_form_summary').value = page.summary || '';
  document.getElementById('page_form_content').value = page.content || '';
  document.getElementById('page_form_published').value = (page.is_published === 1 || page.is_published === true) ? '1' : '0';

  const navWrapper = document.getElementById('add-to-nav-wrapper');
  if (navWrapper) navWrapper.classList.add('hidden');

  document.getElementById('static-page-modal').classList.remove('hidden');
};

window.closeStaticPageModal = function() {
  document.getElementById('static-page-modal').classList.add('hidden');
};

window.handlePageTitleInput = function(val) {
  const editId = document.getElementById('page_edit_id').value;
  // Auto-slug only when creating a new page
  if (editId === '') {
    const slugInput = document.getElementById('page_form_slug');
    if (slugInput) {
      slugInput.value = val.toLowerCase().trim()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }
  }
};

window.insertPageSnippet = function(type) {
  const textarea = document.getElementById('page_form_content');
  if (!textarea) return;

  let snippet = '';
  if (type === 'heading') {
    snippet = '\n<h2 class="text-xl font-bold text-slate-900 pt-3">Judul Bagian Baru</h2>\n<p class="text-sm text-slate-700 leading-relaxed">Penjelasan bagian baru ditulis di sini.</p>\n';
  } else if (type === 'callout') {
    snippet = '\n<div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">\n  <span class="font-bold">⚠️ Perhatian:</span>\n  <p>Tuliskan poin peringatan atau pengumuman penting di sini.</p>\n</div>\n';
  } else if (type === 'list') {
    snippet = '\n<ul class="list-disc pl-6 space-y-1.5 text-sm text-slate-700">\n  <li>Poin informasi pertama</li>\n  <li>Poin informasi kedua</li>\n  <li>Poin informasi ketiga</li>\n</ul>\n';
  }

  const start = textarea.selectionStart || textarea.value.length;
  const end = textarea.selectionEnd || textarea.value.length;
  textarea.value = textarea.value.substring(0, start) + snippet + textarea.value.substring(end);
  textarea.focus();
};

window.handleStaticPageSubmit = async function(e) {
  e.preventDefault();
  const editId = document.getElementById('page_edit_id').value;
  const title = document.getElementById('page_form_title').value.trim();
  const slug = document.getElementById('page_form_slug').value.trim();
  const subtitle = document.getElementById('page_form_subtitle').value.trim();
  const summary = document.getElementById('page_form_summary').value.trim();
  const content = document.getElementById('page_form_content').value.trim();
  const is_published = document.getElementById('page_form_published').value === '1';
  const add_to_nav = document.getElementById('page_form_add_nav')?.checked || false;

  if (!title || !slug || !content) {
    alert('Judul, slug URL, dan isi konten halaman wajib diisi.');
    return;
  }

  try {
    let url = '/api/admin/pages';
    let method = 'POST';
    if (editId !== '') {
      url = `/api/admin/pages/${editId}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({
        title,
        slug,
        subtitle,
        summary,
        content,
        is_published,
        add_to_nav
      })
    });

    const result = await res.json();
    if (result.success) {
      alert(result.message || 'Halaman statik berhasil disimpan!');
      closeStaticPageModal();
      await loadAdminStaticPages();
      if (add_to_nav) {
        await loadCmsEditorData();
      }
    } else {
      alert(result.message || 'Gagal menyimpan halaman statik.');
    }
  } catch (err) {
    console.error('Error saving static page:', err);
    alert('Terjadi kesalahan jaringan saat menyimpan halaman statik.');
  }
};

window.deleteStaticPage = async function(id, title) {
  if (!confirm(`Hapus halaman statik "${title}"? Halaman ini tidak akan dapat diakses publik lagi.`)) return;

  try {
    const res = await fetch(`/api/admin/pages/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });
    const result = await res.json();
    if (result.success) {
      alert(result.message || 'Halaman berhasil dihapus.');
      await loadAdminStaticPages();
    } else {
      alert(result.message || 'Gagal menghapus halaman.');
    }
  } catch (err) {
    console.error('Error deleting static page:', err);
    alert('Terjadi kesalahan jaringan.');
  }
};
