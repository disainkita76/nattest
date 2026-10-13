// public/js/theme.js - Dynamic Typography & Color Theme Engine for NAT-TEST UKK CSGS UI
(function () {
  'use strict';

  const THEME_STORAGE_KEY = 'nattest_site_theme';

  // Preset Palettes
  const THEME_PRESETS = {
    'japan-red': {
      name: 'Merah Torii (Default)',
      primary_color: '#DC2626',
      primary_hover: '#B91C1C',
      primary_light: '#FEF2F2',
      primary_border: 'rgba(220, 38, 38, 0.25)',
      accent_color: '#D97706',
      dark_color: '#0F172A'
    },
    'samurai-blue': {
      name: 'Biru Samurai (Indigo / Royal)',
      primary_color: '#2563EB',
      primary_hover: '#1D4ED8',
      primary_light: '#EFF6FF',
      primary_border: 'rgba(37, 99, 235, 0.25)',
      accent_color: '#0284C7',
      dark_color: '#0F172A'
    },
    'matcha-green': {
      name: 'Hijau Matcha (Zen Emerald)',
      primary_color: '#059669',
      primary_hover: '#047857',
      primary_light: '#ECFDF5',
      primary_border: 'rgba(5, 150, 105, 0.25)',
      accent_color: '#D97706',
      dark_color: '#064E3B'
    },
    'imperial-purple': {
      name: 'Ungu Kekaisaran (Imperial Violet)',
      primary_color: '#7C3AED',
      primary_hover: '#6D28D9',
      primary_light: '#F5F3FF',
      primary_border: 'rgba(124, 58, 237, 0.25)',
      accent_color: '#EC4899',
      dark_color: '#1E1B4B'
    },
    'amber-gold': {
      name: 'Emas Musim Gugur (Amber & Gold)',
      primary_color: '#D97706',
      primary_hover: '#B45309',
      primary_light: '#FFFBEB',
      primary_border: 'rgba(217, 119, 6, 0.25)',
      accent_color: '#EA580C',
      dark_color: '#1C1917'
    },
    'monochrome-slate': {
      name: 'Monokrom & Arang (Slate & Onyx)',
      primary_color: '#334155',
      primary_hover: '#1E293B',
      primary_light: '#F8FAFC',
      primary_border: 'rgba(51, 65, 85, 0.25)',
      accent_color: '#64748B',
      dark_color: '#020617'
    },
    'sakura-rose': {
      name: 'Sakura Blossom (Soft Rose)',
      primary_color: '#E11D48',
      primary_hover: '#BE123C',
      primary_light: '#FFF1F2',
      primary_border: 'rgba(225, 29, 72, 0.25)',
      accent_color: '#FB7185',
      dark_color: '#0F172A'
    }
  };

  // Supported Google Fonts Registry
  const GOOGLE_FONTS = {
    'Plus Jakarta Sans': 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap',
    'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
    'Poppins': 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap',
    'Roboto': 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap',
    'Outfit': 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap',
    'Montserrat': 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap',
    'Noto Sans JP': 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&display=swap',
    'Noto Serif JP': 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700;900&display=swap',
    'Shippori Mincho': 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700;800&display=swap',
    'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&display=swap'
  };

  function loadFont(fontName, customUrl) {
    if (!fontName) return;
    const cleanId = 'theme-font-' + fontName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    if (document.getElementById(cleanId)) return;

    const url = customUrl || GOOGLE_FONTS[fontName] || `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700;800;900&display=swap`;

    const link = document.createElement('link');
    link.id = cleanId;
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }

  function applyTheme(theme, saveCache = true) {
    if (!theme) return;

    const fontName = theme.font_family || 'Plus Jakarta Sans';
    loadFont(fontName, theme.font_url);

    let styleEl = document.getElementById('dynamic-theme-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-theme-style';
      document.head.appendChild(styleEl);
    }

    const primary = theme.primary_color || '#DC2626';
    const primaryHover = theme.primary_hover || '#B91C1C';
    const primaryLight = theme.primary_light || '#FEF2F2';
    const primaryBorder = theme.primary_border || 'rgba(220, 38, 38, 0.25)';
    const accent = theme.accent_color || '#D97706';

    styleEl.innerHTML = `
      :root {
        --theme-primary: ${primary};
        --theme-primary-hover: ${primaryHover};
        --theme-primary-light: ${primaryLight};
        --theme-primary-border: ${primaryBorder};
        --theme-accent: ${accent};
        --theme-font-family: '${fontName}', sans-serif;
        --jp-red: ${primary};
        --jp-red-dark: ${primaryHover};
        --jp-red-light: ${primaryLight};
      }

      /* Global Typography Override */
      body, input, select, textarea, button {
        font-family: '${fontName}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      /* Primary Japanese-Themed Button */
      .btn-japan {
        background: linear-gradient(135deg, ${primary} 0%, ${primaryHover} 100%) !important;
        box-shadow: 0 4px 14px 0 rgba(0, 0, 0, 0.2) !important;
      }
      .btn-japan:hover {
        background: linear-gradient(135deg, ${primaryHover} 0%, ${primary} 100%) !important;
        box-shadow: 0 6px 20px 0 rgba(0, 0, 0, 0.25) !important;
      }

      /* Dynamic Accent Utilities */
      .text-red-600, .text-red-700 {
        color: ${primary} !important;
      }
      .text-red-800, .text-red-900, .text-red-950 {
        color: ${primaryHover} !important;
      }
      .bg-red-600 {
        background-color: ${primary} !important;
      }
      .bg-red-700, .bg-red-800, .bg-red-950 {
        background-color: ${primaryHover} !important;
      }
      .hover\\:bg-red-700:hover, .hover\\:bg-red-600:hover, .hover\\:bg-red-800:hover {
        background-color: ${primaryHover} !important;
      }
      .border-red-400, .border-red-500, .border-red-600 {
        border-color: ${primary} !important;
      }
      .border-red-200, .border-red-300 {
        border-color: ${primaryBorder} !important;
      }
      .bg-red-50, .bg-red-50\\/70, .bg-red-50\\/50, .bg-red-50\\/30 {
        background-color: ${primaryLight} !important;
      }
      .selection\\:bg-red-500::selection {
        background-color: ${primary} !important;
      }
      .ring-red-500, .focus\\:ring-red-500:focus, .ring-red-100 {
        --tw-ring-color: ${primary} !important;
      }
      .hanko-stamp, .hanko-circle {
        border-color: ${primary} !important;
        color: ${primary} !important;
      }
      .torii-accent::before {
        background-color: ${primary} !important;
      }
      .from-red-600 {
        --tw-gradient-from: ${primary} var(--tw-gradient-from-position) !important;
        --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;
      }
      .to-red-800, .to-red-700 {
        --tw-gradient-to: ${primaryHover} var(--tw-gradient-to-position) !important;
      }
    `;

    if (saveCache) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
      } catch (e) {}
    }
  }

  // 1. Instant zero-flicker apply from localStorage
  try {
    const cached = localStorage.getItem(THEME_STORAGE_KEY);
    if (cached) {
      applyTheme(JSON.parse(cached), false);
    }
  } catch (e) {}

  // 2. Load latest theme from CMS server API
  async function fetchAndApplyTheme() {
    try {
      const res = await fetch('/api/cms/theme');
      const json = await res.json();
      if (json.success && json.section?.data) {
        applyTheme(json.section.data, true);
      }
    } catch (e) {
      // Quiet fail if network unavailable
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchAndApplyTheme);
  } else {
    fetchAndApplyTheme();
  }

  // Expose ThemeManager API
  window.ThemeManager = {
    PRESETS: THEME_PRESETS,
    FONTS: GOOGLE_FONTS,
    applyTheme,
    fetchAndApplyTheme,
    loadFont
  };
})();
