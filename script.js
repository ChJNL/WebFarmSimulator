'use strict';

/* =========================================================
   기본 설정
========================================================= */

const STORAGE_KEY = 'farm_sim_prototype_v1';

const FIELD_ROWS = 4;
const FIELD_COLS = 6;
const FIELD_SIZE =
  FIELD_ROWS * FIELD_COLS;

const REAL_TICK_MS = 1000;

/*
  실제 1초 = 게임 5분
  실제 12초 = 게임 1시간
  실제 약 288초 = 게임 1일
*/
const GAME_MINUTES_PER_REAL_SECOND = 5;

const GAME_DAY_MINUTES = 24 * 60;

const WEATHER_REWIND_DAYS = 90;


/* =========================================================
   작물 데이터
========================================================= */

const CROPS = {
  tomato: {
    id: 'tomato',
    name: '방울토마토',
    icon: '🍅',

    seedPrice: 900,
    sellPrice: 2600,

    growthHours: 72,

    optimalTemp: [18, 28],
    optimalMoisture: [45, 75],
    optimalSun: [55, 100],

    baseQuality: 66,
    baseHealth: 100
  },

  lettuce: {
    id: 'lettuce',
    name: '상추',
    icon: '🥬',

    seedPrice: 500,
    sellPrice: 1500,

    growthHours: 36,

    optimalTemp: [12, 24],
    optimalMoisture: [55, 85],
    optimalSun: [45, 90],

    baseQuality: 62,
    baseHealth: 100
  },

  strawberry: {
    id: 'strawberry',
    name: '딸기',
    icon: '🍓',

    seedPrice: 1100,
    sellPrice: 3400,

    growthHours: 96,

    optimalTemp: [14, 22],
    optimalMoisture: [50, 80],
    optimalSun: [60, 100],

    baseQuality: 64,
    baseHealth: 100
  },

  wheat: {
    id: 'wheat',
    name: '밀',
    icon: '🌾',

    seedPrice: 300,
    sellPrice: 1000,

    growthHours: 60,

    optimalTemp: [10, 25],
    optimalMoisture: [35, 70],
    optimalSun: [50, 100],

    baseQuality: 58,
    baseHealth: 100
  }
};


/* =========================================================
   농자재 데이터
========================================================= */

const INPUT_ITEMS = {
  fertilizer: {
    id: 'fertilizer',
    name: '유기질 비료',
    icon: '🪴',
    buyPrice: 700,
    kind: 'input'
  },

  pesticide: {
    id: 'pesticide',
    name: '친환경 농약',
    icon: '🧴',
    buyPrice: 850,
    kind: 'input'
  },

  water: {
    id: 'water',
    name: '물통',
    icon: '💧',
    buyPrice: 120,
    kind: 'input'
  }
};


/* =========================================================
   날씨
========================================================= */

const WEATHER_TYPES = {
  sunny: {
    name: '맑음',
    icon: '☀️',
    tempBase: 23,
    sun: 100,
    rain: 0
  },

  cloudy: {
    name: '구름 많음',
    icon: '⛅',
    tempBase: 19,
    sun: 65,
    rain: 0.1
  },

  rainy: {
    name: '비',
    icon: '🌧️',
    tempBase: 17,
    sun: 35,
    rain: 0.9
  },

  windy: {
    name: '강풍',
    icon: '🌬️',
    tempBase: 16,
    sun: 55,
    rain: 0.03
  }
};


/* =========================================================
   계절
========================================================= */

const SEASONS = [
  {
    name: '봄',
    months: [3, 4, 5],
    tempOffset: 2
  },

  {
    name: '여름',
    months: [6, 7, 8],
    tempOffset: 6
  },

  {
    name: '가을',
    months: [9, 10, 11],
    tempOffset: 0
  },

  {
    name: '겨울',
    months: [12, 1, 2],
    tempOffset: -6
  }
];


/* =========================================================
   게임 상태
========================================================= */

let state =
  createDefaultState();

let selectedCellIndex = null;

let currentMarketTab = 'buy';

let lastTickTimestamp =
  Date.now();

let toastTimer = null;

let tutorialStep = 0;


/* =========================================================
   튜토리얼 데이터
========================================================= */

const TUTORIAL_STEPS = [
  {
    icon: '🌱',

    kicker: '1단계 · 농장 살펴보기',

    title: '가장 먼저 밭을 확인하세요',

    description:
      '화면 중앙의 밭은 24시간 실제 농장처럼 상태가 변합니다. 각 칸을 클릭하면 현재 작물과 토양 상태를 상세하게 확인할 수 있습니다.',

    body: `
      <h3>밭 한 칸을 클릭해 보세요</h3>

      <p>
        빈 밭에서는 씨앗을 심을 수 있고,
        작물이 자라기 시작하면 성장도·건강도·수분·비옥도와
        잡초·병해충 상태를 확인할 수 있습니다.
      </p>

      <div class="tutorial-feature-grid">
        <div class="tutorial-feature">
          <strong>🟫 빈 밭</strong>
          <span>씨앗을 선택해 파종합니다.</span>
        </div>

        <div class="tutorial-feature">
          <strong>🌱 성장 중</strong>
          <span>환경을 관리하며 성장시킵니다.</span>
        </div>

        <div class="tutorial-feature">
          <strong>🐛 위협 발생</strong>
          <span>잡초와 병해충을 방치하지 마세요.</span>
        </div>

        <div class="tutorial-feature">
          <strong>🧺 수확 가능</strong>
          <span>100%가 되면 수확할 수 있습니다.</span>
        </div>
      </div>
    `
  },

  {
    icon: '💧',

    kicker: '2단계 · 작물 관리',

    title: '농작물은 환경에 반응합니다',

    description:
      '성장은 단순한 시간 경과가 아닙니다. 온도·일조량·토양 수분·비옥도와 관리 상태가 성장 속도와 건강도에 영향을 줍니다.',

    body: `
      <h3>작물 상태를 계속 관리하세요</h3>

      <div class="tutorial-feature-grid">
        <div class="tutorial-feature">
          <strong>💧 물주기</strong>
          <span>토양이 건조하면 수분을 보충하세요.</span>
        </div>

        <div class="tutorial-feature">
          <strong>🌿 잡초 제거</strong>
          <span>잡초는 성장 속도와 건강도에 악영향을 줍니다.</span>
        </div>

        <div class="tutorial-feature">
          <strong>🧴 병해충 방제</strong>
          <span>발생 즉시 농약으로 피해를 줄이세요.</span>
        </div>

        <div class="tutorial-feature">
          <strong>✨ 비료</strong>
          <span>성장 부스트와 최종 품질 향상에 도움을 줍니다.</span>
        </div>
      </div>

      <div class="tutorial-tip">
        💡 모든 작물의 적정 온도와 수분 범위가 다릅니다.
        상점과 밭 상세 화면에서 작물별 기준을 확인할 수 있습니다.
      </div>
    `
  },

  {
    icon: '🌦️',

    kicker: '3단계 · 날씨와 시간',

    title: '날씨와 게임 시간이 계속 흐릅니다',

    description:
      '게임 시간은 실제 시간보다 빠르게 진행됩니다. 하루가 지나면 날씨가 달라지고, 시간대에 따라 일조량과 온도도 변합니다.',

    body: `
      <h3>상단 대시보드를 자주 확인하세요</h3>

      <div class="tutorial-feature-grid">
        <div class="tutorial-feature">
          <strong>☀️ 날씨</strong>
          <span>맑음·구름·비·강풍이 작물 환경을 바꿉니다.</span>
        </div>

        <div class="tutorial-feature">
          <strong>🌡️ 온도</strong>
          <span>작물의 적정 온도에서 성장 효율이 높습니다.</span>
        </div>

        <div class="tutorial-feature">
          <strong>☀️ 일조량</strong>
          <span>낮 시간과 날씨에 따라 달라집니다.</span>
        </div>

        <div class="tutorial-feature">
          <strong>🕒 게임 시간</strong>
          <span>시간이 흐르며 작물 성장과 수분 변화가 진행됩니다.</span>
        </div>
      </div>
    `
  },

  {
    icon: '🛒',

    kicker: '4단계 · 경제와 인벤토리',

    title: '씨앗과 농자재를 사고 수확물을 판매하세요',

    description:
      '농장의 돈은 재배를 통해 순환합니다. 상점에서 필요한 자원을 사고, 좋은 품질의 수확물을 판매해 자금을 늘리세요.',

    body: `
      <h3>기본적인 농장 운영 순서</h3>

      <div class="tutorial-feature-grid">
        <div class="tutorial-feature">
          <strong>1. 씨앗 구매</strong>
          <span>오른쪽 MARKET의 구매 탭에서 구입합니다.</span>
        </div>

        <div class="tutorial-feature">
          <strong>2. 파종과 관리</strong>
          <span>밭을 클릭해 씨앗을 심고 관리합니다.</span>
        </div>

        <div class="tutorial-feature">
          <strong>3. 수확</strong>
          <span>성숙하면 수확하여 인벤토리에 넣습니다.</span>
        </div>

        <div class="tutorial-feature">
          <strong>4. 판매</strong>
          <span>MARKET → 판매 탭에서 수확물을 판매합니다.</span>
        </div>
      </div>

      <div class="tutorial-tip">
        🎒 인벤토리에서는 씨앗·수확물·비료·농약·물통의
        현재 보유량을 확인할 수 있습니다.
      </div>
    `
  },

  {
    icon: '🏆',

    kicker: '5단계 · 품질과 목표',

    title: '결국 좋은 농산물을 만드는 것이 목표입니다',

    description:
      '수확 품질은 건강도, 환경 관리, 비료 사용, 잡초와 병해충 방어 상태가 종합되어 결정됩니다.',

    body: `
      <h3>좋은 품질을 만드는 핵심</h3>

      <div class="tutorial-feature-grid">
        <div class="tutorial-feature">
          <strong>🌡️ 적정 환경</strong>
          <span>온도·일조·수분을 작물에 맞게 유지하세요.</span>
        </div>

        <div class="tutorial-feature">
          <strong>❤️ 건강한 작물</strong>
          <span>위협과 스트레스를 줄여 건강도를 지키세요.</span>
        </div>

        <div class="tutorial-feature">
          <strong>✨ 비료 활용</strong>
          <span>성장과 품질을 높이는 데 활용할 수 있습니다.</span>
        </div>

        <div class="tutorial-feature">
          <strong>💰 판매 수익</strong>
          <span>높은 등급일수록 더 높은 가격을 기대할 수 있습니다.</span>
        </div>
      </div>

      <div class="tutorial-tip">
        저장은 자동으로 이루어지며, 브라우저의 LocalStorage에
        농장 상태가 보관됩니다.
        이제 밭을 선택해 첫 작물을 심어보세요!
      </div>
    `
  }
];


/* =========================================================
   초기 상태
========================================================= */

function createDefaultState() {
  return {
    version: 1,

    money: 12000,

    gameTime:
      new Date(
        '2026-09-01T06:00:00+09:00'
      ).getTime(),

    weather: 'sunny',

    weatherSeedDay: null,

    lastSavedAt:
      Date.now(),

    tutorialSeen: false,

    inventory: {
      seeds: {
        tomato: 2,
        lettuce: 4,
        strawberry: 1,
        wheat: 5
      },

      harvest: {
        tomato: 0,
        lettuce: 0,
        strawberry: 0,
        wheat: 0
      },

      inputs: {
        fertilizer: 3,
        pesticide: 2,
        water: 18
      }
    },

    field:
      Array.from(
        {
          length: FIELD_SIZE
        },
        (_, i) =>
          createEmptyCell(i)
      )
  };
}


/* =========================================================
   빈 밭 생성
========================================================= */

function createEmptyCell(index) {
  return {
    id: index,

    cropId: null,

    growth: 0,

    health: 100,

    moisture: 52,

    fertility: 68,

    weed: false,

    pests: false,

    fertilized: false,

    plantedAt: null,

    lastTickAt: null,

    diseasePressure: 0,

    qualityScore: 0,

    dead: false
  };
}


/* =========================================================
   초기화
========================================================= */

function init() {
  const hasSavedGame =
    loadGame();

  normalizeState();

  updateWeather(true);

  bindUI();

  renderAll();

  lastTickTimestamp =
    Date.now();

  setInterval(
    gameTick,
    REAL_TICK_MS
  );

  window.addEventListener(
    'beforeunload',
    saveGame
  );

  /*
    첫 실행에서는 자동으로
    튜토리얼을 띄운다.
  */
  if (
    !hasSavedGame ||
    !state.tutorialSeen
  ) {
    setTimeout(
      () => openTutorial(false),
      250
    );
  }
}


/* =========================================================
   이벤트 연결
========================================================= */

function bindUI() {
  /* 인벤토리 */
  document
    .getElementById(
      'inventory-btn'
    )
    .addEventListener(
      'click',
      openInventory
    );

  /* 사용법 */
  document
    .getElementById(
      'help-btn'
    )
    .addEventListener(
      'click',
      () => openTutorial(false)
    );

  /* 저장 */
  document
    .getElementById(
      'save-btn'
    )
    .addEventListener(
      'click',
      () => {
        saveGame();

        showToast(
          '게임이 저장되었습니다.'
        );
      }
    );

  /* 새 게임 */
  document
    .getElementById(
      'reset-btn'
    )
    .addEventListener(
      'click',
      resetGame
    );

  /* 밭 모달 닫기 */
  document
    .querySelectorAll(
      '[data-close-modal]'
    )
    .forEach(
      el =>
        el.addEventListener(
          'click',
          closeCellModal
        )
    );

  /* 인벤토리 닫기 */
  document
    .querySelectorAll(
      '[data-close-inventory]'
    )
    .forEach(
      el =>
        el.addEventListener(
          'click',
          closeInventory
        )
    );

  /* 튜토리얼 닫기 */
  document
    .querySelectorAll(
      '[data-close-tutorial]'
    )
    .forEach(
      el =>
        el.addEventListener(
          'click',
          () =>
            finishTutorial()
        )
    );

  /* 튜토리얼 이전 */
  document
    .getElementById(
      'tutorial-prev'
    )
    .addEventListener(
      'click',
      tutorialPrev
    );

  /* 튜토리얼 다음 */
  document
    .getElementById(
      'tutorial-next'
    )
    .addEventListener(
      'click',
      tutorialNext
    );

  /* 튜토리얼 건너뛰기 */
  document
    .getElementById(
      'tutorial-skip'
    )
    .addEventListener(
      'click',
      finishTutorial
    );

  /* 상점 탭 */
  document
    .querySelectorAll(
      '.tab-btn'
    )
    .forEach(
      btn => {
        btn.addEventListener(
          'click',
          () => {
            currentMarketTab =
              btn.dataset.tab;

            renderMarket();
          }
        );
      }
    );

  /* ESC */
  document.addEventListener(
    'keydown',
    e => {
      if (
        e.key ===
        'Escape'
      ) {
        closeCellModal();

        closeInventory();

        finishTutorial();
      }
    }
  );
}


/* =========================================================
   게임 시간
========================================================= */

function gameTick() {
  const now =
    Date.now();

  const elapsedSeconds =
    Math.max(
      0,
      Math.min(
        (now -
          lastTickTimestamp) /
          1000,
        20
      )
    );

  lastTickTimestamp =
    now;

  if (
    elapsedSeconds > 0
  ) {
    state.gameTime +=
      elapsedSeconds *
      GAME_MINUTES_PER_REAL_SECOND *
      60 *
      1000;

    simulateField(
      elapsedSeconds *
        GAME_MINUTES_PER_REAL_SECOND /
        60
    );

    updateWeather();

    renderAll();
  }

  /* 자동 저장 */
  if (
    now -
      state.lastSavedAt >
    30000
  ) {
    saveGame(false);
  }
}


/* =========================================================
   작물 시뮬레이션
========================================================= */

function simulateField(
  gameHours
) {
  if (
    gameHours <= 0
  ) {
    return;
  }

  const weather =
    WEATHER_TYPES[
      state.weather
    ];

  const env =
    getEnvironment();

  state.field.forEach(
    cell => {
      /*
        빈 밭
      */
      if (
        !cell.cropId ||
        cell.dead
      ) {
        if (
          !cell.cropId
        ) {
          cell.moisture =
            Math.max(
              0,
              cell.moisture -
                getMoistureLoss(
                  env,
                  weather,
                  0.3
                )
            );

          /*
            빈 밭에도 잡초 발생
          */
          if (
            !cell.weed &&
            Math.random() <
              gameHours /
                72
          ) {
            cell.weed =
              true;
          }
        }

        return;
      }

      const crop =
        CROPS[
          cell.cropId
        ];

      /*
        환경 점수
      */
      const tempScore =
        rangeScore(
          env.temperature,
          crop.optimalTemp
        );

      const moistureScore =
        rangeScore(
          cell.moisture,
          crop.optimalMoisture
        );

      const sunScore =
        rangeScore(
          env.sunPercent,
          crop.optimalSun
        );

      const fertilityScore =
        clamp(
          cell.fertility /
            100,
          0,
          1
        );

      /*
        위협 및 건강도 페널티
      */
      const weedPenalty =
        cell.weed
          ? 0.72
          : 1;

      const pestPenalty =
        cell.pests
          ? 0.55
          : 1;

      const healthPenalty =
        clamp(
          cell.health /
            100,
          0,
          1
        );

      /*
        비료 효과
      */
      const fertilizerBoost =
        cell.fertilized
          ? 1.16
          : 1;

      /*
        종합 성장 계수
      */
      const overall =
        (
          0.35 *
            tempScore +
          0.30 *
            moistureScore +
          0.18 *
            sunScore +
          0.17 *
            fertilityScore
        ) *
        weedPenalty *
        pestPenalty *
        (
          0.65 +
          0.35 *
            healthPenalty
        ) *
        fertilizerBoost;

      /*
        성장
      */
      const stageTarget =
        cell.growth >= 100
          ? 100
          : cell.growth +
            (
              gameHours /
              crop.growthHours
            ) *
            100 *
            overall;

      cell.growth =
        clamp(
          stageTarget,
          0,
          100
        );

      /*
        수분 소모
      */
      cell.moisture =
        clamp(
          cell.moisture -
            getMoistureLoss(
              env,
              weather,
              1
            ) *
              gameHours,
          0,
          100
        );

      /*
        비옥도 감소
      */
      cell.fertility =
        clamp(
          cell.fertility -
            (
              0.7 *
              gameHours /
              24
            ),
          0,
          100
        );

      /*
        건강도
      */
      let healthDelta =
        0;

      if (
        cell.moisture <
          crop
            .optimalMoisture[0] -
            18 ||
        cell.moisture >
          crop
            .optimalMoisture[1] +
            12
      ) {
        healthDelta -=
          1.4 *
          gameHours;
      }

      if (
        tempScore <
        0.5
      ) {
        healthDelta -=
          0.9 *
          gameHours;
      }

      if (
        cell.pests
      ) {
        healthDelta -=
          2.2 *
          gameHours;
      }

      if (
        cell.weed
      ) {
        healthDelta -=
          0.75 *
          gameHours;
      }

      /*
        환경이 좋은 경우 건강도 회복
      */
      if (
        overall > 0.78 &&
        !cell.pests &&
        !cell.weed
      ) {
        healthDelta +=
          0.15 *
          gameHours;
      }

      cell.health =
        clamp(
          cell.health +
            healthDelta,
          0,
          100
        );

      /*
        잡초 발생 확률
      */
      const weedChance =
        (
          0.018 +
          (
            100 -
            cell.fertility
          ) *
            0.00012
        ) *
        gameHours;

      /*
        병해충 발생 확률
      */
      const pestChance =
        (
          0.009 +
          (
            35 -
            cell.health
          ) *
            0.00018 +
          (
            env.humidity >
            75
              ? 0.01
              : 0
          )
        ) *
        gameHours;

      if (
        !cell.weed &&
        Math.random() <
          weedChance
      ) {
        cell.weed =
          true;
      }

      if (
        !cell.pests &&
        Math.random() <
          pestChance
      ) {
        cell.pests =
          true;
      }

      /*
        병해충 압력 증가
      */
      if (
        cell.pests &&
        Math.random() <
          (
            gameHours /
            120
          )
      ) {
        cell.diseasePressure =
          clamp(
            cell.diseasePressure +
              2 +
              Math.random() * 8,
            0,
            100
          );
      }

      /*
        건강도가 0이면 고사
      */
      if (
        cell.health <=
        0
      ) {
        cell.dead =
          true;

        cell.growth =
          0;

        cell.qualityScore =
          0;
      }
    }
  );

  /*
    비가 오면 토양 수분 증가
  */
  if (
    weather.rain >
    0.5
  ) {
    state.field.forEach(
      cell => {
        cell.moisture =
          clamp(
            cell.moisture +
              9 *
                gameHours,
            0,
            100
          );
      }
    );
  }
}


/* =========================================================
   토양 수분 손실
========================================================= */

function getMoistureLoss(
  env,
  weather,
  factor
) {
  const heatFactor =
    Math.max(
      0.4,
      (
        env.temperature -
        10
      ) /
        20
    );

  const sunFactor =
    Math.max(
      0.35,
      env.sunPercent /
        100
    );

  const rainFactor =
    weather.rain >
    0.6
      ? 0.2
      : 1;

  return (
    0.28 *
    heatFactor *
    sunFactor *
    rainFactor *
    factor
  );
}


/* =========================================================
   환경
========================================================= */

function getEnvironment() {
  const d =
    new Date(
      state.gameTime
    );

  const hour =
    d.getHours() +
    d.getMinutes() /
      60;

  const season =
    getSeason(d);

  const weather =
    WEATHER_TYPES[
      state.weather
    ];

  const daylight =
    daylightFactor(
      hour
    );

  const temperature =
    weather.tempBase +
    season.tempOffset +
    dailyTemperatureWave(
      hour
    ) +
    (
      Math.random() *
        0.5 -
      0.25
    );

  const sunPercent =
    weather.sun *
    daylight;

  const humidity =
    weather.rain > 0.5
      ? 80
      : weather.name ===
          '구름 많음'
        ? 65
        : 48;

  return {
    hour,
    season,
    temperature,
    sunPercent,
    humidity
  };
}


/* =========================================================
   일조량
========================================================= */

function daylightFactor(
  hour
) {
  if (
    hour < 6 ||
    hour > 19
  ) {
    return 0.05;
  }

  const peak =
    12.5;

  const distance =
    Math.abs(
      hour - peak
    ) /
    6.5;

  return clamp(
    1 -
      distance *
        0.85,
    0.08,
    1
  );
}


/* =========================================================
   하루 온도 변화
========================================================= */

function dailyTemperatureWave(
  hour
) {
  return (
    Math.sin(
      (
        (hour - 7) /
          24
      ) *
        Math.PI *
        2
    ) * 3
  );
}


/* =========================================================
   계절
========================================================= */

function getSeason(
  date
) {
  const month =
    date.getMonth() +
    1;

  return (
    SEASONS.find(
      season =>
        season.months.includes(
          month
        )
    ) ||
    SEASONS[0]
  );
}


/* =========================================================
   날씨 갱신
========================================================= */

function updateWeather(
  force = false
) {
  const date =
    new Date(
      state.gameTime
    );

  const dayKey =
    date
      .toISOString()
      .slice(
        0,
        10
      );

  if (
    !force &&
    state.weatherSeedDay ===
      dayKey
  ) {
    return;
  }

  const hour =
    date.getHours();

  if (
    force &&
    state.weatherSeedDay ===
      dayKey
  ) {
    return;
  }

  const roll =
    Math.random();

  if (
    roll < 0.5
  ) {
    state.weather =
      'sunny';
  }

  else if (
    roll < 0.74
  ) {
    state.weather =
      'cloudy';
  }

  else if (
    roll < 0.91
  ) {
    state.weather =
      'rainy';
  }

  else {
    state.weather =
      'windy';
  }

  state.weatherSeedDay =
    dayKey;

  /*
    야간에 추가 강수
  */
  if (
    hour >= 0 &&
    hour < 5 &&
    state.weather ===
      'sunny' &&
    Math.random() <
      0.08
  ) {
    state.weather =
      'rainy';
  }
}


/* =========================================================
   전체 렌더
========================================================= */

function renderAll() {
  renderDashboard();

  renderField();

  renderMarket();

  renderFieldSummary();

  if (
    !document
      .getElementById(
        'inventory-modal'
      )
      .classList.contains(
        'hidden'
      )
  ) {
    renderInventory();
  }

  if (
    selectedCellIndex !==
      null &&
    !document
      .getElementById(
        'cell-modal'
      )
      .classList.contains(
        'hidden'
      )
  ) {
    renderCellModal(
      selectedCellIndex
    );
  }
}


/* =========================================================
   대시보드
========================================================= */

function renderDashboard() {
  const env =
    getEnvironment();

  const date =
    new Date(
      state.gameTime
    );

  document.getElementById(
    'money'
  ).textContent =
    formatMoney(
      state.money
    );

  document.getElementById(
    'game-date'
  ).textContent =
    `${
      date.getMonth() + 1
    }월 ${
      date.getDate()
    }일 · ${
      env.season.name
    }`;

  document.getElementById(
    'weather'
  ).textContent =
    `${
      WEATHER_TYPES[
        state.weather
      ].icon
    } ${
      WEATHER_TYPES[
        state.weather
      ].name
    }`;

  document.getElementById(
    'temperature'
  ).textContent =
    `${env.temperature.toFixed(
      1
    )}°C · 일조 ${Math.round(
      env.sunPercent
    )}%`;

  document.getElementById(
    'game-time'
  ).textContent =
    formatTime(date);
}


/* =========================================================
   밭 렌더
========================================================= */

function renderField() {
  const grid =
    document.getElementById(
      'field-grid'
    );

  grid.innerHTML = '';

  state.field.forEach(
    (
      cell,
      index
    ) => {
      const div =
        document.createElement(
          'div'
        );

      div.className =
        `field-cell${
          cell.dead
            ? ' dead'
            : ''
        }`;

      div.addEventListener(
        'click',
        () =>
          openCellModal(
            index
          )
      );

      const crop =
        cell.cropId
          ? CROPS[
              cell.cropId
            ]
          : null;

      const statusClass =
        getCellStatusClass(
          cell,
          crop
        );

      const moistureLabel =
        cell.moisture >=
        60
          ? '수분 충분'
          : cell.moisture >=
            35
            ? '수분 보통'
            : '건조';

      div.innerHTML = `
        <div class="cell-top">
          <span class="cell-number">
            밭 ${index + 1}
          </span>

          <span
            class="cell-status-dot ${statusClass}"
          ></span>
        </div>

        <div class="cell-plant">
          ${
            cell.dead
              ? `
                <div class="plant-emoji">
                  🥀
                </div>

                <div class="plant-name">
                  고사함
                </div>
              `
              : crop
                ? `
                  <div class="plant-emoji">
                    ${crop.icon}
                  </div>

                  <div class="plant-name">
                    ${crop.name}
                  </div>
                `
                : `
                  <div class="empty-emoji">
                    🟫
                  </div>

                  <div class="plant-name">
                    빈 밭
                  </div>
                `
          }
        </div>

        ${
          crop &&
          !cell.dead
            ? `
              <div class="progress-wrap">

                <div class="progress-label">
                  <span>
                    ${getGrowthStage(
                      cell.growth
                    )}
                  </span>

                  <span>
                    ${cell.growth.toFixed(
                      0
                    )}%
                  </span>
                </div>

                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    style="width:${cell.growth}%"
                  ></div>
                </div>

                <div class="cell-tags">

                  <span class="tag ${
                    cell.moisture <
                    crop.optimalMoisture[0]
                      ? 'dry'
                      : 'water'
                  }">
                    💧 ${moistureLabel}
                  </span>

                  ${
                    cell.weed
                      ? `
                        <span class="tag weed">
                          🌿 잡초
                        </span>
                      `
                      : ''
                  }

                  ${
                    cell.pests
                      ? `
                        <span class="tag pest">
                          🐛 병해충
                        </span>
                      `
                      : ''
                  }

                  ${
                    cell.fertilized
                      ? `
                        <span class="tag">
                          ✨ 비료
                        </span>
                      `
                      : ''
                  }

                </div>
              </div>
            `
            : cell.dead
              ? `
                <div class="cell-tags">
                  <span class="tag dead">
                    작물 회수 필요
                  </span>
                </div>
              `
              : ''
        }
      `;

      grid.appendChild(
        div
      );
    }
  );
}


/* =========================================================
   밭 상태 색상
========================================================= */

function getCellStatusClass(
  cell,
  crop
) {
  if (
    cell.dead
  ) {
    return 'bad';
  }

  if (!crop) {
    return 'good';
  }

  if (
    cell.pests ||
    cell.health < 45
  ) {
    return 'bad';
  }

  if (
    cell.weed ||
    cell.moisture <
      crop.optimalMoisture[0] ||
    cell.moisture >
      crop.optimalMoisture[1]
  ) {
    return 'warn';
  }

  return 'good';
}


/* =========================================================
   상점
========================================================= */

function renderMarket() {
  document
    .querySelectorAll(
      '.tab-btn'
    )
    .forEach(
      btn =>
        btn.classList.toggle(
          'active',
          btn.dataset.tab ===
            currentMarketTab
        )
    );

  document
    .getElementById(
      'market-buy'
    )
    .classList.toggle(
      'active',
      currentMarketTab ===
        'buy'
    );

  document
    .getElementById(
      'market-sell'
    )
    .classList.toggle(
      'active',
      currentMarketTab ===
        'sell'
    );

  document.getElementById(
    'market-buy'
  ).innerHTML =
    `<div class="shop-list">
      ${renderBuyItems()}
    </div>`;

  document.getElementById(
    'market-sell'
  ).innerHTML =
    `<div class="shop-list">
      ${renderSellItems()}
    </div>`;

  document
    .querySelectorAll(
      '[data-buy]'
    )
    .forEach(
      btn =>
        btn.addEventListener(
          'click',
          () =>
            buyItem(
              btn.dataset.buy
            )
        )
    );

  document
    .querySelectorAll(
      '[data-sell]'
    )
    .forEach(
      btn =>
        btn.addEventListener(
          'click',
          () =>
            sellHarvest(
              btn.dataset.sell
            )
        )
    );
}


/* =========================================================
   구매 목록
========================================================= */

function renderBuyItems() {
  const cropItems =
    Object.values(
      CROPS
    )
      .map(
        crop => {
          const count =
            state.inventory
              .seeds[
                crop.id
              ] || 0;

          return `
            <div class="shop-item">

              <div class="item-icon">
                ${crop.icon}
              </div>

              <div>
                <div class="item-name">
                  ${crop.name} 씨앗
                </div>

                <div class="item-meta">
                  적정 ${
                    crop.optimalTemp[0]
                  }~${
                    crop.optimalTemp[1]
                  }°C · ${
                    crop.growthHours
                  }시간 · 보유 ${count}
                </div>
              </div>

              <div class="item-actions">

                <div class="price">
                  ${formatMoney(
                    crop.seedPrice
                  )}
                </div>

                <button
                  class="small-btn"
                  data-buy="seed:${crop.id}"
                >
                  구매
                </button>

              </div>
            </div>
          `;
        }
      )
      .join('');

  const inputItems =
    Object.values(
      INPUT_ITEMS
    )
      .map(
        item => {
          const count =
            state.inventory
              .inputs[
                item.id
              ] || 0;

          return `
            <div class="shop-item">

              <div class="item-icon">
                ${item.icon}
              </div>

              <div>
                <div class="item-name">
                  ${item.name}
                </div>

                <div class="item-meta">
                  관리 자원 · 보유 ${count}
                </div>
              </div>

              <div class="item-actions">

                <div class="price">
                  ${formatMoney(
                    item.buyPrice
                  )}
                </div>

                <button
                  class="small-btn"
                  data-buy="input:${item.id}"
                >
                  구매
                </button>

              </div>
            </div>
          `;
        }
      )
      .join('');

  return (
    cropItems +
    inputItems
  );
}


/* =========================================================
   판매 목록
========================================================= */

function renderSellItems() {
  return Object.values(
    CROPS
  )
    .map(
      crop => {
        const count =
          state.inventory
            .harvest[
              crop.id
            ] || 0;

        return `
          <div class="shop-item">

            <div class="item-icon">
              ${crop.icon}
            </div>

            <div>
              <div class="item-name">
                ${crop.name} 수확물
              </div>

              <div class="item-meta">
                기본 판매가
                ${formatMoney(
                  crop.sellPrice
                )}
                / 개 · 보유 ${count}
              </div>
            </div>

            <div class="item-actions">

              <div class="price">
                1개 ×
                ${formatMoney(
                  crop.sellPrice
                )}
              </div>

              <button
                class="small-btn sell"
                data-sell="${crop.id}"
                ${
                  count <= 0
                    ? 'disabled'
                    : ''
                }
              >
                판매
              </button>

            </div>
          </div>
        `;
      }
    )
    .join('');
}


/* =========================================================
   밭 현황
========================================================= */

function renderFieldSummary() {
  const occupied =
    state.field.filter(
      c =>
        c.cropId &&
        !c.dead
    ).length;

  const mature =
    state.field.filter(
      c =>
        c.cropId &&
        !c.dead &&
        c.growth >=
          100
    ).length;

  const dry =
    state.field.filter(
      c =>
        c.cropId &&
        !c.dead &&
        c.moisture <
          35
    ).length;

  const threats =
    state.field.filter(
      c =>
        c.cropId &&
        !c.dead &&
        (
          c.weed ||
          c.pests
        )
    ).length;

  const healthyCells =
    state.field.filter(
      c =>
        c.cropId &&
        !c.dead
    );

  const avgHealth =
    occupied
      ? Math.round(
          healthyCells.reduce(
            (
              sum,
              c
            ) =>
              sum +
              c.health,
            0
          ) /
            occupied
        )
      : 0;

  document.getElementById(
    'field-summary'
  ).innerHTML = `
    <div class="summary-box">
      <span>재배 중</span>
      <strong>
        ${occupied}/${FIELD_SIZE}
      </strong>
    </div>

    <div class="summary-box">
      <span>성숙·수확 가능</span>
      <strong>
        ${mature}
      </strong>
    </div>

    <div class="summary-box">
      <span>건조한 칸</span>
      <strong>
        ${dry}
      </strong>
    </div>

    <div class="summary-box">
      <span>위협 발생 칸</span>
      <strong>
        ${threats}
      </strong>
    </div>

    <div class="summary-box">
      <span>평균 건강도</span>
      <strong>
        ${avgHealth}%
      </strong>
    </div>

    <div class="summary-box">
      <span>비료 사용 칸</span>
      <strong>
        ${
          state.field.filter(
            c =>
              c.fertilized
          ).length
        }
      </strong>
    </div>
  `;
}


/* =========================================================
   밭 상세 모달
========================================================= */

function openCellModal(
  index
) {
  selectedCellIndex =
    index;

  document
    .getElementById(
      'cell-modal'
    )
    .classList.remove(
      'hidden'
    );

  document
    .getElementById(
      'cell-modal'
    )
    .setAttribute(
      'aria-hidden',
      'false'
    );

  renderCellModal(
    index
  );
}


function closeCellModal() {
  selectedCellIndex =
    null;

  document
    .getElementById(
      'cell-modal'
    )
    .classList.add(
      'hidden'
    );

  document
    .getElementById(
      'cell-modal'
    )
    .setAttribute(
      'aria-hidden',
      'true'
    );
}


/* =========================================================
   밭 상세 내용
========================================================= */

function renderCellModal(
  index
) {
  const cell =
    state.field[
      index
    ];

  const container =
    document.getElementById(
      'cell-modal-content'
    );

  if (!cell) {
    return;
  }

  const crop =
    cell.cropId
      ? CROPS[
          cell.cropId
        ]
      : null;

  const env =
    getEnvironment();

  /*
    빈 밭
  */
  if (
    !crop &&
    !cell.dead
  ) {
    container.innerHTML = `
      <div class="modal-title-row">

        <div class="modal-crop-icon">
          🟫
        </div>

        <div>

          <div class="eyebrow">
            FIELD ${index + 1}
          </div>

          <h2 id="modal-title">
            빈 밭
          </h2>

          <div class="modal-subtitle">
            현재 토양 상태를 확인하고
            씨앗을 심어보세요.
          </div>

        </div>
      </div>

      <div class="status-grid">

        ${statusChip(
          '토양 수분',
          `${Math.round(
            cell.moisture
          )}%`
        )}

        ${statusChip(
          '비옥도',
          `${Math.round(
            cell.fertility
          )}%`
        )}

        ${statusChip(
          '현재 온도',
          `${env.temperature.toFixed(
            1
          )}°C`
        )}

      </div>

      <div class="modal-actions">

        ${
          Object.values(
            CROPS
          )
            .map(
              c => `
                <button
                  class="action-btn primary"
                  data-plant="${c.id}"
                >
                  <span>
                    ${c.icon}
                    ${c.name} 심기
                  </span>

                  <span>
                    ${
                      state.inventory
                        .seeds[
                        c.id
                      ] || 0
                    }개
                  </span>
                </button>
              `
            )
            .join('')
        }

      </div>

      <div class="action-note">
        씨앗을 구매한 뒤 원하는 작물을 선택하세요.
        파종 후 환경 조건에 따라 성장 속도가 달라집니다.
      </div>
    `;

    container
      .querySelectorAll(
        '[data-plant]'
      )
      .forEach(
        btn =>
          btn.addEventListener(
            'click',
            () =>
              plantCrop(
                index,
                btn.dataset
                  .plant
              )
          )
      );

    return;
  }

  /*
    고사한 작물
  */
  if (
    cell.dead
  ) {
    container.innerHTML = `
      <div class="modal-title-row">

        <div class="modal-crop-icon">
          🥀
        </div>

        <div>

          <div class="eyebrow">
            FIELD ${index + 1}
          </div>

          <h2 id="modal-title">
            고사한 작물
          </h2>

          <div class="modal-subtitle">
            건강도가 0이 되어 더 이상 성장하지 않습니다.
          </div>

        </div>
      </div>

      <div class="status-grid">

        ${statusChip(
          '토양 수분',
          `${Math.round(
            cell.moisture
          )}%`
        )}

        ${statusChip(
          '비옥도',
          `${Math.round(
            cell.fertility
          )}%`
        )}

        ${statusChip(
          '건강도',
          '0%'
        )}

      </div>

      <div class="modal-actions">

        <button
          class="action-btn danger"
          id="remove-dead"
        >
          <span>
            🗑 고사작물 정리
          </span>

          <span>
            무료
          </span>
        </button>

      </div>

      <div class="action-note">
        고사한 작물을 정리하면
        해당 밭을 다시 파종할 수 있습니다.
      </div>
    `;

    document
      .getElementById(
        'remove-dead'
      )
      .addEventListener(
        'click',
        () =>
          clearCell(
            index
          )
      );

    return;
  }

  const stage =
    getGrowthStage(
      cell.growth
    );

  const estimatedQuality =
    estimateQuality(
      cell,
      crop,
      env
    );

  const dry =
    cell.moisture <
    crop.optimalMoisture[0];

  const overWater =
    cell.moisture >
    crop.optimalMoisture[1];

  const canHarvest =
    cell.growth >=
    100;

  container.innerHTML = `
    <div class="modal-title-row">

      <div class="modal-crop-icon">
        ${crop.icon}
      </div>

      <div>

        <div class="eyebrow">
          FIELD ${index + 1}
        </div>

        <h2 id="modal-title">
          ${crop.name}
        </h2>

        <div class="modal-subtitle">
          ${stage}
          · 적정 온도
          ${crop.optimalTemp[0]}~${crop.optimalTemp[1]}°C
        </div>

      </div>
    </div>

    <div class="status-grid">

      ${statusChip(
        '성장도',
        `${Math.round(
          cell.growth
        )}%`
      )}

      ${statusChip(
        '건강도',
        `${Math.round(
          cell.health
        )}%`
      )}

      ${statusChip(
        '토양 수분',
        `${Math.round(
          cell.moisture
        )}%`
      )}

      ${statusChip(
        '비옥도',
        `${Math.round(
          cell.fertility
        )}%`
      )}

      ${statusChip(
        '잡초',
        cell.weed
          ? '발생'
          : '없음'
      )}

      ${statusChip(
        '병해충',
        cell.pests
          ? '발생'
          : '없음'
      )}

    </div>

    <div class="modal-actions">

      <button
        class="action-btn water"
        data-action="water"
        ${
          state.inventory
            .inputs.water <= 0 ||
          overWater
            ? 'disabled'
            : ''
        }
      >
        <span>
          💧 물주기
        </span>

        <span>
          ${
            state.inventory
              .inputs.water
          }
        </span>
      </button>

      <button
        class="action-btn warn"
        data-action="weed"
        ${
          !cell.weed
            ? 'disabled'
            : ''
        }
      >
        <span>
          🌿 잡초 뽑기
        </span>

        <span>
          작업
        </span>
      </button>

      <button
        class="action-btn danger"
        data-action="pesticide"
        ${
          !cell.pests ||
          state.inventory.inputs.pesticide <= 0
            ? 'disabled'
            : ''
        }
      >
        <span>
          🧴 병해충 방제
        </span>

        <span>
          ${
            state.inventory
              .inputs.pesticide
          }
        </span>
      </button>

      <button
        class="action-btn primary"
        data-action="fertilize"
        ${
          state.inventory.inputs.fertilizer <= 0 ||
          cell.fertilized
            ? 'disabled'
            : ''
        }
      >
        <span>
          ✨ 비료 주기
        </span>

        <span>
          ${
            state.inventory
              .inputs.fertilizer
          }
        </span>
      </button>

      <button
        class="action-btn"
        data-action="harvest"
        ${
          !canHarvest
            ? 'disabled'
            : ''
        }
      >
        <span>
          🧺 수확하기
        </span>

        <span>
          ${
            canHarvest
              ? estimateQuality(
                  cell,
                  crop,
                  env
                ) +
                '등급'
              : '성숙 대기'
          }
        </span>
      </button>

    </div>

    <div class="action-note">

      ${
        dry
          ? '토양이 건조합니다. 물주기를 권장합니다. '
          : ''
      }

      ${
        overWater
          ? '수분이 과다합니다. 뿌리 환경에 불리할 수 있습니다. '
          : ''
      }

      현재 예상 품질:
      <strong>
        ${estimatedQuality}등급
      </strong>

      · 비료 사용:
      ${
        cell.fertilized
          ? '예'
          : '아니오'
      }

    </div>
  `;

  container
    .querySelectorAll(
      '[data-action]'
    )
    .forEach(
      btn =>
        btn.addEventListener(
          'click',
          () =>
            handleCellAction(
              index,
              btn.dataset
                .action
            )
        )
    );
}


/* =========================================================
   상태 칩
========================================================= */

function statusChip(
  label,
  value
) {
  return `
    <div class="status-chip">
      <span>
        ${label}
      </span>

      <strong>
        ${value}
      </strong>
    </div>
  `;
}


/* =========================================================
   밭 액션
========================================================= */

function handleCellAction(
  index,
  action
) {
  switch (
    action
  ) {
    case 'water':
      waterCell(index);
      break;

    case 'weed':
      weedCell(index);
      break;

    case 'pesticide':
      pesticideCell(index);
      break;

    case 'fertilize':
      fertilizeCell(index);
      break;

    case 'harvest':
      harvestCell(index);
      break;
  }
}


/* =========================================================
   파종
========================================================= */

function plantCrop(
  index,
  cropId
) {
  const cell =
    state.field[
      index
    ];

  const crop =
    CROPS[cropId];

  if (
    !cell ||
    cell.cropId ||
    cell.dead
  ) {
    return;
  }

  if (
    (
      state.inventory
        .seeds[
        cropId
      ] || 0
    ) <= 0
  ) {
    showToast(
      `${crop.name} 씨앗이 부족합니다.`
    );

    return;
  }

  state.inventory
    .seeds[
      cropId
    ] -= 1;

  cell.cropId =
    cropId;

  cell.growth =
    0.1;

  cell.health =
    crop.baseHealth;

  cell.plantedAt =
    state.gameTime;

  cell.lastTickAt =
    state.gameTime;

  cell.weed =
    false;

  cell.pests =
    false;

  cell.fertilized =
    false;

  cell.dead =
    false;

  cell.diseasePressure =
    0;

  cell.qualityScore =
    crop.baseQuality;

  cell.moisture =
    clamp(
      cell.moisture,
      25,
      80
    );

  saveGame(false);

  renderAll();

  showToast(
    `${crop.icon} ${crop.name}을(를) 파종했습니다.`
  );

  renderCellModal(
    index
  );
}


/* =========================================================
   물주기
========================================================= */

function waterCell(
  index
) {
  const cell =
    state.field[
      index
    ];

  if (
    !cell?.cropId ||
    cell.dead
  ) {
    return;
  }

  if (
    state.inventory
      .inputs.water <=
    0
  ) {
    showToast(
      '물통이 없습니다. 상점에서 구매하세요.'
    );

    return;
  }

  if (
    cell.moisture >=
    88
  ) {
    showToast(
      '이미 토양 수분이 높습니다. 과습을 피하세요.'
    );

    return;
  }

  state.inventory
    .inputs.water -=
    1;

  cell.moisture =
    clamp(
      cell.moisture +
        28,
      0,
      100
    );

  cell.health =
    clamp(
      cell.health +
        2,
      0,
      100
    );

  saveGame(false);

  renderAll();

  showToast(
    '물을 주었습니다. 토양 수분이 회복되었습니다.'
  );

  renderCellModal(
    index
  );
}


/* =========================================================
   잡초 제거
========================================================= */

function weedCell(
  index
) {
  const cell =
    state.field[
      index
    ];

  if (
    !cell?.weed
  ) {
    return;
  }

  cell.weed =
    false;

  cell.health =
    clamp(
      cell.health +
        4,
      0,
      100
    );

  cell.fertility =
    clamp(
      cell.fertility +
        1,
      0,
      100
    );

  saveGame(false);

  renderAll();

  showToast(
    '잡초를 제거했습니다.'
  );

  renderCellModal(
    index
  );
}


/* =========================================================
   병해충 방제
========================================================= */

function pesticideCell(
  index
) {
  const cell =
    state.field[
      index
    ];

  if (
    !cell?.pests
  ) {
    return;
  }

  if (
    state.inventory
      .inputs
      .pesticide <=
    0
  ) {
    showToast(
      '농약이 없습니다. 상점에서 구매하세요.'
    );

    return;
  }

  state.inventory
    .inputs
    .pesticide -=
    1;

  cell.pests =
    false;

  cell.diseasePressure =
    Math.max(
      0,
      cell.diseasePressure -
        30
    );

  cell.health =
    clamp(
      cell.health +
        9,
      0,
      100
    );

  saveGame(false);

  renderAll();

  showToast(
    '병해충을 방제했습니다.'
  );

  renderCellModal(
    index
  );
}


/* =========================================================
   비료
========================================================= */

function fertilizeCell(
  index
) {
  const cell =
    state.field[
      index
    ];

  if (
    !cell?.cropId ||
    cell.dead
  ) {
    return;
  }

  if (
    cell.fertilized
  ) {
    showToast(
      '이미 비료를 준 밭입니다.'
    );

    return;
  }

  if (
    state.inventory
      .inputs
      .fertilizer <=
    0
  ) {
    showToast(
      '비료가 없습니다. 상점에서 구매하세요.'
    );

    return;
  }

  state.inventory
    .inputs
    .fertilizer -=
    1;

  cell.fertilized =
    true;

  cell.fertility =
    clamp(
      cell.fertility +
        22,
      0,
      100
    );

  cell.qualityScore =
    clamp(
      cell.qualityScore +
        8,
      0,
      100
    );

  saveGame(false);

  renderAll();

  showToast(
    '비료를 주었습니다. 성장과 품질에 도움을 줍니다.'
  );

  renderCellModal(
    index
  );
}


/* =========================================================
   수확
========================================================= */

function harvestCell(
  index
) {
  const cell =
    state.field[
      index
    ];

  if (
    !cell?.cropId ||
    cell.dead
  ) {
    return;
  }

  if (
    cell.growth < 100
  ) {
    showToast(
      '아직 성숙하지 않았습니다.'
    );

    return;
  }

  const crop =
    CROPS[
      cell.cropId
    ];

  const quality =
    estimateQuality(
      cell,
      crop,
      getEnvironment()
    );

  state.inventory
    .harvest[
      crop.id
    ] += 1;

  /*
    밭 초기화
  */
  cell.cropId =
    null;

  cell.growth =
    0;

  cell.health =
    100;

  cell.weed =
    false;

  cell.pests =
    false;

  cell.fertilized =
    false;

  cell.plantedAt =
    null;

  cell.lastTickAt =
    null;

  cell.qualityScore =
    0;

  cell.diseasePressure =
    0;

  cell.dead =
    false;

  /*
    마지막 수확 품질 저장
  */
  state._lastHarvestQuality =
    {
      cropId:
        crop.id,

      quality
    };

  saveGame(false);

  renderAll();

  closeCellModal();

  showToast(
    `${crop.icon} ${crop.name} 수확 완료 · ${quality}등급`
  );
}


/* =========================================================
   고사한 작물 제거
========================================================= */

function clearCell(
  index
) {
  state.field[
    index
  ] =
    createEmptyCell(
      index
    );

  saveGame(false);

  renderAll();

  closeCellModal();

  showToast(
    '밭을 정리했습니다.'
  );
}


/* =========================================================
   품질 계산
========================================================= */

function estimateQuality(
  cell,
  crop,
  env
) {
  const healthScore =
    cell.health;

  const tempScore =
    rangeScore(
      env.temperature,
      crop.optimalTemp
    ) * 100;

  const moistureScore =
    rangeScore(
      cell.moisture,
      crop.optimalMoisture
    ) * 100;

  const sunScore =
    rangeScore(
      env.sunPercent,
      crop.optimalSun
    ) * 100;

  const threatPenalty =
    (
      cell.weed
        ? 12
        : 0
    ) +
    (
      cell.pests
        ? 20
        : 0
    ) +
    cell.diseasePressure *
      0.15;

  const fertilizerBonus =
    cell.fertilized
      ? 10
      : 0;

  const raw =
    crop.baseQuality *
      0.28 +
    healthScore *
      0.33 +
    tempScore *
      0.12 +
    moistureScore *
      0.12 +
    sunScore *
      0.08 +
    cell.fertility *
      0.07 +
    fertilizerBonus -
    threatPenalty;

  const score =
    clamp(
      raw,
      0,
      100
    );

  if (
    score >= 90
  ) {
    return 'S';
  }

  if (
    score >= 78
  ) {
    return 'A';
  }

  if (
    score >= 62
  ) {
    return 'B';
  }

  if (
    score >= 45
  ) {
    return 'C';
  }

  return 'D';
}


/* =========================================================
   품질별 가격 배율
========================================================= */

function qualityMultiplier(
  quality
) {
  return (
    {
      S: 1.6,
      A: 1.32,
      B: 1.08,
      C: 0.85,
      D: 0.58
    }[quality] ||
    1
  );
}


/* =========================================================
   구매
========================================================= */

function buyItem(
  itemKey
) {
  const [
    kind,
    id
  ] =
    itemKey.split(
      ':'
    );

  /*
    씨앗
  */
  if (
    kind === 'seed'
  ) {
    const crop =
      CROPS[id];

    if (!crop) {
      return;
    }

    if (
      state.money <
      crop.seedPrice
    ) {
      showToast(
        '소지금이 부족합니다.'
      );

      return;
    }

    state.money -=
      crop.seedPrice;

    state.inventory
      .seeds[id] +=
      1;

    showToast(
      `${crop.icon} ${crop.name} 씨앗 1개를 구매했습니다.`
    );
  }

  /*
    농자재
  */
  else {
    const item =
      INPUT_ITEMS[id];

    if (!item) {
      return;
    }

    if (
      state.money <
      item.buyPrice
    ) {
      showToast(
        '소지금이 부족합니다.'
      );

      return;
    }

    state.money -=
      item.buyPrice;

    state.inventory
      .inputs[id] +=
      1;

    showToast(
      `${item.icon} ${item.name} 1개를 구매했습니다.`
    );
  }

  saveGame(false);

  renderAll();
}


/* =========================================================
   수확물 판매
========================================================= */

function sellHarvest(
  cropId
) {
  const crop =
    CROPS[cropId];

  if (
    !crop ||
    (
      state.inventory
        .harvest[
        cropId
      ] || 0
    ) <= 0
  ) {
    return;
  }

  const quality =
    state._lastHarvestQuality
      ?.cropId ===
      cropId
      ? state
          ._lastHarvestQuality
          .quality
      : 'B';

  const price =
    Math.round(
      crop.sellPrice *
        qualityMultiplier(
          quality
        )
    );

  state.inventory
    .harvest[
      cropId
    ] -= 1;

  state.money +=
    price;

  showToast(
    `${crop.icon} ${crop.name} 1개를 ${formatMoney(
      price
    )}에 판매했습니다. (${quality}등급 기준)`
  );

  state._lastHarvestQuality =
    null;

  saveGame(false);

  renderAll();
}


/* =========================================================
   인벤토리
========================================================= */

function openInventory() {
  renderInventory();

  document
    .getElementById(
      'inventory-modal'
    )
    .classList.remove(
      'hidden'
    );

  document
    .getElementById(
      'inventory-modal'
    )
    .setAttribute(
      'aria-hidden',
      'false'
    );
}


function closeInventory() {
  document
    .getElementById(
      'inventory-modal'
    )
    .classList.add(
      'hidden'
    );

  document
    .getElementById(
      'inventory-modal'
    )
    .setAttribute(
      'aria-hidden',
      'true'
    );
}


function renderInventory() {
  const wrap =
    document.getElementById(
      'inventory-content'
    );

  const entries =
    [];

  /*
    작물 씨앗 / 수확물
  */
  Object.values(
    CROPS
  ).forEach(
    crop => {
      entries.push(
        {
          icon: crop.icon,

          name:
            `${crop.name} 씨앗`,

          count:
            state.inventory
              .seeds[
              crop.id
            ] || 0
        }
      );

      entries.push(
        {
          icon: crop.icon,

          name:
            `${crop.name} 수확물`,

          count:
            state.inventory
              .harvest[
              crop.id
            ] || 0
        }
      );
    }
  );

  /*
    농자재
  */
  Object.values(
    INPUT_ITEMS
  ).forEach(
    item => {
      entries.push(
        {
          icon: item.icon,

          name:
            item.name,

          count:
            state.inventory
              .inputs[
              item.id
            ] || 0
        }
      );
    }
  );

  wrap.innerHTML =
    entries.length
      ? entries
          .map(
            item => `
              <div class="inventory-card">

                <div class="icon">
                  ${item.icon}
                </div>

                <div class="name">
                  ${item.name}
                </div>

                <div class="count">
                  ${item.count}개
                </div>

              </div>
            `
          )
          .join('')
      : `
          <div class="inventory-empty">
            보유 물품이 없습니다.
          </div>
        `;
}


/* =========================================================
   저장
========================================================= */

function saveGame(
  showToastMessage = false
) {
  state.lastSavedAt =
    Date.now();

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      state
    )
  );

  if (
    showToastMessage
  ) {
    showToast(
      '게임이 저장되었습니다.'
    );
  }
}


/* =========================================================
   불러오기
========================================================= */

function loadGame() {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return false;
    }

    const saved =
      JSON.parse(
        raw
      );

    state = {
      ...createDefaultState(),

      ...saved
    };

    return true;
  }

  catch (error) {
    console.warn(
      '저장 데이터를 불러오지 못했습니다.',
      error
    );

    state =
      createDefaultState();

    return false;
  }
}


/* =========================================================
   상태 보정
========================================================= */

function normalizeState() {
  /*
    밭 보정
  */
  if (
    !Array.isArray(
      state.field
    ) ||
    state.field.length !==
      FIELD_SIZE
  ) {
    state.field =
      Array.from(
        {
          length:
            FIELD_SIZE
        },

        (_, i) =>
          state.field?.[
            i
          ] ||
          createEmptyCell(
            i
          )
      );
  }

  state.field =
    state.field.map(
      (
        cell,
        i
      ) => ({
        ...createEmptyCell(
          i
        ),

        ...cell,

        id: i
      })
    );

  /*
    인벤토리 보정
  */
  state.inventory ||=
    createDefaultState()
      .inventory;

  state.inventory.seeds ||=
    {};

  state.inventory.harvest ||=
    {};

  state.inventory.inputs ||=
    {};

  Object.keys(
    CROPS
  ).forEach(
    id => {
      state.inventory
        .seeds[id] =
        Number(
          state.inventory
            .seeds[id] ||
            0
        );

      state.inventory
        .harvest[id] =
        Number(
          state.inventory
            .harvest[id] ||
            0
        );
    }
  );

  Object.keys(
    INPUT_ITEMS
  ).forEach(
    id => {
      state.inventory
        .inputs[id] =
        Number(
          state.inventory
            .inputs[id] ||
            0
        );
    }
  );

  state.money =
    Number(
      state.money ||
        0
    );

  state.gameTime =
    Number(
      state.gameTime ||
        createDefaultState()
          .gameTime
    );

  state.tutorialSeen =
    Boolean(
      state.tutorialSeen
    );
}


/* =========================================================
   새 게임
========================================================= */

function resetGame() {
  const ok =
    window.confirm(
      '현재 저장 데이터를 모두 지우고 새 게임을 시작할까요?'
    );

  if (!ok) {
    return;
  }

  localStorage.removeItem(
    STORAGE_KEY
  );

  state =
    createDefaultState();

  updateWeather(true);

  selectedCellIndex =
    null;

  closeCellModal();

  closeInventory();

  renderAll();

  showToast(
    '새 게임을 시작했습니다.'
  );

  setTimeout(
    () =>
      openTutorial(
        true
      ),
    180
  );
}


/* =========================================================
   성장 단계
========================================================= */

function getGrowthStage(
  growth
) {
  if (
    growth <=
    0.1
  ) {
    return '씨앗';
  }

  if (
    growth < 25
  ) {
    return '새싹';
  }

  if (
    growth < 60
  ) {
    return '성장';
  }

  if (
    growth < 100
  ) {
    return '성숙';
  }

  return '수확';
}


/* =========================================================
   범위 점수
========================================================= */

function rangeScore(
  value,
  range
) {
  const [
    min,
    max
  ] =
    range;

  /*
    적정 범위
  */
  if (
    value >= min &&
    value <= max
  ) {
    return 1;
  }

  /*
    낮은 경우
  */
  if (
    value < min
  ) {
    return clamp(
      1 -
        (
          min -
          value
        ) /
          Math.max(
            1,
            min + 5
          ),
      0,
      1
    );
  }

  /*
    높은 경우
  */
  return clamp(
    1 -
      (
        value -
        max
      ) /
        Math.max(
          1,
          100 -
            max +
            5
        ),
    0,
    1
  );
}


/* =========================================================
   Clamp
========================================================= */

function clamp(
  value,
  min,
  max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}


/* =========================================================
   돈 표시
========================================================= */

function formatMoney(
  value
) {
  return `₩${Math.round(
    value
  ).toLocaleString(
    'ko-KR'
  )}`;
}


/* =========================================================
   시간 표시
========================================================= */

function formatTime(
  date
) {
  return `${String(
    date.getHours()
  ).padStart(
    2,
    '0'
  )}:${String(
    date.getMinutes()
  ).padStart(
    2,
    '0'
  )}`;
}


/* =========================================================
   튜토리얼 열기
========================================================= */

function openTutorial(
  isNewGame = false
) {
  tutorialStep =
    0;

  const modal =
    document.getElementById(
      'tutorial-modal'
    );

  modal.classList.remove(
    'hidden'
  );

  modal.setAttribute(
    'aria-hidden',
    'false'
  );

  modal.dataset.newGame =
    isNewGame
      ? 'true'
      : 'false';

  renderTutorial();
}


/* =========================================================
   튜토리얼 렌더
========================================================= */

function renderTutorial() {
  const step =
    TUTORIAL_STEPS[
      tutorialStep
    ];

  if (!step) {
    return;
  }

  document.getElementById(
    'tutorial-icon'
  ).textContent =
    step.icon;

  document.getElementById(
    'tutorial-kicker'
  ).textContent =
    step.kicker;

  document.getElementById(
    'tutorial-title'
  ).textContent =
    step.title;

  document.getElementById(
    'tutorial-description'
  ).textContent =
    step.description;

  document.getElementById(
    'tutorial-body'
  ).innerHTML =
    step.body;

  document.getElementById(
    'tutorial-progress'
  ).innerHTML =
    TUTORIAL_STEPS
      .map(
        (
          _,
          i
        ) =>
          `
            <span
              class="tutorial-progress-dot ${
                i <=
                tutorialStep
                  ? 'active'
                  : ''
              }"
            ></span>
          `
      )
      .join('');

  const prev =
    document.getElementById(
      'tutorial-prev'
    );

  const next =
    document.getElementById(
      'tutorial-next'
    );

  prev.disabled =
    tutorialStep ===
    0;

  prev.style.opacity =
    tutorialStep ===
    0
      ? '0.45'
      : '1';

  prev.style.cursor =
    tutorialStep ===
    0
      ? 'not-allowed'
      : 'pointer';

  next.textContent =
    tutorialStep ===
    TUTORIAL_STEPS.length -
      1
      ? '농장 시작하기'
      : '다음';
}


/* =========================================================
   튜토리얼 이전
========================================================= */

function tutorialPrev() {
  if (
    tutorialStep <=
    0
  ) {
    return;
  }

  tutorialStep -=
    1;

  renderTutorial();
}


/* =========================================================
   튜토리얼 다음
========================================================= */

function tutorialNext() {
  if (
    tutorialStep >=
    TUTORIAL_STEPS.length -
      1
  ) {
    finishTutorial();

    return;
  }

  tutorialStep +=
    1;

  renderTutorial();
}


/* =========================================================
   튜토리얼 종료
========================================================= */

function finishTutorial() {
  const modal =
    document.getElementById(
      'tutorial-modal'
    );

  modal.classList.add(
    'hidden'
  );

  modal.setAttribute(
    'aria-hidden',
    'true'
  );

  state.tutorialSeen =
    true;

  saveGame(false);
}


/* =========================================================
   토스트
========================================================= */

function showToast(
  message
) {
  const toast =
    document.getElementById(
      'toast'
    );

  toast.textContent =
    message;

  toast.classList.add(
    'show'
  );

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(
      () =>
        toast.classList.remove(
          'show'
        ),
      2200
    );
}


/* =========================================================
   시작
========================================================= */

init();