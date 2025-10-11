(function () {
  const DAILY_ARTICLES_CONTAINER_ID = "daily-articles";
  const FILTERED_ARTICLES_CONTAINER_ID = "filtered-articles";
  const FILTER_RESULTS_ID = "filter-results";
  const TOPICS_CONTAINER_ID = "topics";
  const ALL_ARTICLES_LIST_ID = "all-articles-list"; // контейнер для полного списка статей слева
  const DAILY_DATE_ID = "daily-date";
  const COPYRIGHT_ID = "copyright";
  const DAILY_COUNT_DEFAULT = 6;
  const CAROUSEL_STEP_PCT = 0.92; // move roughly one card on mobile

  document.addEventListener("DOMContentLoaded", () => {
    setCopyright();
    setDailyDateLabel();
    initialize();
    setupThemeToggle();
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

      // Правый сайдбар: темы (без кнопки «Все»)
      renderTopics(data.topics, topicParam);

      // Левый сайдбар: полный список статей (алфавитно)
      renderArticlesLeft(data.articles);

      // Статьи дня (всегда случайные 3, не зависят от фильтра)
      const dailyCount = Math.min(DAILY_COUNT_DEFAULT, data.articles.length);
      const daily = selectDeterministicDaily(data.articles, dailyCount);
      renderArticles(daily, DAILY_ARTICLES_CONTAINER_ID);

      // Фильтр по выбранной теме
      if (topicParam) {
        const items = data.articles.filter(a =>
          (a.topics || []).some(t => normalize(t) === normalize(topicParam))
        );
        showFilterResults(items, topicParam);
      } else {
        hideFilterResults();
      }
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
      const isActive = active ? normalize(active) === normalize(topicValue) : topicValue === "";
      if (isActive) a.classList.add("active");
      return a;
    };

    // Show "Темы дня" first, then topics (без кнопки "Все")
    wrap.appendChild(makeLink("Темы дня", ""));
    topics.forEach(t => wrap.appendChild(makeLink(t, t)));
  }

  function renderArticlesLeft(articles) {
    const wrap = document.getElementById(ALL_ARTICLES_LIST_ID);
    if (!wrap) return;
    wrap.innerHTML = "";

    const sorted = articles.slice().sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'));
    
    // Показываем только первые 10 статей
    const visibleArticles = sorted.slice(0, 10);
    const hiddenArticles = sorted.slice(10);
    
    // Рендерим видимые статьи
    visibleArticles.forEach((article) => {
      const a = document.createElement("a");
      a.className = "topic-link";
      a.textContent = article.title;
      a.title = article.title; // Добавляем title для CSS селектора
      a.href = article.url || "#";
      a.target = article.url ? "_blank" : "_self";
      a.rel = article.url ? "noopener" : "";
      wrap.appendChild(a);
    });
    
    // Если есть скрытые статьи, добавляем кнопку "Показать все"
    if (hiddenArticles.length > 0) {
      const expandButton = document.createElement("button");
      expandButton.className = "topic-link expand-button";
      expandButton.innerHTML = "Показать все статьи ↓";
      expandButton.onclick = () => toggleAllArticles(wrap, hiddenArticles, expandButton);
      wrap.appendChild(expandButton);
    }
  }
  
  function toggleAllArticles(container, hiddenArticles, button) {
    const isExpanded = button.textContent.includes("Скрыть");
    
    if (isExpanded) {
      // Скрываем дополнительные статьи
      const additionalArticles = container.querySelectorAll('.additional-article');
      additionalArticles.forEach(article => article.remove());
      button.innerHTML = "Показать все статьи ↓";
    } else {
      // Показываем все статьи
      hiddenArticles.forEach((article) => {
        const a = document.createElement("a");
        a.className = "topic-link additional-article";
        a.textContent = article.title;
        a.title = article.title; // Добавляем title для CSS селектора
        a.href = article.url || "#";
        a.target = article.url ? "_blank" : "_self";
        a.rel = article.url ? "noopener" : "";
        container.insertBefore(a, button);
      });
      button.innerHTML = "Скрыть дополнительные статьи ↑";
    }
  }

  function withParam(pathname, key, value) {
    if (!value) return pathname;
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    return `${pathname}?${params.toString()}`;
  }

  function renderArticles(items, containerId) {
    const wrap = document.getElementById(containerId);
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

  function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    
    if (!themeToggle) return;

    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }

  function ensureFilterResultsContainer() {
    let wrap = document.getElementById(FILTER_RESULTS_ID);
    if (wrap) return wrap;
    const content = document.querySelector('.content');
    if (!content) return null;
    wrap = document.createElement('section');
    wrap.id = FILTER_RESULTS_ID;
    const title = document.createElement('h2');
    title.className = 'section-title';
    title.textContent = 'Результаты поиска';
    const grid = document.createElement('div');
    grid.id = FILTERED_ARTICLES_CONTAINER_ID;
    grid.className = 'grid';
    wrap.appendChild(title);
    wrap.appendChild(grid);
    content.appendChild(wrap);
    return wrap;
  }

  function showFilterResults(articles, topic) {
    const wrap = ensureFilterResultsContainer();
    if (!wrap) return;
    // Обновим заголовок с выбранной темой
    const title = wrap.querySelector('.section-title');
    if (title) title.textContent = 'Результаты поиска';
    renderArticles(articles, FILTERED_ARTICLES_CONTAINER_ID);
  }

  function hideFilterResults() {
    const filterResults = document.getElementById(FILTER_RESULTS_ID);
    if (filterResults) filterResults.remove();
    const filteredArticles = document.getElementById(FILTERED_ARTICLES_CONTAINER_ID);
    if (filteredArticles) {
      filteredArticles.innerHTML = '';
      // если обернут в секцию результатов, уберем и ее
      const parent = filteredArticles.closest(`#${FILTER_RESULTS_ID}`);
      if (parent) parent.remove();
    }
  }
})();


