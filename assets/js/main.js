(function () {
  'use strict';

  const STORAGE_KEY = 'chiikawa-agile-progress-v1';
  const PLACEHOLDER = 'images/placeholder.svg';
  const FALLBACK_KEY = 'kai';
  const IMG_EXT_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

  // 角色名稱不在名單中（含 null）時，透過 try/catch 例外處理 fallback 到「鎧甲人」
  function resolveCharacter(key) {
    try {
      if (!key) throw new Error('speaker is null');
      const c = content.characters[key];
      if (!c) throw new Error('character "' + key + '" not found');
      return c;
    } catch (err) {
      console.warn('[character fallback]', err.message, '→ 使用鎧甲人');
      return content.characters[FALLBACK_KEY] || null;
    }
  }

  let content = null;
  let scenes = null;
  let typewriter = null;

  const state = {
    currentSlideIdx: 0,
    currentDialogueIdx: 0,
    visited: new Set(),
    focusKey: null
  };

  // ============================================================
  // 啟動
  // ============================================================
  window.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    try {
      const res = await fetch('content.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      content = await res.json();
    } catch (err) {
      showLoadError();
      console.error('載入 content.json 失敗：', err);
      return;
    }

    scenes = new SceneManager();
    typewriter = new Typewriter(document.getElementById('dialogue-text'));

    loadProgress();
    renderStaticText();
    bindTitleScene();
    bindMapScene();
    bindSlideScene();
    bindKeyboard();
    bindLightbox();

    scenes.show('title');
  }

  function showLoadError() {
    const el = document.getElementById('load-error');
    if (el) el.hidden = false;
  }

  // ============================================================
  // 靜態文字 (一次渲染)
  // ============================================================
  function renderStaticText() {
    const m = content.meta, ui = content.ui, mode = content.mode;
    
    // 依據 mode 套用不同首頁樣式
    const titleCharacters = document.querySelector('.title-characters');
    const enterBtn = document.getElementById('enter-btn');
    if (mode === "2") {
      if (titleCharacters) titleCharacters.style.display = "none";
      if (enterBtn) enterBtn.style.bottom = "calc(8% + 210px)";
    } else {
      if (titleCharacters) titleCharacters.style.display = "";
      if (enterBtn) enterBtn.style.bottom = "";
    }

    setText('t-subtitle', m.subtitle);
    setText('t-title', m.title);
    setText('t-tagline', m.tagline || '');
    setText('title-hint', ui.skipHint || '');

    setText('map-title', ui.mapTitle);
    setText('map-hint', ui.mapHint);
    setText('progress-total', content.slides.length);

    setText('all-clear-title', ui.allClearTitle);
    setText('all-clear-text', ui.allClearText);
    setText('hud-total', content.slides.length);

    document.querySelector('.enter-btn-text').textContent = ui.enterButton;
    document.querySelectorAll('.lbl-prev').forEach(el => el.textContent = ui.prev);
    document.querySelectorAll('.lbl-next').forEach(el => el.textContent = ui.next);
    document.querySelectorAll('.lbl-map').forEach(el => el.textContent = ui.backToMap);
    setText('skip-hint', ui.skipHint);
    setText('dialogue-end', ui.dialogueEnd);
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.title = ui.resetProgress || '重置進度';

    renderStamps();
    renderMapLandmarks();
    renderHudBar();
  }

  // ============================================================
  // Scene 1: Title
  // ============================================================
  function bindTitleScene() {
    document.getElementById('enter-btn').addEventListener('click', () => {
      scenes.show('map');
    });
  }

  // ============================================================
  // Scene 2: Map
  // ============================================================
  function bindMapScene() {
    document.getElementById('reset-btn').addEventListener('click', () => {
      if (!confirm('確定要重置所有進度嗎？')) return;
      state.visited.clear();
      saveProgress();
      renderStamps();
      renderMapLandmarks();
      renderHudBar();
    });
    document.getElementById('all-clear-close').addEventListener('click', () => {
      document.getElementById('all-clear').hidden = true;
    });
  }

  function renderMapLandmarks() {
    const inner = document.getElementById('map-inner');
    // 清掉舊的 landmark（保留 svg）
    inner.querySelectorAll('.landmark').forEach(el => el.remove());

    const slides = content.slides;
    slides.forEach((slide, idx) => {
      const lm = slide.landmark;
      const el = document.createElement('div');
      const cardBelow = lm.y < 35; // 靠上方的地標：資訊卡改顯示在下方
      el.className = 'landmark'
        + (state.visited.has(idx) ? ' done' : '')
        + (cardBelow ? ' card-below' : '');
      el.style.left = lm.x + '%';
      el.style.top  = lm.y + '%';

      // 角色迷你頭像 HTML
      const charDots = (slide.characters || []).slice(0, 3).map(key => {
        const c = content.characters[key];
        if (!c) return '';
        return `<img class="lc-char" src="${c.image}" alt="${c.name}" onerror="this.src='${PLACEHOLDER}'">`;
      }).join('');

      el.innerHTML = `
        <div class="landmark-icon-wrap">
          <span class="landmark-icon">${lm.icon}</span>
          <span class="landmark-badge">${idx + 1}</span>
        </div>
        <div class="landmark-label">${lm.name}</div>
        <div class="landmark-card">
          <div class="lc-title">${slide.title}</div>
          <div class="lc-subtitle">${slide.subtitle || ''}</div>
          <div class="lc-chars">${charDots}</div>
        </div>
      `;
      el.addEventListener('click', () => openSlide(idx));
      inner.appendChild(el);
    });

    renderMapPaths();
  }

  function renderMapPaths() {
    const svg = document.getElementById('map-paths');
    const slides = content.slides;
    const pts = slides.map(s => `${s.landmark.x},${s.landmark.y}`);
    const pathD = `M ${pts[0]} ` + pts.slice(1).map(p => `L ${p}`).join(' ');
    svg.innerHTML = `<path d="${pathD}" class="map-path-line"/>`;
  }

  function renderStamps() {
    const row = document.getElementById('stamp-row');
    row.innerHTML = '';
    const total = content.slides.length;
    for (let i = 0; i < total; i++) {
      const span = document.createElement('span');
      span.className = 'stamp' + (state.visited.has(i) ? ' done' : '');
      span.textContent = '✓';
      row.appendChild(span);
    }
    setText('progress-num', state.visited.size);

    if (state.visited.size === total) {
      setTimeout(() => {
        document.getElementById('all-clear').hidden = false;
      }, 400);
    }
  }

  // ============================================================
  // Scene 3: Slide
  // ============================================================
  function bindSlideScene() {
    const nextBtns = ['slide-next', 'foot-next'];
    const prevBtns = ['slide-prev', 'foot-prev'];
    const mapBtns  = ['slide-map',  'foot-map'];

    nextBtns.forEach(id => document.getElementById(id).addEventListener('click', goNextSlide));
    prevBtns.forEach(id => document.getElementById(id).addEventListener('click', goPrevSlide));
    mapBtns.forEach (id => document.getElementById(id).addEventListener('click', backToMap));

    document.getElementById('dialogue-box').addEventListener('click', advanceDialogue);
  }

  function openSlide(idx) {
    state.currentSlideIdx = idx;
    state.currentDialogueIdx = 0;
    renderSlide();
    scenes.show('slide');
  }

  function renderSlide() {
    const slide = content.slides[state.currentSlideIdx];
    if (!slide) return;

    state.focusKey = null;

    // HUD
    setText('hud-title', slide.title);
    setText('hud-cur', state.currentSlideIdx + 1);
    renderHudBar();

    // 標題區
    setText('slide-badge', slide.subtitle || '');
    setText('slide-title', slide.title);

    // 重點列表
    const ul = document.getElementById('slide-points');
    ul.innerHTML = '';
    (slide.points || []).forEach(p => {
      const li = document.createElement('li');
      const text = String(p).trim();
      if (IMG_EXT_RE.test(text)) {
        li.classList.add('point-image');
        const img = document.createElement('img');
        img.src = text.includes('/') ? text : `images/points/${text}`;
        img.alt = '';
        img.loading = 'lazy';
        img.onerror = () => { img.src = 'images/placeholder.svg'; };
        img.addEventListener('click', () => openLightbox(img.src));
        li.appendChild(img);
      } else {
        li.innerHTML = renderInline(text);
      }
      ul.appendChild(li);
    });

    // 角色立繪
    renderStage(slide);

    // 重播時強制重繪動畫
    ul.querySelectorAll('li').forEach(li => {
      li.style.animation = 'none';
      void li.offsetWidth;
      li.style.animation = '';
    });

    // 開始第一段對話
    state.currentDialogueIdx = 0;
    playDialogue();

    // 標為已看過
    state.visited.add(state.currentSlideIdx);
    saveProgress();
    renderStamps();
  }

  function renderStage(slide) {
    const stage = document.getElementById('stage-characters');
    stage.innerHTML = '';
    const keys = slide.characters || [];
    keys.forEach(key => {
      const c = resolveCharacter(key);
      if (!c) return;
      const img = document.createElement('img');
      img.className = 'stage-char';
      img.src = c.image;
      img.alt = c.name;
      img.dataset.key = key;
      img.onerror = () => { img.src = PLACEHOLDER; };
      stage.appendChild(img);
    });
    renderCharDots(slide);
    updateCharInfo(slide);
  }

  function renderCharDots(slide) {
    const left = document.getElementById('slide-left');
    if (!left) return;
    let dots = document.getElementById('char-dots');
    if (!dots) {
      dots = document.createElement('div');
      dots.id = 'char-dots';
      dots.className = 'char-dots';
      const info = document.getElementById('char-info');
      left.insertBefore(dots, info);
    }
    dots.innerHTML = '';
    const keys = slide.characters || [];
    if (keys.length <= 1) {
      dots.classList.add('hide');
      return;
    }
    dots.classList.remove('hide');
    keys.forEach(key => {
      const c = content.characters[key];
      if (!c) return;
      const btn = document.createElement('button');
      btn.className = 'char-dot';
      btn.type = 'button';
      btn.dataset.key = key;
      btn.title = c.name;
      const img = document.createElement('img');
      img.src = c.image;
      img.alt = c.name;
      img.onerror = () => { img.src = PLACEHOLDER; };
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        state.focusKey = key;
        applyFocus(slide);
        renderCharInfoText(key);
      });
      dots.appendChild(btn);
    });
  }

  function applyFocus(slide) {
    const key = state.focusKey;
    document.querySelectorAll('.stage-char').forEach(img => {
      img.classList.toggle('focus', img.dataset.key === key);
    });
    document.querySelectorAll('.char-dot').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.key === key);
    });
  }

  function renderCharInfoText(key) {
    const info = document.getElementById('char-info');
    const c = key ? resolveCharacter(key) : null;
    if (c) {
      info.innerHTML = `
        <div class="ci-name">${c.name}</div>
        <div class="ci-member">${c.member}</div>
        <div class="ci-dept">${c.department} · ${c.trait}</div>
      `;
    } else {
      info.innerHTML = `<div class="ci-name">旁白</div>`;
    }
  }

  function updateCharInfo(slide) {
    const d = slide.dialogues[state.currentDialogueIdx] || {};
    const speakerKey = d.speaker;
    const keys = slide.characters || [];

    let finalKey = speakerKey;
    if (!finalKey) finalKey = state.focusKey;
    if (!finalKey) finalKey = keys[0] || null;

    state.focusKey = finalKey;
    applyFocus(slide);
    renderCharInfoText(finalKey);
  }

  function playDialogue() {
    const slide = content.slides[state.currentSlideIdx];
    const d = slide.dialogues[state.currentDialogueIdx];
    if (!d) return;
    const box = document.getElementById('dialogue-box');
    const speakerEl = document.getElementById('dialogue-speaker');
    box.classList.remove('ready', 'ended');
    const speaker = d.speaker ? resolveCharacter(d.speaker) : null;
    speakerEl.textContent = speaker ? speaker.name : '';
    updateCharInfo(slide);
    typewriter.play(d.text, () => {
      if (state.currentDialogueIdx < slide.dialogues.length - 1) {
        box.classList.add('ready');
      } else {
        box.classList.add('ended');
      }
    });
  }

  function advanceDialogue() {
    // 打字中 → 跳過
    if (!typewriter.isDone()) {
      typewriter.skip();
      return;
    }
    // 已完成 → 推進下一段 or 下一關
    const slide = content.slides[state.currentSlideIdx];
    if (state.currentDialogueIdx < slide.dialogues.length - 1) {
      state.currentDialogueIdx++;
      playDialogue();
    } else {
      // 最後一段了，不自動跳關 (讓使用者主動按下一關)
    }
  }

  function renderHudBar() {
    const bar = document.getElementById('hud-bar');
    if (!bar) return;
    bar.innerHTML = '';
    const total = content.slides.length;
    for (let i = 0; i < total; i++) {
      const seg = document.createElement('div');
      seg.className = 'hud-bar-seg' +
        (i === state.currentSlideIdx ? ' active' : '') +
        (state.visited.has(i) ? ' done' : '');
      bar.appendChild(seg);
    }
  }

  function goNextSlide() {
    if (state.currentSlideIdx < content.slides.length - 1) {
      state.currentSlideIdx++;
      state.currentDialogueIdx = 0;
      renderSlide();
    } else {
      backToMap();
    }
  }

  function goPrevSlide() {
    if (state.currentSlideIdx > 0) {
      state.currentSlideIdx--;
      state.currentDialogueIdx = 0;
      renderSlide();
    }
  }

  function backToMap() {
    typewriter.stop();
    renderMapLandmarks();
    renderStamps();
    scenes.show('map');
  }

  // ============================================================
  // 鍵盤快捷鍵
  // ============================================================
  function bindKeyboard() {
    document.addEventListener('keydown', e => {
      const cur = scenes.current;
      if (cur === 'title') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          scenes.show('map');
        }
      } else if (cur === 'map') {
        if (e.key === 'Escape') scenes.show('title');
      } else if (cur === 'slide') {
        if (e.key === 'ArrowRight') { e.preventDefault(); goNextSlide(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrevSlide(); }
        else if (e.key === 'Escape') backToMap();
        else if (e.key === ' ') { e.preventDefault(); advanceDialogue(); }
      }
    });
  }

  // ============================================================
  // 工具
  // ============================================================
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // 簡易 inline markdown：**粗體** → <strong>
  function renderInline(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  // ============================================================
  // 圖片燈箱
  // ============================================================
  function bindLightbox() {
    const box = document.getElementById('image-lightbox');
    const closeBtn = document.getElementById('lightbox-close');
    if (!box || !closeBtn) return;
    closeBtn.addEventListener('click', closeLightbox);
    box.addEventListener('click', (e) => {
      if (e.target === box) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !box.hidden) closeLightbox();
    });
  }

  function openLightbox(src) {
    const box = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-img');
    if (!box || !img) return;
    img.src = src;
    box.hidden = false;
  }

  function closeLightbox() {
    const box = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-img');
    if (!box) return;
    box.hidden = true;
    if (img) img.src = '';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) state.visited = new Set(arr);
    } catch (e) { /* ignore */ }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.visited]));
    } catch (e) { /* ignore */ }
  }
})();
