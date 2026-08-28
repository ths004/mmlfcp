/**
 * 세부 비교 화면 탭 네비게이션 (index.html #detailCompareView)
 */
import { app } from './app.js';

export function getDetailToken() {
    return app.getStoredAuthToken() || '';
}

export function goDetailTab(tabId) {
    try {
        const t = getDetailToken();
        if (t) app.setStoredAuthToken(t);
    } catch (_) { /* ignore */ }

    if (window.compareView?.switchTab) {
        window.compareView.switchTab(tabId);
        return;
    }
    console.warn('[goDetailTab] compareView 없음:', tabId);
}

/** 탭 클릭 바인딩 — activeTab: premium | payment | aging | simplifi */
export function bindDetailTabs(activeTab) {
    const root = document.getElementById('detailCompareView') || document;
    const tabs = root.querySelectorAll('.tab-list > li[data-detail-tab]');

    tabs.forEach((li) => {
        const id = li.getAttribute('data-detail-tab') || li.id;
        li.classList.toggle('active', id === activeTab);

        if (li.dataset.detailTabBound === '1') return;
        li.dataset.detailTabBound = '1';

        li.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            const current = window.compareView?.activeTab || activeTab;
            if (id === current) return;
            goDetailTab(id);
        });
    });
}

/**
 * 상품유형·만기 조건에 따라 탭 표시 (메인 툴바와 동일 규칙)
 */
export function applyDetailTabVisibility({ planTypeId, planPaymentExpirationName, forceSimplifi = false } = {}) {
    const plan_type = String(planTypeId || '');
    const expName = String(planPaymentExpirationName || '');

    const menu = {
        premium: false,
        payment: false,
        aging: false,
        simplifi: false,
    };

    const BASE_PAYMENT = ['05', '06', '07', '14', '15', '16', '17', '18', '19', '20', '21', '22', '25'];
    const BASE_SIMPLIFI = ['06', '07', '14', '15', '16', '17', '21', '22', '09', '11', '12', '13'];
    const FEMALE_HEALTH = '08';
    const isRenewal =
        expName.includes('종신') ||
        expName.includes('20년/100세,종신');

    if (plan_type === FEMALE_HEALTH) {
        menu.payment = true;
        menu.aging = true;
    } else if (isRenewal) {
        menu.premium = true;
        menu.aging = true;
    } else if (BASE_PAYMENT.includes(plan_type)) {
        menu.premium = true;
        menu.payment = true;
        menu.aging = true;
    } else {
        menu.premium = true;
        menu.aging = true;
    }

    if (BASE_SIMPLIFI.includes(plan_type) || forceSimplifi) {
        menu.simplifi = true;
    }

    const root = document.getElementById('detailCompareView') || document;
    Object.keys(menu).forEach((id) => {
        const el =
            root.querySelector(`[data-detail-tab="${id}"]`) ||
            document.getElementById(id);
        if (!el) return;
        const show = !!menu[id];
        el.classList.toggle('is-tab-hidden', !show);
        el.hidden = !show;
        el.setAttribute('aria-hidden', show ? 'false' : 'true');
    });

    return menu;
}
