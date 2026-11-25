/* MangoMod Runtime v1.1 — isolated, local-first mod bridge for browser games.
 * Mods execute in sandboxed, opaque-origin frames with network access disabled.
 * A game must include this file and provide its supported settings/events adapter.
 */
(() => {
  'use strict';
  if (window.MangoMod) return;

  const MODS_KEY = 'vexhub:mangomod:mods:v1';
  const SETTINGS_KEY = 'vexhub:mangomod:settings:v1';
  const SETTING_RULES = Object.freeze({
    playerSpeedMultiplier: { min: 0.65, max: 1.75 },
    fireRateMultiplier: { min: 0.7, max: 1.6 },
    damageMultiplier: { min: 0.5, max: 2.2 },
    shipColor: { pattern: /^#[0-9a-f]{6}$/i },
    screenShakeMultiplier: { min: 0, max: 2 },
    particleMultiplier: { min: 0.25, max: 1.5 },
    sfxVolumeMultiplier: { min: 0, max: 1.5 }
  });

  function safeRead(key, fallback) {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
    catch { return fallback; }
  }
  function safeWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
  function clampSetting(key, value) {
    const rule = SETTING_RULES[key];
    if (!rule) return undefined;
    if (rule.pattern) return typeof value === 'string' && rule.pattern.test(value) ? value : undefined;
    const number = Number(value);
    if (!Number.isFinite(number)) return undefined;
    return Math.min(rule.max, Math.max(rule.min, number));
  }
  function create(gameId, adapter = {}) {
    const id = String(gameId || '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id)) throw new Error('MangoMod requires a valid game ID.');
    const allMods = safeRead(MODS_KEY, []);
    const mods = Array.isArray(allMods) ? allMods.filter(mod => mod && mod.enabled !== false && Array.isArray(mod.target) && (mod.target.includes('*') || mod.target.includes(id)) && typeof mod.code === 'string') : [];
    const allSettings = safeRead(SETTINGS_KEY, {});
    const gameSettings = allSettings && typeof allSettings === 'object' ? (allSettings[id] || {}) : {};
    const frames = [];
    let disposed = false;
    const lastEventAt = new Map();

    Object.keys(SETTING_RULES).forEach(key => {
      const value = clampSetting(key, gameSettings[key]);
      if (value !== undefined) adapter.setSetting?.(key, value, 'saved');
    });

    function handleMessage(frame, event) {
      if (disposed || event.source !== frame.element.contentWindow) return;
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'mangomod:ready') {
        frame.ready = true;
        frame.element.contentWindow.postMessage({
          type: 'mangomod:init',
          info: { api: 'mangomod-1', gameId: id, modId: frame.mod.id, modName: frame.mod.name, settings: gameSettings }
        }, '*');
        frame.pendingEvents.splice(0).forEach(item => frame.element.contentWindow.postMessage({ type: 'mangomod:event', name: item.name, payload: item.payload }, '*'));
        return;
      }
      if (message.type !== 'mangomod:command' || !frame.ready) return;
      const now = performance.now();
      frame.commandTimes = frame.commandTimes.filter(time => now - time < 1000);
      if (frame.commandTimes.length >= 35) return;
      frame.commandTimes.push(now);

      if (message.action === 'setSetting' && typeof message.key === 'string') {
        const value = clampSetting(message.key, message.value);
        if (value === undefined) return;
        const latest = safeRead(SETTINGS_KEY, {});
        const next = latest && typeof latest === 'object' ? latest : {};
        next[id] = next[id] && typeof next[id] === 'object' ? next[id] : {};
        next[id][message.key] = value;
        safeWrite(SETTINGS_KEY, next);
        gameSettings[message.key] = value;
        adapter.setSetting?.(message.key, value, frame.mod.id);
      } else if (message.action === 'notify' && typeof message.message === 'string') {
        adapter.notify?.(message.message.slice(0, 100), frame.mod.name);
      }
    }

    function addModFrame(mod) {
      const frame = { mod, ready: false, commandTimes: [], pendingEvents: [], element: document.createElement('iframe') };
      frame.element.title = `MangoMod sandbox: ${mod.name}`;
      frame.element.setAttribute('aria-hidden', 'true');
      frame.element.tabIndex = -1;
      frame.element.sandbox = 'allow-scripts';
      frame.element.referrerPolicy = 'no-referrer';
      frame.element.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-10000px;top:-10000px;pointer-events:none';
      window.addEventListener('message', event => handleMessage(frame, event));
      const source = String(mod.code).replace(/<\/script/gi, '<\\/script');
      frame.element.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'"></head><body><script>
        (() => {
          'use strict';
          const handlers = new Map();
          let info = { api: 'mangomod-1', gameId: ${JSON.stringify(id)}, settings: {} };
          const post = (action, payload = {}) => window.parent.postMessage({ type: 'mangomod:command', action, ...payload }, '*');
          const api = Object.freeze({
            on(name, callback) {
              if (typeof name !== 'string' || typeof callback !== 'function') return () => {};
              const list = handlers.get(name) || []; list.push(callback); handlers.set(name, list);
              return () => handlers.set(name, (handlers.get(name) || []).filter(fn => fn !== callback));
            },
            setSetting(key, value) { info.settings[key] = value; post('setSetting', { key, value }); },
            notify(message) { post('notify', { message: String(message).slice(0, 100) }); },
            getInfo() { return Object.freeze({ ...info, settings: { ...info.settings } }); },
            getSetting(key, fallback) { return Object.prototype.hasOwnProperty.call(info.settings, key) ? info.settings[key] : fallback; }
          });
          Object.defineProperty(window, 'MangoMod', { value: api, writable: false, configurable: false });
          window.addEventListener('message', event => {
            if (event.source !== window.parent || !event.data || typeof event.data !== 'object') return;
            if (event.data.type === 'mangomod:init') { info = event.data.info || info; return; }
            if (event.data.type !== 'mangomod:event' || typeof event.data.name !== 'string') return;
            const list = handlers.get(event.data.name) || [];
            for (const callback of list.slice(0, 30)) { try { callback(event.data.payload || {}); } catch (error) { post('notify', { message: 'Mod callback error: ' + String(error.message || error).slice(0, 65) }); } }
          });
          try { ${source}\n } catch (error) { post('notify', { message: 'Mod error: ' + String(error.message || error).slice(0, 75) }); }
          window.parent.postMessage({ type: 'mangomod:ready' }, '*');
        })();
      <\/script></body></html>`;
      frames.push(frame);
      document.body.appendChild(frame.element);
    }

    mods.forEach(addModFrame);

    function emit(name, payload = {}) {
      if (disposed || typeof name !== 'string') return;
      const now = performance.now();
      const previous = lastEventAt.get(name) || 0;
      const minInterval = name === 'game:tick' ? 220 : 0;
      if (now - previous < minInterval) return;
      lastEventAt.set(name, now);
      let safePayload;
      try { safePayload = JSON.parse(JSON.stringify(payload)); }
      catch { safePayload = {}; }
      const serialized = JSON.stringify(safePayload);
      if (serialized.length > 4000) safePayload = {};
      frames.forEach(frame => {
        if (frame.ready) frame.element.contentWindow.postMessage({ type: 'mangomod:event', name, payload: safePayload }, '*');
        else if (frame.pendingEvents.length < 20) frame.pendingEvents.push({ name, payload: safePayload });
      });
    }
    function getSetting(key, fallback) {
      return Object.prototype.hasOwnProperty.call(gameSettings, key) ? gameSettings[key] : fallback;
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      frames.forEach(frame => frame.element.remove());
      frames.length = 0;
    }
    return Object.freeze({ gameId: id, modCount: mods.length, emit, getSetting, dispose });
  }

  window.MangoMod = Object.freeze({ version: '1.1.0', create });
})();
