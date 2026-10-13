// public/js/page.js - Interactive Logic for Public Static Page Viewer
document.addEventListener('DOMContentLoaded', async () => {
  const slug = getPageSlugFromUrl();
  await Promise.all([
    loadPageContent(slug),
    loadSidebarPages(slug),
    loadHeaderNavAndCms()
  ]);
});

function getPageSlugFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramSlug = urlParams.get('slug');
  if (paramSlug) return paramSlug.trim().toLowerCase();

  const path = window.location.pathname;
  const prefixes = ['/page/', '/pages/', '/p/'];
  for (const prefix of prefixes) {
    if (path.startsWith(prefix)) {
      const extracted = path.substring(prefix.length).replace(/\/$/, '').trim().toLowerCase();
      if (extracted) return decodeURIComponent(extracted);
    }
  }

  // Default fallback
  return 'tentang-kami';
}

async function loadPageContent(slug) {
  const loadingEl = document.getElementById('page-loading');
  const errorEl = document.getElementById('page-error');
  const containerEl = document.getElementById('page-container');

  try {
    const res = await fetch(`/api/pages/${encodeURIComponent(slug)}`);
    const data = await res.json();

    if (!data.success || !data.page) {
      if (loadingEl) loadingEl.classList.add('hidden');
      if (errorEl) {
        errorEl.classList.remove('hidden');
        const msgEl = document.getElementById('page-error-message');
        if (msgEl) msgEl.textContent = `Halaman '${slug}' tidak ditemukan atau sedang dinonaktifkan oleh administrator.`;
      }
      return;
    }

    const page = data.page;

    // Update document title & meta tags
    document.title = `${page.meta_title || page.title} - NAT-TEST Official UKK CSGS UI`;
    const metaDesc = document.getElementById('page-meta-desc');
    if (metaDesc && page.meta_description) {
      metaDesc.setAttribute('content', page.meta_description);
    }

    // Populate Breadcrumbs & Titles
    const breadcrumbTitle = document.getElementById('breadcrumb-page-title');
    if (breadcrumbTitle) breadcrumbTitle.textContent = page.title;

    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = page.title;

    const subtitleEl = document.getElementById('page-subtitle');
    if (subtitleEl) {
      if (page.subtitle) {
        subtitleEl.textContent = page.subtitle;
        subtitleEl.classList.remove('hidden');
      } else {
        subtitleEl.classList.add('hidden');
      }
    }

    // Format updated date (Indonesian locale)
    const dateEl = document.getElementById('page-updated-at');
    if (dateEl && page.updated_at) {
      const d = new Date(page.updated_at);
      dateEl.textContent = d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }

    // View count
    const viewsEl = document.getElementById('page-view-count');
    if (viewsEl) {
      viewsEl.textContent = `👁️ ${page.view_count || 1} Pembaca`;
    }

    // Reading time calculation
    const readTimeEl = document.getElementById('page-read-time');
    if (readTimeEl) {
      const cleanText = page.content.replace(/<[^>]*>/g, ' ');
      const words = cleanText.trim().split(/\s+/).length;
      const minutes = Math.max(1, Math.ceil(words / 180));
      readTimeEl.textContent = `⏱️ ~${minutes} Menit Baca`;
    }

    // Body content
    const bodyEl = document.getElementById('page-body-content');
    if (bodyEl) {
      bodyEl.innerHTML = page.content;
    }

    // Switch view
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (containerEl) containerEl.classList.remove('hidden');

  } catch (err) {
    console.error('Gagal memuat halaman statik:', err);
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) errorEl.classList.remove('hidden');
  }
}

async function loadSidebarPages(currentSlug) {
  const sidebarContainer = document.getElementById('sidebar-pages-list');
  const footerContainer = document.getElementById('footer-static-pages-list');

  try {
    const res = await fetch('/api/pages');
    const data = await res.json();
    if (!data.success || !Array.isArray(data.pages)) return;

    if (sidebarContainer) {
      sidebarContainer.innerHTML = data.pages.map(p => {
        const isActive = p.slug === currentSlug;
        return `
          <a href="/page/${p.slug}" class="block p-3 rounded-2xl transition-all ${
            isActive
              ? 'bg-red-50 text-red-700 font-bold border border-red-200 shadow-2xs'
              : 'hover:bg-slate-50 text-slate-700 font-medium border border-transparent'
          }">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs truncate">${p.title}</span>
              ${isActive ? '<span class="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full shrink-0 font-bold">Aktif</span>' : '<span class="text-slate-400 text-xs">→</span>'}
            </div>
            ${p.summary ? `<p class="text-[11px] text-slate-500 mt-1 line-clamp-1 font-normal">${p.summary}</p>` : ''}
          </a>
        `;
      }).join('');
    }

    if (footerContainer) {
      footerContainer.innerHTML = data.pages.map(p => `
        <li>
          <a href="/page/${p.slug}" class="hover:text-white transition-colors truncate block">
            ${p.title}
          </a>
        </li>
      `).join('');
    }

  } catch (err) {
    console.error('Gagal memuat daftar halaman sidebar:', err);
  }
}

async function loadHeaderNavAndCms() {
  try {
    const res = await fetch('/api/cms');
    const data = await res.json();
    if (!data.success || !data.cms) return;

    // Top announcement
    if (data.cms.hero?.data?.announcement_bar) {
      const annEl = document.getElementById('top-announcement-text');
      if (annEl) annEl.textContent = data.cms.hero.data.announcement_bar;
    }

    // Dynamic header navigation menus
    if (data.cms.navigation?.data?.menus) {
      const desktopNav = document.getElementById('main-header-nav');
      const mobileNav = document.getElementById('mobile-header-nav');

      const activeMenus = data.cms.navigation.data.menus.filter(m => m.is_active !== false);
      const linksHtml = activeMenus.map(m => {
        let url = m.url;
        // If anchor like #jadwal, link back to /#jadwal
        if (url.startsWith('#')) url = `/${url}`;
        return `
          <a href="${url}" target="${m.target || '_self'}" class="hover:text-red-600 transition-colors py-1">
            ${m.label}
          </a>
        `;
      }).join('');

      if (desktopNav) desktopNav.innerHTML = linksHtml;
      if (mobileNav) mobileNav.innerHTML = linksHtml;
    }
  } catch (err) {
    console.error('Gagal memuat CMS header:', err);
  }
}

window.toggleMobileNav = function() {
  const drawer = document.getElementById('mobile-nav-drawer');
  if (drawer) drawer.classList.toggle('hidden');
};

window.sharePage = function() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert('Tautan halaman berhasil disalin ke clipboard:\n' + window.location.href);
    }).catch(() => {
      prompt('Salin tautan ini:', window.location.href);
    });
  } else {
    prompt('Salin tautan ini:', window.location.href);
  }
};
