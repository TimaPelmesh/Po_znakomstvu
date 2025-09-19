(function () {
  const ARTICLES_CONTAINER_ID = "articles";
  const TOPICS_CONTAINER_ID = "topics";
  const DAILY_DATE_ID = "daily-date";
  const COPYRIGHT_ID = "copyright";
  const DAILY_COUNT_DEFAULT = 6;
  const CAROUSEL_STEP_PCT = 0.92; // move roughly one card on mobile

  document.addEventListener("DOMContentLoaded", () => {
    setCopyright();
    setDailyDateLabel();
    initialize();
  });

  function setCopyright() {
    const target = document.getElementById(COPYRIGHT_ID);
    if (target) target.textContent = `© ${new Date().getFullYear()}`;
  }

  function setDailyDateLabel() {
    const el = document.getElementById(DAILY_DATE_ID);
    const elContent = document.getElementById("daily-date-content");
    if (!el && !elContent) return;
    const d = new Date();
    const dateStr = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long" });
    const text = `Обновляется ежедневно · ${dateStr}`;
    if (el) el.textContent = text;
    if (elContent) elContent.textContent = text;
  }

  async function initialize() {
    try {
      const data = await fetchJson("data.json");
      const urlParams = new URLSearchParams(window.location.search);
      const topicParam = urlParams.get("topic");

      renderTopics(data.topics, topicParam);

      const filtered = topicParam
        ? data.articles.filter(a => (a.topics || []).map(normalize).includes(normalize(topicParam)))
        : data.articles;

      const dailyCount = Math.min(DAILY_COUNT_DEFAULT, filtered.length);
      const daily = selectDeterministicDaily(filtered, dailyCount);
      renderArticles(daily);
      setupCarouselControls();
    } catch (err) {
      console.error(err);
      renderError("Не удалось загрузить данные. Проверьте файл data.json.");
    }
  }

  async function fetchJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} while fetching ${path}`);
    return res.json();
  }

  function normalize(v) {
    return String(v || "").trim().toLowerCase();
  }

  function renderTopics(topics, active) {
    const wrap = document.getElementById(TOPICS_CONTAINER_ID);
    if (!wrap) return;
    wrap.innerHTML = "";

    const makeLink = (label, topicValue) => {
      const a = document.createElement("a");
      a.className = "topic-link";
      a.textContent = label;
      a.href = topicValue ? withParam(window.location.pathname, "topic", topicValue) : window.location.pathname;
      if (active && normalize(active) === normalize(topicValue)) {
        a.style.borderColor = "var(--accent)";
        a.style.color = "var(--accent)";
      }
      return a;
    };

    // Show topics first; place "Все" at the end
    topics.forEach(t => wrap.appendChild(makeLink(t, t)));
    wrap.appendChild(makeLink("Все", ""));
  }

  function withParam(pathname, key, value) {
    if (!value) return pathname;
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    return `${pathname}?${params.toString()}`;
  }

  function renderArticles(items) {
    const wrap = document.getElementById(ARTICLES_CONTAINER_ID);
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!items.length) {
      renderEmpty(wrap);
      return;
    }

    for (const article of items) {
      const card = document.createElement("article");
      card.className = "card";

      const tags = document.createElement("div");
      tags.className = "tags";
      (article.topics || []).slice(0, 3).forEach((t, idx) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = t;
        applyTagColor(tag, t, idx);
        tags.appendChild(tag);
      });

      const title = document.createElement("h3");
      title.textContent = article.title;

      const excerpt = document.createElement("p");
      excerpt.textContent = article.excerpt || "";

      const actions = document.createElement("div");
      actions.className = "actions";
      if (article.url) {
        const link = document.createElement("a");
        link.className = "link";
        link.href = article.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Читать";
        actions.appendChild(link);
      }

      card.appendChild(tags);
      card.appendChild(title);
      if (excerpt.textContent) card.appendChild(excerpt);
      card.appendChild(actions);
      wrap.appendChild(card);
    }
  }

  function applyTagColor(el, text, idx) {
    const pastel = pickPastelColor(hashString(text + idx));
    el.style.backgroundColor = pastel.bg;
    el.style.borderColor = pastel.border;
    el.style.color = pastel.fg;
  }

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pickPastelColor(seed) {
    const prng = mulberry32(seed);
    const hue = Math.floor(prng() * 360);
    const bg = `hsl(${hue} 90% 96%)`;
    const border = `hsl(${hue} 70% 85%)`;
    const fg = `hsl(${hue} 40% 30%)`;
    return { bg, border, fg };
  }

  function setupCarouselControls() {
    const wrap = document.getElementById(ARTICLES_CONTAINER_ID);
    const prev = document.getElementById("carousel-prev");
    const next = document.getElementById("carousel-next");
    if (!wrap || !prev || !next) return;

    const isMobile = () => window.matchMedia("(max-width: 600px)").matches;

    function scrollByStep(dir) {
      if (!isMobile()) return;
      const step = wrap.clientWidth * CAROUSEL_STEP_PCT;
      wrap.scrollBy({ left: dir * step, behavior: "smooth" });
    }

    prev.addEventListener("click", () => scrollByStep(-1));
    next.addEventListener("click", () => scrollByStep(1));

    // swipe support
    let startX = 0;
    let isDown = false;
    wrap.addEventListener("pointerdown", (e) => {
      if (!isMobile()) return;
      isDown = true;
      startX = e.clientX;
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener("pointerup", (e) => {
      if (!isMobile()) return;
      if (!isDown) return;
      isDown = false;
      const dx = e.clientX - startX;
      const threshold = 30; // minimal movement to trigger
      if (dx > threshold) scrollByStep(-1);
      else if (dx < -threshold) scrollByStep(1);
    });
  }

  function renderEmpty(wrap) {
    const notice = document.createElement("div");
    notice.className = "card";
    const p = document.createElement("p");
    p.textContent = "По этой теме пока пусто. Попробуйте выбрать другую тему.";
    notice.appendChild(p);
    wrap.appendChild(notice);
  }

  function renderError(message) {
    const wrap = document.getElementById(ARTICLES_CONTAINER_ID);
    if (!wrap) return;
    wrap.innerHTML = "";
    const card = document.createElement("div");
    card.className = "card";
    const p = document.createElement("p");
    p.textContent = message;
    card.appendChild(p);
    wrap.appendChild(card);
  }

  function selectDeterministicDaily(list, count) {
    const seed = getDateSeed();
    const prng = mulberry32(seed);
    const copy = list.slice();
    // Fisher-Yates with seeded PRNG
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
  }

  function getDateSeed() {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1; // 1..12
    const d = now.getUTCDate();
    // Simple hash YYYYMMDD
    return y * 10000 + m * 100 + d;
  }

  // Deterministic PRNG
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
})();


