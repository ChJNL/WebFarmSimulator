/* ==========================================================================
   흙내음 농장 — script.js  (2차 업데이트: 확장 / 농기구 / 시세 / 레벨)

   모듈 목차
   0. 상수 / 데이터 정의
   1. 유틸리티
   2. 상태(state) 생성 · 저장 · 불러오기 · 마이그레이션
   3. 환경(날씨·계절·시장) 시뮬레이션
   4. 밭(plot) 시뮬레이션 — 수분 / 잡초 / 건강도 / 성장
   5. 메인 게임 루프
   6. 레벨 / 경험치
   7. 플레이어 액션 (상점 · 농기구 · 밭 확장 · 작물 관리 · 판매)
   8. 렌더링 — 대시보드
   9. 렌더링 — 밭 그리드 (확장/잠금 포함)
   10. 렌더링 — 상점 / 인벤토리 / 시세
   11. 밭 칸 액션 팝업
   12. 토스트 알림
   13. 탭 전환 / 초기화
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   0. 상수 / 데이터 정의
   -------------------------------------------------------------------------- */

const SAVE_KEY = 'heulnaeum_farm_save_v2';

const GRID_COLS = 5;
const START_PLOTS = 6;     // 시작 시 개간된 밭 칸 수
const MAX_PLOTS = 20;      // 최대 확장 가능 칸 수 (5열 x 4행)
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
    seedPrice: 15, basePrice: 40, unlockLevel: 1,
    stageDuration: 1440,               // 4일
    tempOptimal: [20, 28], tempAccept: [14, 33],
    moistureOptimal: [45, 70],
    hint: '따뜻한 날씨를 좋아해요',
  },
  lettuce: {
    id: 'lettuce', name: '상추', emoji: '🥬',
    seedPrice: 8, basePrice: 22, unlockLevel: 1,
    stageDuration: 720,                // 2일
    tempOptimal: [9, 18], tempAccept: [2, 23],
    moistureOptimal: [58, 82],
    hint: '빨리 자라는 서늘한 잎채소예요',
  },
  potato: {
    id: 'potato', name: '감자', emoji: '🥔',
    seedPrice: 12, basePrice: 32, unlockLevel: 2,
    stageDuration: 1800,               // 5일
    tempOptimal: [12, 20], tempAccept: [5, 26],
    moistureOptimal: [50, 75],
    hint: '서늘한 날씨를 좋아해요',
  },
  corn: {
    id: 'corn', name: '옥수수', emoji: '🌽',
    seedPrice: 20, basePrice: 55, unlockLevel: 3,
    stageDuration: 2160,               // 6일
    tempOptimal: [22, 31], tempAccept: [16, 36],
    moistureOptimal: [40, 65],
    hint: '한여름에 잘 자라요',
  },
  strawberry: {
    id: 'strawberry', name: '딸기', emoji: '🍓',
    seedPrice: 25, basePrice: 70, unlockLevel: 4,
    stageDuration: 1080,               // 3일
    tempOptimal: [14, 22], tempAccept: [8, 27],
    moistureOptimal: [55, 78],
    hint: '봄가을 서늘한 날씨가 적합해요',
  },
  watermelon: {
    id: 'watermelon', name: '수박', emoji: '🍉',
    seedPrice: 40, basePrice: 120, unlockLevel: 5,
    stageDuration: 2520,               // 7일
    tempOptimal: [24, 32], tempAccept: [18, 37],
    moistureOptimal: [50, 72],
    hint: '무더운 여름, 긴 재배기간이 필요한 고급 작물이에요',
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

// 시장 시세: 하루에 한 번 소폭 랜덤 변동 (0.75배 ~ 1.35배)
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
};

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

function marketUnitPrice(crop, grade) {
  const marketMult = state.market[crop.id] || 1;
  return Math.round(crop.basePrice * GRADE_MULTIPLIER[grade] * marketMult);
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

function createDefaultState() {
  const field = Array.from({ length: MAX_PLOTS }, (_, i) => (i < START_PLOTS ? createEmptyPlot(i) : null));
  const market = {};
  const marketTrend = {};
  Object.keys(CROPS).forEach((id) => { market[id] = 1.0; marketTrend[id] = 'flat'; });

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
    },
    tools: { wateringCanLevel: 1, hoeLevel: 1 },
    unlockedCount: START_PLOTS,
    field,
    market,
    marketTrend,
    lastBulkWaterDay: 0,
  };
}

let state = createDefaultState();
let ticksSinceSave = 0;
let currentPopupPlotIndex = null;
let activeTab = 'shop';

function isValidState(s) {
  return s && s.time && s.inventory && Array.isArray(s.field);
}

// 이전 버전 저장 데이터에 새 필드가 없을 경우 기본값으로 보강한다.
function migrateState(s) {
  const d = createDefaultState();
  if (s.level === undefined) s.level = d.level;
  if (s.exp === undefined) s.exp = d.exp;
  if (!s.tools) s.tools = d.tools;
  if (s.tools.wateringCanLevel === undefined) s.tools.wateringCanLevel = 1;
  if (s.tools.hoeLevel === undefined) s.tools.hoeLevel = 1;
  if (!s.market) s.market = d.market;
  if (!s.marketTrend) s.marketTrend = d.marketTrend;
  Object.keys(CROPS).forEach((id) => {
    if (s.market[id] === undefined) s.market[id] = 1.0;
    if (s.marketTrend[id] === undefined) s.marketTrend[id] = 'flat';
  });
  if (s.lastBulkWaterDay === undefined) s.lastBulkWaterDay = 0;

  // 구버전(1차) 저장: field 길이가 고정 12칸짜리였던 경우 → 새 MAX_PLOTS 배열로 이식
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
  Object.keys(CROPS).forEach((cropId) => {
    const prev = state.market[cropId];
    const delta = randRange(-MARKET_DAILY_DRIFT, MARKET_DAILY_DRIFT);
    const next = clamp(prev + delta, MARKET_MIN, MARKET_MAX);
    state.market[cropId] = next;
    state.marketTrend[cropId] = next > prev + 0.004 ? 'up' : next < prev - 0.004 ? 'down' : 'flat';
  });
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

  // 하루가 지날 때마다 병해충 발생 확률 체크 (개간된 밭만)
  state.field.forEach((plot) => {
    if (plot && plot.cropId && !plot.hasPest) {
      if (Math.random() < 0.12) {
        plot.hasPest = true;
        const crop = CROPS[plot.cropId];
        showToast(`${plot.id + 1}번 밭의 ${crop.name}에 병해충이 발생했습니다!`, 'bad');
      }
    }
  });
}

function getEnv() {
  return {
    temperature: state.time.temperature,
    weatherId: state.time.weatherId,
    sunlight: WEATHER_TYPES[state.time.weatherId].sunlightMult,
  };
}

/* --------------------------------------------------------------------------
   4. 밭(plot) 시뮬레이션 — 수분 / 잡초 / 건강도 / 성장
   -------------------------------------------------------------------------- */

function rangeFactor(value, optimal, accept) {
  if (value >= optimal[0] && value <= optimal[1]) return 1.2;
  if (value >= accept[0] && value <= accept[1]) return 0.9;
  return 0.35;
}

function updatePlotMoisture(plot, env, ticks) {
  if (env.weatherId === 'rainy') {
    plot.moisture = clamp(plot.moisture + 3 * ticks, 0, 100); // 비 오는 날은 자동으로 채워짐 → 물주기 생략 가능
  } else {
    const evap = (0.55 + Math.max(0, env.temperature - 25) * 0.06) * ticks;
    plot.moisture = clamp(plot.moisture - evap, 0, 100);
  }
}

function updatePlotWeeds(plot, ticks) {
  if (!plot.cropId) return;
  const growthMult = TOOLS.hoe.levels[state.tools.hoeLevel - 1].weedGrowthMult;
  plot.weedLevel = clamp(plot.weedLevel + 0.45 * growthMult * ticks, 0, 100);
}

function killPlot(plot) {
  const crop = CROPS[plot.cropId];
  showToast(`${plot.id + 1}번 밭의 ${crop.name}이(가) 시들어 죽고 말았습니다...`, 'bad');
  resetPlotAfterCrop(plot, false);
}

// 완만해진 건강도 곡선: 적정범위를 살짝 벗어난 정도는 거의 상쇄되고,
// 심각하게 벗어나거나(허용범위 밖) 병해충이 있을 때만 확실히 타격을 준다.
function updatePlotHealth(plot, crop, env, ticks) {
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

  if (plot.health <= 0) killPlot(plot);
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

/* --------------------------------------------------------------------------
   5. 메인 게임 루프
   -------------------------------------------------------------------------- */

function gameTick() {
  state.time.minutes += MINUTES_PER_TICK;
  if (state.time.minutes >= DAY_MINUTES) {
    state.time.minutes -= DAY_MINUTES;
    advanceDay();
  }

  const env = getEnv();
  const ticks = MINUTES_PER_TICK / 30; // 기준 틱 단위 = 1

  state.field.forEach((plot) => {
    if (!plot) return; // 미개간 칸
    updatePlotMoisture(plot, env, ticks);
    if (plot.fertBoostTicks > 0) plot.fertBoostTicks -= 1;

    if (plot.cropId) {
      const crop = CROPS[plot.cropId];
      updatePlotWeeds(plot, ticks);
      updatePlotHealth(plot, crop, env, ticks);
      if (plot.cropId) updatePlotGrowth(plot, crop, env, MINUTES_PER_TICK);
    }
  });

  renderDashboard();
  renderField();
  if (currentPopupPlotIndex !== null) refreshPopup();

  ticksSinceSave += 1;
  if (ticksSinceSave >= 5) { ticksSinceSave = 0; saveState(); }
}

/* --------------------------------------------------------------------------
   6. 레벨 / 경험치
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
    const bonus = state.level * 40;
    state.money += bonus;
    const newlyUnlocked = Object.values(CROPS).filter((c) => c.unlockLevel === state.level);
    newlyUnlocked.forEach((c) => unlockedNames.push(`${c.emoji} ${c.name}`));
  }
  if (leveledUp) {
    const unlockMsg = unlockedNames.length ? ` · 신규 작물 해금: ${unlockedNames.join(', ')}` : '';
    showToast(`레벨 업! Lv.${state.level} 달성${unlockMsg}`, 'level');
  }
}

/* --------------------------------------------------------------------------
   7. 플레이어 액션
   -------------------------------------------------------------------------- */

function buySeed(cropId) {
  const crop = CROPS[cropId];
  if (state.level < crop.unlockLevel) { showToast(`Lv.${crop.unlockLevel}에 해금되는 작물입니다.`, 'bad'); return; }
  if (state.money < crop.seedPrice) { showToast('소지금이 부족합니다.', 'bad'); return; }
  state.money -= crop.seedPrice;
  state.inventory.seeds[cropId] = (state.inventory.seeds[cropId] || 0) + 1;
  showToast(`${crop.name} 씨앗을 구매했습니다.`, 'good');
  renderAll(); saveState();
}

function buySupply(itemId) {
  const item = SUPPLIES[itemId];
  if (state.money < item.price) { showToast('소지금이 부족합니다.', 'bad'); return; }
  state.money -= item.price;
  state.inventory.supplies[itemId] = (state.inventory.supplies[itemId] || 0) + 1;
  showToast(`${item.name}을(를) 구매했습니다.`, 'good');
  renderAll(); saveState();
}

function buyToolUpgrade(toolId) {
  const tool = TOOLS[toolId];
  const levelKey = toolId + 'Level';
  const currentLevel = state.tools[levelKey];
  if (currentLevel >= tool.levels.length) { showToast('이미 최고 단계입니다.', 'bad'); return; }
  const nextDef = tool.levels[currentLevel]; // 0-index → 현재 레벨이 곧 다음 단계 인덱스
  if (state.money < nextDef.cost) { showToast('소지금이 부족합니다.', 'bad'); return; }
  state.money -= nextDef.cost;
  state.tools[levelKey] = nextDef.level;
  showToast(`${tool.name}이(가) Lv.${nextDef.level}로 업그레이드되었습니다!`, 'good');
  renderAll(); saveState();
}

function expandField() {
  if (state.unlockedCount >= MAX_PLOTS) { showToast('더 이상 밭을 확장할 수 없습니다.', 'bad'); return; }
  const cost = computeExpandCost(state.unlockedCount);
  if (state.money < cost) { showToast('소지금이 부족합니다.', 'bad'); return; }
  state.money -= cost;
  state.field[state.unlockedCount] = createEmptyPlot(state.unlockedCount);
  state.unlockedCount += 1;
  showToast(`밭을 개간했습니다! (총 ${state.unlockedCount}칸)`, 'good');
  closePopup();
  renderAll(); saveState();
}

function plantSeed(plotIndex, cropId) {
  const plot = state.field[plotIndex];
  if (!plot || plot.cropId) return;
  if (!state.inventory.seeds[cropId]) { showToast('보유한 씨앗이 없습니다.', 'bad'); return; }
  state.inventory.seeds[cropId] -= 1;
  plot.cropId = cropId;
  plot.stage = 0;
  plot.progress = 0;
  plot.health = 100;
  plot.hasPest = false;
  plot.fertilizedUsed = false;
  plot.fertBoostTicks = 0;
  plot.healthSum = 0; plot.healthTicks = 0;
  plot.weedSum = 0; plot.weedTicks = 0;
  plot.pestTicks = 0;
  showToast(`${CROPS[cropId].name} 씨앗을 심었습니다.`, 'good');
  renderAll(); saveState();
  openPlotPopup(plotIndex);
}

function waterPlot(plotIndex) {
  const plot = state.field[plotIndex];
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
  state.lastBulkWaterDay = state.time.day;
  showToast('보유한 모든 밭에 물을 주었습니다.', 'good');
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

function removeWeeds(plotIndex) {
  const plot = state.field[plotIndex];
  if (!plot) return;
  const hadWeeds = plot.weedLevel > 8;
  plot.weedLevel = 0;

  const hoeDef = TOOLS.hoe.levels[state.tools.hoeLevel - 1];
  if (hoeDef.adjacentClearRatio > 0) {
    getAdjacentIndices(plotIndex).forEach((i) => {
      const adj = state.field[i];
      if (adj && adj.cropId) adj.weedLevel = clamp(adj.weedLevel * (1 - hoeDef.adjacentClearRatio), 0, 100);
    });
  }

  showToast('잡초를 제거했습니다.', 'good');
  if (hadWeeds) gainExp(EXP_REWARD.weed);
  renderAll();
}

function treatPest(plotIndex) {
  const plot = state.field[plotIndex];
  if (!plot) return;
  if (!state.inventory.supplies.pesticide) { showToast('방제약이 없습니다. 상점에서 구매하세요.', 'bad'); return; }
  state.inventory.supplies.pesticide -= 1;
  plot.hasPest = false;
  plot.health = clamp(plot.health + 15, 0, 100);
  showToast('병해충을 방제했습니다.', 'good');
  gainExp(EXP_REWARD.pest);
  renderAll(); saveState();
}

function fertilizePlot(plotIndex) {
  const plot = state.field[plotIndex];
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

function harvestPlot(plotIndex) {
  const plot = state.field[plotIndex];
  if (!plot || plot.stage < 4) return;
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

  const gradeExpMult = { '특': 3, '상': 2, '중': 1.4, '하': 1 }[grade];
  const exp = Math.round((8 + crop.seedPrice * 0.5) * gradeExpMult);

  showToast(`${crop.name} 수확! 등급 [${grade}] × ${yieldQty}`, 'good');
  resetPlotAfterCrop(plot, true);
  gainExp(exp);
  closePopup();
  renderAll(); saveState();
}

function sellHarvestStack(key) {
  const qty = state.inventory.harvest[key];
  if (!qty) return;
  const [cropId, grade] = key.split('_');
  const crop = CROPS[cropId];
  const total = marketUnitPrice(crop, grade) * qty;
  state.money += total;
  delete state.inventory.harvest[key];
  showToast(`${crop.name}(${grade}) ${qty}개를 ${formatMoney(total)}에 판매했습니다.`, 'good');
  renderAll(); saveState();
}

function resetGame() {
  const ok = window.confirm('정말 처음부터 다시 시작할까요? 모든 진행 상황이 삭제됩니다.');
  if (!ok) return;
  localStorage.removeItem(SAVE_KEY);
  state = createDefaultState();
  closePopup();
  renderAll(); saveState();
  showToast('새 농장을 시작합니다.', 'good');
}

/* --------------------------------------------------------------------------
   8. 렌더링 — 대시보드
   -------------------------------------------------------------------------- */

function renderDashboard() {
  document.getElementById('stat-money').textContent = formatMoney(state.money);
  document.getElementById('stat-level').textContent = `Lv.${state.level}`;
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
   9. 렌더링 — 밭 그리드 (확장 / 잠금 포함)
   -------------------------------------------------------------------------- */

function stageIcon(crop, stage) {
  if (stage === 0) return '🌰';
  if (stage === 1) return '🌱';
  if (stage === 2) return '🌿';
  return crop.emoji;
}

function renderField() {
  const grid = document.getElementById('field-grid');
  grid.innerHTML = '';
  document.getElementById('field-count-label').textContent = `(${state.unlockedCount} / ${MAX_PLOTS}칸)`;

  for (let i = 0; i < MAX_PLOTS; i++) {
    const plot = state.field[i];
    const cell = document.createElement('div');

    if (!plot) {
      const isNext = i === state.unlockedCount;
      cell.className = 'plot is-locked' + (isNext ? '' : ' is-far');
      cell.innerHTML = `<div class="plot-lock-icon">🔒</div>` + (isNext ? `<div class="plot-lock-cost">${formatMoney(computeExpandCost(state.unlockedCount))}</div>` : '');
      cell.addEventListener('click', (e) => openPlotPopup(i, e));
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

    cell.addEventListener('click', (e) => openPlotPopup(plot.id, e));
    grid.appendChild(cell);
  }
}

/* --------------------------------------------------------------------------
   10. 렌더링 — 상점 / 인벤토리 / 시세
   -------------------------------------------------------------------------- */

function renderMarketTicker() {
  const el = document.getElementById('market-ticker');
  el.innerHTML = '';
  Object.values(CROPS).forEach((crop) => {
    if (state.level < crop.unlockLevel) return;
    const mult = state.market[crop.id] || 1;
    const trend = state.marketTrend[crop.id] || 'flat';
    const arrow = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—';
    const pct = Math.round((mult - 1) * 100);
    const pctLabel = pct > 0 ? `+${pct}%` : `${pct}%`;
    const row = document.createElement('div');
    row.className = 'market-row';
    row.innerHTML = `
      <span class="m-name">${crop.emoji} ${crop.name}</span>
      <span class="m-trend ${trend}">${arrow} ${pctLabel}</span>
    `;
    el.appendChild(row);
  });
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
          <span class="item-name">${crop.name} 씨앗</span>
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
}

function renderAll() {
  renderDashboard();
  renderField();
  renderShop();
  renderInventory();
}

/* --------------------------------------------------------------------------
   11. 밭 칸 액션 팝업
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

function buildPopupContent(plotIndex) {
  const plot = state.field[plotIndex];

  // 잠긴 칸: 개간(확장) 팝업
  if (!plot) {
    const isNext = plotIndex === state.unlockedCount;
    if (!isNext) {
      return `
        <div class="popup-title">🔒 미개간지 <button class="popup-close" data-act="close">✕</button></div>
        <div class="popup-empty-msg">앞 칸부터 순서대로 개간해야 합니다.</div>
      `;
    }
    const cost = computeExpandCost(state.unlockedCount);
    return `
      <div class="popup-title">🔒 미개간지 <button class="popup-close" data-act="close">✕</button></div>
      <div class="popup-stats">이 땅을 개간하면 새 밭 한 칸이 생깁니다.</div>
      <button class="btn-action btn-expand" data-act="expand" ${state.money < cost ? 'disabled' : ''}>🪓 개간하기 <span class="action-cost">${formatMoney(cost)}</span></button>
    `;
  }

  if (!plot.cropId) {
    const ownedSeeds = Object.entries(state.inventory.seeds).filter(([, c]) => c > 0);
    const seedButtons = ownedSeeds.length
      ? ownedSeeds.map(([cropId, count]) => {
          const crop = CROPS[cropId];
          return `<button class="btn-action" data-act="plant" data-crop="${cropId}">${crop.emoji} ${crop.name} 파종하기 <span class="action-cost">보유 ${count}</span></button>`;
        }).join('')
      : '<div class="popup-empty-msg">보유한 씨앗이 없습니다.<br>상점에서 먼저 구매하세요.</div>';

    return `
      <div class="popup-title">${plotIndex + 1}번 밭 <button class="popup-close" data-act="close">✕</button></div>
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

function openPlotPopup(plotIndex, event) {
  currentPopupPlotIndex = plotIndex;
  const popup = document.getElementById('plot-popup');
  popup.innerHTML = buildPopupContent(plotIndex);
  popup.classList.remove('hidden');
  document.getElementById('popup-backdrop').classList.remove('hidden');
  positionPopup(popup, event);
  bindPopupButtons(plotIndex);
}

function refreshPopup() {
  if (currentPopupPlotIndex === null) return;
  const popup = document.getElementById('plot-popup');
  if (popup.classList.contains('hidden')) { currentPopupPlotIndex = null; return; }
  popup.innerHTML = buildPopupContent(currentPopupPlotIndex);
  bindPopupButtons(currentPopupPlotIndex);
}

function bindPopupButtons(plotIndex) {
  const popup = document.getElementById('plot-popup');
  popup.querySelectorAll('[data-act]').forEach((btn) => {
    const act = btn.dataset.act;
    btn.addEventListener('click', () => {
      if (act === 'close') return closePopup();
      if (act === 'expand') return expandField();
      if (act === 'plant') return plantSeed(plotIndex, btn.dataset.crop);
      if (act === 'water') return waterPlotAndRefresh(plotIndex);
      if (act === 'weed') return removeWeedsAndRefresh(plotIndex);
      if (act === 'pest') return treatPestAndRefresh(plotIndex);
      if (act === 'fert') return fertilizePlotAndRefresh(plotIndex);
      if (act === 'harvest') return harvestPlot(plotIndex);
    });
  });
}

function waterPlotAndRefresh(i) { waterPlot(i); refreshPopup(); }
function removeWeedsAndRefresh(i) { removeWeeds(i); refreshPopup(); }
function treatPestAndRefresh(i) { treatPest(i); refreshPopup(); }
function fertilizePlotAndRefresh(i) { fertilizePlot(i); refreshPopup(); }

function closePopup() {
  currentPopupPlotIndex = null;
  document.getElementById('plot-popup').classList.add('hidden');
  document.getElementById('popup-backdrop').classList.add('hidden');
}

/* --------------------------------------------------------------------------
   12. 토스트 알림
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
   13. 탭 전환 / 초기화
   -------------------------------------------------------------------------- */

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.toggle('active', c.id === `tab-${activeTab}`));
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
  document.getElementById('popup-backdrop').addEventListener('click', closePopup);

  window.addEventListener('beforeunload', saveState);

  renderAll();
  setInterval(gameTick, TICK_MS);
}

document.addEventListener('DOMContentLoaded', init);