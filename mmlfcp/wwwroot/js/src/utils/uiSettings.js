/**
 * 화면 설정 — 컬러 테마 / 밝은·다크 모드 / 폰트 크기 / 직접 색상 선택
 * localStorage: mmlfcp_ui_theme, mmlfcp_ui_mode, mmlfcp_ui_font, mmlfcp_ui_custom_color
 */
(function () {
    'use strict';

    var THEME_KEY = 'mmlfcp_ui_theme';
    var MODE_KEY = 'mmlfcp_ui_mode';
    var FONT_KEY = 'mmlfcp_ui_font';
    var CUSTOM_COLOR_KEY = 'mmlfcp_ui_custom_color';
    var DEFAULT_THEME = 'teal';
    var DEFAULT_MODE = 'light';
    var DEFAULT_FONT = 'md';
    var DEFAULT_CUSTOM = '#2B579A';
    var STYLE_ID = 'mmlfcp-custom-theme';

    var THEMES = ['teal', 'navy', 'forest', 'wine', 'slate', 'custom'];
    var MODES = ['light', 'dark'];
    var FONTS = ['sm', 'md', 'lg', 'xl'];

    function safeGet(key, fallback) {
        try {
            var v = localStorage.getItem(key);
            return v || fallback;
        } catch (_) {
            return fallback;
        }
    }

    function safeSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (_) { /* ignore */ }
    }

    function clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
    }

    function normalizeHex(hex) {
        if (!hex || typeof hex !== 'string') return null;
        var h = hex.trim().replace(/^#/, '');
        if (/^[0-9a-fA-F]{3}$/.test(h)) {
            h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        }
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
        return '#' + h.toLowerCase();
    }

    function hexToRgb(hex) {
        var h = normalizeHex(hex);
        if (!h) return null;
        return {
            r: parseInt(h.slice(1, 3), 16),
            g: parseInt(h.slice(3, 5), 16),
            b: parseInt(h.slice(5, 7), 16)
        };
    }

    function rgbToHex(r, g, b) {
        function to(n) {
            var s = clamp(Math.round(n), 0, 255).toString(16);
            return s.length === 1 ? '0' + s : s;
        }
        return '#' + to(r) + to(g) + to(b);
    }

    function darken(hex, amount) {
        var c = hexToRgb(hex);
        if (!c) return hex;
        var t = clamp(amount, 0, 1);
        return rgbToHex(c.r * (1 - t), c.g * (1 - t), c.b * (1 - t));
    }

    function lighten(hex, amount) {
        var c = hexToRgb(hex);
        if (!c) return hex;
        var t = clamp(amount, 0, 1);
        return rgbToHex(c.r + (255 - c.r) * t, c.g + (255 - c.g) * t, c.b + (255 - c.b) * t);
    }

    /** mix amount of hex into base (0=base, 1=hex) */
    function mixHex(base, hex, amount) {
        var a = hexToRgb(base);
        var b = hexToRgb(hex);
        if (!a || !b) return base;
        var t = clamp(amount, 0, 1);
        return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
    }

    function currentMode() {
        return document.documentElement.getAttribute('data-mode') || DEFAULT_MODE;
    }

    function buildCustomVars(hex, mode) {
        var accent = normalizeHex(hex) || DEFAULT_CUSTOM;
        var isDark = mode === 'dark';
        if (isDark) {
            return {
                '--accent': lighten(accent, 0.12),
                '--accent-hover': lighten(accent, 0.22),
                '--accent-ink': lighten(accent, 0.55),
                '--accent-soft': mixHex('#1a222c', accent, 0.28)
            };
        }
        return {
            '--accent': accent,
            '--accent-hover': darken(accent, 0.14),
            '--accent-ink': darken(accent, 0.28),
            '--accent-soft': lighten(accent, 0.9),
            '--bg': lighten(accent, 0.93),
            '--bg-accent': lighten(accent, 0.88)
        };
    }

    function clearCustomStyle() {
        var el = document.getElementById(STYLE_ID);
        if (el) el.remove();
    }

    function applyCustomColor(hex, mode) {
        var accent = normalizeHex(hex) || DEFAULT_CUSTOM;
        var vars = buildCustomVars(accent, mode || currentMode());
        var el = document.getElementById(STYLE_ID);
        if (!el) {
            el = document.createElement('style');
            el.id = STYLE_ID;
            document.head.appendChild(el);
        }
        var css = 'html[data-theme="custom"]{';
        Object.keys(vars).forEach(function (k) {
            css += k + ':' + vars[k] + ';';
        });
        css += '}';
        el.textContent = css;
        return accent;
    }

    function applyTheme(theme, customHex) {
        var t = THEMES.indexOf(theme) >= 0 ? theme : DEFAULT_THEME;
        document.documentElement.setAttribute('data-theme', t);
        if (t === 'custom') {
            applyCustomColor(customHex || safeGet(CUSTOM_COLOR_KEY, DEFAULT_CUSTOM), currentMode());
        } else {
            clearCustomStyle();
        }
        return t;
    }

    function applyMode(mode) {
        var m = MODES.indexOf(mode) >= 0 ? mode : DEFAULT_MODE;
        document.documentElement.setAttribute('data-mode', m);
        var theme = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
        if (theme === 'custom') {
            applyCustomColor(safeGet(CUSTOM_COLOR_KEY, DEFAULT_CUSTOM), m);
        }
        return m;
    }

    function applyFont(font) {
        var f = FONTS.indexOf(font) >= 0 ? font : DEFAULT_FONT;
        document.documentElement.setAttribute('data-font', f);
        return f;
    }

    function applyStored() {
        applyMode(safeGet(MODE_KEY, DEFAULT_MODE));
        var theme = safeGet(THEME_KEY, DEFAULT_THEME);
        applyTheme(theme, safeGet(CUSTOM_COLOR_KEY, DEFAULT_CUSTOM));
        applyFont(safeGet(FONT_KEY, DEFAULT_FONT));
    }

    var GA_BRAND_KEY = 'mmlfcp_ui_ga_brand';
    var A242_BRAND_COLOR = '#ff9b00';

    /**
     * GA별 브랜드 테마
     * A242 → 커스텀 #ff9b00
     * 그 외 → 기본 테마(teal)로 복원 (A242 브랜드가 남아 있는 경우)
     */
    function applyGaBrandTheme(gaId) {
        var ga = String(gaId || '').trim().toUpperCase();
        var panel = document.getElementById('uiSettingsPanel');

        if (ga === 'A242') {
            safeSet(GA_BRAND_KEY, 'A242');
            safeSet(CUSTOM_COLOR_KEY, A242_BRAND_COLOR);
            safeSet(THEME_KEY, 'custom');
            applyTheme('custom', A242_BRAND_COLOR);
            if (panel) syncPanel(panel);
            return true;
        }

        var brand = safeGet(GA_BRAND_KEY, '');
        var color = normalizeHex(safeGet(CUSTOM_COLOR_KEY, '')) || '';
        var needsReset = brand === 'A242' || color === A242_BRAND_COLOR;
        if (!needsReset) return false;

        try { localStorage.removeItem(GA_BRAND_KEY); } catch (_) { /* ignore */ }
        safeSet(THEME_KEY, DEFAULT_THEME);
        safeSet(CUSTOM_COLOR_KEY, DEFAULT_CUSTOM);
        applyTheme(DEFAULT_THEME, DEFAULT_CUSTOM);
        if (panel) syncPanel(panel);
        return true;
    }

    applyStored();

    function syncPanel(root) {
        if (!root) return;
        var theme = document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
        var mode = document.documentElement.getAttribute('data-mode') || DEFAULT_MODE;
        var font = document.documentElement.getAttribute('data-font') || DEFAULT_FONT;
        var custom = normalizeHex(safeGet(CUSTOM_COLOR_KEY, DEFAULT_CUSTOM)) || DEFAULT_CUSTOM;

        root.querySelectorAll('[data-ui-theme]').forEach(function (btn) {
            var on = btn.getAttribute('data-ui-theme') === theme;
            btn.classList.toggle('is-selected', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        root.querySelectorAll('[data-ui-mode]').forEach(function (btn) {
            var on = btn.getAttribute('data-ui-mode') === mode;
            btn.classList.toggle('is-selected', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        root.querySelectorAll('[data-ui-font]').forEach(function (btn) {
            var on = btn.getAttribute('data-ui-font') === font;
            btn.classList.toggle('is-selected', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });

        var colorInput = root.querySelector('#uiThemeCustomColor');
        var customWrap = root.querySelector('.ui-theme-custom');
        if (colorInput) colorInput.value = custom;
        if (customWrap) {
            customWrap.classList.toggle('is-selected', theme === 'custom');
            customWrap.style.setProperty('--swatch', custom);
        }
        var hexLabel = root.querySelector('#uiThemeCustomHex');
        if (hexLabel) hexLabel.textContent = custom;
    }

    function selectCustomColor(panel, hex) {
        var accent = normalizeHex(hex) || DEFAULT_CUSTOM;
        safeSet(CUSTOM_COLOR_KEY, accent);
        applyTheme('custom', accent);
        safeSet(THEME_KEY, 'custom');
        syncPanel(panel);
    }

    function initUiSettings() {
        var btn = document.getElementById('btnUiSettings');
        var panel = document.getElementById('uiSettingsPanel');
        if (!btn || !panel) return;

        syncPanel(panel);

        function openPanel() {
            panel.hidden = false;
            panel.classList.add('is-open');
            btn.setAttribute('aria-expanded', 'true');
            syncPanel(panel);
        }

        function closePanel() {
            panel.hidden = true;
            panel.classList.remove('is-open');
            btn.setAttribute('aria-expanded', 'false');
        }

        function togglePanel() {
            if (panel.classList.contains('is-open')) closePanel();
            else openPanel();
        }

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            togglePanel();
        });

        panel.addEventListener('click', function (e) {
            e.stopPropagation();
            var modeBtn = e.target.closest('[data-ui-mode]');
            if (modeBtn) {
                var mode = applyMode(modeBtn.getAttribute('data-ui-mode'));
                safeSet(MODE_KEY, mode);
                syncPanel(panel);
                return;
            }
            var themeBtn = e.target.closest('[data-ui-theme]');
            if (themeBtn) {
                var theme = applyTheme(themeBtn.getAttribute('data-ui-theme'));
                safeSet(THEME_KEY, theme);
                syncPanel(panel);
                return;
            }
            var fontBtn = e.target.closest('[data-ui-font]');
            if (fontBtn) {
                var font = applyFont(fontBtn.getAttribute('data-ui-font'));
                safeSet(FONT_KEY, font);
                syncPanel(panel);
            }
        });

        var colorInput = panel.querySelector('#uiThemeCustomColor');
        if (colorInput) {
            colorInput.addEventListener('input', function () {
                selectCustomColor(panel, colorInput.value);
            });
            colorInput.addEventListener('change', function () {
                selectCustomColor(panel, colorInput.value);
            });
            colorInput.addEventListener('click', function (e) {
                e.stopPropagation();
            });
        }

        document.addEventListener('click', function (e) {
            if (!panel.classList.contains('is-open')) return;
            if (panel.contains(e.target) || btn.contains(e.target)) return;
            closePanel();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && panel.classList.contains('is-open')) {
                closePanel();
                btn.focus();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUiSettings);
    } else {
        initUiSettings();
    }

    window.mmlfcpUiSettings = {
        applyStored: applyStored,
        applyTheme: applyTheme,
        applyMode: applyMode,
        applyFont: applyFont,
        applyCustomColor: applyCustomColor,
        applyGaBrandTheme: applyGaBrandTheme,
    };
})();
