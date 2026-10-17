/* ==========================================================================
   엄청난 농부로 부자 되기 — script.js (3차 대규모 업데이트: 타이쿤 확장)

   모듈 목차
   0.  상수 / 데이터 정의
   1.  유틸리티
   2.  상태(state) 생성 · 저장 · 불러오기 · 마이그레이션
   3.  환경(날씨·계절·시장) 시뮬레이션
   4.  밭/온실 plot 시뮬레이션 로직 (공통)
   5.  메인 게임 루프 + 자동화 실행
   6.  레벨 / 경험치 / 명성(Fame)
   7.  상점 · 농기구 · 밭 확장 액션
   8.  밭·온실 작물 관리 액션 (파종/물/잡초/방제/비료/수확/판매)
   9.  자동화 장치 & 일꾼 고용 액션
   10. 가공 시설 액션
   11. 축산업(목장) 액션
   12. 온실 건설 액션
   13. 렌더링 — 대시보드
   14. 렌더링 — 밭 / 온실 그리드 (공통)
   15. 렌더링 — 상점 / 인벤토리 / 시세
   16. 렌더링 — 경영(자동화 + 일꾼)
   17. 렌더링 — 가공
   18. 렌더링 — 목장
   19. 렌더링 — 통계
   20. 팝업 — 밭/온실 칸 + 목장 펜
   21. 토스트 알림
   22. 탭 전환 / 초기화
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   0. 상수 / 데이터 정의
   -------------------------------------------------------------------------- */

const SAVE_KEY = 'heulnaeum_farm_save_v2'; // 저장 형식은 계속 진화하지만 기존 플레이어의 세이브를 보존하기 위해 키는 유지하고 migrateState()가 하위호환을 책임진다.

const GRID_COLS = 5;
const START_PLOTS = 6;     // 시작 시 개간된 밭 칸 수
const MAX_PLOTS = 20;      // 밭 최대 확장 칸 수 (5열 x 4행)
const BASE_EXPAND_COST = 80;
const EXPAND_COST_STEP = 70;

const TICK_MS = 1000;          // 실제 1초마다 한 틱
const MINUTES_PER_TICK = 30;   // 한 틱 = 게임 내 30분
const DAY_MINUTES = 1440;      // 하루 = 1440분 (48틱 ≈ 48초)
const SEASON_DAYS = 6;         // 한 계절 = 6일

const STAGE_NAMES = ['씨앗', '새싹', '성장', '성숙', '수확 가능'];

const CROPS = {
  tomato: {
    id: 'tomato', name: '토마토', emoji: '🍅',
    seedPrice: 15, basePrice: 40, unlockLevel: 1, greenhouseOnly: false,
    stageDuration: 1440,
    tempOptimal: [20, 28], tempAccept: [14, 33],
    moistureOptimal: [45, 70],
    hint: '따뜻한 날씨를 좋아해요',
  },
  lettuce: {
    id: 'lettuce', name: '상추', emoji: '🥬',
    seedPrice: 8, basePrice: 22, unlockLevel: 1, greenhouseOnly: false,
    stageDuration: 720,
    tempOptimal: [9, 18], tempAccept: [2, 23],
    moistureOptimal: [58, 82],
    hint: '빨리 자라는 서늘한 잎채소예요',
  },
  potato: {
    id: 'potato', name: '감자', emoji: '🥔',
    seedPrice: 12, basePrice: 32, unlockLevel: 2, greenhouseOnly: false,
    stageDuration: 1800,
    tempOptimal: [12, 20], tempAccept: [5, 26],
    moistureOptimal: [50, 75],
    hint: '서늘한 날씨를 좋아해요',
  },
  corn: {
    id: 'corn', name: '옥수수', emoji: '🌽',
    seedPrice: 20, basePrice: 55, unlockLevel: 3, greenhouseOnly: false,
    stageDuration: 2160,
    tempOptimal: [22, 31], tempAccept: [16, 36],
    moistureOptimal: [40, 65],
    hint: '한여름에 잘 자라요',
  },
  strawberry: {
    id: 'strawberry', name: '딸기', emoji: '🍓',
    seedPrice: 25, basePrice: 70, unlockLevel: 4, greenhouseOnly: false,
    stageDuration: 1080,
    tempOptimal: [14, 22], tempAccept: [8, 27],
    moistureOptimal: [55, 78],
    hint: '봄가을 서늘한 날씨가 적합해요',
  },
  watermelon: {
    id: 'watermelon', name: '수박', emoji: '🍉',
    seedPrice: 40, basePrice: 120, unlockLevel: 5, greenhouseOnly: false,
    stageDuration: 2520,
    tempOptimal: [24, 32], tempAccept: [18, 37],
    moistureOptimal: [50, 72],
    hint: '무더운 여름, 긴 재배기간이 필요한 고급 작물이에요',
  },
  // 온실 전용 희귀 작물 — 날씨·계절 영향을 받지 않는 온실에서만 심을 수 있다.
  melon: {
    id: 'melon', name: '멜론', emoji: '🍈',
    seedPrice: 60, basePrice: 180, unlockLevel: 6, greenhouseOnly: true,
    stageDuration: 1800,
    tempOptimal: [22, 30], tempAccept: [15, 35],
    moistureOptimal: [50, 70],
    hint: '온실 전용 고급 작물',
  },
  coffee: {
    id: 'coffee', name: '커피체리', emoji: '☕',
    seedPrice: 80, basePrice: 240, unlockLevel: 7, greenhouseOnly: true,
    stageDuration: 2400,
    tempOptimal: [18, 26], tempAccept: [10, 32],
    moistureOptimal: [55, 75],
    hint: '온실 전용 희귀 작물',
  },
  vanilla: {
    id: 'vanilla', name: '바닐라', emoji: '🌼',
    seedPrice: 110, basePrice: 300, unlockLevel: 8, greenhouseOnly: true,
    stageDuration: 2880,
    tempOptimal: [24, 30], tempAccept: [18, 34],
    moistureOptimal: [60, 80],
    hint: '온실 전용 최고급 작물',
  },
};

const SUPPLIES = {
  fertilizer: {
    id: 'fertilizer', name: '퇴비 (비료)', icon: '🌱', price: 30,
    desc: '비옥도 +25 · 품질 상승 · 일시적 성장 촉진',
  },
  pesticide: {
    id: 'pesticide', name: '친환경 방제약', icon: '🧴', price: 25,
    desc: '병해충 제거 · 건강도 +15 회복',
  },
  feed: {
    id: 'feed', name: '가축 사료', icon: '🌽', price: 10,
    desc: '가축에게 먹여 생산 활동을 유지시킵니다 (+50 사료량)',
  },
};

// 농기구 업그레이드: 레벨 1은 기본 지급, 2·3은 돈으로 구매
const TOOLS = {
  wateringCan: {
    id: 'wateringCan', name: '물뿌리개', icon: '🚿',
    levels: [
      { level: 1, cost: 0,   moistureAdd: 40,  bulkWater: false, bulkCooldownDays: 0, desc: '칸당 수분 +40' },
      { level: 2, cost: 150, moistureAdd: 70,  bulkWater: true,  bulkCooldownDays: 1, desc: '칸당 수분 +70 · 전체 물주기(하루 1회)' },
      { level: 3, cost: 400, moistureAdd: 100, bulkWater: true,  bulkCooldownDays: 0, desc: '칸당 수분 100% 충전 · 전체 물주기 무제한' },
    ],
  },
  hoe: {
    id: 'hoe', name: '괭이', icon: '⛏️',
    levels: [
      { level: 1, cost: 0,   adjacentClearRatio: 0,    weedGrowthMult: 1.0, desc: '클릭한 칸의 잡초만 제거' },
      { level: 2, cost: 150, adjacentClearRatio: 0.5,  weedGrowthMult: 1.0, desc: '인접한 칸 잡초도 50% 감소' },
      { level: 3, cost: 400, adjacentClearRatio: 1.0,  weedGrowthMult: 0.8, desc: '인접 칸 잡초 완전 제거 · 잡초 재발 속도 20%↓' },
    ],
  },
};

const WEATHER_TYPES = {
  sunny:     { name: '맑음', icon: '☀️', tempMod: 2,  sunlightMult: 1.2 },
  cloudy:    { name: '흐림', icon: '☁️', tempMod: 0,  sunlightMult: 1.0 },
  rainy:     { name: '비',   icon: '🌧️', tempMod: -2, sunlightMult: 0.85 },
  heatwave:  { name: '폭염', icon: '🥵', tempMod: 8,  sunlightMult: 0.95 },
  coldsnap:  { name: '한파', icon: '🥶', tempMod: -9, sunlightMult: 0.8 },
};

const SEASONS = [
  { id: 'spring', name: '봄',   tempRange: [13, 22], weatherWeights: { sunny: 40, cloudy: 30, rainy: 30 } },
  { id: 'summer', name: '여름', tempRange: [24, 33], weatherWeights: { sunny: 35, cloudy: 20, rainy: 25, heatwave: 20 } },
  { id: 'fall',   name: '가을', tempRange: [11, 20], weatherWeights: { sunny: 35, cloudy: 35, rainy: 30 } },
  { id: 'winter', name: '겨울', tempRange: [-3, 7],  weatherWeights: { sunny: 25, cloudy: 35, rainy: 10, coldsnap: 30 } },
];

const GRADE_MULTIPLIER = { '특': 1.6, '상': 1.25, '중': 1.0, '하': 0.6 };

// 시장 시세: 하루에 한 번 소폭 랜덤 변동 (0.75배 ~ 1.35배) — 작물 + 가공품 + 축산물 공통 적용
const MARKET_MIN = 0.75;
const MARKET_MAX = 1.35;
const MARKET_DAILY_DRIFT = 0.08;

// 레벨/경험치
const EXP_BASE = 90;
const EXP_STEP = 70;
const EXP_REWARD = {
  weed: 3,
  pest: 6,
  fertilize: 4,
  process: 10,
  livestock: 3,
};

// 가공품 + 축산물 카탈로그 (원물보다 훨씬 비싸게 팔리는 고부가가치 상품)
const GOODS = {
  tomato_sauce:     { id: 'tomato_sauce',     name: '토마토 소스',     icon: '🥫', basePrice: 260, category: 'processed' },
  lettuce_salad:    { id: 'lettuce_salad',    name: '샐러드 패키지',   icon: '🥗', basePrice: 85,  category: 'processed' },
  potato_chips:     { id: 'potato_chips',     name: '감자칩',         icon: '🍟', basePrice: 140, category: 'processed' },
  corn_flour:       { id: 'corn_flour',       name: '옥수수 가루',     icon: '🌾', basePrice: 150, category: 'processed' },
  strawberry_jam:   { id: 'strawberry_jam',   name: '딸기잼',         icon: '🍯', basePrice: 340, category: 'processed' },
  watermelon_juice: { id: 'watermelon_juice', name: '수박 주스',       icon: '🧃', basePrice: 300, category: 'processed' },
  egg:   { id: 'egg',   name: '달걀',   icon: '🥚', basePrice: 18, category: 'livestock' },
  milk:  { id: 'milk',  name: '우유',   icon: '🥛', basePrice: 32, category: 'livestock' },
  bacon: { id: 'bacon', name: '베이컨', icon: '🥓', basePrice: 70, category: 'livestock' },
};

// 가공 레시피: 원물 N개 → 가공품 M개 (가공소 레벨에 따라 해금)
const RECIPES = {
  tomato_sauce:     { id: 'tomato_sauce',     name: '토마토 소스 만들기', inputCropId: 'tomato',     inputQty: 3, outputId: 'tomato_sauce',     outputQty: 1, ticks: 50, requiredFactoryLevel: 1 },
  lettuce_salad:    { id: 'lettuce_salad',    name: '샐러드 포장하기',   inputCropId: 'lettuce',    inputQty: 3, outputId: 'lettuce_salad',    outputQty: 2, ticks: 30, requiredFactoryLevel: 1 },
  potato_chips:     { id: 'potato_chips',     name: '감자칩 튀기기',     inputCropId: 'potato',     inputQty: 4, outputId: 'potato_chips',     outputQty: 2, ticks: 45, requiredFactoryLevel: 2 },
  corn_flour:       { id: 'corn_flour',       name: '옥수수 가루 빻기', inputCropId: 'corn',       inputQty: 4, outputId: 'corn_flour',       outputQty: 3, ticks: 55, requiredFactoryLevel: 2 },
  strawberry_jam:   { id: 'strawberry_jam',   name: '딸기잼 졸이기',     inputCropId: 'strawberry', inputQty: 4, outputId: 'strawberry_jam',   outputQty: 2, ticks: 60, requiredFactoryLevel: 3 },
  watermelon_juice: { id: 'watermelon_juice', name: '수박 주스 짜기',   inputCropId: 'watermelon', inputQty: 3, outputId: 'watermelon_juice', outputQty: 3, ticks: 65, requiredFactoryLevel: 3 },
};

// 가공소 레벨 (0 = 미건설). 레벨업 시 동시 가공 슬롯 수 증가 + 가공 속도 향상
const FACTORY_LEVELS = [
  { level: 1, cost: 500,  slots: 1, speedMult: 1.0, desc: '가공소 건설 · 가공 슬롯 1개' },
  { level: 2, cost: 900,  slots: 2, speedMult: 1.2, desc: '가공 슬롯 2개 · 가공 속도 +20%' },
  { level: 3, cost: 1800, slots: 3, speedMult: 1.5, desc: '가공 슬롯 3개 · 가공 속도 +50%' },
];

// 자동화 장치: 레벨 0 = 미설치. 레벨이 오를수록 한 틱에 처리하는 칸 수가 늘어난다.
const AUTOMATION = {
  water: {
    id: 'water', name: '자동 급수기', icon: '💦',
    levels: [
      { level: 1, cost: 300,  coveragePerTick: 2,  thresholdBelow: 40, desc: '수분 40% 미만인 밭 중 2칸을 틱마다 자동 급수' },
      { level: 2, cost: 700,  coveragePerTick: 5,  thresholdBelow: 50, desc: '수분 50% 미만인 밭 중 5칸을 틱마다 자동 급수' },
      { level: 3, cost: 1500, coveragePerTick: 99, thresholdBelow: 60, desc: '수분 60% 미만인 밭을 모두 자동 급수' },
    ],
  },
  harvest: {
    id: 'harvest', name: '자동 수확기', icon: '🤖',
    levels: [
      { level: 1, cost: 400,  coveragePerTick: 1,  desc: '틱마다 수확 가능한 밭 1칸 자동 수확' },
      { level: 2, cost: 900,  coveragePerTick: 3,  desc: '틱마다 수확 가능한 밭 3칸 자동 수확' },
      { level: 3, cost: 1800, coveragePerTick: 99, desc: '수확 가능한 밭을 모두 즉시 자동 수확' },
    ],
  },
  seed: {
    id: 'seed', name: '자동 파종기', icon: '🌾',
    levels: [
      { level: 1, cost: 350,  coveragePerTick: 1,  desc: '틱마다 빈 밭 1칸에 지정 씨앗 자동 파종' },
      { level: 2, cost: 800,  coveragePerTick: 3,  desc: '틱마다 빈 밭 3칸 자동 파종' },
      { level: 3, cost: 1600, coveragePerTick: 99, desc: '빈 밭 전체 자동 파종' },
    ],
  },
};

// 일꾼(NPC): 고용 시 자동화 장치를 보조하거나, 새로운 사업 영역(목장/가공/온실)을 스스로 관리한다.
const WORKER_ROLES = {
  field: {
    id: 'field', name: '밭 일꾼', icon: '🧑‍🌾', wageBase: 35,
    desc: '설치된 자동화 장치의 처리 칸 수를 +1칸씩 보조합니다.',
  },
  factory: {
    id: 'factory', name: '가공 기술자', icon: '👩‍🏭', wageBase: 50,
    desc: '가공소 슬롯이 비면 보유 원물로 자동으로 가공을 시작합니다.',
  },
  livestock: {
    id: 'livestock', name: '목장 관리인', icon: '🧑‍🌾', wageBase: 40,
    desc: '사료가 부족한 가축에게 자동으로 사료를 줍니다.',
  },
  greenhouse: {
    id: 'greenhouse', name: '온실 재배사', icon: '🧑‍🔬', wageBase: 45,
    desc: '온실의 모든 칸에 자동으로 물을 주고 수확합니다.',
  },
};
const MAX_WORKERS = 5;
const WORKER_HIRE_BASE_COST = 250;
const WORKER_HIRE_STEP = 180;

// 가축
const ANIMALS = {
  chicken: { id: 'chicken', name: '닭', icon: '🐔', buyCost: 150, cycleTicks: 60,  productId: 'egg',   productQty: 1 },
  cow:     { id: 'cow',     name: '소', icon: '🐄', buyCost: 400, cycleTicks: 120, productId: 'milk',  productQty: 2 },
  pig:     { id: 'pig',     name: '돼지', icon: '🐖', buyCost: 300, cycleTicks: 150, productId: 'bacon', productQty: 1 },
};
const RANCH_BUILD_COST = 500;
const RANCH_START_PENS = 3;
const RANCH_MAX_PENS = 8;
const RANCH_EXPAND_BASE = 150;
const RANCH_EXPAND_STEP = 120;
const FEED_DEPLETE_PER_TICK = 0.6;

// 온실
const GREENHOUSE_BUILD_COST = 1800;
const GREENHOUSE_START_PLOTS = 3;
const GREENHOUSE_MAX_PLOTS = 8;
const GREENHOUSE_EXPAND_BASE = 250;
const GREENHOUSE_EXPAND_STEP = 180;

// 명성(Fame): 누적 판매 수익 기준 등급. 등급이 오를수록 판매가 보너스를 받는다.
const FAME_TIERS = [
  { min: 0,       title: '초보 농부' },
  { min: 3000,    title: '마을 농부' },
  { min: 10000,   title: '숙련 농부' },
  { min: 30000,   title: '농장 경영주' },
  { min: 80000,   title: '지역 유지' },
  { min: 200000,  title: '농업 재벌' },
  { min: 500000,  title: '전설의 농부' },
];
const FAME_SELL_BONUS_PER_TIER = 0.015;

/* --------------------------------------------------------------------------
   1. 유틸리티
   -------------------------------------------------------------------------- */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const randInt = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const randRange = (lo, hi) => Math.random() * (hi - lo) + lo;

function weightedPick(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    if (r < w) return key;
    r -= w;
  }
  return entries[0][0];
}

function formatMoney(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }

function formatTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function gradeFromScore(score) {
  if (score >= 85) return '특';
  if (score >= 65) return '상';
  if (score >= 40) return '중';
  return '하';
}

function expForLevel(level) { return Math.round(EXP_BASE + (level - 1) * EXP_STEP); }

function computeExpandCost(unlockedCount) {
  return BASE_EXPAND_COST + (unlockedCount - START_PLOTS) * EXPAND_COST_STEP;
}
function computeGreenhouseExpandCost(unlockedPlots) {
  return GREENHOUSE_EXPAND_BASE + (unlockedPlots - GREENHOUSE_START_PLOTS) * GREENHOUSE_EXPAND_STEP;
}
function computeRanchExpandCost(unlockedPens) {
  return RANCH_EXPAND_BASE + (unlockedPens - RANCH_START_PENS) * RANCH_EXPAND_STEP;
}

// 돈 변화는 항상 이 세 헬퍼를 통해서만 — 통계(누적 수익/지출)를 한 곳에서 일관되게 추적하기 위함
function addMoney(amount) { state.money += amount; } // 레벨업 보너스 등 '수익'으로 집계하지 않는 돈
function earnMoney(amount) { state.money += amount; state.stats.totalRevenue += amount; } // 판매 수익
function spendMoney(amount) { state.money -= amount; state.stats.totalSpent += amount; } // 구매/임금 지출

function getLocationArray(loc) { return loc === 'greenhouse' ? state.greenhouse.plots : state.field; }
function getLocationLabel(loc) { return loc === 'greenhouse' ? '온실' : '밭'; }

function getTotalHarvestCount(cropId) {
  return Object.entries(state.inventory.harvest)
    .filter(([key]) => key.startsWith(cropId + '_'))
    .reduce((sum, [, qty]) => sum + qty, 0);
}

// 가공 재료 소모 시 '하' 등급부터 우선 소모 — 고급 원물은 생으로 비싸게 팔 수 있도록 남겨둔다.
function consumeHarvest(cropId, qty) {
  const order = ['하', '중', '상', '특'];
  let remaining = qty;
  for (const grade of order) {
    const key = `${cropId}_${grade}`;
    if (!state.inventory.harvest[key]) continue;
    const take = Math.min(remaining, state.inventory.harvest[key]);
    state.inventory.harvest[key] -= take;
    if (state.inventory.harvest[key] <= 0) delete state.inventory.harvest[key];
    remaining -= take;
    if (remaining <= 0) break;
  }
  return remaining <= 0;
}

function getFameInfo() {
  const revenue = state.stats.totalRevenue;
  let tierIndex = 0;
  for (let i = 0; i < FAME_TIERS.length; i++) { if (revenue >= FAME_TIERS[i].min) tierIndex = i; }
  const tier = FAME_TIERS[tierIndex];
  const next = FAME_TIERS[tierIndex + 1] || null;
  const progressPct = next ? clamp(((revenue - tier.min) / (next.min - tier.min)) * 100, 0, 100) : 100;
  return { tierIndex, title: tier.title, revenue, next, progressPct, sellBonus: tierIndex * FAME_SELL_BONUS_PER_TIER };
}

function marketUnitPrice(crop, grade) {
  const marketMult = state.market[crop.id] || 1;
  const fameBonus = getFameInfo().sellBonus;
  return Math.round(crop.basePrice * GRADE_MULTIPLIER[grade] * marketMult * (1 + fameBonus));
}
function goodsUnitPrice(goodsId) {
  const goods = GOODS[goodsId];
  const marketMult = state.market[goodsId] || 1;
  const fameBonus = getFameInfo().sellBonus;
  return Math.round(goods.basePrice * marketMult * (1 + fameBonus));
}

/* --------------------------------------------------------------------------
   2. 상태(state) 생성 / 저장 / 불러오기 / 마이그레이션
   -------------------------------------------------------------------------- */

function createEmptyPlot(id) {
  return {
    id,
    cropId: null,
    stage: 0,
    progress: 0,
    moisture: randInt(45, 60),
    fertility: randInt(40, 60),
    health: 100,
    weedLevel: 0,
    hasPest: false,
    fertilizedUsed: false,
    fertBoostTicks: 0,
    healthSum: 0, healthTicks: 0,
    weedSum: 0, weedTicks: 0,
    pestTicks: 0,
  };
}

function createEmptyPen(id) {
  return { id, animalId: null, feedLevel: 0, health: 100, progress: 0 };
}

function createDefaultState() {
  const field = Array.from({ length: MAX_PLOTS }, (_, i) => (i < START_PLOTS ? createEmptyPlot(i) : null));
  const market = {};
  const marketTrend = {};
  [...Object.keys(CROPS), ...Object.keys(GOODS)].forEach((id) => { market[id] = 1.0; marketTrend[id] = 'flat'; });

  return {
    money: 1200,
    level: 1,
    exp: 0,
    time: {
      day: 1,
      seasonIndex: 0,
      seasonDay: 1,
      minutes: 360, // 06:00 시작
      weatherId: 'sunny',
      temperature: 18,
    },
    inventory: {
      seeds: { tomato: 2, lettuce: 2 },
      supplies: { fertilizer: 1, pesticide: 1 },
      harvest: {},
      goods: {},
    },
    tools: { wateringCanLevel: 1, hoeLevel: 1 },
    unlockedCount: START_PLOTS,
    field,
    market,
    marketTrend,
    lastBulkWaterDay: 0,

    automation: { waterLevel: 0, harvestLevel: 0, seedLevel: 0, autoSeedCropId: null },
    workers: [],
    nextWorkerId: 1,

    factory: { level: 0, queue: [] },
    nextFactoryQueueId: 1,

    ranch: { built: false, unlockedPens: 0, pens: Array.from({ length: RANCH_MAX_PENS }, () => null) },
    greenhouse: { built: false, unlockedPlots: 0, plots: Array.from({ length: GREENHOUSE_MAX_PLOTS }, () => null) },

    stats: {
      totalCropsHarvested: 0,
      totalRevenue: 0,
      totalSpent: 0,
      totalProcessed: 0,
      totalLivestockProduced: 0,
      peakMoney: 1200,
    },
  };
}

let state = createDefaultState();
let ticksSinceSave = 0;
let popupState = null; // { kind:'plot', loc:'field'|'greenhouse', index } | { kind:'pen', index } | null
let activeTab = 'shop';

function isValidState(s) {
  return s && s.time && s.inventory && Array.isArray(s.field);
}

// 이전 버전 저장 데이터에 없는 필드를 기본값으로 보강한다. (세이브 키를 바꾸지 않으므로 반드시 하위호환되어야 함)
function migrateState(s) {
  if (s.level === undefined) s.level = 1;
  if (s.exp === undefined) s.exp = 0;
  if (!s.tools) s.tools = { wateringCanLevel: 1, hoeLevel: 1 };
  if (s.tools.wateringCanLevel === undefined) s.tools.wateringCanLevel = 1;
  if (s.tools.hoeLevel === undefined) s.tools.hoeLevel = 1;

  if (!s.market) s.market = {};
  if (!s.marketTrend) s.marketTrend = {};
  [...Object.keys(CROPS), ...Object.keys(GOODS)].forEach((id) => {
    if (s.market[id] === undefined) s.market[id] = 1.0;
    if (s.marketTrend[id] === undefined) s.marketTrend[id] = 'flat';
  });
  if (s.lastBulkWaterDay === undefined) s.lastBulkWaterDay = 0;

  // 1차 저장(고정 12칸) 호환: field 길이를 MAX_PLOTS로 확장
  if (!Array.isArray(s.field) || s.field.length !== MAX_PLOTS) {
    const oldField = Array.isArray(s.field) ? s.field : [];
    const newField = Array.from({ length: MAX_PLOTS }, (_, i) => {
      if (i < oldField.length && oldField[i]) return oldField[i];
      if (i < Math.max(START_PLOTS, oldField.length)) return createEmptyPlot(i);
      return null;
    });
    s.field = newField;
    s.unlockedCount = Math.max(START_PLOTS, oldField.length);
  }
  if (s.unlockedCount === undefined) {
    s.unlockedCount = s.field.filter((p) => p !== null).length || START_PLOTS;
  }

  if (!s.inventory.goods) s.inventory.goods = {};

  if (!s.automation) s.automation = { waterLevel: 0, harvestLevel: 0, seedLevel: 0, autoSeedCropId: null };
  if (s.automation.waterLevel === undefined) s.automation.waterLevel = 0;
  if (s.automation.harvestLevel === undefined) s.automation.harvestLevel = 0;
  if (s.automation.seedLevel === undefined) s.automation.seedLevel = 0;
  if (s.automation.autoSeedCropId === undefined) s.automation.autoSeedCropId = null;

  if (!Array.isArray(s.workers)) s.workers = [];
  if (s.nextWorkerId === undefined) s.nextWorkerId = s.workers.reduce((m, w) => Math.max(m, w.id || 0), 0) + 1;

  if (!s.factory) s.factory = { level: 0, queue: [] };
  if (s.factory.level === undefined) s.factory.level = 0;
  if (!Array.isArray(s.factory.queue)) s.factory.queue = [];
  if (s.nextFactoryQueueId === undefined) s.nextFactoryQueueId = s.factory.queue.reduce((m, q) => Math.max(m, q.id || 0), 0) + 1;

  if (!s.ranch) s.ranch = { built: false, unlockedPens: 0, pens: [] };
  if (!Array.isArray(s.ranch.pens)) s.ranch.pens = [];
  if (s.ranch.pens.length !== RANCH_MAX_PENS) {
    const old = s.ranch.pens;
    s.ranch.pens = Array.from({ length: RANCH_MAX_PENS }, (_, i) => (old[i] !== undefined ? old[i] : null));
  }

  if (!s.greenhouse) s.greenhouse = { built: false, unlockedPlots: 0, plots: [] };
  if (!Array.isArray(s.greenhouse.plots)) s.greenhouse.plots = [];
  if (s.greenhouse.plots.length !== GREENHOUSE_MAX_PLOTS) {
    const old = s.greenhouse.plots;
    s.greenhouse.plots = Array.from({ length: GREENHOUSE_MAX_PLOTS }, (_, i) => (old[i] !== undefined ? old[i] : null));
  }

  if (!s.stats) s.stats = { totalCropsHarvested: 0, totalRevenue: 0, totalSpent: 0, totalProcessed: 0, totalLivestockProduced: 0, peakMoney: s.money || 0 };
  ['totalCropsHarvested', 'totalRevenue', 'totalSpent', 'totalProcessed', 'totalLivestockProduced'].forEach((k) => {
    if (s.stats[k] === undefined) s.stats[k] = 0;
  });
  if (s.stats.peakMoney === undefined) s.stats.peakMoney = s.money || 0;

  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) return createDefaultState();
    return migrateState(parsed);
  } catch (e) {
    console.warn('저장 데이터를 불러오지 못했습니다. 새 게임을 시작합니다.', e);
    return createDefaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    const el = document.getElementById('save-indicator');
    if (el) {
      const now = new Date();
      el.textContent = `자동 저장됨 · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    }
  } catch (e) {
    console.warn('저장 실패', e);
  }
}

/* --------------------------------------------------------------------------
   3. 환경(날씨 · 계절 · 시장) 시뮬레이션
   -------------------------------------------------------------------------- */

function getCurrentSeason() { return SEASONS[state.time.seasonIndex]; }

function rollWeather() {
  const season = getCurrentSeason();
  const id = weightedPick(season.weatherWeights);
  state.time.weatherId = id;
  const base = randRange(season.tempRange[0], season.tempRange[1]);
  state.time.temperature = Math.round(base + WEATHER_TYPES[id].tempMod);
}

function updateMarketPrices() {
  Object.keys(state.market).forEach((id) => {
    const prev = state.market[id];
    const delta = randRange(-MARKET_DAILY_DRIFT, MARKET_DAILY_DRIFT);
    const next = clamp(prev + delta, MARKET_MIN, MARKET_MAX);
    state.market[id] = next;
    state.marketTrend[id] = next > prev + 0.004 ? 'up' : next < prev - 0.004 ? 'down' : 'flat';
  });
}

function payWorkerWages() {
  if (state.workers.length === 0) return;
  const totalWage = state.workers.reduce((s, w) => s + w.wage, 0);
  if (state.money >= totalWage) {
    spendMoney(totalWage);
    showToast(`일꾼 임금 ${formatMoney(totalWage)}을 지급했습니다.`, 'good');
  } else {
    const fired = state.workers.pop(); // 가장 최근에 고용한 일꾼부터 내보낸다
    if (fired) showToast(`임금을 지불할 돈이 부족해 ${WORKER_ROLES[fired.role].name}이(가) 떠났습니다.`, 'bad');
  }
}

function checkDailyPests() {
  state.field.forEach((plot) => {
    if (plot && plot.cropId && !plot.hasPest && Math.random() < 0.12) {
      plot.hasPest = true;
      showToast(`${plot.id + 1}번 밭의 ${CROPS[plot.cropId].name}에 병해충이 발생했습니다!`, 'bad');
    }
  });
  if (state.greenhouse.built) {
    state.greenhouse.plots.forEach((plot) => {
      if (plot && plot.cropId && !plot.hasPest && Math.random() < 0.05) { // 실내라 발생 확률이 낮다
        plot.hasPest = true;
        showToast(`온실 ${plot.id + 1}번 칸의 ${CROPS[plot.cropId].name}에 병해충이 발생했습니다!`, 'bad');
      }
    });
  }
}

function advanceDay() {
  state.time.day += 1;
  state.time.seasonDay += 1;
  if (state.time.seasonDay > SEASON_DAYS) {
    state.time.seasonDay = 1;
    state.time.seasonIndex = (state.time.seasonIndex + 1) % SEASONS.length;
    showToast(`계절이 ${getCurrentSeason().name}(으)로 바뀌었습니다.`, 'good');
  }
  rollWeather();
  updateMarketPrices();

  if (state.time.weatherId === 'rainy') {
    showToast('비가 내려요 — 밭의 토양 수분이 저절로 채워집니다.', 'good');
  }

  checkDailyPests();
  payWorkerWages();
}

function getEnv() {
  return {
    temperature: state.time.temperature,
    weatherId: state.time.weatherId,
    sunlight: WEATHER_TYPES[state.time.weatherId].sunlightMult,
  };
}

// 온실은 심어진 작물의 적정 온도를 그대로 유지하는 것으로 간주한다 — 날씨/계절 영향 없음이 핵심 가치.
function getGreenhouseEnv(crop) {
  const idealTemp = (crop.tempOptimal[0] + crop.tempOptimal[1]) / 2;
  return { temperature: idealTemp, weatherId: 'sunny', sunlight: 1.2 };
}

/* --------------------------------------------------------------------------
   4. 밭/온실 plot 시뮬레이션 로직 (공통)
   -------------------------------------------------------------------------- */

function rangeFactor(value, optimal, accept) {
  if (value >= optimal[0] && value <= optimal[1]) return 1.2;
  if (value >= accept[0] && value <= accept[1]) return 0.9;
  return 0.35;
}

function updatePlotMoisture(plot, env, ticks) {
  if (env.weatherId === 'rainy') {
    plot.moisture = clamp(plot.moisture + 3 * ticks, 0, 100); // 비 오는 날은 자동으로 채워짐
  } else {
    const evap = (0.55 + Math.max(0, env.temperature - 25) * 0.06) * ticks;
    plot.moisture = clamp(plot.moisture - evap, 0, 100);
  }
}

function updatePlotWeeds(plot, ticks, growthMult) {
  if (!plot.cropId) return;
  plot.weedLevel = clamp(plot.weedLevel + 0.45 * growthMult * ticks, 0, 100);
}

function killPlot(plot, loc) {
  const crop = CROPS[plot.cropId];
  showToast(`${getLocationLabel(loc)} ${plot.id + 1}번 칸의 ${crop.name}이(가) 시들어 죽고 말았습니다...`, 'bad');
  resetPlotAfterCrop(plot, false);
}

// 완만해진 건강도 곡선: 적정범위를 살짝 벗어난 정도는 거의 상쇄되고,
// 심각하게 벗어나거나(허용범위 밖) 병해충이 있을 때만 확실히 타격을 준다.
function updatePlotHealth(plot, crop, env, ticks, loc) {
  let change = 0;

  const [mLo, mHi] = crop.moistureOptimal;
  if (plot.moisture < mLo - 20 || plot.moisture > mHi + 20) change -= 0.45;
  else if (plot.moisture < mLo || plot.moisture > mHi) change -= 0.06;

  const [taLo, taHi] = crop.tempAccept;
  const [tLo, tHi] = crop.tempOptimal;
  if (env.temperature < taLo || env.temperature > taHi) change -= 0.5;
  else if (env.temperature < tLo || env.temperature > tHi) change -= 0.06;

  if (plot.weedLevel > 70) change -= 0.15;
  if (plot.hasPest) change -= 1.3;

  if (change > -0.3) change += 0.3; // 경미한 스트레스는 회복력으로 상쇄, 완벽한 조건이면 순성장

  plot.health = clamp(plot.health + change * ticks, 0, 100);

  plot.healthSum += plot.health * ticks;
  plot.healthTicks += ticks;
  plot.weedSum += plot.weedLevel * ticks;
  plot.weedTicks += ticks;
  if (plot.hasPest) plot.pestTicks += ticks;

  if (plot.health <= 0) killPlot(plot, loc);
}

function computeGrowthMultiplier(plot, crop, env) {
  const tempFactor = rangeFactor(env.temperature, crop.tempOptimal, crop.tempAccept);
  const moistAccept = [crop.moistureOptimal[0] - 20, crop.moistureOptimal[1] + 20];
  const moistFactor = rangeFactor(plot.moisture, crop.moistureOptimal, moistAccept);
  const sunFactor = env.sunlight;
  const fertilityFactor = 0.7 + (plot.fertility / 100) * 0.6;
  const fertBoost = plot.fertBoostTicks > 0 ? 1.3 : 1.0;
  const weedPenalty = 1 - (plot.weedLevel / 100) * 0.5;
  const healthFactor = 0.5 + (plot.health / 100) * 0.5;
  return tempFactor * moistFactor * sunFactor * fertilityFactor * fertBoost * weedPenalty * healthFactor;
}

function updatePlotGrowth(plot, crop, env, minutesElapsed) {
  if (plot.stage >= 4) return;
  const multiplier = computeGrowthMultiplier(plot, crop, env);
  plot.progress += minutesElapsed * multiplier;
  if (plot.progress >= crop.stageDuration) {
    plot.progress -= crop.stageDuration;
    plot.stage += 1;
    if (plot.stage >= 4) { plot.stage = 4; plot.progress = 0; }
  }
}

function resetPlotAfterCrop(plot, depleteSoil) {
  if (depleteSoil) plot.fertility = clamp(plot.fertility - 12, 10, 100);
  plot.cropId = null;
  plot.stage = 0;
  plot.progress = 0;
  plot.health = 100;
  plot.hasPest = false;
  plot.fertilizedUsed = false;
  plot.fertBoostTicks = 0;
  plot.healthSum = 0; plot.healthTicks = 0;
  plot.weedSum = 0; plot.weedTicks = 0;
  plot.pestTicks = 0;
  // 잡초와 토양 수분은 그대로 유지 (현실적인 밭 상태 계승)
}

function processFieldTick(ticks) {
  const env = getEnv();
  const weedMult = TOOLS.hoe.levels[state.tools.hoeLevel - 1].weedGrowthMult;
  state.field.forEach((plot) => {
    if (!plot) return;
    updatePlotMoisture(plot, env, ticks);
    if (plot.fertBoostTicks > 0) plot.fertBoostTicks -= 1;
    if (plot.cropId) {
      const crop = CROPS[plot.cropId];
      updatePlotWeeds(plot, ticks, weedMult);
      updatePlotHealth(plot, crop, env, ticks, 'field');
      if (plot.cropId) updatePlotGrowth(plot, crop, env, MINUTES_PER_TICK);
    }
  });
}

function processGreenhouseTick(ticks) {
  if (!state.greenhouse.built) return;
  state.greenhouse.plots.forEach((plot) => {
    if (!plot) return;
    if (plot.fertBoostTicks > 0) plot.fertBoostTicks -= 1;
    if (plot.cropId) {
      const crop = CROPS[plot.cropId];
      const env = getGreenhouseEnv(crop);
      updatePlotMoisture(plot, env, ticks);
      updatePlotWeeds(plot, ticks, 0.5); // 실내라 잡초 번식이 절반 속도
      updatePlotHealth(plot, crop, env, ticks, 'greenhouse');
      if (plot.cropId) updatePlotGrowth(plot, crop, env, MINUTES_PER_TICK);
    } else {
      updatePlotMoisture(plot, { weatherId: 'sunny', temperature: 20 }, ticks);
    }
  });
}

/* --------------------------------------------------------------------------
   5. 메인 게임 루프 + 자동화 실행
   -------------------------------------------------------------------------- */

function runFieldAutomation() {
  const workerFieldBonus = state.workers.filter((w) => w.role === 'field').length;

  if (state.automation.waterLevel > 0) {
    const def = AUTOMATION.water.levels[state.automation.waterLevel - 1];
    const coverage = def.coveragePerTick + workerFieldBonus;
    const amount = TOOLS.wateringCan.levels[state.tools.wateringCanLevel - 1].moistureAdd;
    state.field
      .filter((p) => p && p.cropId && p.moisture < def.thresholdBelow)
      .sort((a, b) => a.moisture - b.moisture)
      .slice(0, coverage)
      .forEach((p) => { p.moisture = clamp(p.moisture + amount, 0, 100); });
  }

  if (state.automation.harvestLevel > 0) {
    const def = AUTOMATION.harvest.levels[state.automation.harvestLevel - 1];
    const coverage = def.coveragePerTick + workerFieldBonus;
    const targets = state.field.filter((p) => p && p.stage === 4).slice(0, coverage);
    let count = 0;
    targets.forEach((p) => { if (doHarvest(p)) count += 1; });
    if (count > 0) showToast(`자동 수확기가 밭 ${count}칸을 수확했습니다.`, 'good');
  }

  if (state.automation.seedLevel > 0 && state.automation.autoSeedCropId) {
    const cropId = state.automation.autoSeedCropId;
    const def = AUTOMATION.seed.levels[state.automation.seedLevel - 1];
    const coverage = def.coveragePerTick + workerFieldBonus;
    const targets = state.field.filter((p) => p && !p.cropId).slice(0, coverage);
    let count = 0;
    for (const p of targets) {
      if ((state.inventory.seeds[cropId] || 0) <= 0) break;
      if (plantSeedCore(p, cropId)) count += 1;
    }
    if (count > 0) showToast(`자동 파종기가 ${CROPS[cropId].name} ${count}칸을 심었습니다.`, 'good');
  }
}

function runGreenhouseWorkerAuto() {
  if (!state.greenhouse.built) return;
  let count = 0;
  state.greenhouse.plots.forEach((plot) => {
    if (!plot || !plot.cropId) return;
    if (plot.moisture < 60) plot.moisture = clamp(plot.moisture + 70, 0, 100);
    if (plot.stage === 4 && doHarvest(plot)) count += 1;
  });
  if (count > 0) showToast(`온실 재배사가 ${count}칸을 수확했습니다.`, 'good');
}

function runLivestockWorkerAuto() {
  if (!state.ranch.built) return;
  state.ranch.pens.forEach((pen) => {
    if (pen && pen.animalId && pen.feedLevel < 40 && (state.inventory.supplies.feed || 0) > 0) {
      state.inventory.supplies.feed -= 1;
      pen.feedLevel = clamp(pen.feedLevel + 50, 0, 100);
    }
  });
}

function runFactoryWorkerAuto() {
  if (state.factory.level <= 0) return;
  const slots = FACTORY_LEVELS[state.factory.level - 1].slots;
  if (state.factory.queue.length >= slots) return;
  const candidates = Object.values(RECIPES).filter(
    (r) => r.requiredFactoryLevel <= state.factory.level && getTotalHarvestCount(r.inputCropId) >= r.inputQty
  );
  if (!candidates.length) return;
  candidates.sort((a, b) => goodsUnitPrice(b.outputId) * b.outputQty - goodsUnitPrice(a.outputId) * a.outputQty);
  startProcessing(candidates[0].id);
}

function runWorkerAutomations() {
  if (state.workers.some((w) => w.role === 'livestock')) runLivestockWorkerAuto();
  if (state.workers.some((w) => w.role === 'factory')) runFactoryWorkerAuto();
  if (state.workers.some((w) => w.role === 'greenhouse')) runGreenhouseWorkerAuto();
}

function processRanchTick(ticks) {
  if (!state.ranch.built) return;
  state.ranch.pens.forEach((pen) => {
    if (!pen || !pen.animalId) return;
    const animal = ANIMALS[pen.animalId];
    pen.feedLevel = clamp(pen.feedLevel - FEED_DEPLETE_PER_TICK * ticks, 0, 100);

    if (pen.feedLevel > 15) {
      pen.progress += ticks;
      pen.health = clamp(pen.health + 0.3 * ticks, 0, 100);
    } else {
      pen.health = clamp(pen.health - 0.5 * ticks, 0, 100);
      if (pen.health <= 0) {
        showToast(`${animal.name}이(가) 영양 부족으로 떠나버렸습니다...`, 'bad');
        pen.animalId = null; pen.feedLevel = 0; pen.health = 100; pen.progress = 0;
        return;
      }
    }

    if (pen.progress >= animal.cycleTicks) {
      pen.progress -= animal.cycleTicks;
      state.inventory.goods[animal.productId] = (state.inventory.goods[animal.productId] || 0) + animal.productQty;
      state.stats.totalLivestockProduced += animal.productQty;
      gainExp(EXP_REWARD.livestock);
    }
  });
}

function processFactoryQueueTick() {
  if (state.factory.level <= 0 || state.factory.queue.length === 0) return;
  state.factory.queue.forEach((item) => { item.remainingTicks -= 1; });
  const done = state.factory.queue.filter((item) => item.remainingTicks <= 0);
  if (!done.length) return;
  state.factory.queue = state.factory.queue.filter((item) => item.remainingTicks > 0);
  done.forEach((item) => {
    const recipe = RECIPES[item.recipeId];
    state.inventory.goods[recipe.outputId] = (state.inventory.goods[recipe.outputId] || 0) + recipe.outputQty;
    state.stats.totalProcessed += recipe.outputQty;
    gainExp(EXP_REWARD.process);
  });
  const names = done.map((item) => GOODS[RECIPES[item.recipeId].outputId].name);
  showToast(`가공 완료: ${names.join(', ')}`, 'good');
}

function gameTick() {
  state.time.minutes += MINUTES_PER_TICK;
  if (state.time.minutes >= DAY_MINUTES) {
    state.time.minutes -= DAY_MINUTES;
    advanceDay();
  }

  const ticks = MINUTES_PER_TICK / 30; // 기준 틱 단위 = 1

  processFieldTick(ticks);
  processGreenhouseTick(ticks);
  processRanchTick(ticks);
  processFactoryQueueTick();
  runFieldAutomation();
  runWorkerAutomations();

  if (state.money > state.stats.peakMoney) state.stats.peakMoney = state.money;

  renderAll();
  if (popupState) refreshPopup();

  ticksSinceSave += 1;
  if (ticksSinceSave >= 5) { ticksSinceSave = 0; saveState(); }
}

/* --------------------------------------------------------------------------
   6. 레벨 / 경험치 / 명성
   -------------------------------------------------------------------------- */

function gainExp(amount) {
  if (amount <= 0) return;
  state.exp += amount;
  let leveledUp = false;
  let unlockedNames = [];
  while (state.exp >= expForLevel(state.level)) {
    state.exp -= expForLevel(state.level);
    state.level += 1;
    leveledUp = true;
    addMoney(state.level * 40);
    Object.values(CROPS).filter((c) => c.unlockLevel === state.level).forEach((c) => unlockedNames.push(`${c.emoji} ${c.name}`));
  }
  if (leveledUp) {
    const unlockMsg = unlockedNames.length ? ` · 신규 작물 해금: ${unlockedNames.join(', ')}` : '';
    showToast(`레벨 업! Lv.${state.level} 달성${unlockMsg}`, 'level');
  }
}

/* --------------------------------------------------------------------------
   7. 상점 · 농기구 · 밭 확장 액션
   -------------------------------------------------------------------------- */

function buySeed(cropId) {
  const crop = CROPS[cropId];
  if (state.level < crop.unlockLevel) { showToast(`Lv.${crop.unlockLevel}에 해금되는 작물입니다.`, 'bad'); return; }
  if (state.money < crop.seedPrice) { showToast('소지금이 부족합니다.', 'bad'); return; }
  spendMoney(crop.seedPrice);
  state.inventory.seeds[cropId] = (state.inventory.seeds[cropId] || 0) + 1;
  showToast(`${crop.name} 씨앗을 구매했습니다.`, 'good');
  renderAll(); saveState();
}

function buySupply(itemId) {
  const item = SUPPLIES[itemId];
  if (state.money < item.price) { showToast('소지금이 부족합니다.', 'bad'); return; }
  spendMoney(item.price);
  state.inventory.supplies[itemId] = (state.inventory.supplies[itemId] || 0) + 1;
  showToast(`${item.name}을(를) 구매했습니다.`, 'good');
  renderAll(); saveState();
}

function buyToolUpgrade(toolId) {
  const tool = TOOLS[toolId];
  const levelKey = toolId + 'Level';
  const currentLevel = state.tools[levelKey];
  if (currentLevel >= tool.levels.length) { showToast('이미 최고 단계입니다.', 'bad'); return; }
  const nextDef = tool.levels[currentLevel];
  if (state.money < nextDef.cost) { showToast('소지금이 부족합니다.', 'bad'); return; }
  spendMoney(nextDef.cost);
  state.tools[levelKey] = nextDef.level;
  showToast(`${tool.name}이(가) Lv.${nextDef.level}로 업그레이드되었습니다!`, 'good');
  renderAll(); saveState();
}

function expandField() {
  if (state.unlockedCount >= MAX_PLOTS) { showToast('더 이상 밭을 확장할 수 없습니다.', 'bad'); return; }
  const cost = computeExpandCost(state.unlockedCount);
  if (state.money < cost) { showToast('소지금이 부족합니다.', 'bad'); return; }
  spendMoney(cost);
  state.field[state.unlockedCount] = createEmptyPlot(state.unlockedCount);
  state.unlockedCount += 1;
  showToast(`밭을 개간했습니다! (총 ${state.unlockedCount}칸)`, 'good');
  closePopup();
  renderAll(); saveState();
}

function getAdjacentIndices(index) {
  const result = [];
  const col = index % GRID_COLS;
  if (col > 0) result.push(index - 1);
  if (col < GRID_COLS - 1) result.push(index + 1);
  if (index - GRID_COLS >= 0) result.push(index - GRID_COLS);
  if (index + GRID_COLS < MAX_PLOTS) result.push(index + GRID_COLS);
  return result;
}

function resetGame() {
  const ok = window.confirm('정말 처음부터 다시 시작할까요? 모든 진행 상황이 삭제됩니다.');
  if (!ok) return;
  localStorage.removeItem(SAVE_KEY);
  state = createDefaultState();
  popupState = null;
  renderAll(); saveState();
  showToast('새 농장을 시작합니다.', 'good');
}

/* --------------------------------------------------------------------------
   8. 밭·온실 작물 관리 액션 (파종 / 물 / 잡초 / 방제 / 비료 / 수확 / 판매)
   -------------------------------------------------------------------------- */

function plantSeedCore(plot, cropId) {
  if (!plot || plot.cropId) return false;
  if (!state.inventory.seeds[cropId]) return false;
  state.inventory.seeds[cropId] -= 1;
  plot.cropId = cropId;
  plot.stage = 0; plot.progress = 0; plot.health = 100; plot.hasPest = false;
  plot.fertilizedUsed = false; plot.fertBoostTicks = 0;
  plot.healthSum = 0; plot.healthTicks = 0; plot.weedSum = 0; plot.weedTicks = 0; plot.pestTicks = 0;
  return true;
}

function plantSeed(loc, plotIndex, cropId) {
  const plot = getLocationArray(loc)[plotIndex];
  if (!plot) return;
  if (loc === 'field' && CROPS[cropId].greenhouseOnly) { showToast('온실에서만 재배할 수 있는 작물입니다.', 'bad'); return; }
  const ok = plantSeedCore(plot, cropId);
  if (!ok) { showToast('보유한 씨앗이 없습니다.', 'bad'); return; }
  showToast(`${CROPS[cropId].name} 씨앗을 심었습니다.`, 'good');
  renderAll(); saveState();
  openPlotPopup(loc, plotIndex);
}

function waterPlot(loc, plotIndex) {
  const plot = getLocationArray(loc)[plotIndex];
  if (!plot) return;
  const amount = TOOLS.wateringCan.levels[state.tools.wateringCanLevel - 1].moistureAdd;
  plot.moisture = clamp(plot.moisture + amount, 0, 100);
  showToast('물을 주었습니다.', 'good');
  renderAll();
}

function bulkWaterAll() {
  const toolDef = TOOLS.wateringCan.levels[state.tools.wateringCanLevel - 1];
  if (!toolDef.bulkWater) { showToast('물뿌리개를 업그레이드하면 전체 물주기를 사용할 수 있습니다.', 'bad'); return; }
  if (toolDef.bulkCooldownDays > 0 && state.lastBulkWaterDay === state.time.day) {
    showToast('전체 물주기는 오늘 이미 사용했습니다.', 'bad'); return;
  }
  state.field.forEach((plot) => { if (plot) plot.moisture = clamp(plot.moisture + toolDef.moistureAdd, 0, 100); });
  if (state.greenhouse.built) {
    state.greenhouse.plots.forEach((plot) => { if (plot) plot.moisture = clamp(plot.moisture + toolDef.moistureAdd, 0, 100); });
  }
  state.lastBulkWaterDay = state.time.day;
  showToast('보유한 모든 밭과 온실에 물을 주었습니다.', 'good');
  renderAll(); saveState();
}

function removeWeeds(loc, plotIndex) {
  const plot = getLocationArray(loc)[plotIndex];
  if (!plot) return;
  const hadWeeds = plot.weedLevel > 8;
  plot.weedLevel = 0;

  if (loc === 'field') {
    const hoeDef = TOOLS.hoe.levels[state.tools.hoeLevel - 1];
    if (hoeDef.adjacentClearRatio > 0) {
      getAdjacentIndices(plotIndex).forEach((i) => {
        const adj = state.field[i];
        if (adj && adj.cropId) adj.weedLevel = clamp(adj.weedLevel * (1 - hoeDef.adjacentClearRatio), 0, 100);
      });
    }
  }

  showToast('잡초를 제거했습니다.', 'good');
  if (hadWeeds) gainExp(EXP_REWARD.weed);
  renderAll();
}

function treatPest(loc, plotIndex) {
  const plot = getLocationArray(loc)[plotIndex];
  if (!plot) return;
  if (!state.inventory.supplies.pesticide) { showToast('방제약이 없습니다. 상점에서 구매하세요.', 'bad'); return; }
  state.inventory.supplies.pesticide -= 1;
  plot.hasPest = false;
  plot.health = clamp(plot.health + 15, 0, 100);
  showToast('병해충을 방제했습니다.', 'good');
  gainExp(EXP_REWARD.pest);
  renderAll(); saveState();
}

function fertilizePlot(loc, plotIndex) {
  const plot = getLocationArray(loc)[plotIndex];
  if (!plot) return;
  if (plot.fertilizedUsed) { showToast('이미 이번 작물에 비료를 주었습니다.', 'bad'); return; }
  if (!state.inventory.supplies.fertilizer) { showToast('비료가 없습니다. 상점에서 구매하세요.', 'bad'); return; }
  state.inventory.supplies.fertilizer -= 1;
  plot.fertility = clamp(plot.fertility + 25, 0, 100);
  plot.fertilizedUsed = true;
  plot.fertBoostTicks = 96; // 약 2일간 성장 부스트
  showToast('비료를 주었습니다.', 'good');
  gainExp(EXP_REWARD.fertilize);
  renderAll(); saveState();
}

// 수확 핵심 로직 — 수동 수확과 자동 수확(자동수확기/온실 재배사) 모두 이 함수를 공유한다.
function doHarvest(plot) {
  if (!plot || !plot.cropId || plot.stage < 4) return null;
  const crop = CROPS[plot.cropId];

  const avgHealth = plot.healthTicks > 0 ? plot.healthSum / plot.healthTicks : 100;
  const avgWeed = plot.weedTicks > 0 ? plot.weedSum / plot.weedTicks : 0;
  const fertScore = plot.fertilizedUsed ? 100 : 60;
  const pestPenalty = plot.pestTicks * 1.2;
  const qualityScore = clamp(avgHealth * 0.55 + (100 - avgWeed) * 0.25 + fertScore * 0.2 - pestPenalty, 0, 100);
  const grade = gradeFromScore(qualityScore);
  const yieldQty = randInt(2, 4);

  const key = `${crop.id}_${grade}`;
  state.inventory.harvest[key] = (state.inventory.harvest[key] || 0) + yieldQty;
  state.stats.totalCropsHarvested += yieldQty;

  const gradeExpMult = { '특': 3, '상': 2, '중': 1.4, '하': 1 }[grade];
  const exp = Math.round((8 + crop.seedPrice * 0.5) * gradeExpMult);

  resetPlotAfterCrop(plot, true);
  gainExp(exp);
  return { cropName: crop.name, grade, qty: yieldQty };
}

function harvestPlot(loc, plotIndex) {
  const plot = getLocationArray(loc)[plotIndex];
  const result = doHarvest(plot);
  if (!result) return;
  showToast(`${result.cropName} 수확! 등급 [${result.grade}] × ${result.qty}`, 'good');
  closePopup();
  renderAll(); saveState();
}

function sellHarvestStack(key) {
  const qty = state.inventory.harvest[key];
  if (!qty) return;
  const [cropId, grade] = key.split('_');
  const crop = CROPS[cropId];
  const total = marketUnitPrice(crop, grade) * qty;
  earnMoney(total);
  delete state.inventory.harvest[key];
  showToast(`${crop.name}(${grade}) ${qty}개를 ${formatMoney(total)}에 판매했습니다.`, 'good');
  renderAll(); saveState();
}

function sellGoodsStack(itemId) {
  const qty = state.inventory.goods[itemId];
  if (!qty) return;
  const goods = GOODS[itemId];
  const total = goodsUnitPrice(itemId) * qty;
  earnMoney(total);
  delete state.inventory.goods[itemId];
  showToast(`${goods.name} ${qty}개를 ${formatMoney(total)}에 판매했습니다.`, 'good');
  renderAll(); saveState();
}

/* --------------------------------------------------------------------------
   9. 자동화 장치 & 일꾼 고용 액션
   -------------------------------------------------------------------------- */

function buyAutomation(deviceId) {
  const device = AUTOMATION[deviceId];
  const levelKey = deviceId + 'Level';
  const currentLevel = state.automation[levelKey];
  if (currentLevel >= device.levels.length) { showToast('이미 최고 단계입니다.', 'bad'); return; }
  const nextDef = device.levels[currentLevel];
  if (state.money < nextDef.cost) { showToast('소지금이 부족합니다.', 'bad'); return; }
  spendMoney(nextDef.cost);
  state.automation[levelKey] = nextDef.level;
  showToast(`${device.name}이(가) ${currentLevel === 0 ? '설치' : '업그레이드'}되었습니다!`, 'good');
  renderAll(); saveState();
}

function setAutoSeedCrop(cropId) {
  state.automation.autoSeedCropId = cropId || null;
  showToast(cropId ? `자동 파종 작물을 ${CROPS[cropId].name}(으)로 설정했습니다.` : '자동 파종을 비활성화했습니다.', 'good');
  renderManagement(); saveState();
}

function hireWorker(roleId) {
  if (state.workers.length >= MAX_WORKERS) { showToast(`일꾼은 최대 ${MAX_WORKERS}명까지 고용할 수 있습니다.`, 'bad'); return; }
  const role = WORKER_ROLES[roleId];
  const cost = WORKER_HIRE_BASE_COST + state.workers.length * WORKER_HIRE_STEP;
  if (state.money < cost) { showToast('소지금이 부족합니다.', 'bad'); return; }
  spendMoney(cost);
  state.workers.push({ id: state.nextWorkerId++, role: roleId, wage: role.wageBase, hiredDay: state.time.day });
  showToast(`${role.name}을(를) 고용했습니다! (일급 ${role.wageBase}원)`, 'good');
  renderAll(); saveState();
}

function fireWorker(workerId) {
  state.workers = state.workers.filter((w) => w.id !== workerId);
  showToast('일꾼을 내보냈습니다.', 'good');
  renderAll(); saveState();
}

/* --------------------------------------------------------------------------
   10. 가공 시설 액션
   -------------------------------------------------------------------------- */

function buildOrUpgradeFactory() {
  if (state.factory.level >= FACTORY_LEVELS.length) { showToast('이미 최고 단계입니다.', 'bad'); return; }
  const def = FACTORY_LEVELS[state.factory.level];
  if (state.money < def.cost) { showToast('소지금이 부족합니다.', 'bad'); return; }
  spendMoney(def.cost);
  state.factory.level = def.level;
  showToast(state.factory.level === 1 ? '가공소를 건설했습니다!' : `가공소가 Lv.${def.level}로 업그레이드되었습니다!`, 'good');
  renderAll(); saveState();
}

function startProcessing(recipeId) {
  const recipe = RECIPES[recipeId];
  if (state.factory.level < recipe.requiredFactoryLevel) { showToast(`가공소 Lv.${recipe.requiredFactoryLevel}이 필요합니다.`, 'bad'); return; }
  const slots = FACTORY_LEVELS[state.factory.level - 1].slots;
  if (state.factory.queue.length >= slots) { showToast('가공 슬롯이 모두 사용 중입니다.', 'bad'); return; }
  if (getTotalHarvestCount(recipe.inputCropId) < recipe.inputQty) { showToast('원재료가 부족합니다.', 'bad'); return; }
  consumeHarvest(recipe.inputCropId, recipe.inputQty);
  const speedMult = FACTORY_LEVELS[state.factory.level - 1].speedMult;
  const ticks = Math.max(1, Math.round(recipe.ticks / speedMult));
  state.factory.queue.push({ id: state.nextFactoryQueueId++, recipeId, remainingTicks: ticks, totalTicks: ticks });
  showToast(`${GOODS[recipe.outputId].name} 가공을 시작했습니다.`, 'good');
  renderAll(); saveState();
}

/* --------------------------------------------------------------------------
   11. 축산업(목장) 액션
   -------------------------------------------------------------------------- */

function buildRanch() {
  if (state.ranch.built) return;
  if (state.money < RANCH_BUILD_COST) { showToast('소지금이 부족합니다.', 'bad'); return; }
  spendMoney(RANCH_BUILD_COST);
  state.ranch.built = true;
  for (let i = 0; i < RANCH_START_PENS; i++) state.ranch.pens[i] = createEmptyPen(i);
  state.ranch.unlockedPens = RANCH_START_PENS;
  showToast('목장을 건설했습니다!', 'good');
  renderAll(); saveState();
}

function expandRanch() {
  if (!state.ranch.built) return;
  if (state.ranch.unlockedPens >= RANCH_MAX_PENS) { showToast('더 이상 확장할 수 없습니다.', 'bad'); return; }
  const cost = computeRanchExpandCost(state.ranch.unlockedPens);
  if (state.money < cost) { showToast('소지금이 부족합니다.', 'bad'); return; }
  spendMoney(cost);
  state.ranch.pens[state.ranch.unlockedPens] = createEmptyPen(state.ranch.unlockedPens);
  state.ranch.unlockedPens += 1;
  showToast('축사를 확장했습니다!', 'good');
  closePopup();
  renderAll(); saveState();
}

function buyAnimal(penIndex, animalId) {
  const pen = state.ranch.pens[penIndex];
  if (!pen || pen.animalId) return;
  const animal = ANIMALS[animalId];
  if (state.money < animal.buyCost) { showToast('소지금이 부족합니다.', 'bad'); return; }
  spendMoney(animal.buyCost);
  pen.animalId = animalId;
  pen.feedLevel = 70;
  pen.health = 100;
  pen.progress = 0;
  showToast(`${animal.name}을(를) 들였습니다!`, 'good');
  renderAll(); saveState();
}

function feedPen(penIndex) {
  const pen = state.ranch.pens[penIndex];
  if (!pen || !pen.animalId) return;
  if (!state.inventory.supplies.feed) { showToast('사료가 없습니다. 상점에서 구매하세요.', 'bad'); return; }
  state.inventory.supplies.feed -= 1;
  pen.feedLevel = clamp(pen.feedLevel + 50, 0, 100);
  showToast('사료를 주었습니다.', 'good');
  renderAll(); saveState();
}

/* --------------------------------------------------------------------------
   12. 온실 건설 액션
   -------------------------------------------------------------------------- */

function buildGreenhouse() {
  if (state.greenhouse.built) return;
  if (state.money < GREENHOUSE_BUILD_COST) { showToast('소지금이 부족합니다.', 'bad'); return; }
  spendMoney(GREENHOUSE_BUILD_COST);
  state.greenhouse.built = true;
  for (let i = 0; i < GREENHOUSE_START_PLOTS; i++) state.greenhouse.plots[i] = createEmptyPlot(i);
  state.greenhouse.unlockedPlots = GREENHOUSE_START_PLOTS;
  showToast('온실을 건설했습니다! 날씨와 무관하게 작물을 재배할 수 있어요.', 'good');
  renderAll(); saveState();
}

function expandGreenhouse() {
  if (!state.greenhouse.built) return;
  if (state.greenhouse.unlockedPlots >= GREENHOUSE_MAX_PLOTS) { showToast('더 이상 확장할 수 없습니다.', 'bad'); return; }
  const cost = computeGreenhouseExpandCost(state.greenhouse.unlockedPlots);
  if (state.money < cost) { showToast('소지금이 부족합니다.', 'bad'); return; }
  spendMoney(cost);
  state.greenhouse.plots[state.greenhouse.unlockedPlots] = createEmptyPlot(state.greenhouse.unlockedPlots);
  state.greenhouse.unlockedPlots += 1;
  showToast('온실을 확장했습니다!', 'good');
  closePopup();
  renderAll(); saveState();
}

/* --------------------------------------------------------------------------
   13. 렌더링 — 대시보드
   -------------------------------------------------------------------------- */

function renderDashboard() {
  document.getElementById('stat-money').textContent = formatMoney(state.money);
  document.getElementById('stat-level').textContent = `Lv.${state.level}`;
  document.getElementById('stat-fame').textContent = getFameInfo().title;
  document.getElementById('stat-season').textContent = getCurrentSeason().name;
  document.getElementById('stat-day').textContent = `${state.time.day}일차 (${state.time.seasonDay}/${SEASON_DAYS})`;

  const weather = WEATHER_TYPES[state.time.weatherId];
  document.getElementById('stat-weather-icon').textContent = weather.icon;
  document.getElementById('stat-weather-name').textContent = weather.name;
  document.getElementById('stat-temp').textContent = `${state.time.temperature}°C`;
  document.getElementById('stat-time').textContent = formatTime(state.time.minutes);

  const need = expForLevel(state.level);
  document.getElementById('exp-bar-fill').style.width = `${clamp((state.exp / need) * 100, 0, 100)}%`;
  document.getElementById('exp-bar-label').textContent = `${Math.floor(state.exp)} / ${need} EXP`;

  const bulkBtn = document.getElementById('btn-bulk-water');
  const toolDef = TOOLS.wateringCan.levels[state.tools.wateringCanLevel - 1];
  if (toolDef.bulkWater) {
    bulkBtn.classList.remove('hidden');
    const onCooldown = toolDef.bulkCooldownDays > 0 && state.lastBulkWaterDay === state.time.day;
    bulkBtn.disabled = onCooldown;
    bulkBtn.textContent = onCooldown ? '🚿 전체 물주기 (내일 다시)' : '🚿 전체 물주기';
  } else {
    bulkBtn.classList.add('hidden');
  }
}

/* --------------------------------------------------------------------------
   14. 렌더링 — 밭 / 온실 그리드 (공통)
   -------------------------------------------------------------------------- */

function stageIcon(crop, stage) {
  if (stage === 0) return '🌰';
  if (stage === 1) return '🌱';
  if (stage === 2) return '🌿';
  return crop.emoji;
}

function renderPlotsGrid(containerId, loc) {
  const plotsArray = getLocationArray(loc);
  const maxSlots = loc === 'field' ? MAX_PLOTS : GREENHOUSE_MAX_PLOTS;
  const unlockedCount = loc === 'field' ? state.unlockedCount : state.greenhouse.unlockedPlots;
  const expandCostFn = loc === 'field' ? computeExpandCost : computeGreenhouseExpandCost;
  const grid = document.getElementById(containerId);
  grid.innerHTML = '';

  for (let i = 0; i < maxSlots; i++) {
    const plot = plotsArray[i];
    const cell = document.createElement('div');

    if (!plot) {
      const isNext = i === unlockedCount;
      cell.className = 'plot is-locked' + (isNext ? '' : ' is-far');
      cell.innerHTML = `<div class="plot-lock-icon">🔒</div>` + (isNext ? `<div class="plot-lock-cost">${formatMoney(expandCostFn(unlockedCount))}</div>` : '');
      cell.addEventListener('click', (e) => openPlotPopup(loc, i, e));
      grid.appendChild(cell);
      continue;
    }

    cell.className = 'plot' + (plot.cropId ? '' : ' is-empty') + (plot.moisture > 75 ? ' is-wet' : '');
    cell.dataset.index = plot.id;

    const badges = document.createElement('div');
    badges.className = 'plot-badges';
    if (plot.cropId && plot.weedLevel > 30) badges.innerHTML += '<span title="잡초">🍃</span>';
    if (plot.cropId && plot.hasPest) badges.innerHTML += '<span title="병해충">🐛</span>';
    cell.appendChild(badges);

    if (plot.stage === 4) {
      const ready = document.createElement('span');
      ready.className = 'plot-badge-ready';
      ready.textContent = '수확!';
      cell.appendChild(ready);
    }

    if (plot.cropId) {
      const crop = CROPS[plot.cropId];
      const icon = document.createElement('div');
      icon.className = 'plot-crop-icon';
      icon.textContent = stageIcon(crop, plot.stage);
      cell.appendChild(icon);

      const label = document.createElement('div');
      label.className = 'plot-stage-label';
      label.textContent = STAGE_NAMES[plot.stage];
      cell.appendChild(label);

      const bars = document.createElement('div');
      bars.className = 'plot-bars';
      bars.innerHTML = `
        <div class="mini-bar"><div class="mini-bar-fill moisture" style="width:${plot.moisture}%"></div></div>
        <div class="mini-bar"><div class="mini-bar-fill health${plot.health < 40 ? ' low' : ''}" style="width:${plot.health}%"></div></div>
        ${plot.stage < 4 ? `<div class="mini-bar"><div class="mini-bar-fill progress" style="width:${Math.min(100, (plot.progress / crop.stageDuration) * 100)}%"></div></div>` : ''}
      `;
      cell.appendChild(bars);
    } else {
      const bars = document.createElement('div');
      bars.className = 'plot-bars';
      bars.innerHTML = `<div class="mini-bar"><div class="mini-bar-fill moisture" style="width:${plot.moisture}%"></div></div>`;
      cell.appendChild(bars);
    }

    cell.addEventListener('click', (e) => openPlotPopup(loc, plot.id, e));
    grid.appendChild(cell);
  }
}

function renderField() {
  document.getElementById('field-count-label').textContent = `(${state.unlockedCount} / ${MAX_PLOTS}칸)`;
  renderPlotsGrid('field-grid', 'field');
}

function renderGreenhouse() {
  const promptEl = document.getElementById('greenhouse-build-prompt');
  const gridWrap = document.getElementById('greenhouse-grid-wrap');
  const countLabel = document.getElementById('greenhouse-count-label');

  if (!state.greenhouse.built) {
    promptEl.classList.remove('hidden');
    gridWrap.classList.add('hidden');
    const btn = document.getElementById('btn-build-greenhouse');
    btn.textContent = formatMoney(GREENHOUSE_BUILD_COST);
    btn.disabled = state.money < GREENHOUSE_BUILD_COST;
    countLabel.textContent = '(미건설)';
    return;
  }

  promptEl.classList.add('hidden');
  gridWrap.classList.remove('hidden');
  countLabel.textContent = `(${state.greenhouse.unlockedPlots} / ${GREENHOUSE_MAX_PLOTS}칸)`;
  renderPlotsGrid('greenhouse-grid', 'greenhouse');
}

/* --------------------------------------------------------------------------
   15. 렌더링 — 상점 / 인벤토리 / 시세
   -------------------------------------------------------------------------- */

function renderMarketTicker() {
  const el = document.getElementById('market-ticker');
  el.innerHTML = '';
  const addRow = (id, icon, name) => {
    const mult = state.market[id] || 1;
    const trend = state.marketTrend[id] || 'flat';
    const arrow = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—';
    const pct = Math.round((mult - 1) * 100);
    const pctLabel = pct > 0 ? `+${pct}%` : `${pct}%`;
    const row = document.createElement('div');
    row.className = 'market-row';
    row.innerHTML = `<span class="m-name">${icon} ${name}</span><span class="m-trend ${trend}">${arrow} ${pctLabel}</span>`;
    el.appendChild(row);
  };
  Object.values(CROPS).forEach((crop) => { if (state.level >= crop.unlockLevel) addRow(crop.id, crop.emoji, crop.name); });
  if (state.factory.level > 0) Object.values(GOODS).filter((g) => g.category === 'processed').forEach((g) => addRow(g.id, g.icon, g.name));
  if (state.ranch.built) Object.values(GOODS).filter((g) => g.category === 'livestock').forEach((g) => addRow(g.id, g.icon, g.name));
}

function renderShop() {
  renderMarketTicker();

  const seedsEl = document.getElementById('shop-seeds');
  seedsEl.innerHTML = '';
  Object.values(CROPS).forEach((crop) => {
    const locked = state.level < crop.unlockLevel;
    const owned = state.inventory.seeds[crop.id] || 0;
    const card = document.createElement('div');
    card.className = 'item-card' + (locked ? ' is-locked-item' : '');
    if (locked) {
      card.innerHTML = `
        <span class="item-icon">🔒</span>
        <span class="item-info">
          <span class="item-name">${crop.emoji} ${crop.name} 씨앗</span>
          <span class="item-sub">${crop.hint}</span>
        </span>
        <span class="lock-tag">Lv.${crop.unlockLevel} 해금</span>
      `;
    } else {
      card.innerHTML = `
        <span class="item-icon">${crop.emoji}</span>
        <span class="item-info">
          <span class="item-name">${crop.name} 씨앗${crop.greenhouseOnly ? ' <span class="lock-tag">온실전용</span>' : ''}</span>
          <span class="item-sub">${crop.hint} · 보유 ${owned}개</span>
        </span>
        <button class="btn-buy" ${state.money < crop.seedPrice ? 'disabled' : ''}>${crop.seedPrice}원</button>
      `;
      card.querySelector('button').addEventListener('click', () => buySeed(crop.id));
    }
    seedsEl.appendChild(card);
  });

  const suppliesEl = document.getElementById('shop-supplies');
  suppliesEl.innerHTML = '';
  Object.values(SUPPLIES).forEach((item) => {
    const owned = state.inventory.supplies[item.id] || 0;
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <span class="item-icon">${item.icon}</span>
      <span class="item-info">
        <span class="item-name">${item.name}</span>
        <span class="item-sub">${item.desc} · 보유 ${owned}개</span>
      </span>
      <button class="btn-buy" ${state.money < item.price ? 'disabled' : ''}>${item.price}원</button>
    `;
    card.querySelector('button').addEventListener('click', () => buySupply(item.id));
    suppliesEl.appendChild(card);
  });

  const toolsEl = document.getElementById('shop-tools');
  toolsEl.innerHTML = '';
  Object.values(TOOLS).forEach((tool) => {
    const levelKey = tool.id + 'Level';
    const currentLevel = state.tools[levelKey];
    const maxed = currentLevel >= tool.levels.length;
    const dots = tool.levels.map((_, idx) => `<span class="tool-level-dot${idx < currentLevel ? ' is-filled' : ''}"></span>`).join('');
    const card = document.createElement('div');
    card.className = 'item-card';
    if (maxed) {
      card.innerHTML = `
        <span class="item-icon">${tool.icon}</span>
        <span class="item-info">
          <span class="item-name">${tool.name} <span class="tool-level-dots">${dots}</span></span>
          <span class="item-sub">최고 단계 달성 · ${tool.levels[currentLevel - 1].desc}</span>
        </span>
      `;
    } else {
      const nextDef = tool.levels[currentLevel];
      card.innerHTML = `
        <span class="item-icon">${tool.icon}</span>
        <span class="item-info">
          <span class="item-name">${tool.name} <span class="tool-level-dots">${dots}</span> Lv.${currentLevel}→${nextDef.level}</span>
          <span class="item-sub">${nextDef.desc}</span>
        </span>
        <button class="btn-buy" ${state.money < nextDef.cost ? 'disabled' : ''}>${nextDef.cost}원</button>
      `;
      card.querySelector('button').addEventListener('click', () => buyToolUpgrade(tool.id));
    }
    toolsEl.appendChild(card);
  });
}

function renderInventory() {
  const seedsEl = document.getElementById('inv-seeds');
  const ownedSeeds = Object.entries(state.inventory.seeds).filter(([, c]) => c > 0);
  seedsEl.innerHTML = ownedSeeds.length ? '' : '<div class="item-empty">보유한 씨앗이 없습니다.</div>';
  ownedSeeds.forEach(([cropId, count]) => {
    const crop = CROPS[cropId];
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <span class="item-icon">${crop.emoji}</span>
      <span class="item-info">
        <span class="item-name">${crop.name} 씨앗</span>
        <span class="item-sub">보유 수량: ${count}개</span>
      </span>
    `;
    seedsEl.appendChild(card);
  });

  const suppliesEl = document.getElementById('inv-supplies');
  const ownedSupplies = Object.entries(state.inventory.supplies).filter(([, c]) => c > 0);
  suppliesEl.innerHTML = ownedSupplies.length ? '' : '<div class="item-empty">보유한 농자재가 없습니다.</div>';
  ownedSupplies.forEach(([itemId, count]) => {
    const item = SUPPLIES[itemId];
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <span class="item-icon">${item.icon}</span>
      <span class="item-info">
        <span class="item-name">${item.name}</span>
        <span class="item-sub">보유 수량: ${count}개</span>
      </span>
    `;
    suppliesEl.appendChild(card);
  });

  const harvestEl = document.getElementById('inv-harvest');
  const harvestKeys = Object.keys(state.inventory.harvest);
  harvestEl.innerHTML = harvestKeys.length ? '' : '<div class="item-empty">수확한 작물이 없습니다.</div>';
  harvestKeys.forEach((key) => {
    const [cropId, grade] = key.split('_');
    const crop = CROPS[cropId];
    const qty = state.inventory.harvest[key];
    const unitPrice = marketUnitPrice(crop, grade);
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <span class="item-icon">${crop.emoji}</span>
      <span class="item-info">
        <span class="item-name">${crop.name} <span class="grade-tag grade-${grade}">${grade}</span></span>
        <span class="item-sub">${qty}개 · 개당 ${unitPrice}원</span>
      </span>
      <button class="btn-sell">전량 판매</button>
    `;
    card.querySelector('button').addEventListener('click', () => sellHarvestStack(key));
    harvestEl.appendChild(card);
  });

  const goodsEl = document.getElementById('inv-goods');
  const goodsKeys = Object.keys(state.inventory.goods).filter((k) => state.inventory.goods[k] > 0);
  goodsEl.innerHTML = goodsKeys.length ? '' : '<div class="item-empty">보유한 가공품·축산물이 없습니다.</div>';
  goodsKeys.forEach((itemId) => {
    const goods = GOODS[itemId];
    const qty = state.inventory.goods[itemId];
    const unitPrice = goodsUnitPrice(itemId);
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <span class="item-icon">${goods.icon}</span>
      <span class="item-info">
        <span class="item-name">${goods.name}</span>
        <span class="item-sub">${qty}개 · 개당 ${unitPrice}원</span>
      </span>
      <button class="btn-sell">전량 판매</button>
    `;
    card.querySelector('button').addEventListener('click', () => sellGoodsStack(itemId));
    goodsEl.appendChild(card);
  });
}

/* --------------------------------------------------------------------------
   16. 렌더링 — 경영(자동화 + 일꾼)
   -------------------------------------------------------------------------- */

function renderManagement() {
  const autoEl = document.getElementById('auto-devices');
  autoEl.innerHTML = '';
  Object.values(AUTOMATION).forEach((device) => {
    const levelKey = device.id + 'Level';
    const currentLevel = state.automation[levelKey];
    const dots = device.levels.map((_, i) => `<span class="tool-level-dot${i < currentLevel ? ' is-filled' : ''}"></span>`).join('');
    const card = document.createElement('div');
    card.className = 'item-card';
    if (currentLevel >= device.levels.length) {
      card.innerHTML = `
        <span class="item-icon">${device.icon}</span>
        <span class="item-info">
          <span class="item-name">${device.name} <span class="tool-level-dots">${dots}</span></span>
          <span class="item-sub">최고 단계 · ${device.levels[currentLevel - 1].desc}</span>
        </span>
      `;
    } else {
      const nextDef = device.levels[currentLevel];
      const label = currentLevel === 0 ? '설치' : `Lv.${currentLevel}→${nextDef.level}`;
      card.innerHTML = `
        <span class="item-icon">${device.icon}</span>
        <span class="item-info">
          <span class="item-name">${device.name} <span class="tool-level-dots">${dots}</span> ${label}</span>
          <span class="item-sub">${nextDef.desc}</span>
        </span>
        <button class="btn-buy" ${state.money < nextDef.cost ? 'disabled' : ''}>${formatMoney(nextDef.cost)}</button>
      `;
      card.querySelector('button').addEventListener('click', () => buyAutomation(device.id));
    }
    autoEl.appendChild(card);

    if (device.id === 'seed' && currentLevel > 0) {
      const plantable = Object.values(CROPS).filter((c) => !c.greenhouseOnly && state.level >= c.unlockLevel);
      const pickWrap = document.createElement('div');
      pickWrap.className = 'auto-seed-picker';
      pickWrap.innerHTML = `<button class="auto-seed-btn${!state.automation.autoSeedCropId ? ' is-selected' : ''}" data-crop="" title="자동 파종 끄기">🚫</button>`
        + plantable.map((c) => `<button class="auto-seed-btn${state.automation.autoSeedCropId === c.id ? ' is-selected' : ''}" data-crop="${c.id}" title="${c.name}">${c.emoji}</button>`).join('');
      autoEl.appendChild(pickWrap);
      pickWrap.querySelectorAll('[data-crop]').forEach((btn) => btn.addEventListener('click', () => setAutoSeedCrop(btn.dataset.crop)));
    }
  });

  const hireEl = document.getElementById('worker-hire-list');
  hireEl.innerHTML = '';
  const hireCost = WORKER_HIRE_BASE_COST + state.workers.length * WORKER_HIRE_STEP;
  Object.values(WORKER_ROLES).forEach((role) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <span class="item-icon">${role.icon}</span>
      <span class="item-info">
        <span class="item-name">${role.name}</span>
        <span class="item-sub">${role.desc} · 일급 ${role.wageBase}원</span>
      </span>
      <button class="btn-buy" ${state.money < hireCost || state.workers.length >= MAX_WORKERS ? 'disabled' : ''}>${formatMoney(hireCost)}</button>
    `;
    card.querySelector('button').addEventListener('click', () => hireWorker(role.id));
    hireEl.appendChild(card);
  });

  const rosterEl = document.getElementById('worker-roster');
  rosterEl.innerHTML = state.workers.length ? '' : '<div class="item-empty">고용한 일꾼이 없습니다.</div>';
  state.workers.forEach((w) => {
    const role = WORKER_ROLES[w.role];
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <span class="item-icon">${role.icon}</span>
      <span class="item-info">
        <span class="item-name">${role.name}</span>
        <span class="item-sub">일급 ${w.wage}원 · 고용 ${w.hiredDay}일차</span>
      </span>
      <button class="btn-sell">해고</button>
    `;
    card.querySelector('button').addEventListener('click', () => fireWorker(w.id));
    rosterEl.appendChild(card);
  });
}

/* --------------------------------------------------------------------------
   17. 렌더링 — 가공
   -------------------------------------------------------------------------- */

function renderFactory() {
  const statusEl = document.getElementById('factory-status');
  if (state.factory.level <= 0) {
    const def = FACTORY_LEVELS[0];
    statusEl.innerHTML = `
      <div class="item-card">
        <span class="item-icon">🏭</span>
        <span class="item-info"><span class="item-name">가공소 건설</span><span class="item-sub">${def.desc}</span></span>
        <button class="btn-buy" id="btn-build-factory" ${state.money < def.cost ? 'disabled' : ''}>${formatMoney(def.cost)}</button>
      </div>
    `;
    document.getElementById('btn-build-factory').addEventListener('click', buildOrUpgradeFactory);
  } else {
    const idx = state.factory.level - 1;
    const maxed = state.factory.level >= FACTORY_LEVELS.length;
    const dots = FACTORY_LEVELS.map((_, i) => `<span class="tool-level-dot${i < state.factory.level ? ' is-filled' : ''}"></span>`).join('');
    if (maxed) {
      statusEl.innerHTML = `
        <div class="item-card">
          <span class="item-icon">🏭</span>
          <span class="item-info"><span class="item-name">가공소 <span class="tool-level-dots">${dots}</span></span><span class="item-sub">최고 단계 · ${FACTORY_LEVELS[idx].desc}</span></span>
        </div>
      `;
    } else {
      const next = FACTORY_LEVELS[state.factory.level];
      statusEl.innerHTML = `
        <div class="item-card">
          <span class="item-icon">🏭</span>
          <span class="item-info"><span class="item-name">가공소 <span class="tool-level-dots">${dots}</span> Lv.${state.factory.level}→${next.level}</span><span class="item-sub">${next.desc}</span></span>
          <button class="btn-buy" id="btn-build-factory" ${state.money < next.cost ? 'disabled' : ''}>${formatMoney(next.cost)}</button>
        </div>
      `;
      document.getElementById('btn-build-factory').addEventListener('click', buildOrUpgradeFactory);
    }
  }

  const recipesEl = document.getElementById('factory-recipes');
  recipesEl.innerHTML = '';
  Object.values(RECIPES).forEach((r) => {
    const goods = GOODS[r.outputId];
    const have = getTotalHarvestCount(r.inputCropId);
    const locked = state.factory.level < r.requiredFactoryLevel;
    const slots = state.factory.level > 0 ? FACTORY_LEVELS[state.factory.level - 1].slots : 0;
    const full = state.factory.queue.length >= slots;
    const canStart = !locked && have >= r.inputQty && !full;
    const card = document.createElement('div');
    card.className = 'item-card' + (locked ? ' is-locked-item' : '');
    if (locked) {
      card.innerHTML = `
        <span class="item-icon">${goods.icon}</span>
        <span class="item-info"><span class="item-name">${r.name}</span><span class="item-sub">가공소 Lv.${r.requiredFactoryLevel} 필요</span></span>
        <span class="lock-tag">잠김</span>
      `;
    } else {
      card.innerHTML = `
        <span class="item-icon">${goods.icon}</span>
        <span class="item-info"><span class="item-name">${r.name}</span><span class="item-sub">${CROPS[r.inputCropId].name} ${r.inputQty}개 → ${goods.name} ${r.outputQty}개 (보유 원물 ${have}개)</span></span>
        <button class="btn-buy" ${canStart ? '' : 'disabled'}>가공 시작</button>
      `;
      card.querySelector('button').addEventListener('click', () => startProcessing(r.id));
    }
    recipesEl.appendChild(card);
  });

  const queueEl = document.getElementById('factory-queue');
  queueEl.innerHTML = state.factory.queue.length ? '' : '<div class="item-empty">가공 중인 작업이 없습니다.</div>';
  state.factory.queue.forEach((item) => {
    const recipe = RECIPES[item.recipeId];
    const goods = GOODS[recipe.outputId];
    const pct = Math.round(((item.totalTicks - item.remainingTicks) / item.totalTicks) * 100);
    const row = document.createElement('div');
    row.className = 'item-card';
    row.innerHTML = `
      <span class="item-icon">${goods.icon}</span>
      <span class="item-info">
        <span class="item-name">${recipe.name}</span>
        <div class="mini-bar" style="margin-top:4px;"><div class="mini-bar-fill progress" style="width:${pct}%"></div></div>
      </span>
    `;
    queueEl.appendChild(row);
  });
}

/* --------------------------------------------------------------------------
   18. 렌더링 — 목장
   -------------------------------------------------------------------------- */

function renderRanch() {
  const statusEl = document.getElementById('ranch-status');
  const pensWrap = document.getElementById('ranch-pens-wrap');

  if (!state.ranch.built) {
    statusEl.innerHTML = `
      <div class="item-card">
        <span class="item-icon">🐄</span>
        <span class="item-info"><span class="item-name">목장 건설</span><span class="item-sub">닭·소·돼지를 길러 달걀·우유·베이컨을 생산합니다.</span></span>
        <button class="btn-buy" id="btn-build-ranch" ${state.money < RANCH_BUILD_COST ? 'disabled' : ''}>${formatMoney(RANCH_BUILD_COST)}</button>
      </div>
    `;
    document.getElementById('btn-build-ranch').addEventListener('click', buildRanch);
    pensWrap.innerHTML = '';
    return;
  }

  statusEl.innerHTML = `
    <div class="item-card">
      <span class="item-icon">🐄</span>
      <span class="item-info"><span class="item-name">목장</span><span class="item-sub">축사 ${state.ranch.unlockedPens} / ${RANCH_MAX_PENS}칸 운영 중 · 사료가 부족하면 생산이 멈춰요</span></span>
    </div>
  `;

  pensWrap.innerHTML = '';
  for (let i = 0; i < RANCH_MAX_PENS; i++) {
    const pen = state.ranch.pens[i];
    const cell = document.createElement('div');

    if (!pen) {
      const isNext = i === state.ranch.unlockedPens;
      cell.className = 'plot pen-cell is-locked' + (isNext ? '' : ' is-far');
      cell.innerHTML = `<div class="plot-lock-icon">🔒</div>` + (isNext ? `<div class="plot-lock-cost">${formatMoney(computeRanchExpandCost(state.ranch.unlockedPens))}</div>` : '');
    } else if (!pen.animalId) {
      cell.className = 'plot pen-cell is-empty';
    } else {
      const animal = ANIMALS[pen.animalId];
      const pct = Math.min(100, Math.round((pen.progress / animal.cycleTicks) * 100));
      cell.className = 'plot pen-cell';
      cell.innerHTML = `
        <div class="plot-crop-icon">${animal.icon}</div>
        <div class="plot-stage-label">${animal.name}</div>
        <div class="plot-bars">
          <div class="mini-bar"><div class="mini-bar-fill moisture" style="width:${pen.feedLevel}%"></div></div>
          <div class="mini-bar"><div class="mini-bar-fill health${pen.health < 40 ? ' low' : ''}" style="width:${pen.health}%"></div></div>
          <div class="mini-bar"><div class="mini-bar-fill progress" style="width:${pct}%"></div></div>
        </div>
      `;
    }
    cell.addEventListener('click', (e) => openPenPopup(i, e));
    pensWrap.appendChild(cell);
  }
}

/* --------------------------------------------------------------------------
   19. 렌더링 — 통계
   -------------------------------------------------------------------------- */

function renderStats() {
  const fame = getFameInfo();
  document.getElementById('fame-title').textContent = fame.title;
  document.getElementById('fame-bar-fill').style.width = `${fame.progressPct}%`;
  document.getElementById('fame-bar-label').textContent = fame.next
    ? `다음 등급까지 누적 판매 ${formatMoney(Math.max(0, fame.next.min - fame.revenue))} 남음`
    : '최고 등급 달성!';
  document.getElementById('fame-bonus-label').textContent = `판매가 +${Math.round(fame.sellBonus * 100)}%`;

  const rows = [
    ['누적 수확 작물', `${state.stats.totalCropsHarvested.toLocaleString('ko-KR')}개`],
    ['누적 판매 수익', formatMoney(state.stats.totalRevenue)],
    ['누적 지출', formatMoney(state.stats.totalSpent)],
    ['순이익', formatMoney(state.stats.totalRevenue - state.stats.totalSpent)],
    ['가공품 생산량', `${state.stats.totalProcessed.toLocaleString('ko-KR')}개`],
    ['축산물 생산량', `${state.stats.totalLivestockProduced.toLocaleString('ko-KR')}개`],
    ['최고 소지금', formatMoney(state.stats.peakMoney)],
  ];
  document.getElementById('stats-list').innerHTML = rows
    .map(([label, val]) => `<div class="popup-stat-row stats-row"><span>${label}</span><b>${val}</b></div>`)
    .join('');
}

function renderAll() {
  renderDashboard();
  renderField();
  renderGreenhouse();
  renderShop();
  renderInventory();
  renderManagement();
  renderFactory();
  renderRanch();
  renderStats();
}

/* --------------------------------------------------------------------------
   20. 팝업 — 밭/온실 칸 + 목장 펜
   -------------------------------------------------------------------------- */

function positionPopup(popup, event) {
  const margin = 12;
  let x = event ? event.clientX + 14 : window.innerWidth / 2 - 125;
  let y = event ? event.clientY : window.innerHeight / 2 - 100;
  const w = 250, h = 320;
  x = clamp(x, margin, window.innerWidth - w - margin);
  y = clamp(y, margin, window.innerHeight - h - margin);
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
}

function buildPopupContent(loc, plotIndex) {
  const plot = getLocationArray(loc)[plotIndex];
  const locLabel = getLocationLabel(loc);
  const unlockedCount = loc === 'field' ? state.unlockedCount : state.greenhouse.unlockedPlots;
  const expandCostFn = loc === 'field' ? computeExpandCost : computeGreenhouseExpandCost;

  if (!plot) {
    const isNext = plotIndex === unlockedCount;
    if (!isNext) {
      return `<div class="popup-title">🔒 미개간지 <button class="popup-close" data-act="close">✕</button></div><div class="popup-empty-msg">앞 칸부터 순서대로 개간해야 합니다.</div>`;
    }
    const cost = expandCostFn(unlockedCount);
    return `
      <div class="popup-title">🔒 미개간지 <button class="popup-close" data-act="close">✕</button></div>
      <div class="popup-stats">이 ${locLabel}을(를) 개간하면 새 칸이 생깁니다.</div>
      <button class="btn-action btn-expand" data-act="expand" ${state.money < cost ? 'disabled' : ''}>🪓 개간하기 <span class="action-cost">${formatMoney(cost)}</span></button>
    `;
  }

  if (!plot.cropId) {
    const ownedSeeds = Object.entries(state.inventory.seeds).filter(([cid, c]) => c > 0 && (loc === 'greenhouse' || !CROPS[cid].greenhouseOnly));
    const seedButtons = ownedSeeds.length
      ? ownedSeeds.map(([cropId, count]) => {
          const crop = CROPS[cropId];
          return `<button class="btn-action" data-act="plant" data-crop="${cropId}">${crop.emoji} ${crop.name} 파종하기${crop.greenhouseOnly ? ' <span class="lock-tag">온실전용</span>' : ''} <span class="action-cost">보유 ${count}</span></button>`;
        }).join('')
      : '<div class="popup-empty-msg">보유한 씨앗이 없습니다.<br>상점에서 먼저 구매하세요.</div>';

    return `
      <div class="popup-title">${locLabel} ${plotIndex + 1}번 칸 <button class="popup-close" data-act="close">✕</button></div>
      <div class="popup-stats">
        <div class="popup-stat-row"><span>토양 수분</span><b>${Math.round(plot.moisture)}%</b></div>
        <div class="popup-stat-row"><span>토양 비옥도</span><b>${Math.round(plot.fertility)}%</b></div>
      </div>
      <div class="popup-seed-list">${seedButtons}</div>
    `;
  }

  const crop = CROPS[plot.cropId];
  const progressPct = plot.stage < 4 ? Math.min(100, Math.round((plot.progress / crop.stageDuration) * 100)) : 100;

  return `
    <div class="popup-title">${crop.emoji} ${crop.name} <button class="popup-close" data-act="close">✕</button></div>
    <div class="popup-stats">
      <div class="popup-stat-row"><span>생육 단계</span><b>${STAGE_NAMES[plot.stage]} (${progressPct}%)</b></div>
      <div class="popup-stat-row"><span>건강도</span><b>${Math.round(plot.health)}%</b></div>
      <div class="popup-stat-row"><span>토양 수분</span><b>${Math.round(plot.moisture)}%</b></div>
      <div class="popup-stat-row"><span>토양 비옥도</span><b>${Math.round(plot.fertility)}%</b></div>
      <div class="popup-stat-row"><span>잡초</span><b>${Math.round(plot.weedLevel)}%</b></div>
      <div class="popup-stat-row"><span>병해충</span><b class="${plot.hasPest ? 'popup-warn' : ''}">${plot.hasPest ? '발생함!' : '없음'}</b></div>
    </div>
    <button class="btn-action" data-act="water">💧 물 주기</button>
    <button class="btn-action" data-act="weed" ${plot.weedLevel < 5 ? 'disabled' : ''}>🌾 잡초 뽑기</button>
    <button class="btn-action" data-act="pest" ${!plot.hasPest ? 'disabled' : ''}>🧴 병해충 방제 <span class="action-cost">방제약 ${state.inventory.supplies.pesticide || 0}</span></button>
    <button class="btn-action" data-act="fert" ${plot.fertilizedUsed || !state.inventory.supplies.fertilizer ? 'disabled' : ''}>🌱 비료 주기 <span class="action-cost">비료 ${state.inventory.supplies.fertilizer || 0}</span></button>
    <button class="btn-action" data-act="harvest" ${plot.stage < 4 ? 'disabled' : ''}>🧺 수확하기</button>
  `;
}

function bindPopupButtons(loc, plotIndex) {
  const popup = document.getElementById('plot-popup');
  popup.querySelectorAll('[data-act]').forEach((btn) => {
    const act = btn.dataset.act;
    btn.addEventListener('click', () => {
      if (act === 'close') return closePopup();
      if (act === 'expand') return (loc === 'field' ? expandField() : expandGreenhouse());
      if (act === 'plant') return plantSeed(loc, plotIndex, btn.dataset.crop);
      if (act === 'water') return waterPlotAndRefresh(loc, plotIndex);
      if (act === 'weed') return removeWeedsAndRefresh(loc, plotIndex);
      if (act === 'pest') return treatPestAndRefresh(loc, plotIndex);
      if (act === 'fert') return fertilizePlotAndRefresh(loc, plotIndex);
      if (act === 'harvest') return harvestPlot(loc, plotIndex);
    });
  });
}

function waterPlotAndRefresh(loc, i) { waterPlot(loc, i); refreshPopup(); }
function removeWeedsAndRefresh(loc, i) { removeWeeds(loc, i); refreshPopup(); }
function treatPestAndRefresh(loc, i) { treatPest(loc, i); refreshPopup(); }
function fertilizePlotAndRefresh(loc, i) { fertilizePlot(loc, i); refreshPopup(); }

function openPlotPopup(loc, plotIndex, event) {
  popupState = { kind: 'plot', loc, index: plotIndex };
  const popup = document.getElementById('plot-popup');
  popup.innerHTML = buildPopupContent(loc, plotIndex);
  popup.classList.remove('hidden');
  document.getElementById('popup-backdrop').classList.remove('hidden');
  positionPopup(popup, event);
  bindPopupButtons(loc, plotIndex);
}

function buildPenPopupContent(penIndex) {
  const pen = state.ranch.pens[penIndex];

  if (!pen) {
    const isNext = penIndex === state.ranch.unlockedPens;
    if (!isNext) {
      return `<div class="popup-title">🔒 미개간 축사 <button class="popup-close" data-act="close">✕</button></div><div class="popup-empty-msg">앞 칸부터 순서대로 확장해야 합니다.</div>`;
    }
    const cost = computeRanchExpandCost(state.ranch.unlockedPens);
    return `
      <div class="popup-title">🔒 미개간 축사 <button class="popup-close" data-act="close">✕</button></div>
      <div class="popup-stats">새 축사 칸을 짓습니다.</div>
      <button class="btn-action btn-expand" data-act="expand-ranch" ${state.money < cost ? 'disabled' : ''}>🪓 축사 짓기 <span class="action-cost">${formatMoney(cost)}</span></button>
    `;
  }

  if (!pen.animalId) {
    const buttons = Object.values(ANIMALS).map((a) => `<button class="btn-action" data-act="buy-animal" data-animal="${a.id}" ${state.money < a.buyCost ? 'disabled' : ''}>${a.icon} ${a.name} 들이기 <span class="action-cost">${formatMoney(a.buyCost)}</span></button>`).join('');
    return `
      <div class="popup-title">빈 축사 <button class="popup-close" data-act="close">✕</button></div>
      <div class="popup-stats">동물을 들여 사육을 시작하세요.</div>
      ${buttons}
    `;
  }

  const animal = ANIMALS[pen.animalId];
  const progressPct = Math.min(100, Math.round((pen.progress / animal.cycleTicks) * 100));
  return `
    <div class="popup-title">${animal.icon} ${animal.name} <button class="popup-close" data-act="close">✕</button></div>
    <div class="popup-stats">
      <div class="popup-stat-row"><span>사료량</span><b>${Math.round(pen.feedLevel)}%</b></div>
      <div class="popup-stat-row"><span>건강도</span><b>${Math.round(pen.health)}%</b></div>
      <div class="popup-stat-row"><span>다음 생산까지</span><b>${progressPct}%</b></div>
    </div>
    <button class="btn-action" data-act="feed-pen" ${!state.inventory.supplies.feed ? 'disabled' : ''}>🌽 사료 주기 <span class="action-cost">사료 ${state.inventory.supplies.feed || 0}</span></button>
  `;
}

function bindPenPopupButtons(penIndex) {
  const popup = document.getElementById('plot-popup');
  popup.querySelectorAll('[data-act]').forEach((btn) => {
    const act = btn.dataset.act;
    btn.addEventListener('click', () => {
      if (act === 'close') return closePopup();
      if (act === 'expand-ranch') return expandRanch();
      if (act === 'buy-animal') return buyAnimalAndRefresh(penIndex, btn.dataset.animal);
      if (act === 'feed-pen') return feedPenAndRefresh(penIndex);
    });
  });
}

function buyAnimalAndRefresh(i, a) { buyAnimal(i, a); refreshPopup(); }
function feedPenAndRefresh(i) { feedPen(i); refreshPopup(); }

function openPenPopup(penIndex, event) {
  popupState = { kind: 'pen', index: penIndex };
  const popup = document.getElementById('plot-popup');
  popup.innerHTML = buildPenPopupContent(penIndex);
  popup.classList.remove('hidden');
  document.getElementById('popup-backdrop').classList.remove('hidden');
  positionPopup(popup, event);
  bindPenPopupButtons(penIndex);
}

function refreshPopup() {
  if (!popupState) return;
  const popup = document.getElementById('plot-popup');
  if (popup.classList.contains('hidden')) { popupState = null; return; }
  if (popupState.kind === 'plot') {
    popup.innerHTML = buildPopupContent(popupState.loc, popupState.index);
    bindPopupButtons(popupState.loc, popupState.index);
  } else if (popupState.kind === 'pen') {
    popup.innerHTML = buildPenPopupContent(popupState.index);
    bindPenPopupButtons(popupState.index);
  }
}

function closePopup() {
  popupState = null;
  document.getElementById('plot-popup').classList.add('hidden');
  document.getElementById('popup-backdrop').classList.add('hidden');
}

/* --------------------------------------------------------------------------
   21. 토스트 알림
   -------------------------------------------------------------------------- */

function showToast(message, type) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast' + (type === 'bad' ? ' toast-bad' : type === 'good' ? ' toast-good' : type === 'level' ? ' toast-level' : '');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}

/* --------------------------------------------------------------------------
   22. 탭 전환 / 초기화
   -------------------------------------------------------------------------- */

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.toggle('active', c.id === `tab-${activeTab}`));
    });
  });

  document.querySelectorAll('.field-subtab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.field-subtab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.farm-view').forEach((v) => v.classList.toggle('active', v.id === `${btn.dataset.view}-view`));
    });
  });
}

function init() {
  const hadSave = !!localStorage.getItem(SAVE_KEY);
  state = loadState();
  if (!hadSave) rollWeather(); // 새 게임일 때만 초기 날씨를 무작위로 굴린다

  setupTabs();
  document.getElementById('btn-save').addEventListener('click', () => { saveState(); showToast('저장했습니다.', 'good'); });
  document.getElementById('btn-reset').addEventListener('click', resetGame);
  document.getElementById('btn-bulk-water').addEventListener('click', bulkWaterAll);
  document.getElementById('btn-build-greenhouse').addEventListener('click', buildGreenhouse);
  document.getElementById('popup-backdrop').addEventListener('click', closePopup);

  window.addEventListener('beforeunload', saveState);

  renderAll();
  setInterval(gameTick, TICK_MS);
}

document.addEventListener('DOMContentLoaded', init);