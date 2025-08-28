export const _state =
{
    cust_name: '홍길동',
    plan_id: '921081111041',
    gender: 'M',
    age: 46,
    birth_date: '19800101',
    jwt: '',

    // ✅ 페이지 상태 추가
    current_page: 1,
    guide_coverage_item: new Map(),
};

export const mmlfcp_state = {
    /**
    * 상태 저장
    * @param {string} key - 저장할 키 이름
    * @param {*} value - 저장할 값
    */
    set(key, value) {
        _state[key] = value;

        // ✅ localStorage에 자동 저장
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn("[mmlfcp_state] localStorage 저장 실패:", key, e);
        }
    },

    /**
     * 상태 가져오기
     * @param {string} key - 가져올 키 이름
     * @returns {*} 저장된 값
     */
    get(key) {
        return _state[key];
    },

    /**
     * 특정 키 삭제
     * @param {string} key
     */
    remove(key) {
        delete _state[key];
    },

    /**
    * 전체 상태 초기화
    */
    clear() {
        Object.keys(_state).forEach(key => {
            delete _state[key];
            localStorage.removeItem(key); // ✅ localStorage도 같이 초기화
        });
    },


    /**
     * 현재 상태 콘솔 출력 (디버깅용)
     */
    debug() {
        //console.log('[🧠 MMLFCP_STATE DEBUG]', JSON.stringify(_state, null, 2));
    },

    // ✅ 전용 plans getter/setter
    setPlans(plans) {
        this.set('mmlfcp_plans', plans);
    },

    getPlans() {
        return this.get('mmlfcp_plans') || [];
    },
    getAll() {
        return { ..._state }; // 복사해서 반환
    }
};