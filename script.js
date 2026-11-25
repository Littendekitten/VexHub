(() => {
  'use strict';

  const GAME = {
    id: 'sunset-strike-3d',
    title: 'SUNSET STRIKE 3D',
    description: 'Defend the Sunset Frontier in Vexuno Studio’s first arcade space shooter. Pilot your interceptor, clear hostile waves, and take down the flagship.',
    release: '0.1 BETA',
    status: 'AVAILABLE NOW · 0.1 BETA',
    tags: ['VEXUNO ORIGINAL', '0.1 BETA', 'ARCADE SPACE SHOOTER'],
    url: 'games/sunset-strike-3d/index.html'
  };

  const storage = {
    read(key, fallback) {
      try {
        const value = localStorage.getItem(`vexhub:${key}`);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try { localStorage.setItem(`vexhub:${key}`, JSON.stringify(value)); } catch { /* Storage may be unavailable in private browsing. */ }
    }
  };

  const state = {
    page: 'dashboard',
    search: '',
    favorites: storage.read('favorites', []),
    profileName: storage.read('profileName', 'Player'),
    accent: storage.read('accent', 'green'),
    reduceMotion: storage.read('reduceMotion', false)
  };

  const pageContent = document.getElementById('page-content');
  const searchInput = document.getElementById('global-search');
  const toastRegion = document.getElementById('toast-region');
  const pageLabels = { dashboard: 'DASHBOARD', discover: 'DISCOVER', library: 'MY LIBRARY', settings: 'SETTINGS' };

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function toast(message) {
    const item = document.createElement('div');
    item.className = 'toast';
    item.textContent = message;
    toastRegion.appendChild(item);
    window.setTimeout(() => item.remove(), 2800);
  }

  function isFavorite() { return state.favorites.includes(GAME.id); }

  function gameCard() {
    const saved = isFavorite();
    return `
      <article class="featured-card sunset-featured">
        <a class="game-cover sunset-cover" href="${GAME.url}" aria-label="Play ${GAME.title}">
          <span class="cover-stamp">VEXUNO ORIGINAL / 001</span>
          <span class="sunset-sun" aria-hidden="true"></span>
          <span class="sunset-horizon" aria-hidden="true"></span>
          <span class="sunset-ship" aria-hidden="true">✦</span>
          <span class="sunset-cover-title">SUNSET <b>STRIKE</b><small>3D / FRONTIER ASSAULT</small></span>
          <span class="sunset-cover-number">001</span>
        </a>
        <div class="game-details">
          <p class="release-label">${GAME.status}</p>
          <h3>${GAME.title}</h3>
          <p class="game-description">${GAME.description}</p>
          <div class="game-tags">${GAME.tags.map(tag => `<span class="game-tag">${tag}</span>`).join('')}</div>
        </div>
        <div class="game-action">
          <a class="button button-primary launch-game-button" href="${GAME.url}">PLAY NOW <span aria-hidden="true">↗</span></a>
          <button class="favorite-button ${saved ? 'saved' : ''}" data-action="favorite" type="button" aria-pressed="${saved}"><span class="heart" aria-hidden="true">${saved ? '♥' : '♡'}</span>${saved ? 'SAVED TO LIBRARY' : 'ADD TO LIBRARY'}</button>
        </div>
      </article>`;
  }

  function dashboardTemplate() {
    return `
      <section class="welcome-row">
        <div><p class="eyebrow"><span class="eyebrow-line"></span> YOUR VEXUNO SPACE</p>
          <h1>Welcome to <span>VexHub.</span></h1>
          <p class="welcome-subtitle">One home for everything Vexuno. Launch SUNSET STRIKE 3D, keep your favourites close, and discover what’s next.</p>
        </div><div class="welcome-mark" aria-hidden="true">V<span>.</span></div>
      </section>
      <section class="hero-panel" aria-labelledby="hero-title">
        <div class="hero-grid" aria-hidden="true"></div><div class="hero-glow" aria-hidden="true"></div>
        <div class="hero-content">
          <div class="hero-tag"><span class="pulse-dot"></span> THE VEXUNO UNIVERSE</div>
          <p class="hero-overline">PLAY. EXPLORE. REPEAT.</p>
          <h2 id="hero-title">Your next<br /><span>adventure</span> starts here.</h2>
          <p class="hero-description">Your first mission is ready. Launch the Vexuno original, defend the frontier, and chase your personal best.</p>
          <div class="hero-actions"><button class="button button-primary" data-page="discover" type="button">Explore games <span aria-hidden="true">↗</span></button><button class="button button-quiet" data-page="library" type="button">Open library <span aria-hidden="true">→</span></button></div>
        </div>
        <div class="hero-art" aria-hidden="true"><div class="art-ring ring-one"></div><div class="art-ring ring-two"></div><div class="art-ring ring-three"></div><div class="art-core"><span>V</span></div><div class="art-spark spark-one"></div><div class="art-spark spark-two"></div><div class="art-spark spark-three"></div><div class="art-caption">VEXUNO<br /><span>STUDIO</span></div></div>
        <div class="hero-index"><span>01</span><i></i><span>VEXHUB</span></div>
      </section>
      <section class="section-block"><div class="section-heading"><div><p class="eyebrow">HAND-PICKED BY VEXUNO</p><h2>In the spotlight</h2></div><button class="subtle-link" data-page="discover" type="button">View all <span aria-hidden="true">↗</span></button></div><div id="featured-game">${gameCard()}</div></section>
      <section class="bottom-grid">
        <div class="section-card stats-card"><div class="card-heading"><div><p class="eyebrow">YOUR COLLECTION</p><h3>Your space, at a glance</h3></div><span class="mini-icon">▦</span></div><div class="stats-grid"><div class="stat-item"><strong>01</strong><span>Games available</span></div><div class="stat-item"><strong>${String(state.favorites.length).padStart(2, '0')}</strong><span>Favourites</span></div><div class="stat-item"><strong>01</strong><span>Playable</span></div></div></div>
        <div class="section-card update-card"><div class="update-top"><span class="update-icon">✳</span><span class="update-label">FROM THE STUDIO</span></div><h3>Your first mission is live.</h3><p>SUNSET STRIKE 3D is ready to play. Take control of your interceptor and defend the Sunset Frontier.</p><a class="text-button" href="games/sunset-strike-3d/index.html">Launch the game <span aria-hidden="true">↗</span></a></div>
      </section>
      ${footerTemplate()}`;
  }

  function footerTemplate() {
    return `<footer class="page-footer"><span>© ${new Date().getFullYear()} VEXUNO STUDIO</span><span>MADE FOR THE NEXT ADVENTURE <b>✳</b></span></footer>`;
  }

  function discoverTemplate() {
    const found = `${GAME.title} ${GAME.description} ${GAME.tags.join(' ')}`.toLowerCase().includes(state.search.toLowerCase());
    return `<header class="page-header"><p class="eyebrow">THE VEXUNO CATALOGUE</p><h1>Find your next <span>favourite.</span></h1><p>The Vexuno catalogue starts here. SUNSET STRIKE 3D is available now in its first 0.1 BETA build.</p></header>
      <div class="results-bar"><span>SHOWING <strong>${found ? '01' : '00'}</strong> OF 01 GAMES</span><span>${state.search ? `SEARCH: “${escapeHTML(state.search)}”` : 'LATEST RELEASES'}</span></div>
      ${found ? gameCard() : `<div class="empty-state"><div class="empty-symbol">⌕</div><h2>No games found</h2><p>We couldn't find a game matching “${escapeHTML(state.search)}”. Try another search.</p><button class="button button-primary" data-action="clear-search" type="button">Clear search</button></div>`}
      ${footerTemplate()}`;
  }

  function libraryTemplate() {
    const hasSaved = isFavorite();
    return `<header class="page-header"><p class="eyebrow">YOUR PERSONAL COLLECTION</p><h1>My <span>library.</span></h1><p>Your saved Vexuno games, all in one place. Launch games straight from your library. Favourites are stored on this device.</p></header>
      <div class="results-bar"><span>SAVED GAMES <strong>${String(state.favorites.length).padStart(2, '0')}</strong></span><span>LOCAL COLLECTION</span></div>
      ${hasSaved ? gameCard() : `<div class="empty-state"><div class="empty-symbol">＋</div><h2>Your library is waiting</h2><p>Save games you like and they'll show up here. Add SUNSET STRIKE 3D to your collection to keep it close.</p><button class="button button-primary" data-page="discover" type="button">Discover games <span aria-hidden="true">↗</span></button></div>`}
      ${footerTemplate()}`;
  }

  function settingsTemplate() {
    return `<header class="page-header"><p class="eyebrow">MAKE VEXHUB YOURS</p><h1>Client <span>settings.</span></h1><p>Personalise your VexHub experience. These preferences are saved locally in this browser.</p></header>
      <div class="settings-layout">
        <section class="settings-panel"><h2>Profile</h2><p>Choose the name shown in your VexHub client.</p>
          <div class="setting-row"><div><strong>Display name</strong><small>This is only a local profile, not an online account.</small></div><input class="setting-input" id="profile-name-input" maxlength="20" value="${escapeHTML(state.profileName)}" aria-label="Display name" /></div>
          <div class="setting-row"><div><strong>Accent colour</strong><small>Pick the colour used across your client.</small></div><div class="accent-options" role="group" aria-label="Accent colour"><button class="accent-choice ${state.accent === 'green' ? 'selected' : ''}" data-accent="green" type="button" aria-label="Green" aria-pressed="${state.accent === 'green'}"></button><button class="accent-choice ${state.accent === 'blue' ? 'selected' : ''}" data-accent="blue" type="button" aria-label="Blue" aria-pressed="${state.accent === 'blue'}"></button><button class="accent-choice ${state.accent === 'violet' ? 'selected' : ''}" data-accent="violet" type="button" aria-label="Violet" aria-pressed="${state.accent === 'violet'}"></button></div></div>
          <div class="setting-row"><div><strong>Reduced motion</strong><small>Limit decorative animations and transitions.</small></div><button class="toggle" data-action="motion" type="button" aria-label="Toggle reduced motion" aria-pressed="${state.reduceMotion}"></button></div>
        </section>
        <aside class="settings-panel"><div class="about-mark">V</div><p class="eyebrow">ABOUT THIS CLIENT</p><h2>VexHub</h2><p>Your central hub for games from Vexuno Studio.</p><ul class="about-list"><li><span>Client version</span><strong>1.0.0 Preview</strong></li><li><span>Platform</span><strong>Web client</strong></li><li><span>Studio</span><strong>Vexuno Studio</strong></li><li><span>Account system</span><strong>Not connected</strong></li></ul>
        </aside>
      </div>${footerTemplate()}`;
  }

  function updateShell() {
    document.getElementById('breadcrumb-current').textContent = pageLabels[state.page] || 'DASHBOARD';
    document.querySelectorAll('[data-page]').forEach(button => {
      button.classList.toggle('active', button.dataset.page === state.page && button.classList.contains('nav-item'));
      if (button.classList.contains('nav-item')) button.setAttribute('aria-current', button.dataset.page === state.page ? 'page' : 'false');
    });
    document.getElementById('library-count').textContent = state.favorites.length;
    document.getElementById('top-profile-name').textContent = state.profileName || 'Player';
    document.getElementById('top-avatar').textContent = (state.profileName || 'P').trim().charAt(0).toUpperCase() || 'P';
    document.documentElement.dataset.accent = state.accent;
    document.body.classList.toggle('reduce-motion', state.reduceMotion);
  }

  function render() {
    updateShell();
    const templates = { dashboard: dashboardTemplate, discover: discoverTemplate, library: libraryTemplate, settings: settingsTemplate };
    pageContent.innerHTML = (templates[state.page] || dashboardTemplate)();
    pageContent.scrollTop = 0;
    if (state.page === 'settings') {
      const profileInput = document.getElementById('profile-name-input');
      profileInput.addEventListener('change', () => {
        const nextName = profileInput.value.trim().slice(0, 20) || 'Player';
        state.profileName = nextName;
        storage.write('profileName', nextName);
        updateShell();
        toast('Profile name updated');
      });
    }
  }

  function navigate(page) {
    if (!pageLabels[page]) return;
    state.page = page;
    if (page !== 'discover') {
      state.search = '';
      searchInput.value = '';
    }
    render();
  }

  function toggleFavorite() {
    if (isFavorite()) {
      state.favorites = state.favorites.filter(id => id !== GAME.id);
      toast('Removed from your library');
    } else {
      state.favorites = [...state.favorites, GAME.id];
      toast('Added to your library');
    }
    storage.write('favorites', state.favorites);
    render();
  }

  document.addEventListener('click', event => {
    const pageButton = event.target.closest('[data-page]');
    if (pageButton) {
      navigate(pageButton.dataset.page);
      return;
    }
    const accentButton = event.target.closest('[data-accent]');
    if (accentButton) {
      state.accent = accentButton.dataset.accent;
      storage.write('accent', state.accent);
      render();
      toast(`${state.accent[0].toUpperCase()}${state.accent.slice(1)} accent applied`);
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    if (actionButton.dataset.action === 'favorite') toggleFavorite();
    if (actionButton.dataset.action === 'clear-search') {
      state.search = '';
      searchInput.value = '';
      render();
    }
    if (actionButton.dataset.action === 'motion') {
      state.reduceMotion = !state.reduceMotion;
      storage.write('reduceMotion', state.reduceMotion);
      render();
      toast(state.reduceMotion ? 'Reduced motion enabled' : 'Reduced motion disabled');
    }
  });

  searchInput.addEventListener('input', () => {
    state.search = searchInput.value.trim();
    if (state.search && state.page !== 'discover') state.page = 'discover';
    if (state.page === 'discover') render();
  });

  document.addEventListener('keydown', event => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
    if (event.key === '/' && !isTyping) {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.value = '';
      state.search = '';
      searchInput.blur();
      if (state.page === 'discover') render();
    }
  });

  // Start the client with saved preferences.
  render();
})();
