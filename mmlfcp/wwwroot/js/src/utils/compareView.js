/**
 * index.html 내 통합 세부 비교 뷰
 */
import { detailController } from '../components/detailcontroller.js?v=26.08.27.13';
import { detailSimplController } from '../components/detailsimplcontroller.js?v=26.08.26.26';
import { applyDetailTabVisibility, bindDetailTabs } from './detailTabs.js';
import { mmlfcp_state } from '../core/state.js';
import { appConstants } from '../constants/constants.js';
import { apiService } from '../services/apiService.js';

const VIEW_ID = 'detailCompareView';

export const compareView = {
    _opened: false,
    _detailReady: false,
    _simplifiReady: false,
    _detailInitPromise: null,
    _simplifiInitPromise: null,
    activeTab: 'premium',

    root() {
        return document.getElementById(VIEW_ID);
    },

    isOpen() {
        return !!this._opened;
    },

    async open(tabName = 'premium') {
        const root = this.root();
        if (!root) {
            console.error('[compareView] #detailCompareView 없음');
            return;
        }

        const tab = tabName || 'premium';
        this.activeTab = tab;
        window.__detailCompareTab = tab;

        root.hidden = false;
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('detail-compare-open');
        this._opened = true;

        applyDetailTabVisibility({
            planTypeId: localStorage.getItem('plan_type_id') || mmlfcp_state.get('plan_type_id'),
            planPaymentExpirationName:
                localStorage.getItem('plan_payment_expiration_name') ||
                mmlfcp_state.get('plan_payment_expiration_name'),
            forceSimplifi: tab === 'simplifi',
        });
        bindDetailTabs(tab);
        this._syncTabUi(tab);

        try {
            if (tab === 'simplifi') {
                await this._ensureSimplifi();
            } else {
                await this._ensureDetail();
                await detailController.switchTabContent(tab);
            }
        } catch (err) {
            console.error('[compareView.open]', err);
            alert(err?.message || '세부 비교 화면을 불러오지 못했습니다.');
        }
    },

    close() {
        const root = this.root();
        if (!root) return;
        root.hidden = true;
        root.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('detail-compare-open');
        this._opened = false;
        window.__detailCompareTab = '';
        detailController.setLoading(false);
        detailSimplController.setLoading(false);

        const simplifiModal = document.getElementById('simplifiDetailModal');
        if (simplifiModal) simplifiModal.style.display = 'none';
    },

    /** 탭 클릭 (같은 패널 내 전환) */
    async switchTab(tabName) {
        if (!this._opened) {
            await this.open(tabName);
            return;
        }
        const tab = tabName || 'premium';
        if (tab === this.activeTab) return;

        this.activeTab = tab;
        window.__detailCompareTab = tab;
        this._syncTabUi(tab);

        applyDetailTabVisibility({
            planTypeId: localStorage.getItem('plan_type_id') || mmlfcp_state.get('plan_type_id'),
            planPaymentExpirationName:
                localStorage.getItem('plan_payment_expiration_name') ||
                mmlfcp_state.get('plan_payment_expiration_name'),
            forceSimplifi: tab === 'simplifi',
        });
        bindDetailTabs(tab);

        try {
            if (tab === 'simplifi') {
                await this._ensureSimplifi();
                return;
            }
            await this._ensureDetail();
            await detailController.switchTabContent(tab);
        } catch (err) {
            console.error('[compareView.switchTab]', err);
            alert(err?.message || '탭을 전환하지 못했습니다.');
        }
    },

    _syncTabUi(tabId) {
        const root = this.root();
        if (!root) return;

        root.querySelectorAll('.tab-list > li[data-detail-tab]').forEach((li) => {
            const id = li.getAttribute('data-detail-tab') || li.id;
            li.classList.toggle('active', id === tabId);
        });

        const map = {
            premium: 'content01',
            payment: 'content03',
            aging: 'content04',
            simplifi: 'content02',
        };
        root.querySelectorAll('.tab-content').forEach((sec) => {
            const key = Object.keys(map).find((k) => sec.classList.contains(map[k]));
            sec.classList.toggle('show', key === tabId);
        });
    },

    async _ensurePlans(storageKey) {
        if (mmlfcp_state.get(storageKey)?.length) return;
        if (!appConstants.jwt) return;
        const prevPath = appConstants.access_path;
        try {
            appConstants.access_path =
                storageKey === 'mmlfcp_simplifi_plans'
                    ? 'MMLFCP_WEB_SIMPLIFICATION_DETAIL'
                    : 'MMLFCP_WEB_DETAIL';
            const authResult = await apiService.auth();
            if (authResult?.is_success && Array.isArray(authResult.plans)) {
                mmlfcp_state.set(storageKey, authResult.plans);
            }
        } finally {
            appConstants.access_path = prevPath || 'MMLFCP_WEB';
        }
    },

    async _ensureDetail() {
        if (this._detailReady) return;
        if (this._detailInitPromise) return this._detailInitPromise;

        this._detailInitPromise = (async () => {
            await this._ensurePlans('mmlfcp_plans_detail');
            await detailController.init();
            this._detailReady = true;
        })();

        try {
            await this._detailInitPromise;
        } finally {
            this._detailInitPromise = null;
        }
    },

    async _ensureSimplifi() {
        if (this._simplifiReady) return;
        if (this._simplifiInitPromise) return this._simplifiInitPromise;

        this._simplifiInitPromise = (async () => {
            await this._ensurePlans('mmlfcp_simplifi_plans');
            await detailSimplController.init();
            this._simplifiReady = true;
        })();

        try {
            await this._simplifiInitPromise;
        } finally {
            this._simplifiInitPromise = null;
        }
    },

    /** 메인 조회·조건 변경 후 캐시 무효화 (다음 열 때 최신 데이터) */
    invalidate() {
        this._detailReady = false;
        this._simplifiReady = false;
        // 이벤트 리스너는 1회 바인딩 유지 (_eventsBound 리셋 금지)
    },
};

if (typeof window !== 'undefined') {
    window.closeModal = () => compareView.close();
    window.compareView = compareView;
}
