// public/js/app.js - Landing Page Interactive Logic & CMS Renderer
document.addEventListener('DOMContentLoaded', async () => {
  // Animasi daun sakura berguguran dinonaktifkan
  await loadLandingCmsContent();
  setupAuthButtons();
  setupBirthDateInputs();
  setupFileUploadValidation();
  setupNavigation();
});

// -------------------------------------------------------------
// 1. SAKURA PETALS EFFECT (DISABLED)
// -------------------------------------------------------------
function initSakuraPetals() {
  // Dinonaktifkan sesuai permintaan pengguna
}

// -------------------------------------------------------------
// 2. CMS CONTENT LOADER
// -------------------------------------------------------------
let globalCmsData = {};

async function loadLandingCmsContent() {
  try {
    const res = await fetch('/api/cms');
    const result = await res.json();
    if (!result.success || !result.cms) return;

    globalCmsData = result.cms;

    // Render Hero & Announcement
    if (result.cms.hero) {
      const hero = result.cms.hero.data;
      const annEl = document.getElementById('top-announcement-text');
      if (annEl && hero.announcement_bar) annEl.textContent = hero.announcement_bar;

      const badgeEl = document.getElementById('hero-badge-text');
      if (badgeEl && hero.hero_badge) badgeEl.textContent = hero.hero_badge;

      const titleEl = document.getElementById('hero-title-text');
      if (titleEl && hero.hero_title) titleEl.textContent = hero.hero_title;

      const subtitleEl = document.getElementById('hero-subtitle-text');
      if (subtitleEl && hero.hero_subtitle) subtitleEl.textContent = hero.hero_subtitle;
    }

    // Render Schedules
    if (result.cms.schedule) {
      renderScheduleSection(result.cms.schedule.data);
    }

    // Render Location & Access
    if (result.cms.location) {
      renderLocationSection(result.cms.location.data);
    }

    // Render Dress Code
    if (result.cms.dresscode) {
      renderDresscodeSection(result.cms.dresscode.data);
    }

    // Render Stationery (ATK)
    if (result.cms.stationery) {
      renderStationerySection(result.cms.stationery.data);
    }

    // Render Payment
    if (result.cms.payment) {
      renderPaymentSection(result.cms.payment.data);
    }

    // Render FAQ
    if (result.cms.faq) {
      renderFaqSection(result.cms.faq);
    }

    // Render Dynamic Header Navigation Menus
    if (result.cms.navigation?.data?.menus) {
      renderHeaderNavigation(result.cms.navigation.data.menus);
    }

    // Render Header Logo (Ubah & Kurangi Logo)
    renderHeaderLogo(result.cms.header_logo?.data);

    // Render Image Slider Halaman Depan (Maksimal 3 Gambar)
    renderLandingSlider(result.cms.slider?.data);

    // Render Footer Settings & Text
    if (result.cms.footer) {
      renderFooterSection(result.cms.footer);
    }
  } catch (error) {
    console.error('Gagal memuat konten CMS:', error);
  }
}

// -------------------------------------------------------------
// 2B. HEADER LOGO RENDERER (UBAH & KURANGI LOGO)
// -------------------------------------------------------------
function renderHeaderLogo(logoData) {
  const container = document.getElementById('header-logo-container');
  const logo1El = document.getElementById('header-logo-1');
  const dividerEl = document.getElementById('header-logo-divider');
  const logo2El = document.getElementById('header-logo-2');

  const logo1 = logoData?.logo_1 || { enabled: true, url: '/images/logo-nat-test.svg', alt: 'NAT-TEST Official Logo' };
  const logo2 = logoData?.logo_2 || { enabled: true, url: '/images/logo-csgs-ui.svg', alt: 'UKK CSGS UI Logo' };

  const isLogo1Active = logo1.enabled !== false;
  const isLogo2Active = logo2.enabled !== false;

  // Logo 1
  if (logo1El) {
    if (isLogo1Active) {
      logo1El.src = logo1.url || '/images/logo-nat-test.svg';
      logo1El.alt = logo1.alt || 'NAT-TEST Official Logo';
      logo1El.classList.remove('hidden');
    } else {
      logo1El.classList.add('hidden');
    }
  }

  // Logo 2
  if (logo2El) {
    if (isLogo2Active) {
      logo2El.src = logo2.url || '/images/logo-csgs-ui.svg';
      logo2El.alt = logo2.alt || 'UKK CSGS UI Logo';
      logo2El.classList.remove('hidden');
    } else {
      logo2El.classList.add('hidden');
    }
  }

  // Divider: Only visible when BOTH logos are displayed
  if (dividerEl) {
    if (isLogo1Active && isLogo2Active && logoData?.show_divider !== false) {
      dividerEl.classList.remove('hidden');
    } else {
      dividerEl.classList.add('hidden');
    }
  }

  // Custom link target
  if (container && logoData?.link_target) {
    container.href = logoData.link_target;
  }
}

// -------------------------------------------------------------
// 2C. IMAGE SLIDER BANNER HALAMAN DEPAN (MAKSIMAL 3 GAMBAR)
// -------------------------------------------------------------
let currentSlideIndex = 0;
let sliderAutoplayTimer = null;
let sliderAutoplayEnabled = true;
let activeSliderItems = [];

function renderLandingSlider(sliderData) {
  const sectionEl = document.getElementById('landing-slider-section');
  const trackEl = document.getElementById('slider-track');
  const dotsEl = document.getElementById('slider-dots');
  const counterEl = document.getElementById('slider-counter');

  if (!sectionEl || !trackEl) return;

  if (sliderData && sliderData.enabled === false) {
    sectionEl.classList.add('hidden');
    return;
  }
  sectionEl.classList.remove('hidden');

  // Strict enforcement: maksimal 3 gambar
  let rawSlides = (sliderData?.slides && Array.isArray(sliderData.slides)) ? sliderData.slides : [];
  if (rawSlides.length === 0) {
    rawSlides = [
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

  // Filter active and clamp to maximum 3
  activeSliderItems = rawSlides.filter(s => s.is_active !== false).slice(0, 3);
  if (activeSliderItems.length === 0) {
    activeSliderItems = rawSlides.slice(0, 3);
  }

  // Render slides into track
  trackEl.innerHTML = activeSliderItems.map((s, idx) => `
    <div id="slide-item-${idx}" class="slider-slide absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${idx === 0 ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}">
      <img src="${s.image_url}" alt="${s.title || 'NAT-TEST Banner'}" class="w-full h-full object-cover" />
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent sm:hidden"></div>
      <div class="absolute bottom-5 sm:bottom-10 left-4 sm:left-12 right-4 sm:right-12 max-w-2xl text-white space-y-2 sm:hidden">
        ${s.badge ? `<span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white uppercase tracking-wider">${s.badge}</span>` : ''}
        <h3 class="text-base sm:text-xl font-extrabold text-white leading-tight drop-shadow-md">${s.title || ''}</h3>
        <p class="text-xs text-slate-200 line-clamp-2">${s.subtitle || ''}</p>
        ${s.btn_text ? `<a href="${s.btn_link || '#jadwal'}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl btn-japan text-xs font-bold shadow-md"><span>${s.btn_text}</span> ↗</a>` : ''}
      </div>
    </div>
  `).join('');

  // Render dots
  if (dotsEl) {
    dotsEl.innerHTML = activeSliderItems.map((_, idx) => `
      <button type="button" onclick="goToSlide(${idx})" id="slider-dot-${idx}" class="w-2.5 h-2.5 rounded-full transition-all ${idx === 0 ? 'bg-red-500 scale-125' : 'bg-white/40 hover:bg-white/80'}" aria-label="Slide ${idx + 1}"></button>
    `).join('');
  }

  currentSlideIndex = 0;
  updateSliderState();

  // If single slide, hide next/prev buttons and dots
  const btnPrev = document.getElementById('slider-btn-prev');
  const btnNext = document.getElementById('slider-btn-next');
  if (activeSliderItems.length <= 1) {
    if (btnPrev) btnPrev.classList.add('hidden');
    if (btnNext) btnNext.classList.add('hidden');
    if (dotsEl) dotsEl.classList.add('hidden');
  } else {
    if (btnPrev) btnPrev.classList.remove('hidden');
    if (btnNext) btnNext.classList.remove('hidden');
    if (dotsEl) dotsEl.classList.remove('hidden');
  }

  // Setup autoplay
  const intervalMs = sliderData?.interval_ms || 5000;
  setupSliderAutoplay(intervalMs);
}

function updateSliderState() {
  const total = activeSliderItems.length;
  if (total === 0) return;

  for (let i = 0; i < total; i++) {
    const slide = document.getElementById(`slide-item-${i}`);
    const dot = document.getElementById(`slider-dot-${i}`);

    if (slide) {
      if (i === currentSlideIndex) {
        slide.className = 'slider-slide absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out opacity-100 z-10 pointer-events-auto';
      } else {
        slide.className = 'slider-slide absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out opacity-0 z-0 pointer-events-none';
      }
    }

    if (dot) {
      if (i === currentSlideIndex) {
        dot.className = 'w-2.5 h-2.5 rounded-full transition-all bg-red-500 scale-125 shadow-xs';
      } else {
        dot.className = 'w-2.5 h-2.5 rounded-full transition-all bg-white/40 hover:bg-white/80';
      }
    }
  }

  const counterEl = document.getElementById('slider-counter');
  if (counterEl) {
    counterEl.textContent = `${currentSlideIndex + 1} / ${total}`;
  }
}

window.goToSlide = function(index) {
  if (activeSliderItems.length === 0) return;
  currentSlideIndex = (index + activeSliderItems.length) % activeSliderItems.length;
  updateSliderState();
};

window.sliderNext = function() {
  if (activeSliderItems.length <= 1) return;
  goToSlide(currentSlideIndex + 1);
};

window.sliderPrev = function() {
  if (activeSliderItems.length <= 1) return;
  goToSlide(currentSlideIndex - 1);
};

function setupSliderAutoplay(intervalMs = 5000) {
  if (sliderAutoplayTimer) {
    clearInterval(sliderAutoplayTimer);
  }

  sliderAutoplayTimer = setInterval(() => {
    if (sliderAutoplayEnabled && activeSliderItems.length > 1) {
      sliderNext();
    }
  }, intervalMs);

  // Pause on hover
  const section = document.getElementById('landing-slider-section');
  if (section && !section.dataset.hoverBound) {
    section.dataset.hoverBound = 'true';
    section.addEventListener('mouseenter', () => {
      sliderAutoplayEnabled = false;
    });
    section.addEventListener('mouseleave', () => {
      sliderAutoplayEnabled = true;
    });
  }
}

window.toggleSliderAutoplay = function() {
  sliderAutoplayEnabled = !sliderAutoplayEnabled;
  const icon = document.getElementById('slider-play-icon');
  const label = document.getElementById('slider-play-label');

  if (sliderAutoplayEnabled) {
    if (icon) icon.textContent = '⏸️';
    if (label) label.textContent = 'Auto';
  } else {
    if (icon) icon.textContent = '▶️';
    if (label) label.textContent = 'Jeda';
  }
};

function renderHeaderNavigation(menus) {
  const desktopNav = document.getElementById('main-header-nav');
  const mobileNav = document.getElementById('mobile-header-nav');
  if (!Array.isArray(menus)) return;

  const activeMenus = menus.filter(m => m.is_active !== false);
  const linksHtml = activeMenus.map(m => `
    <a href="${m.url}" target="${m.target || '_self'}" class="hover:text-red-600 transition-colors py-1">
      ${m.label}
    </a>
  `).join('');

  if (desktopNav) desktopNav.innerHTML = linksHtml;
  if (mobileNav) {
    mobileNav.innerHTML = linksHtml;
    // Auto-close mobile drawer upon clicking a nav link
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        const drawer = document.getElementById('mobile-nav-drawer');
        if (drawer) drawer.classList.add('hidden');
      });
    });
  }

  setupNavigation();
}

window.toggleMobileNav = function() {
  const drawer = document.getElementById('mobile-nav-drawer');
  if (drawer) drawer.classList.toggle('hidden');
};

function renderScheduleSection(data) {
  const container = document.getElementById('schedule-list-container');
  if (!container || !data.schedules) return;

  const descEl = document.getElementById('schedule-desc-text');
  if (descEl && data.description) descEl.textContent = data.description;

  container.innerHTML = data.schedules.map((item) => {
    let statusBadge = '';
    if (item.status === 'BUKA') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Pendaftaran Dibuka
      </span>`;
    } else if (item.status === 'SEGERA') {
      statusBadge = `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
        Segera Hadir
      </span>`;
    } else {
      statusBadge = `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        Selesai
      </span>`;
    }

    const levelsPill = (item.levels || []).map(lvl => `
      <span class="px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded">${lvl}</span>
    `).join('');

    const isAvailable = item.status === 'BUKA';

    return `
      <div class="relative bg-white rounded-2xl p-6 border ${isAvailable ? 'border-red-400 shadow-md ring-2 ring-red-100' : 'border-slate-200'} transition-all hover:shadow-lg">
        ${isAvailable ? '<div class="absolute -top-3 right-6 bg-red-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow">Gelombang Aktif</div>' : ''}
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 class="font-bold text-lg text-slate-900">${item.name}</h3>
          ${statusBadge}
        </div>
        
        <div class="space-y-2.5 text-sm mb-5 text-slate-600">
          <div class="flex items-start gap-2">
            <span class="font-medium text-slate-900 min-w-[120px]">📅 Tanggal Ujian:</span>
            <span class="font-bold text-red-600">${item.exam_date}</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="font-medium text-slate-900 min-w-[120px]">⏳ Pendaftaran:</span>
            <span>${item.registration_period}</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="font-medium text-slate-900 min-w-[120px]">📜 Hasil Ujian:</span>
            <span>${item.result_date}</span>
          </div>
          <div class="flex items-center gap-2 pt-1">
            <span class="font-medium text-slate-900 min-w-[120px]">🎯 Level Dibuka:</span>
            <div class="flex flex-wrap gap-1">${levelsPill}</div>
          </div>
        </div>

        <div>
          ${isAvailable ? `
            <button onclick="openRegisterModal('${item.name}')" class="w-full py-2.5 px-4 rounded-xl btn-japan font-bold text-sm flex items-center justify-center gap-2">
              Daftar Gelombang Ini
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </button>
          ` : `
            <button disabled class="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-semibold text-sm cursor-not-allowed">
              Pendaftaran Tidak Aktif
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function renderLocationSection(data) {
  const venueTitle = document.getElementById('location-venue-name');
  if (venueTitle && data.venue_name) venueTitle.textContent = data.venue_name;

  const venueAddress = document.getElementById('location-address');
  if (venueAddress && data.address) venueAddress.textContent = data.address;

  const mapIframe = document.getElementById('location-map-iframe');
  if (mapIframe && data.map_embed_url) mapIframe.src = data.map_embed_url;

  const directMapLink = document.getElementById('location-direct-link');
  if (directMapLink && data.google_maps_link) directMapLink.href = data.google_maps_link;

  const routesContainer = document.getElementById('location-routes-container');
  if (routesContainer && data.routes) {
    routesContainer.innerHTML = data.routes.map((route) => {
      let iconSvg = '';
      if (route.mode.includes('KRL')) {
        iconSvg = `<svg class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h8m-8 4h8m-9 7h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v9a2 2 0 002 2zm1 0v2m8-2v2"/></svg>`;
      } else if (route.mode.includes('Bus')) {
        iconSvg = `<svg class="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8m8-8v8m-9 4h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`;
      } else {
        iconSvg = `<svg class="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>`;
      }
      return `
        <div class="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div class="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 shrink-0">${iconSvg}</div>
          <div>
            <h4 class="font-bold text-slate-900 text-sm mb-1">${route.title}</h4>
            <p class="text-xs text-slate-600 leading-relaxed">${route.steps}</p>
          </div>
        </div>
      `;
    }).join('');
  }
}

function renderDresscodeSection(data) {
  const allowedList = document.getElementById('dresscode-allowed-list');
  if (allowedList && data.allowed) {
    allowedList.innerHTML = data.allowed.map(item => `
      <li class="flex items-start gap-3">
        <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 shrink-0 text-xs font-bold mt-0.5">✓</span>
        <span class="text-sm text-slate-700 leading-relaxed">${item}</span>
      </li>
    `).join('');
  }

  const prohibitedList = document.getElementById('dresscode-prohibited-list');
  if (prohibitedList && data.prohibited) {
    prohibitedList.innerHTML = data.prohibited.map(item => `
      <li class="flex items-start gap-3">
        <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 shrink-0 text-xs font-bold mt-0.5">✕</span>
        <span class="text-sm text-slate-700 leading-relaxed">${item}</span>
      </li>
    `).join('');
  }

  const specialRule = document.getElementById('dresscode-special-rule');
  if (specialRule && data.special_rule) {
    specialRule.textContent = data.special_rule;
  }
}

function renderStationerySection(data) {
  const mandatoryContainer = document.getElementById('stationery-mandatory-list');
  if (mandatoryContainer && data.mandatory) {
    mandatoryContainer.innerHTML = data.mandatory.map(item => `
      <div class="flex items-start gap-3.5 p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-red-300 transition-all">
        <div class="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 font-bold">
          ✏️
        </div>
        <div>
          <h4 class="font-bold text-slate-900 text-sm mb-0.5">${item.name}</h4>
          <p class="text-xs text-slate-600 leading-relaxed">${item.desc}</p>
        </div>
      </div>
    `).join('');
  }

  const prohibitedContainer = document.getElementById('stationery-prohibited-list');
  if (prohibitedContainer && data.prohibited_on_desk) {
    prohibitedContainer.innerHTML = data.prohibited_on_desk.map(item => `
      <li class="flex items-start gap-3 text-sm text-slate-700">
        <span class="text-red-500 font-bold shrink-0">🚫</span>
        <span>${item}</span>
      </li>
    `).join('');
  }
}

function renderPaymentSection(data) {
  // Fee cards
  const feeContainer = document.getElementById('payment-fees-container');
  if (feeContainer && data.fee_structures) {
    feeContainer.innerHTML = data.fee_structures.map(f => `
      <div class="bg-white rounded-xl p-5 border border-slate-200 text-center shadow-sm">
        <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">${f.desc}</div>
        <div class="font-bold text-slate-900 text-base mb-2">${f.level}</div>
        <div class="text-2xl font-black text-red-600">${f.fee_text}</div>
      </div>
    `).join('');
  }

  // Bank accounts
  const bankContainer = document.getElementById('payment-accounts-container');
  if (bankContainer && data.bank_accounts) {
    bankContainer.innerHTML = data.bank_accounts.map(acc => `
      <div class="p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div class="text-xs font-semibold text-slate-500">${acc.type}</div>
        <div class="font-bold text-slate-900 text-base my-0.5">${acc.bank}</div>
        <div class="font-mono font-bold text-red-600 text-sm tracking-wide bg-white px-2.5 py-1 rounded border border-slate-200 inline-block my-1">${acc.account_number}</div>
        <div class="text-xs text-slate-600">a.n. ${acc.account_name}</div>
      </div>
    `).join('');
  }

  // Steps
  const stepsContainer = document.getElementById('payment-steps-container');
  if (stepsContainer && data.steps) {
    stepsContainer.innerHTML = data.steps.map(step => `
      <div class="flex items-start gap-3">
        <div class="w-7 h-7 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
          ${step.step}
        </div>
        <div>
          <h5 class="font-bold text-slate-900 text-sm">${step.title}</h5>
          <p class="text-xs text-slate-600 leading-relaxed">${step.desc}</p>
        </div>
      </div>
    `).join('');
  }
}

function renderFaqSection(faqCms) {
  const data = faqCms?.data || faqCms || {};
  const title = faqCms?.title;
  const subtitle = faqCms?.subtitle;

  const titleEl = document.getElementById('faq-section-title');
  if (titleEl && title) titleEl.textContent = title;

  const subtitleEl = document.getElementById('faq-section-subtitle');
  if (subtitleEl && subtitle) subtitleEl.textContent = subtitle;

  const container = document.getElementById('faq-accordion-container');
  if (container && Array.isArray(data.faqs)) {
    container.innerHTML = data.faqs.map((faq, idx) => `
      <div class="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <button onclick="toggleFaq(${idx})" class="w-full text-left px-5 py-4 font-bold text-sm text-slate-900 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
          <span>${faq.q}</span>
          <svg id="faq-icon-${idx}" class="w-4 h-4 text-slate-500 transform transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <div id="faq-content-${idx}" class="hidden px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
          <div class="whitespace-pre-line">${faq.a}</div>
          ${faq.image_url ? `
            <div class="mt-3.5 pt-3 border-t border-slate-100">
              <a href="${faq.image_url}" target="_blank" class="inline-block group/faqimg max-w-full">
                <img src="${faq.image_url}" alt="${faq.q}" class="max-h-72 w-auto max-w-full rounded-xl border border-slate-200 shadow-2xs object-contain group-hover/faqimg:shadow-md transition-shadow cursor-pointer bg-slate-50" />
                <span class="inline-flex items-center gap-1 text-[11px] text-slate-400 group-hover/faqimg:text-red-600 mt-1.5 transition-colors font-medium">
                  <span>🔍 Klik untuk memperbesar / membuka gambar di tab baru</span>
                </span>
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  // Update footer contacts if available
  if (data.contact) {
    const c = data.contact;
    const offEl = document.getElementById('footer-contact-office');
    const waEl = document.getElementById('footer-contact-wa');
    const emEl = document.getElementById('footer-contact-email');
    const hrEl = document.getElementById('footer-contact-hours');
    if (offEl && c.office) offEl.textContent = c.office;
    if (waEl && c.whatsapp) waEl.textContent = c.whatsapp;
    if (emEl && c.email) emEl.textContent = c.email;
    if (hrEl && c.operational_hours) hrEl.textContent = c.operational_hours;
  }
}

window.toggleFaq = function (idx) {
  const content = document.getElementById(`faq-content-${idx}`);
  const icon = document.getElementById(`faq-icon-${idx}`);
  if (content) {
    content.classList.toggle('hidden');
    if (icon) icon.classList.toggle('rotate-180');
  }
};

// -------------------------------------------------------------
// 2H. FOOTER SECTION RENDERER
// -------------------------------------------------------------
function renderFooterSection(footerCms) {
  if (!footerCms) return;
  const data = footerCms.data || footerCms;

  const aboutEl = document.getElementById('footer-about-text');
  if (aboutEl && data.about_text) aboutEl.textContent = data.about_text;

  const accredEl = document.getElementById('footer-accreditation-text');
  if (accredEl && data.accreditation_text) accredEl.textContent = data.accreditation_text;

  const col2El = document.getElementById('footer-col2-title');
  if (col2El && data.col2_title) col2El.textContent = data.col2_title;

  const col3El = document.getElementById('footer-col3-title');
  if (col3El && data.col3_title) col3El.textContent = data.col3_title;

  const col4El = document.getElementById('footer-col4-title');
  if (col4El && data.col4_title) col4El.textContent = data.col4_title;

  const offEl = document.getElementById('footer-contact-office');
  if (offEl && data.contact_office) offEl.textContent = data.contact_office;

  const waEl = document.getElementById('footer-contact-wa');
  if (waEl && data.contact_wa) waEl.textContent = data.contact_wa;

  const emEl = document.getElementById('footer-contact-email');
  if (emEl && data.contact_email) emEl.textContent = data.contact_email;

  const hrEl = document.getElementById('footer-contact-hours');
  if (hrEl && data.contact_hours) hrEl.textContent = data.contact_hours;

  const copyEl = document.getElementById('footer-copyright-text');
  if (copyEl && data.copyright_text) copyEl.textContent = data.copyright_text;

  // Render Footer Logos (Ubah & Kurangi Image)
  renderFooterLogos(data);
}

function renderFooterLogos(data) {
  const container = document.getElementById('footer-logos-container');
  if (!container) return;

  const logos = [];

  // If specific logo_1/logo_2/logo_3 properties are provided
  if (data.logo_1 !== undefined || data.logo_2 !== undefined || data.logo_3 !== undefined) {
    if (data.logo_1 && data.logo_1.enabled !== false && data.logo_1.url) {
      logos.push(data.logo_1);
    }
    if (data.logo_2 && data.logo_2.enabled !== false && data.logo_2.url) {
      logos.push(data.logo_2);
    }
    if (data.logo_3 && data.logo_3.enabled === true && data.logo_3.url) {
      logos.push(data.logo_3);
    }
  } else if (Array.isArray(data.logos)) {
    data.logos.forEach(l => {
      if (l.enabled !== false && l.url) logos.push(l);
    });
  } else {
    // Default fallback - keep existing logos visible
    return;
  }

  if (logos.length === 0) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = logos.map((l, idx) => `
    <img src="${l.url}" alt="${l.alt || 'Logo ' + (idx + 1)}" class="h-9 w-auto bg-white p-1 rounded-md object-contain shadow-2xs" />
  `).join('');
}

// -------------------------------------------------------------
// 3. BIRTH DATE PICKER ENHANCEMENT (NO 1970-01-01 BUG!)
// -------------------------------------------------------------
function setupBirthDateInputs() {
  const dateInput = document.getElementById('reg_birth_date');
  const previewEl = document.getElementById('birth_date_preview');

  if (!dateInput) return;

  // Crucial: Clear initial value to avoid epoch 1970
  dateInput.value = '';
  // Set bounds: 1950 to 2018
  dateInput.min = '1950-01-01';
  dateInput.max = '2018-12-31';

  dateInput.addEventListener('change', () => {
    const val = dateInput.value;
    if (!val) {
      if (previewEl) previewEl.innerHTML = '<span class="text-amber-600">Pilih tanggal lahir sesuai KTP</span>';
      return;
    }

    if (val === '1970-01-01') {
      alert('Perhatian: Anda memilih tanggal default 1 Januari 1970. Mohon pilih tanggal lahir Anda yang sebenarnya sesuai KTP.');
      dateInput.value = '';
      if (previewEl) previewEl.innerHTML = '<span class="text-red-600">Tanggal tidak boleh 1970-01-01</span>';
      return;
    }

    const parts = val.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;

    if (previewEl) {
      previewEl.innerHTML = `✓ Tanggal Lahir: <strong class="text-slate-900">${day} ${monthNames[month]} ${year}</strong> (Usia: ${age} tahun)`;
    }
  });
}

// -------------------------------------------------------------
// 4. FILE UPLOAD & STRICT 2MB VALIDATOR
// -------------------------------------------------------------
const uploadedFiles = {
  ktp: null,
  pasfoto: null,
  institution: null
};

function setupFileUploadValidation() {
  const ktpInput = document.getElementById('upload_ktp_file');
  const pasfotoInput = document.getElementById('upload_pasfoto_file');
  const instInput = document.getElementById('upload_institution_file');

  if (ktpInput) {
    ktpInput.addEventListener('change', (e) => handleFileSelection(e.target.files[0], 'ktp'));
  }

  if (pasfotoInput) {
    pasfotoInput.addEventListener('change', (e) => handleFileSelection(e.target.files[0], 'pasfoto'));
  }

  if (instInput) {
    instInput.addEventListener('change', (e) => handleFileSelection(e.target.files[0], 'institution'));
  }
}

function handleFileSelection(file, type) {
  if (!file) return;

  const MAX_LIMIT = 2 * 1024 * 1024; // 2MB
  const statusEl = document.getElementById(`${type}_upload_status`);
  const previewImg = document.getElementById(`${type}_preview_img`);

  // STRICT CHECK: File size > 2MB
  if (file.size > MAX_LIMIT) {
    const actualSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    alert(`Peringatan: Ukuran berkas ${file.name} adalah ${actualSizeMB} MB. Melebihi batas maksimal 2 MB!\n\nHarap perkecil resolusi atau kompres foto Anda sebelum mengunggah.`);
    
    // Reset input
    const input = document.getElementById(`upload_${type}_file`);
    if (input) input.value = '';

    if (statusEl) {
      statusEl.innerHTML = `<span class="text-red-600 font-bold">✕ File terlalu besar (${actualSizeMB} MB). Maksimal 2 MB!</span>`;
    }
    if (previewImg) previewImg.classList.add('hidden');
    uploadedFiles[type] = null;
    return;
  }

  // Valid size (< 2MB)
  const sizeKB = (file.size / 1024).toFixed(1);
  const reader = new FileReader();

  reader.onload = (e) => {
    uploadedFiles[type] = {
      filename: file.name,
      dataUrl: e.target.result,
      size: file.size
    };

    if (statusEl) {
      statusEl.innerHTML = `<span class="text-emerald-700 font-semibold">✓ ${file.name} (${sizeKB} KB / Max 2 MB - Sesuai)</span>`;
    }

    if (previewImg) {
      previewImg.src = e.target.result;
      previewImg.classList.remove('hidden');
    }
  };

  reader.readAsDataURL(file);
}

// -------------------------------------------------------------
// 5. AUTH BUTTONS & MODALS
// -------------------------------------------------------------
function setupAuthButtons() {
  const user = Auth.getUser();
  const authNav = document.getElementById('nav-auth-section');

  if (authNav) {
    if (user) {
      authNav.innerHTML = `
        <div class="flex items-center gap-3">
          <a href="${user.role === 'ADMIN' ? '/admin-dashboard.html' : '/user-dashboard.html'}" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-sm">
            <span>Dashboard ${user.name.split(' ')[0]}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] bg-red-600 text-white">${user.role}</span>
          </a>
          <button onclick="Auth.logout()" class="text-xs font-semibold text-slate-500 hover:text-red-600 py-1">Keluar</button>
        </div>
      `;
    } else {
      authNav.innerHTML = `
        <button onclick="openLoginModal()" class="px-4 py-2 text-xs font-bold text-slate-700 hover:text-red-600 transition-colors">
          Masuk Peserta
        </button>
        <button onclick="openRegisterModal()" class="px-4 py-2 text-xs font-bold rounded-xl btn-japan">
          Daftar Sekarang
        </button>
      `;
    }
  }

  // Keyboard shortcut to access secret admin modal / page: Ctrl + Shift + A
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') {
      e.preventDefault();
      window.location.href = '/admin-login.html';
    }
  });
}

function setupNavigation() {
  // Smooth scroll for in-page anchors
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// Global modal triggers
window.openLoginModal = function () {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.remove('hidden');
};

window.closeLoginModal = function () {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.add('hidden');
};

window.openRegisterModal = function (preferredWave = null) {
  const modal = document.getElementById('register-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (preferredWave) {
      const waveSelect = document.getElementById('reg_exam_period');
      if (waveSelect) waveSelect.value = preferredWave;
    }
  }
};

window.closeRegisterModal = function () {
  const modal = document.getElementById('register-modal');
  if (modal) modal.classList.add('hidden');
};

// Handle Login Form Submission
window.handleLoginSubmit = async function (e) {
  e.preventDefault();
  const email = document.getElementById('login_email').value;
  const password = document.getElementById('login_password').value;
  const errorEl = document.getElementById('login_error_message');

  if (errorEl) errorEl.classList.add('hidden');

  try {
    const res = await Auth.login(email, password);
    if (res.success) {
      if (res.user.role === 'ADMIN' || res.user.role === 'VERIFIKATOR') {
        window.location.href = '/admin-dashboard.html';
      } else {
        window.location.href = '/user-dashboard.html';
      }
    } else {
      if (errorEl) {
        errorEl.textContent = res.message || 'Login gagal';
        errorEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = 'Terjadi kesalahan sistem';
      errorEl.classList.remove('hidden');
    }
  }
};

window.toggleSameAddressLanding = function() {
  const isChecked = document.getElementById('reg_same_address')?.checked;
  const domAddress = document.getElementById('reg_address')?.value || '';
  const domPostal = document.getElementById('reg_postal_code')?.value || '';
  const certAddrInput = document.getElementById('reg_cert_address');
  const certPostalInput = document.getElementById('reg_cert_postal_code');

  if (isChecked) {
    if (certAddrInput) certAddrInput.value = domAddress;
    if (certPostalInput) certPostalInput.value = domPostal;
  }
};

// Handle Registration Form Submission
window.handleRegisterSubmit = async function (e) {
  e.preventDefault();
  const name = document.getElementById('reg_name').value;
  const nik = document.getElementById('reg_nik').value;
  const email = document.getElementById('reg_email').value;
  const password = document.getElementById('reg_password').value;
  const phone = document.getElementById('reg_phone').value;
  const birth_date = document.getElementById('reg_birth_date').value;
  const exam_period = document.getElementById('reg_exam_period').value;
  const exam_level = document.getElementById('reg_exam_level').value;
  const birth_place = document.getElementById('reg_birth_place').value;
  const address = document.getElementById('reg_address')?.value || '';
  const postal_code = document.getElementById('reg_postal_code')?.value || '';
  const institution = document.getElementById('reg_institution')?.value || '';
  const cert_address = document.getElementById('reg_cert_address')?.value || address;
  const cert_postal_code = document.getElementById('reg_cert_postal_code')?.value || postal_code;
  const errorEl = document.getElementById('reg_error_message');

  if (errorEl) errorEl.classList.add('hidden');

  // Verify non-1970 date
  if (!birth_date || birth_date === '1970-01-01') {
    if (errorEl) {
      errorEl.textContent = 'Harap masukkan tanggal lahir Anda yang sebenarnya (bukan 1970-01-01).';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  try {
    // 1. Create User account first
    const regRes = await Auth.register(name, email, password, phone, birth_date);
    if (!regRes.success) {
      if (errorEl) {
        errorEl.textContent = regRes.message || 'Pendaftaran akun gagal.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    // 2. Upload KTP, Pasfoto, and Foto Institusi if selected
    let ktpUrl = '';
    let pasfotoUrl = '';
    let instUrl = '';

    if (uploadedFiles.ktp) {
      const uploadKtp = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${regRes.token}`
        },
        body: JSON.stringify({
          dataUrl: uploadedFiles.ktp.dataUrl,
          filename: uploadedFiles.ktp.filename,
          category: 'ktp'
        })
      });
      const ktpRes = await uploadKtp.json();
      if (ktpRes.success) ktpUrl = ktpRes.fileUrl;
    }

    if (uploadedFiles.pasfoto) {
      const uploadFoto = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${regRes.token}`
        },
        body: JSON.stringify({
          dataUrl: uploadedFiles.pasfoto.dataUrl,
          filename: uploadedFiles.pasfoto.filename,
          category: 'pasfoto'
        })
      });
      const fotoRes = await uploadFoto.json();
      if (fotoRes.success) pasfotoUrl = fotoRes.fileUrl;
    }

    if (uploadedFiles.institution) {
      const uploadInst = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${regRes.token}`
        },
        body: JSON.stringify({
          dataUrl: uploadedFiles.institution.dataUrl,
          filename: uploadedFiles.institution.filename,
          category: 'institusi'
        })
      });
      const instRes = await uploadInst.json();
      if (instRes.success) instUrl = instRes.fileUrl;
    }

    // 3. Create Exam Registration record with full participant details
    const examRes = await fetch('/api/registrations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${regRes.token}`
      },
      body: JSON.stringify({
        exam_period,
        exam_level,
        full_name: name,
        nik_ktp: nik,
        gender: document.getElementById('reg_gender')?.value || 'L',
        birth_place: birth_place || 'Jakarta',
        birth_date,
        phone,
        address,
        postal_code,
        certificate_delivery_address: cert_address,
        certificate_postal_code: cert_postal_code,
        institution,
        photo_ktp_path: ktpUrl,
        photo_pasfoto_path: pasfotoUrl,
        photo_institution_path: instUrl,
        payment_method: document.getElementById('reg_payment_method')?.value || 'Virtual Account BNI46'
      })
    });

    const finalResult = await examRes.json();
    if (finalResult.success) {
      alert(`Selamat ${name}! Pendaftaran berhasil disimpan dengan Nomor: ${finalResult.registration_number}.\nSilakan masuk ke dashboard untuk melihat rincian pembayaran.`);
      window.location.href = '/user-dashboard.html';
    } else {
      window.location.href = '/user-dashboard.html';
    }
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = 'Terjadi gangguan jaringan saat pendaftaran.';
      errorEl.classList.remove('hidden');
    }
  }
};
