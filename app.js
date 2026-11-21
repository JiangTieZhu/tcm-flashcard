(() => {
  'use strict';

  const STORAGE_KEY = 'tcm-materia-flashcards-v1';
  const DATA_URL = 'data/herbs.json';
  const PRIORITIES = ['重点', '次重点', '了解'];

  const $ = (id) => document.getElementById(id);
  const els = {
    loading: $('loading'),
    errorPanel: $('errorPanel'),
    errorText: $('errorText'),
    card: $('card'),
    cardFront: $('cardFront'),
    cardBack: $('cardBack'),
    emptyState: $('emptyState'),
    herbName: $('herbName'),
    herbCategory: $('herbCategory'),
    frontPriority: $('frontPriority'),
    backName: $('backName'),
    backCategory: $('backCategory'),
    backPriority: $('backPriority'),
    natureText: $('natureText'),
    effectsText: $('effectsText'),
    indicationsText: $('indicationsText'),
    usageText: $('usageText'),
    cautionText: $('cautionText'),
    pointsText: $('pointsText'),
    trapText: $('trapText'),
    backScroll: $('backScroll'),
    unitTag: $('unitTag'),
    cardCounter: $('cardCounter'),
    progressPct: $('progressPct'),
    progressFill: $('progressFill'),
    progressBar: $('progressBar'),
    positionText: $('positionText'),
    masteredText: $('masteredText'),
    masterBtn: $('masterBtn'),
    masterLabel: $('masterLabel'),
    prevBtn: $('prevBtn'),
    nextBtn: $('nextBtn'),
    flipBtn: $('flipBtn'),
    backFlipBtn: $('backFlipBtn'),
    randomBtn: $('randomBtn'),
    randomTop: $('randomTop'),
    resetBtn: $('resetBtn'),
    searchInput: $('searchInput'),
    clearSearch: $('clearSearch'),
    priorityChips: $('priorityChips'),
    categorySelect: $('categorySelect'),
    clearFilters: $('clearFilters'),
    toast: $('toast'),
    filterToggle: $('filterToggle'),
    sidebar: $('sidebar'),
    drawerBackdrop: $('drawerBackdrop'),
    drawerClose: $('drawerClose')
  };

  const defaultState = () => ({
    current: null,
    flipped: false,
    priority: '全部',
    category: '全部',
    mastered: []
  });

  function loadState() {
    const fallback = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return fallback;
      return {
        current: typeof saved.current === 'string' ? saved.current : null,
        flipped: Boolean(saved.flipped),
        priority: PRIORITIES.includes(saved.priority) ? saved.priority : '全部',
        category: typeof saved.category === 'string' ? saved.category : '全部',
        mastered: Array.isArray(saved.mastered) ? [...new Set(saved.mastered.filter((x) => typeof x === 'string'))] : []
      };
    } catch {
      return fallback;
    }
  }

  let state = loadState();
  let herbs = [];
  let deck = [];
  let index = 0;
  let query = '';
  let lastRenderedName = null;
  let searchTimer = null;
  let toastTimer = null;

  const masteredSet = new Set(state.mastered);

  function saveState() {
    state.mastered = [...masteredSet];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* 隐私模式下 localStorage 可能不可用，不影响当前学习 */
    }
  }

  function safe(value) {
    return value == null || value === '' ? '—' : String(value);
  }

  function setPriority(el, priority) {
    const value = PRIORITIES.includes(priority) ? priority : '了解';
    el.dataset.priority = value;
    el.textContent = value;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 2200);
  }

  function updateCounts() {
    const counts = { 全部: herbs.length, 重点: 0, 次重点: 0, 了解: 0 };
    herbs.forEach((h) => { if (counts[h.priority] != null) counts[h.priority] += 1; });
    document.querySelectorAll('[data-count]').forEach((el) => {
      el.textContent = counts[el.dataset.count] ?? 0;
    });
  }

  function buildCategoryOptions() {
    const groups = new Map();
    herbs.forEach((h) => {
      const category = h.category || '其他';
      const unit = category.split('·')[0];
      if (!groups.has(unit)) groups.set(unit, new Map());
      const sub = groups.get(unit);
      sub.set(category, (sub.get(category) || 0) + 1);
    });

    const fragment = document.createDocumentFragment();
    const allOption = document.createElement('option');
    allOption.value = '全部';
    allOption.textContent = `全部分类（${herbs.length}）`;
    fragment.appendChild(allOption);

    groups.forEach((categories, unit) => {
      const group = document.createElement('optgroup');
      group.label = unit;
      categories.forEach((count, category) => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = `${category}（${count}）`;
        group.appendChild(option);
      });
      fragment.appendChild(group);
    });

    els.categorySelect.replaceChildren(fragment);
    const categories = new Set(herbs.map((h) => h.category));
    if (state.category !== '全部' && !categories.has(state.category)) state.category = '全部';
    els.categorySelect.value = state.category;
  }

  function matchesQuery(herb) {
    if (!query) return true;
    const haystack = [
      herb.name, herb.category, herb.priority, herb.nature,
      herb.effects, herb.indications, herb.usage, herb.caution,
      herb.points, herb.trap
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  }

  function rebuildDeck({ keepFlip = false } = {}) {
    const preferred = state.current;
    deck = herbs.filter((h) =>
      (state.priority === '全部' || h.priority === state.priority) &&
      (state.category === '全部' || h.category === state.category) &&
      matchesQuery(h)
    );

    if (!deck.length) {
      index = 0;
      if (!keepFlip) state.flipped = false;
      return;
    }

    let found = preferred ? deck.findIndex((h) => h.name === preferred) : -1;
    if (found < 0) {
      found = 0;
      state.flipped = false;
    }
    index = found;
    state.current = deck[index].name;
    if (!keepFlip) state.flipped = false;
  }

  function updateFilterUI() {
    els.priorityChips.querySelectorAll('.chip').forEach((chip) => {
      const active = chip.dataset.priority === state.priority;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    els.categorySelect.value = state.category;
    els.searchInput.value = query;
    els.clearSearch.hidden = !query;
  }

  function render() {
    const hasCards = deck.length > 0;
    const herb = hasCards ? deck[index] : null;

    els.card.hidden = !hasCards;
    els.emptyState.hidden = hasCards;
    els.masterBtn.disabled = !hasCards;

    if (!hasCards) {
      els.unitTag.textContent = query ? '搜索结果' : '全部中药';
      els.cardCounter.textContent = '0 / 0';
      els.positionText.textContent = '第 0 / 0 味';
      els.progressPct.textContent = '0%';
      els.progressFill.style.width = '0%';
      els.progressBar.setAttribute('aria-valuenow', '0');
      els.masteredText.textContent = `已掌握 ${masteredSet.size} 味`;
      els.prevBtn.disabled = true;
      els.nextBtn.disabled = true;
      setMasterUI(false);
      document.title = '中医中药学 · 执业医师闪卡';
      return;
    }

    const name = safe(herb.name);
    const priority = PRIORITIES.includes(herb.priority) ? herb.priority : '了解';
    const category = safe(herb.category);
    const unit = category.split('·')[0];

    els.herbName.textContent = name;
    els.herbName.classList.toggle('name-long', name.length >= 5);
    els.herbCategory.textContent = category;
    setPriority(els.frontPriority, priority);

    els.backName.textContent = name;
    els.backCategory.textContent = category;
    setPriority(els.backPriority, priority);
    els.natureText.textContent = safe(herb.nature);
    els.effectsText.textContent = safe(herb.effects);
    els.indicationsText.textContent = safe(herb.indications);
    els.usageText.textContent = safe(herb.usage);
    els.cautionText.textContent = safe(herb.caution);
    els.pointsText.textContent = safe(herb.points);
    els.trapText.textContent = safe(herb.trap);

    els.unitTag.textContent = unit;
    els.cardCounter.textContent = `${index + 1} / ${deck.length}`;
    els.positionText.textContent = `第 ${index + 1} / ${deck.length} 味`;

    const pct = Math.round(((index + 1) / deck.length) * 100);
    els.progressPct.textContent = `${pct}%`;
    els.progressFill.style.width = `${pct}%`;
    els.progressBar.setAttribute('aria-valuenow', String(pct));
    els.masteredText.textContent = `已掌握 ${masteredSet.size} 味`;

    els.prevBtn.disabled = index <= 0;
    els.nextBtn.disabled = index >= deck.length - 1;

    els.card.classList.toggle('is-flipped', state.flipped);
    els.cardFront.setAttribute('aria-hidden', state.flipped ? 'true' : 'false');
    els.cardBack.setAttribute('aria-hidden', state.flipped ? 'false' : 'true');
    els.card.setAttribute('aria-label', `中药 ${name}，${priority}。${state.flipped ? '显示考试要点，按空格返回正面' : '按空格查看考试要点'}`);

    if (lastRenderedName !== name) {
      els.backScroll.scrollTop = 0;
      lastRenderedName = name;
    }

    setMasterUI(masteredSet.has(name));
    document.title = `${name} · ${priority}｜中药学闪卡`;
  }

  function setMasterUI(isMastered) {
    els.masterBtn.classList.toggle('is-mastered', isMastered);
    els.masterBtn.setAttribute('aria-pressed', isMastered ? 'true' : 'false');
    els.masterLabel.textContent = isMastered ? '已掌握' : '标记掌握';
  }

  function goTo(newIndex, { announce = false } = {}) {
    if (!deck.length) return;
    const target = Math.max(0, Math.min(deck.length - 1, newIndex));
    if (target === index && !announce) return;
    index = target;
    state.current = deck[index].name;
    state.flipped = false;
    saveState();
    render();
  }

  function toggleFlip(force) {
    if (!deck.length) return;
    state.flipped = typeof force === 'boolean' ? force : !state.flipped;
    saveState();
    render();
    if (state.flipped) els.backScroll.scrollTop = 0;
  }

  function toggleMaster() {
    if (!deck.length) return;
    const name = deck[index].name;
    if (masteredSet.has(name)) {
      masteredSet.delete(name);
      showToast(`已取消掌握：${name}`);
    } else {
      masteredSet.add(name);
      showToast(`已标记掌握：${name}`);
    }
    saveState();
    render();
  }

  function randomHerb() {
    if (!deck.length) return;
    if (deck.length === 1) {
      showToast('当前筛选下只有这一味药');
      return;
    }
    let next = index;
    while (next === index) next = Math.floor(Math.random() * deck.length);
    goTo(next);
    showToast(`随机抽取：${deck[index].name}`);
  }

  function applyFilters() {
    rebuildDeck();
    saveState();
    updateFilterUI();
    render();
  }

  function clearAllFilters() {
    state.priority = '全部';
    state.category = '全部';
    query = '';
    rebuildDeck();
    saveState();
    updateFilterUI();
    render();
  }

  function resetProgress() {
    const ok = window.confirm('确定重置吗？将回到第一味，并清除全部“已掌握”标记。');
    if (!ok) return;
    masteredSet.clear();
    state = defaultState();
    query = '';
    lastRenderedName = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    els.searchInput.value = '';
    els.clearSearch.hidden = true;
    rebuildDeck();
    saveState();
    updateFilterUI();
    render();
    showToast('学习记录已重置');
  }

  function openDrawer() {
    els.sidebar.classList.add('is-open');
    els.drawerBackdrop.hidden = false;
    els.filterToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    els.sidebar.classList.remove('is-open');
    els.drawerBackdrop.hidden = true;
    els.filterToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  function showError(message) {
    if (els.loading) {
      els.loading.classList.add('is-hidden');
      setTimeout(() => els.loading.remove(), 320);
    }
    els.errorPanel.hidden = false;
    if (message) els.errorText.textContent = message;
  }

  function bindEvents() {
    els.card.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      if (!state.flipped) toggleFlip(true);
    });

    els.backFlipBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleFlip(false);
    });

    els.flipBtn.addEventListener('click', () => toggleFlip());
    els.prevBtn.addEventListener('click', () => goTo(index - 1));
    els.nextBtn.addEventListener('click', () => goTo(index + 1));
    els.masterBtn.addEventListener('click', toggleMaster);
    els.randomBtn.addEventListener('click', randomHerb);
    els.randomTop.addEventListener('click', randomHerb);
    els.resetBtn.addEventListener('click', resetProgress);
    els.clearFilters.addEventListener('click', clearAllFilters);

    els.priorityChips.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (!chip) return;
      state.priority = chip.dataset.priority;
      applyFilters();
    });

    els.categorySelect.addEventListener('change', () => {
      state.category = els.categorySelect.value;
      applyFilters();
    });

    els.searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        query = els.searchInput.value.trim().toLowerCase();
        els.clearSearch.hidden = !query;
        rebuildDeck();
        render();
      }, 120);
    });

    els.clearSearch.addEventListener('click', () => {
      query = '';
      els.searchInput.value = '';
      els.clearSearch.hidden = true;
      rebuildDeck();
      saveState();
      render();
      els.searchInput.focus();
    });

    els.filterToggle.addEventListener('click', openDrawer);
    els.drawerClose.addEventListener('click', closeDrawer);
    els.drawerBackdrop.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('button, input, select, textarea, a, [contenteditable="true"]')) return;
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        toggleFlip();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(index - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key.toLowerCase() === 'm') {
        toggleMaster();
      } else if (event.key.toLowerCase() === 'r') {
        randomHerb();
      } else if (event.key === 'Escape') {
        if (els.sidebar.classList.contains('is-open')) closeDrawer();
        else if (query) {
          query = '';
          els.searchInput.value = '';
          els.clearSearch.hidden = true;
          rebuildDeck();
          render();
        }
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 980 && els.sidebar.classList.contains('is-open')) closeDrawer();
    });
  }

  async function init() {
    bindEvents();
    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data) || !data.length) throw new Error('数据文件为空或格式不正确');
      herbs = data.filter((h) => h && h.name);
      if (!herbs.length) throw new Error('数据文件中没有可用的中药记录');

      updateCounts();
      buildCategoryOptions();

      const hadSavedPosition = Boolean(state.current);
      rebuildDeck({ keepFlip: true });
      updateFilterUI();
      render();

      if (els.loading) {
        els.loading.classList.add('is-hidden');
        setTimeout(() => els.loading.remove(), 340);
      }

      if (hadSavedPosition && deck.length > 0) {
        const message = state.flipped
          ? `已恢复上次位置：第 ${index + 1} 味（背面）`
          : `已恢复上次位置：第 ${index + 1} / ${deck.length} 味`;
        setTimeout(() => showToast(message), 500);
      }
    } catch (error) {
      const isFile = location.protocol === 'file:';
      const reason = isFile
        ? '浏览器禁止直接双击打开时读取 JSON 数据。请在本文件夹运行下面的命令，再通过本地网址访问。'
        : `读取数据失败：${error.message}。请确认 data/herbs.json 存在，并通过本地服务器访问。`;
      showError(reason);
    }

    saveState();
  }

  init();
})();
