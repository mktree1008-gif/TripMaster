const STORAGE_KEYS = {
  placesPlan: "travel_places_plan",
  restaurantsPlan: "travel_restaurants_plan",
  records: "travel_records",
  diaries: "travel_diaries",
};

const airports = [
  { code: "ICN", city: "Seoul", country: "KR" },
  { code: "GMP", city: "Seoul", country: "KR" },
  { code: "NRT", city: "Tokyo", country: "JP" },
  { code: "HND", city: "Tokyo", country: "JP" },
  { code: "KIX", city: "Osaka", country: "JP" },
  { code: "BKK", city: "Bangkok", country: "TH" },
  { code: "SIN", city: "Singapore", country: "SG" },
  { code: "CDG", city: "Paris", country: "FR" },
  { code: "LHR", city: "London", country: "GB" },
  { code: "JFK", city: "New York", country: "US" },
  { code: "LAX", city: "Los Angeles", country: "US" },
];

const routeProfile = {
  "ICN-NRT": { basePrice: 220000, duration: 2.5 },
  "ICN-HND": { basePrice: 215000, duration: 2.4 },
  "ICN-KIX": { basePrice: 250000, duration: 1.9 },
  "ICN-BKK": { basePrice: 360000, duration: 5.7 },
  "ICN-SIN": { basePrice: 390000, duration: 6.4 },
  "ICN-CDG": { basePrice: 940000, duration: 13.8 },
  "ICN-LHR": { basePrice: 970000, duration: 14.1 },
  "ICN-JFK": { basePrice: 1280000, duration: 15.1 },
  "ICN-LAX": { basePrice: 1100000, duration: 11.7 },
  "NRT-BKK": { basePrice: 330000, duration: 6.1 },
  "NRT-SIN": { basePrice: 320000, duration: 6.8 },
  "NRT-LAX": { basePrice: 940000, duration: 10.6 },
  "NRT-JFK": { basePrice: 1060000, duration: 12.8 },
  "KIX-BKK": { basePrice: 350000, duration: 5.5 },
  "KIX-SIN": { basePrice: 370000, duration: 6.1 },
  "BKK-SIN": { basePrice: 220000, duration: 2.5 },
  "CDG-LHR": { basePrice: 170000, duration: 1.4 },
  "LHR-JFK": { basePrice: 830000, duration: 8.1 },
  "LAX-JFK": { basePrice: 420000, duration: 5.6 },
};

const airlines = [
  {
    name: "Korean Air",
    rating: 4.7,
    factor: 1.08,
    baggage: "위탁 1개 포함",
    officialUrl: "https://www.koreanair.com",
  },
  {
    name: "Asiana Airlines",
    rating: 4.6,
    factor: 1.05,
    baggage: "위탁 1개 포함",
    officialUrl: "https://flyasiana.com",
  },
  {
    name: "Japan Airlines",
    rating: 4.7,
    factor: 1.09,
    baggage: "위탁 1개 포함",
    officialUrl: "https://www.jal.com",
  },
  {
    name: "Singapore Airlines",
    rating: 4.8,
    factor: 1.14,
    baggage: "위탁 1개 포함",
    officialUrl: "https://www.singaporeair.com",
  },
  {
    name: "Delta Air Lines",
    rating: 4.5,
    factor: 1.03,
    baggage: "기내 1 + 위탁 유료",
    officialUrl: "https://www.delta.com",
  },
  {
    name: "Air France",
    rating: 4.4,
    factor: 1.01,
    baggage: "기내 1 + 위탁 유료",
    officialUrl: "https://wwws.airfrance.co.kr",
  },
  {
    name: "Lufthansa",
    rating: 4.5,
    factor: 1.04,
    baggage: "기내 1 + 위탁 유료",
    officialUrl: "https://www.lufthansa.com",
  },
];

const hotelCatalog = {
  Tokyo: [
    {
      name: "Hotel Groove Shinjuku",
      area: "Shinjuku",
      stars: 4,
      rating: 4.5,
      distance: 0.4,
      basePrice: 185000,
      officialUrl: "https://www.hotelgroove.jp/en/",
    },
    {
      name: "The Tokyo Station Hotel",
      area: "Marunouchi",
      stars: 5,
      rating: 4.8,
      distance: 0.2,
      basePrice: 460000,
      officialUrl: "https://www.thetokyostationhotel.jp/en/",
    },
    {
      name: "Shibuya Stream Excel Hotel Tokyu",
      area: "Shibuya",
      stars: 4,
      rating: 4.4,
      distance: 0.6,
      basePrice: 230000,
      officialUrl: "https://www.tokyuhotels.co.jp/shibuyastream-e/",
    },
  ],
  Osaka: [
    {
      name: "Hotel Royal Classic Osaka",
      area: "Namba",
      stars: 4,
      rating: 4.6,
      distance: 0.3,
      basePrice: 210000,
      officialUrl: "https://hotel-royalclassic.jp/en/",
    },
    {
      name: "Conrad Osaka",
      area: "Nakanoshima",
      stars: 5,
      rating: 4.8,
      distance: 1.2,
      basePrice: 480000,
      officialUrl: "https://www.hilton.com/en/hotels/osacici-conrad-osaka/",
    },
    {
      name: "Cross Hotel Osaka",
      area: "Dotonbori",
      stars: 4,
      rating: 4.4,
      distance: 0.2,
      basePrice: 190000,
      officialUrl: "https://www.crosshotel.com/osaka/en/",
    },
  ],
  Bangkok: [
    {
      name: "Eastin Grand Hotel Sathorn",
      area: "Sathorn",
      stars: 5,
      rating: 4.7,
      distance: 0.5,
      basePrice: 175000,
      officialUrl: "https://www.eastingrandsathorn.com/",
    },
    {
      name: "The Standard, Bangkok Mahanakhon",
      area: "Silom",
      stars: 5,
      rating: 4.6,
      distance: 0.7,
      basePrice: 235000,
      officialUrl: "https://www.standardhotels.com/bangkok/properties/bangkok",
    },
    {
      name: "Siam Kempinski Hotel Bangkok",
      area: "Siam",
      stars: 5,
      rating: 4.8,
      distance: 0.4,
      basePrice: 340000,
      officialUrl: "https://www.kempinski.com/en/siam-hotel",
    },
  ],
  Singapore: [
    {
      name: "PARKROYAL COLLECTION Pickering",
      area: "Chinatown",
      stars: 5,
      rating: 4.7,
      distance: 0.3,
      basePrice: 320000,
      officialUrl: "https://www.panpacific.com/en/hotels-and-resorts/pr-collection-pickering.html",
    },
    {
      name: "The Fullerton Hotel Singapore",
      area: "Marina Bay",
      stars: 5,
      rating: 4.8,
      distance: 0.2,
      basePrice: 410000,
      officialUrl: "https://www.fullertonhotels.com/fullerton-hotel-singapore",
    },
    {
      name: "YOTEL Singapore Orchard Road",
      area: "Orchard",
      stars: 4,
      rating: 4.2,
      distance: 0.4,
      basePrice: 210000,
      officialUrl: "https://www.yotel.com/en/hotels/yotel-singapore",
    },
  ],
  Paris: [
    {
      name: "Hôtel Madame Rêve",
      area: "Louvre",
      stars: 5,
      rating: 4.7,
      distance: 0.5,
      basePrice: 520000,
      officialUrl: "https://www.madamereve.com/en/",
    },
    {
      name: "Le Grand Quartier",
      area: "Canal Saint-Martin",
      stars: 4,
      rating: 4.5,
      distance: 0.8,
      basePrice: 340000,
      officialUrl: "https://www.legrandquartier.com/en",
    },
    {
      name: "citizenM Paris Gare de Lyon",
      area: "Gare de Lyon",
      stars: 4,
      rating: 4.3,
      distance: 0.6,
      basePrice: 275000,
      officialUrl: "https://www.citizenm.com/hotels/europe/paris/paris-gare-de-lyon-hotel",
    },
  ],
  London: [
    {
      name: "The Hoxton Holborn",
      area: "Holborn",
      stars: 4,
      rating: 4.5,
      distance: 0.4,
      basePrice: 360000,
      officialUrl: "https://thehoxton.com/london/holborn/",
    },
    {
      name: "The Savoy",
      area: "Covent Garden",
      stars: 5,
      rating: 4.9,
      distance: 0.3,
      basePrice: 980000,
      officialUrl: "https://www.thesavoylondon.com/",
    },
    {
      name: "Park Plaza Westminster Bridge",
      area: "Westminster",
      stars: 4,
      rating: 4.4,
      distance: 0.5,
      basePrice: 395000,
      officialUrl: "https://www.parkplaza.com/london-hotel-gb-se1-7ut/gbwestmi",
    },
  ],
};

const placesCatalog = {
  Tokyo: [
    {
      id: "tokyo-1",
      name: "Shibuya Sky",
      theme: "photo",
      area: "Shibuya",
      bestTime: "석양~야경",
      note: "도쿄 스카이라인을 한 번에 볼 수 있는 전망대",
    },
    {
      id: "tokyo-2",
      name: "Meiji Jingu",
      theme: "nature",
      area: "Harajuku",
      bestTime: "오전",
      note: "도심 안 숲길 산책 코스로 좋음",
    },
    {
      id: "tokyo-3",
      name: "Asakusa & Senso-ji",
      theme: "culture",
      area: "Asakusa",
      bestTime: "오후",
      note: "전통 거리와 사원 분위기를 함께 즐길 수 있음",
    },
  ],
  Osaka: [
    {
      id: "osaka-1",
      name: "Dotonbori",
      theme: "photo",
      area: "Namba",
      bestTime: "저녁",
      note: "네온사인과 강변 산책이 매력적인 중심지",
    },
    {
      id: "osaka-2",
      name: "Osaka Castle Park",
      theme: "culture",
      area: "Chuo",
      bestTime: "오전",
      note: "성 주변 공원 산책과 역사 관람",
    },
    {
      id: "osaka-3",
      name: "Minoh Falls",
      theme: "nature",
      area: "Minoh",
      bestTime: "낮",
      note: "도시 근교 트래킹 명소",
    },
  ],
  Bangkok: [
    {
      id: "bkk-1",
      name: "Wat Arun",
      theme: "culture",
      area: "Bangkok Yai",
      bestTime: "일몰",
      note: "강변 사원 야경이 아름다운 명소",
    },
    {
      id: "bkk-2",
      name: "Lumphini Park",
      theme: "nature",
      area: "Pathum Wan",
      bestTime: "아침",
      note: "현지 조깅 분위기를 느끼기 좋은 공원",
    },
    {
      id: "bkk-3",
      name: "Mahanakhon SkyWalk",
      theme: "photo",
      area: "Silom",
      bestTime: "해질녘",
      note: "스카이워크에서 도심 파노라마 촬영",
    },
  ],
  Singapore: [
    {
      id: "sin-1",
      name: "Gardens by the Bay",
      theme: "nature",
      area: "Marina Bay",
      bestTime: "저녁",
      note: "슈퍼트리 쇼와 돔 가든 체험",
    },
    {
      id: "sin-2",
      name: "National Gallery Singapore",
      theme: "culture",
      area: "Downtown",
      bestTime: "오후",
      note: "동남아 현대미술 중심 전시",
    },
    {
      id: "sin-3",
      name: "Haji Lane",
      theme: "photo",
      area: "Kampong Glam",
      bestTime: "낮",
      note: "감성 벽화와 부티크 숍 거리",
    },
  ],
};

const restaurantsCatalog = {
  Tokyo: [
    {
      id: "tokyo-r1",
      name: "Sushi Dai",
      type: "local",
      area: "Toyosu",
      note: "새벽 경매장 근처 스시 오마카세",
    },
    {
      id: "tokyo-r2",
      name: "Den",
      type: "fine",
      area: "Jingumae",
      note: "창의적인 코스 파인다이닝",
    },
    {
      id: "tokyo-r3",
      name: "Onibus Coffee",
      type: "cafe",
      area: "Nakameguro",
      note: "싱글오리진 필터 커피로 유명",
    },
  ],
  Osaka: [
    {
      id: "osaka-r1",
      name: "Mizuno",
      type: "local",
      area: "Dotonbori",
      note: "오코노미야키 로컬 맛집",
    },
    {
      id: "osaka-r2",
      name: "Hajime",
      type: "fine",
      area: "Nishi",
      note: "미슐랭 파인다이닝 레스토랑",
    },
    {
      id: "osaka-r3",
      name: "LiLo Coffee Roasters",
      type: "cafe",
      area: "Shinsaibashi",
      note: "드립 커피 스페셜티 카페",
    },
  ],
  Bangkok: [
    {
      id: "bkk-r1",
      name: "Jeh O Chula",
      type: "local",
      area: "Pathum Wan",
      note: "마마 누들로 유명한 야식집",
    },
    {
      id: "bkk-r2",
      name: "Sorn",
      type: "fine",
      area: "Sathon",
      note: "남부 태국식 코스 다이닝",
    },
    {
      id: "bkk-r3",
      name: "Factory Coffee",
      type: "cafe",
      area: "Ratchathewi",
      note: "바리스타 챔피언 카페",
    },
  ],
  Singapore: [
    {
      id: "sin-r1",
      name: "Lau Pa Sat Satay Street",
      type: "local",
      area: "CBD",
      note: "현지 야시장 사테 거리",
    },
    {
      id: "sin-r2",
      name: "Odette",
      type: "fine",
      area: "City Hall",
      note: "프렌치 파인다이닝",
    },
    {
      id: "sin-r3",
      name: "Nylon Coffee Roasters",
      type: "cafe",
      area: "Everton Park",
      note: "스페셜티 커피와 로스터리",
    },
  ],
};

const cityOptions = ["Tokyo", "Osaka", "Bangkok", "Singapore", "Paris", "London"];

const state = {
  tripType: "round",
  flightResults: [],
  hotelResults: [],
  placesPlan: loadStorage(STORAGE_KEYS.placesPlan, []),
  restaurantsPlan: loadStorage(STORAGE_KEYS.restaurantsPlan, []),
  records: loadStorage(STORAGE_KEYS.records, []),
  diaries: loadStorage(STORAGE_KEYS.diaries, []),
};

const els = {
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  tripTypeButtons: document.querySelectorAll(".trip-type-btn"),
  flight: {
    origin: document.getElementById("flight-origin"),
    destination: document.getElementById("flight-destination"),
    secondOrigin: document.getElementById("flight-second-origin"),
    secondDestination: document.getElementById("flight-second-destination"),
    departDate: document.getElementById("flight-depart-date"),
    returnDate: document.getElementById("flight-return-date"),
    secondDate: document.getElementById("flight-second-date"),
    returnWrap: document.getElementById("return-date-wrap"),
    multiGroup: document.getElementById("multi-city-group"),
    multiDateWrap: document.getElementById("multi-second-date"),
    passengers: document.getElementById("flight-passengers"),
    cabin: document.getElementById("flight-cabin"),
    searchBtn: document.getElementById("flight-search-btn"),
    sort: document.getElementById("flight-sort"),
    results: document.getElementById("flight-results"),
    feedback: document.getElementById("flight-feedback"),
  },
  hotel: {
    city: document.getElementById("hotel-city"),
    guests: document.getElementById("hotel-guests"),
    checkin: document.getElementById("hotel-checkin"),
    checkout: document.getElementById("hotel-checkout"),
    searchBtn: document.getElementById("hotel-search-btn"),
    sort: document.getElementById("hotel-sort"),
    results: document.getElementById("hotel-results"),
    feedback: document.getElementById("hotel-feedback"),
  },
  places: {
    city: document.getElementById("places-city"),
    theme: document.getElementById("places-theme"),
    filterBtn: document.getElementById("places-filter-btn"),
    results: document.getElementById("places-results"),
    plan: document.getElementById("places-plan"),
  },
  restaurants: {
    city: document.getElementById("restaurants-city"),
    type: document.getElementById("restaurants-type"),
    filterBtn: document.getElementById("restaurants-filter-btn"),
    results: document.getElementById("restaurants-results"),
    plan: document.getElementById("restaurants-plan"),
  },
  record: {
    title: document.getElementById("record-title"),
    date: document.getElementById("record-date"),
    photo: document.getElementById("record-photo"),
    note: document.getElementById("record-note"),
    saveBtn: document.getElementById("record-save-btn"),
    feedback: document.getElementById("record-feedback"),
    list: document.getElementById("record-list"),
  },
  diary: {
    date: document.getElementById("diary-date"),
    mood: document.getElementById("diary-mood"),
    content: document.getElementById("diary-content"),
    saveBtn: document.getElementById("diary-save-btn"),
    feedback: document.getElementById("diary-feedback"),
    list: document.getElementById("diary-list"),
  },
};

initialize();

function initialize() {
  initTabs();
  populateSelects();
  setDefaultDates();
  initFlight();
  initHotel();
  initPlaces();
  initRestaurants();
  initRecord();
  initDiary();

  searchFlights();
  searchHotels();
  renderPlaces();
  renderRestaurants();
  renderPlacesPlan();
  renderRestaurantsPlan();
  renderRecords();
  renderDiaries();
}

function initTabs() {
  els.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      els.tabButtons.forEach((b) => b.classList.toggle("is-active", b === button));
      els.tabPanels.forEach((panel) => panel.classList.toggle("is-active", panel.id === tab));
    });
  });
}

function populateSelects() {
  const airportOptions = airports
    .map((airport) => `<option value="${airport.code}">${airport.city} (${airport.code})</option>`)
    .join("");

  els.flight.origin.innerHTML = airportOptions;
  els.flight.destination.innerHTML = airportOptions;
  els.flight.secondOrigin.innerHTML = airportOptions;
  els.flight.secondDestination.innerHTML = airportOptions;

  els.flight.origin.value = "ICN";
  els.flight.destination.value = "NRT";
  els.flight.secondOrigin.value = "NRT";
  els.flight.secondDestination.value = "BKK";

  const cityOptionMarkup = cityOptions.map((city) => `<option value="${city}">${city}</option>`).join("");

  els.hotel.city.innerHTML = cityOptionMarkup;
  els.places.city.innerHTML = cityOptionMarkup;
  els.restaurants.city.innerHTML = cityOptionMarkup;

  els.hotel.city.value = "Tokyo";
  els.places.city.value = "Tokyo";
  els.restaurants.city.value = "Tokyo";
}

function setDefaultDates() {
  const today = new Date();
  const depart = shiftDate(today, 21);
  const returnDate = shiftDate(today, 26);
  const secondLeg = shiftDate(today, 24);

  const checkin = shiftDate(today, 14);
  const checkout = shiftDate(today, 17);

  els.flight.departDate.value = toISODate(depart);
  els.flight.returnDate.value = toISODate(returnDate);
  els.flight.secondDate.value = toISODate(secondLeg);

  els.hotel.checkin.value = toISODate(checkin);
  els.hotel.checkout.value = toISODate(checkout);

  els.record.date.value = toISODate(today);
  els.diary.date.value = toISODate(today);
}

function initFlight() {
  els.tripTypeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.tripType = button.dataset.tripType;
      els.tripTypeButtons.forEach((btn) => btn.classList.toggle("is-active", btn === button));
      applyTripTypeView();
    });
  });

  els.flight.searchBtn.addEventListener("click", searchFlights);
  els.flight.sort.addEventListener("change", renderFlightResults);

  applyTripTypeView();
}

function applyTripTypeView() {
  const isRound = state.tripType === "round";
  const isMulti = state.tripType === "multi";

  els.flight.returnWrap.classList.toggle("is-hidden", !isRound);
  els.flight.multiGroup.classList.toggle("is-hidden", !isMulti);
  els.flight.multiDateWrap.classList.toggle("is-hidden", !isMulti);
}

function searchFlights() {
  const origin = els.flight.origin.value;
  const destination = els.flight.destination.value;
  const secondOrigin = els.flight.secondOrigin.value;
  const secondDestination = els.flight.secondDestination.value;
  const departDate = els.flight.departDate.value;
  const returnDate = els.flight.returnDate.value;
  const secondDate = els.flight.secondDate.value;
  const passengers = Math.max(1, Number(els.flight.passengers.value) || 1);
  const cabin = els.flight.cabin.value;

  els.flight.feedback.textContent = "";

  if (!origin || !destination) {
    els.flight.feedback.textContent = "출발지와 도착지를 선택해 주세요.";
    state.flightResults = [];
    renderFlightResults();
    return;
  }

  if (origin === destination) {
    els.flight.feedback.textContent = "출발지와 도착지는 달라야 해요.";
    state.flightResults = [];
    renderFlightResults();
    return;
  }

  if (!departDate) {
    els.flight.feedback.textContent = "출발일을 입력해 주세요.";
    state.flightResults = [];
    renderFlightResults();
    return;
  }

  if (state.tripType === "round") {
    if (!returnDate) {
      els.flight.feedback.textContent = "왕복은 귀국일 입력이 필요해요.";
      state.flightResults = [];
      renderFlightResults();
      return;
    }

    if (returnDate < departDate) {
      els.flight.feedback.textContent = "귀국일은 출발일 이후여야 해요.";
      state.flightResults = [];
      renderFlightResults();
      return;
    }
  }

  if (state.tripType === "multi") {
    if (!secondOrigin || !secondDestination || !secondDate) {
      els.flight.feedback.textContent = "멀티시티는 2구간 정보가 모두 필요해요.";
      state.flightResults = [];
      renderFlightResults();
      return;
    }

    if (secondOrigin === secondDestination) {
      els.flight.feedback.textContent = "2구간 출발지와 도착지는 달라야 해요.";
      state.flightResults = [];
      renderFlightResults();
      return;
    }
  }

  const firstRoute = getRouteMetric(origin, destination);
  const secondRoute = state.tripType === "multi" ? getRouteMetric(secondOrigin, secondDestination) : null;

  const cabinFactor = { economy: 1, premium: 1.35, business: 2.2 }[cabin] || 1;
  const roundMultiplier = state.tripType === "round" ? 1.75 : 1;
  const multiMultiplier = state.tripType === "multi" ? 1.25 : 1;

  const generated = airlines.map((airline, idx) => {
    const baseSeed = `${origin}${destination}${airline.name}${departDate}${state.tripType}`;
    const seed = seededDecimal(baseSeed);
    const noise = 0.9 + seed * 0.26;

    const stopCount = seededInt(`${baseSeed}-stops`, 0, 2);
    const secondStops = secondRoute ? seededInt(`${baseSeed}-stop2`, 0, 2) : 0;

    const firstDuration = firstRoute.duration + stopCount * 1.35;
    const secondDuration = secondRoute ? secondRoute.duration + secondStops * 1.15 : 0;
    const totalDuration = firstDuration * (state.tripType === "round" ? 2 : 1) + secondDuration;

    let basePrice = firstRoute.basePrice;
    if (state.tripType === "round") {
      basePrice *= roundMultiplier;
    }
    if (state.tripType === "multi" && secondRoute) {
      basePrice += secondRoute.basePrice * multiMultiplier;
    }

    const totalPrice = Math.round(
      basePrice * airline.factor * noise * cabinFactor * passengers * (1 + 0.08 * (stopCount + secondStops))
    );

    return {
      id: `${airline.name}-${idx}`,
      airline: airline.name,
      officialUrl: airline.officialUrl,
      baggage: airline.baggage,
      price: totalPrice,
      stopCount: stopCount + secondStops,
      duration: Number(totalDuration.toFixed(1)),
      rating: airline.rating,
      tripLabel: formatFlightTripLabel(origin, destination, secondOrigin, secondDestination),
      cabin,
      passengers,
      score: 0,
    };
  });

  state.flightResults = withRecommendedScore(generated, {
    higherIsBetterKeys: ["rating"],
    lowerIsBetterKeys: ["price", "duration", "stopCount"],
    weights: { price: 0.42, duration: 0.24, stopCount: 0.2, rating: 0.14 },
  });

  renderFlightResults();
}

function renderFlightResults() {
  const sort = els.flight.sort.value;
  const list = [...state.flightResults];

  if (sort === "price") {
    list.sort((a, b) => a.price - b.price);
  } else {
    list.sort((a, b) => b.score - a.score);
  }

  if (!list.length) {
    els.flight.results.innerHTML = '<div class="empty">검색 조건을 입력하면 항공권 비교 결과가 보여요.</div>';
    return;
  }

  const topRecommendation = sort === "recommended" ? list[0].id : null;

  els.flight.results.innerHTML = list
    .map((item) => {
      const badge = item.id === topRecommendation ? "<span>추천 1순위</span>" : "";
      return `
        <article class="result-card">
          <div class="result-top">
            <div>
              <strong>${escapeHTML(item.airline)}</strong>
              <span>${item.tripLabel}</span>
            </div>
            <div class="price">${formatKRW(item.price)}</div>
          </div>
          <div class="meta">
            ${badge}
            <span>${item.duration}시간</span>
            <span>경유 ${item.stopCount}회</span>
            <span>${item.passengers}인 / ${cabinLabel(item.cabin)}</span>
            <span>평점 ${item.rating.toFixed(1)}</span>
          </div>
          <p class="note">${escapeHTML(item.baggage)} · 가격 비교 후 공식 항공사로 바로 이동 가능</p>
          <div class="cta-row">
            <a href="${item.officialUrl}" target="_blank" rel="noopener noreferrer">공식 항공사 예약</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function initHotel() {
  els.hotel.searchBtn.addEventListener("click", searchHotels);
  els.hotel.sort.addEventListener("change", renderHotelResults);
}

function searchHotels() {
  const city = els.hotel.city.value;
  const guests = Math.max(1, Number(els.hotel.guests.value) || 1);
  const checkin = els.hotel.checkin.value;
  const checkout = els.hotel.checkout.value;

  els.hotel.feedback.textContent = "";

  if (!city || !hotelCatalog[city]?.length) {
    els.hotel.feedback.textContent = "선택한 도시의 숙소 데이터가 아직 없어요.";
    state.hotelResults = [];
    renderHotelResults();
    return;
  }

  if (!checkin || !checkout) {
    els.hotel.feedback.textContent = "체크인/체크아웃 날짜를 입력해 주세요.";
    state.hotelResults = [];
    renderHotelResults();
    return;
  }

  if (checkout <= checkin) {
    els.hotel.feedback.textContent = "체크아웃 날짜는 체크인 이후여야 해요.";
    state.hotelResults = [];
    renderHotelResults();
    return;
  }

  const nights = Math.max(1, daysBetween(checkin, checkout));
  const occupancyFactor = guests > 2 ? 1 + (guests - 2) * 0.18 : 1;

  const generated = hotelCatalog[city].map((hotel, idx) => {
    const seedKey = `${city}${hotel.name}${checkin}${guests}`;
    const agodaUnit = Math.round(hotel.basePrice * (0.94 + seededDecimal(seedKey) * 0.08));
    const tripUnit = Math.round(hotel.basePrice * (0.92 + seededDecimal(`${seedKey}-trip`) * 0.09));
    const officialUnit = Math.round(hotel.basePrice * (0.98 + seededDecimal(`${seedKey}-official`) * 0.05));

    const compareBest = Math.min(agodaUnit, tripUnit, officialUnit);
    const total = Math.round(compareBest * occupancyFactor * nights);

    return {
      id: `${hotel.name}-${idx}`,
      city,
      name: hotel.name,
      area: hotel.area,
      stars: hotel.stars,
      rating: hotel.rating,
      distance: hotel.distance,
      nights,
      guests,
      total,
      agodaUnit,
      tripUnit,
      officialUnit,
      officialUrl: hotel.officialUrl,
      score: 0,
    };
  });

  state.hotelResults = withRecommendedScore(generated, {
    higherIsBetterKeys: ["rating"],
    lowerIsBetterKeys: ["total", "distance"],
    weights: { total: 0.45, rating: 0.35, distance: 0.2 },
  });

  renderHotelResults();
}

function renderHotelResults() {
  const sort = els.hotel.sort.value;
  const list = [...state.hotelResults];

  if (sort === "price") {
    list.sort((a, b) => a.total - b.total);
  } else {
    list.sort((a, b) => b.score - a.score);
  }

  if (!list.length) {
    els.hotel.results.innerHTML = '<div class="empty">숙소 검색을 하면 도시별 추천 호텔을 비교할 수 있어요.</div>';
    return;
  }

  const topRecommendation = sort === "recommended" ? list[0].id : null;

  els.hotel.results.innerHTML = list
    .map((hotel) => {
      const bestSource = findLowestSource(hotel.agodaUnit, hotel.tripUnit, hotel.officialUnit);
      const recoBadge = hotel.id === topRecommendation ? "<span>추천 1순위</span>" : "";
      return `
        <article class="result-card">
          <div class="result-top">
            <div>
              <strong>${escapeHTML(hotel.name)}</strong>
              <span>${hotel.city} · ${escapeHTML(hotel.area)}</span>
            </div>
            <div class="price">${formatKRW(hotel.total)}</div>
          </div>
          <div class="meta">
            ${recoBadge}
            <span>${"★".repeat(hotel.stars)} ${hotel.stars}성급</span>
            <span>평점 ${hotel.rating.toFixed(1)}</span>
            <span>중심지 ${hotel.distance}km</span>
            <span>${hotel.nights}박 / ${hotel.guests}인</span>
          </div>
          <p class="note">최저 비교가: ${bestSource} · Agoda ${formatKRW(
            hotel.agodaUnit
          )} / Trip.com ${formatKRW(hotel.tripUnit)} / Official ${formatKRW(hotel.officialUnit)}</p>
          <div class="cta-row">
            <a href="${hotel.officialUrl}" target="_blank" rel="noopener noreferrer">호텔 공식 사이트 예약</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function initPlaces() {
  els.places.filterBtn.addEventListener("click", renderPlaces);
  els.places.results.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const placeId = target.dataset.placeAdd;
    if (!placeId) {
      return;
    }

    const city = els.places.city.value;
    const selected = placesCatalog[city]?.find((item) => item.id === placeId);
    if (!selected) {
      return;
    }

    if (state.placesPlan.some((item) => item.id === selected.id)) {
      return;
    }

    state.placesPlan.push({ ...selected, city });
    saveStorage(STORAGE_KEYS.placesPlan, state.placesPlan);
    renderPlacesPlan();
  });

  els.places.plan.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const removeId = target.dataset.placeRemove;
    if (!removeId) {
      return;
    }

    state.placesPlan = state.placesPlan.filter((item) => item.id !== removeId);
    saveStorage(STORAGE_KEYS.placesPlan, state.placesPlan);
    renderPlacesPlan();
  });
}

function renderPlaces() {
  const city = els.places.city.value;
  const theme = els.places.theme.value;
  const list = placesCatalog[city] || [];
  const filtered = theme === "all" ? list : list.filter((item) => item.theme === theme);

  if (!filtered.length) {
    els.places.results.innerHTML = '<div class="empty">조건에 맞는 장소가 없어요.</div>';
    return;
  }

  els.places.results.innerHTML = filtered
    .map(
      (item) => `
      <article class="result-card">
        <div class="result-top">
          <div>
            <strong>${escapeHTML(item.name)}</strong>
            <span>${escapeHTML(city)} · ${escapeHTML(item.area)}</span>
          </div>
          <div class="price">${themeLabel(item.theme)}</div>
        </div>
        <div class="meta">
          <span>추천 시간: ${escapeHTML(item.bestTime)}</span>
        </div>
        <p class="note">${escapeHTML(item.note)}</p>
        <div class="cta-row">
          <button type="button" data-place-add="${item.id}">일정에 추가</button>
        </div>
      </article>
    `
    )
    .join("");
}

function renderPlacesPlan() {
  if (!state.placesPlan.length) {
    els.places.plan.innerHTML = '<div class="empty">추가한 장소가 아직 없어요.</div>';
    return;
  }

  els.places.plan.innerHTML = state.placesPlan
    .map(
      (item) => `
      <div class="mini-item">
        <div>
          <strong>${escapeHTML(item.name)}</strong>
          <div class="note">${escapeHTML(item.city)} · ${escapeHTML(item.area)}</div>
        </div>
        <button type="button" data-place-remove="${item.id}">삭제</button>
      </div>
    `
    )
    .join("");
}

function initRestaurants() {
  els.restaurants.filterBtn.addEventListener("click", renderRestaurants);
  els.restaurants.results.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const id = target.dataset.restaurantAdd;
    if (!id) {
      return;
    }

    const city = els.restaurants.city.value;
    const selected = restaurantsCatalog[city]?.find((item) => item.id === id);
    if (!selected) {
      return;
    }

    if (state.restaurantsPlan.some((item) => item.id === selected.id)) {
      return;
    }

    state.restaurantsPlan.push({ ...selected, city });
    saveStorage(STORAGE_KEYS.restaurantsPlan, state.restaurantsPlan);
    renderRestaurantsPlan();
  });

  els.restaurants.plan.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const removeId = target.dataset.restaurantRemove;
    if (!removeId) {
      return;
    }

    state.restaurantsPlan = state.restaurantsPlan.filter((item) => item.id !== removeId);
    saveStorage(STORAGE_KEYS.restaurantsPlan, state.restaurantsPlan);
    renderRestaurantsPlan();
  });
}

function renderRestaurants() {
  const city = els.restaurants.city.value;
  const type = els.restaurants.type.value;
  const list = restaurantsCatalog[city] || [];
  const filtered = type === "all" ? list : list.filter((item) => item.type === type);

  if (!filtered.length) {
    els.restaurants.results.innerHTML = '<div class="empty">조건에 맞는 식당이 없어요.</div>';
    return;
  }

  els.restaurants.results.innerHTML = filtered
    .map(
      (item) => `
      <article class="result-card">
        <div class="result-top">
          <div>
            <strong>${escapeHTML(item.name)}</strong>
            <span>${escapeHTML(city)} · ${escapeHTML(item.area)}</span>
          </div>
          <div class="price">${restaurantTypeLabel(item.type)}</div>
        </div>
        <p class="note">${escapeHTML(item.note)}</p>
        <div class="cta-row">
          <button type="button" data-restaurant-add="${item.id}">식사 플랜 추가</button>
        </div>
      </article>
    `
    )
    .join("");
}

function renderRestaurantsPlan() {
  if (!state.restaurantsPlan.length) {
    els.restaurants.plan.innerHTML = '<div class="empty">추가한 식사 계획이 아직 없어요.</div>';
    return;
  }

  els.restaurants.plan.innerHTML = state.restaurantsPlan
    .map(
      (item) => `
      <div class="mini-item">
        <div>
          <strong>${escapeHTML(item.name)}</strong>
          <div class="note">${escapeHTML(item.city)} · ${restaurantTypeLabel(item.type)}</div>
        </div>
        <button type="button" data-restaurant-remove="${item.id}">삭제</button>
      </div>
    `
    )
    .join("");
}

function initRecord() {
  els.record.saveBtn.addEventListener("click", async () => {
    const title = els.record.title.value.trim();
    const date = els.record.date.value;
    const note = els.record.note.value.trim();
    const file = els.record.photo.files?.[0];

    els.record.feedback.textContent = "";

    if (!title) {
      els.record.feedback.textContent = "기록 제목을 입력해 주세요.";
      return;
    }

    if (!date) {
      els.record.feedback.textContent = "날짜를 선택해 주세요.";
      return;
    }

    if (!note && !file) {
      els.record.feedback.textContent = "메모 또는 사진 중 하나는 필요해요.";
      return;
    }

    const image = file ? await readImageAsDataURL(file) : "";

    const entry = {
      id: crypto.randomUUID(),
      title,
      date,
      note,
      image,
      createdAt: new Date().toISOString(),
    };

    state.records.unshift(entry);
    saveStorage(STORAGE_KEYS.records, state.records);

    els.record.title.value = "";
    els.record.note.value = "";
    els.record.photo.value = "";
    els.record.feedback.textContent = "기록이 저장됐어요.";

    renderRecords();
  });

  els.record.list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const id = target.dataset.recordRemove;
    if (!id) {
      return;
    }

    state.records = state.records.filter((entry) => entry.id !== id);
    saveStorage(STORAGE_KEYS.records, state.records);
    renderRecords();
  });
}

function renderRecords() {
  if (!state.records.length) {
    els.record.list.innerHTML = '<div class="empty">아직 저장된 여행 기록이 없어요.</div>';
    return;
  }

  const sorted = [...state.records].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  els.record.list.innerHTML = sorted
    .map((entry) => {
      const imageMarkup = entry.image
        ? `<img class="record-image" src="${entry.image}" alt="${escapeHTML(entry.title)}" />`
        : "";

      return `
      <article class="result-card">
        <div class="result-top">
          <div>
            <strong>${escapeHTML(entry.title)}</strong>
            <span>${escapeHTML(entry.date)}</span>
          </div>
        </div>
        ${imageMarkup}
        <p class="note">${escapeHTML(entry.note || "(메모 없음)")}</p>
        <div class="cta-row">
          <button type="button" data-record-remove="${entry.id}">삭제</button>
        </div>
      </article>
    `;
    })
    .join("");
}

function initDiary() {
  els.diary.saveBtn.addEventListener("click", () => {
    const date = els.diary.date.value;
    const mood = els.diary.mood.value;
    const content = els.diary.content.value.trim();

    els.diary.feedback.textContent = "";

    if (!date) {
      els.diary.feedback.textContent = "날짜를 선택해 주세요.";
      return;
    }

    if (!content) {
      els.diary.feedback.textContent = "일기 내용을 입력해 주세요.";
      return;
    }

    const existingIndex = state.diaries.findIndex((entry) => entry.date === date);
    const entry = {
      id: existingIndex >= 0 ? state.diaries[existingIndex].id : crypto.randomUUID(),
      date,
      mood,
      content,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      state.diaries[existingIndex] = entry;
    } else {
      state.diaries.push(entry);
    }

    saveStorage(STORAGE_KEYS.diaries, state.diaries);

    els.diary.content.value = "";
    els.diary.feedback.textContent = "일기가 저장됐어요.";
    renderDiaries();
  });

  els.diary.list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const deleteId = target.dataset.diaryDelete;
    const loadId = target.dataset.diaryLoad;

    if (deleteId) {
      state.diaries = state.diaries.filter((entry) => entry.id !== deleteId);
      saveStorage(STORAGE_KEYS.diaries, state.diaries);
      renderDiaries();
      return;
    }

    if (loadId) {
      const selected = state.diaries.find((entry) => entry.id === loadId);
      if (!selected) {
        return;
      }

      els.diary.date.value = selected.date;
      els.diary.mood.value = selected.mood;
      els.diary.content.value = selected.content;
    }
  });
}

function renderDiaries() {
  if (!state.diaries.length) {
    els.diary.list.innerHTML = '<div class="empty">아직 작성한 다이어리가 없어요.</div>';
    return;
  }

  const sorted = [...state.diaries].sort((a, b) => (a.date < b.date ? 1 : -1));

  els.diary.list.innerHTML = sorted
    .map(
      (entry) => `
      <article class="result-card">
        <div class="result-top">
          <div>
            <strong>${escapeHTML(entry.date)}</strong>
            <span>기분: ${escapeHTML(entry.mood)}</span>
          </div>
        </div>
        <p class="note">${escapeHTML(entry.content)}</p>
        <div class="cta-row">
          <button type="button" data-diary-load="${entry.id}">불러오기</button>
          <button type="button" data-diary-delete="${entry.id}">삭제</button>
        </div>
      </article>
    `
    )
    .join("");
}

function withRecommendedScore(items, config) {
  if (!items.length) {
    return items;
  }

  const { higherIsBetterKeys, lowerIsBetterKeys, weights } = config;
  const scoreMap = new Map(items.map((item) => [item.id, 0]));

  higherIsBetterKeys.forEach((key) => {
    const normalized = normalize(items.map((item) => item[key]));
    normalized.forEach((value, index) => {
      const target = items[index];
      const score = scoreMap.get(target.id) || 0;
      scoreMap.set(target.id, score + value * (weights[key] || 0));
    });
  });

  lowerIsBetterKeys.forEach((key) => {
    const normalized = normalize(items.map((item) => item[key])).map((value) => 1 - value);
    normalized.forEach((value, index) => {
      const target = items[index];
      const score = scoreMap.get(target.id) || 0;
      scoreMap.set(target.id, score + value * (weights[key] || 0));
    });
  });

  return items.map((item) => ({
    ...item,
    score: Number((scoreMap.get(item.id) || 0).toFixed(4)),
  }));
}

function normalize(values) {
  const max = Math.max(...values);
  const min = Math.min(...values);

  if (max === min) {
    return values.map(() => 1);
  }

  return values.map((value) => (value - min) / (max - min));
}

function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(baseDate, days) {
  const copy = new Date(baseDate);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function seededDecimal(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash % 1000) / 1000;
}

function seededInt(value, min, max) {
  const decimal = seededDecimal(value);
  return Math.floor(decimal * (max - min + 1)) + min;
}

function getRouteMetric(origin, destination) {
  const direct = routeProfile[`${origin}-${destination}`] || routeProfile[`${destination}-${origin}`];
  if (direct) {
    return direct;
  }

  const fallback = 330000 + seededInt(`${origin}-${destination}-price`, 0, 900000);
  const duration = Number((2.3 + seededDecimal(`${origin}-${destination}-duration`) * 12).toFixed(1));

  return {
    basePrice: fallback,
    duration,
  };
}

function formatKRW(amount) {
  return `₩${new Intl.NumberFormat("ko-KR").format(amount)}`;
}

function findLowestSource(agoda, trip, official) {
  const min = Math.min(agoda, trip, official);
  if (min === agoda) {
    return `Agoda ${formatKRW(agoda)}/박`;
  }
  if (min === trip) {
    return `Trip.com ${formatKRW(trip)}/박`;
  }
  return `Official ${formatKRW(official)}/박`;
}

function formatFlightTripLabel(origin, destination, secondOrigin, secondDestination) {
  if (state.tripType === "multi") {
    return `${origin} → ${destination} / ${secondOrigin} → ${secondDestination}`;
  }

  if (state.tripType === "round") {
    return `${origin} ↔ ${destination}`;
  }

  return `${origin} → ${destination}`;
}

function cabinLabel(cabin) {
  if (cabin === "premium") {
    return "Premium Economy";
  }
  if (cabin === "business") {
    return "Business";
  }
  return "Economy";
}

function themeLabel(theme) {
  if (theme === "nature") {
    return "자연";
  }
  if (theme === "culture") {
    return "문화";
  }
  return "포토";
}

function restaurantTypeLabel(type) {
  if (type === "local") {
    return "로컬";
  }
  if (type === "fine") {
    return "파인다이닝";
  }
  return "카페";
}

function readImageAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
