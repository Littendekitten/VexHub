(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ui = {
    score: $('score'), best: $('best'), wave: $('wave'), hull: $('hull'), bombs: $('bombs'), weapon: $('weapon'),
    message: $('message'), overlay: $('overlay'), overlayKicker: $('overlayKicker'), overlayTitle: $('overlayTitle'),
    overlayCopy: $('overlayCopy'), overlayStats: $('overlayStats'), overlayFoot: $('overlayFoot'), start: $('startButton'),
    bossBar: $('bossBar'), bossFill: $('bossFill'), bossText: $('bossText'), loading: $('loading'),
    mute: $('muteButton'), pause: $('pauseButton'), toast: $('toast'), recordBest: $('recordBest'),
    missions: $('missions'), kills: $('kills'), resetRecord: $('resetRecord'), touchBomb: $('touchBomb')
  };
  const STORE_KEY = 'vexhub:sunset-strike-3d:record';
  const fallbackRecord = { best: 0, missions: 0, kills: 0 };
  function readRecord() {
    try { return { ...fallbackRecord, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; }
    catch { return { ...fallbackRecord }; }
  }
  let record = readRecord();
  let renderer, scene, camera, player, playerGlow, starField, sun, bossMesh;
  let running = false, paused = false, gameOver = false, muted = false, initialized = false;
  let score = 0, hull = 5, bombs = 3, weapon = 1, wave = 1, kills = 0, killsInWave = 0;
  let fireTimer = 0, spawnTimer = 0, elapsed = 0, boss = null, shake = 0, invulnerable = 0;
  let animationId = 0, audioContext = null, toastTimer = 0, pointerActive = false, pointerTarget = null;
  const keys = new Set(), enemies = [], playerShots = [], enemyShots = [], pickups = [], particles = [];
  const fieldBounds = { x: 12.3, yMin: -9.0, yMax: 8.7 };
  let clock;
  const color = { green: 0x69ffc0, cyan: 0x74efff, orange: 0xffa26d, red: 0xff587a, violet: 0x9f8bff, gold: 0xffd27b };

  function saveRecord() {
    record.best = Math.max(record.best, score);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(record)); } catch { /* Local storage can be disabled. */ }
    renderRecord();
  }
  function renderRecord() {
    ui.best.textContent = String(record.best).padStart(6, '0');
    ui.recordBest.textContent = String(record.best).padStart(6, '0');
    ui.missions.textContent = String(record.missions).padStart(2, '0');
    ui.kills.textContent = String(record.kills).padStart(3, '0');
  }
  function updateHUD() {
    ui.score.textContent = String(score).padStart(6, '0');
    ui.best.textContent = String(Math.max(record.best, score)).padStart(6, '0');
    ui.wave.textContent = String(wave).padStart(2, '0');
    ui.hull.textContent = '♥'.repeat(Math.max(0, hull)) + '·'.repeat(Math.max(0, 5 - hull));
    ui.bombs.textContent = String(bombs).padStart(2, '0');
    ui.weapon.textContent = String(weapon);
  }
  function setMessage(message) { ui.message.textContent = message.toUpperCase(); }
  function showToast(message) {
    ui.toast.textContent = message.toUpperCase();
    ui.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => ui.toast.classList.remove('show'), 1500);
  }
  function sound(frequency = 440, duration = 0.07, type = 'sine', volume = 0.035, slide = 0) {
    if (muted) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, frequency + slide), audioContext.currentTime + duration);
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
    } catch { /* Audio is an optional enhancement. */ }
  }
  function toggleMute() {
    muted = !muted;
    ui.mute.textContent = muted ? '×' : '♪';
    ui.mute.setAttribute('aria-label', muted ? 'Turn sound on' : 'Mute sound');
    ui.mute.title = muted ? 'Sound on (M)' : 'Mute (M)';
    showToast(muted ? 'Sound disabled' : 'Sound enabled');
  }

  function removeObject(object) {
    if (!object || !scene) return;
    scene.remove(object);
    object.traverse?.((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }

  function makeMaterial(hex, emissive = 0x000000, intensity = 0.3, roughness = 0.45) {
    return new THREE.MeshStandardMaterial({ color: hex, emissive, emissiveIntensity: intensity, metalness: 0.45, roughness });
  }
  function makeShipShape(isPlayer, hex) {
    const shape = new THREE.Shape();
    if (isPlayer) {
      shape.moveTo(0, 1.28); shape.lineTo(-0.36, 0.22); shape.lineTo(-1.08, -0.55);
      shape.lineTo(-0.93, -0.9); shape.lineTo(-0.16, -0.56); shape.lineTo(0, -1.02);
      shape.lineTo(0.16, -0.56); shape.lineTo(0.93, -0.9); shape.lineTo(1.08, -0.55);
      shape.lineTo(0.36, 0.22); shape.closePath();
    } else {
      shape.moveTo(0, -1.05); shape.lineTo(-1.0, 0.72); shape.lineTo(-0.68, 0.88);
      shape.lineTo(0, 0.42); shape.lineTo(0.68, 0.88); shape.lineTo(1.0, 0.72); shape.closePath();
    }
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.09, bevelThickness: 0.07 });
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, makeMaterial(hex, hex, 0.38, 0.3));
    mesh.position.z = 0;
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: isPlayer ? color.cyan : 0xffc1a0, transparent: true, opacity: 0.55 }));
    mesh.add(edge);
    return mesh;
  }
  function createPlayer() {
    const group = new THREE.Group();
    const body = makeShipShape(true, color.cyan);
    body.scale.set(0.82, 0.82, 0.82);
    group.add(body);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), makeMaterial(0xe4fbff, 0x63eaff, 1.4, 0.18));
    cockpit.position.set(0, 0.1, 0.44); cockpit.scale.set(0.7, 1.25, 0.6); group.add(cockpit);
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.86, 0.1), makeMaterial(0x6bffc6, 0x37ffad, 1.8));
    leftWing.position.set(-0.72, -0.48, 0.28); leftWing.rotation.z = -0.9; group.add(leftWing);
    const rightWing = leftWing.clone(); rightWing.position.x = 0.72; rightWing.rotation.z = 0.9; group.add(rightWing);
    const engineGeo = new THREE.ConeGeometry(0.16, 0.72, 10);
    const engineMat = new THREE.MeshBasicMaterial({ color: 0x69eaff, transparent: true, opacity: 0.86 });
    const engine = new THREE.Mesh(engineGeo, engineMat); engine.rotation.x = Math.PI; engine.position.set(0, -0.93, -0.04); engine.name = 'engineFlame'; group.add(engine);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.025, 5, 32), new THREE.MeshBasicMaterial({ color: 0x69f4ff, transparent: true, opacity: 0.27 }));
    halo.position.z = -0.3; group.add(halo);
    group.position.set(0, -7.1, 1.5);
    player = group; playerGlow = engine;
    scene.add(player);
  }
  function createEnemyMesh(kind = 'scout') {
    const colors = { scout: color.red, weaver: color.violet, tank: color.orange };
    const group = new THREE.Group();
    const body = makeShipShape(false, colors[kind] || color.red); body.scale.set(kind === 'tank' ? 1.22 : 0.72, kind === 'tank' ? 1.0 : 0.7, kind === 'tank' ? 1.1 : 0.85); group.add(body);
    const core = new THREE.Mesh(new THREE.SphereGeometry(kind === 'tank' ? 0.3 : 0.19, 12, 10), makeMaterial(0xffe0d3, colors[kind], 1.4, 0.2));
    core.position.set(0, -0.12, 0.42); group.add(core);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(kind === 'tank' ? 2.4 : 1.5, 0.09, 0.14), makeMaterial(colors[kind], colors[kind], 0.7));
    wing.position.set(0, 0.13, 0.1); group.add(wing);
    return group;
  }
  function createBossMesh() {
    const group = new THREE.Group();
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, -1.55); hullShape.lineTo(-1.0, -0.65); hullShape.lineTo(-3.0, 0.05);
    hullShape.lineTo(-2.55, 0.75); hullShape.lineTo(-1.05, 0.52); hullShape.lineTo(0, 1.18);
    hullShape.lineTo(1.05, 0.52); hullShape.lineTo(2.55, 0.75); hullShape.lineTo(3.0, 0.05);
    hullShape.lineTo(1.0, -0.65); hullShape.closePath();
    const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 0.85, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.16, bevelThickness: 0.12 }), makeMaterial(0x6b315c, 0xff315e, 0.6, 0.3));
    group.add(hull);
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.78, 22, 16), makeMaterial(0xffa36e, 0xff3d67, 1.6, 0.18));
    center.scale.set(1.25, 0.75, 0.7); center.position.set(0, -0.05, 0.85); group.add(center);
    for (const side of [-1, 1]) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), makeMaterial(0xffd18a, 0xff5b55, 1.8));
      orb.position.set(side * 2.05, 0.2, 0.65); group.add(orb);
      const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.2, 12), makeMaterial(0x392842, 0xff4b72, 0.5));
      cannon.rotation.x = Math.PI / 2; cannon.position.set(side * 1.3, -0.95, 0.5); group.add(cannon);
    }
    return group;
  }
  function makeGlowTexture() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d'); const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,207,142,0.92)'); gradient.addColorStop(0.24, 'rgba(255,122,107,0.35)'); gradient.addColorStop(1, 'rgba(100,80,170,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }
  function initScene() {
    if (initialized) return;
    if (!window.THREE) throw new Error('The 3D engine could not be loaded. Check your internet connection and reload.');
    const wrap = $('stageWrap');
    clock = new THREE.Clock();
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.domElement.setAttribute('aria-label', '3D space shooter play area');
    renderer.domElement.tabIndex = 0;
    wrap.insertBefore(renderer.domElement, wrap.firstChild);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090b1d);
    scene.fog = new THREE.FogExp2(0x090b1d, 0.012);
    camera = new THREE.PerspectiveCamera(43, wrap.clientWidth / wrap.clientHeight, 0.1, 180);
    camera.position.set(0, 0, 28); camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0x8290cb, 0.82));
    const keyLight = new THREE.DirectionalLight(0xffbd91, 1.65); keyLight.position.set(-7, 7, 12); scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x6b75ff, 38, 55); rimLight.position.set(8, 2, -3); scene.add(rimLight);
    const sunsetTexture = makeGlowTexture();
    const sunset = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunsetTexture, transparent: true, depthWrite: false, opacity: 0.78 }));
    sunset.position.set(0, 5.7, -21); sunset.scale.set(24, 17, 1); scene.add(sunset); sun = sunset;
    const horizon = new THREE.Mesh(new THREE.PlaneGeometry(75, 0.13), new THREE.MeshBasicMaterial({ color: 0xff926d, transparent: true, opacity: 0.14 }));
    horizon.position.set(0, 3, -16); scene.add(horizon);
    const stars = new Float32Array(1000 * 3);
    for (let i = 0; i < 1000; i++) { stars[i * 3] = (Math.random() - 0.5) * 64; stars[i * 3 + 1] = (Math.random() - 0.5) * 48; stars[i * 3 + 2] = -6 - Math.random() * 76; }
    const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdbe8ff, size: 0.095, transparent: true, opacity: 0.76, sizeAttenuation: true })); scene.add(starField);
    const grid = new THREE.GridHelper(70, 45, 0x45416c, 0x252947); grid.position.set(0, -10.8, -4); grid.rotation.x = Math.PI / 2; grid.material.transparent = true; grid.material.opacity = 0.12; scene.add(grid);
    createPlayer();
    window.addEventListener('resize', resizeRenderer);
    initialized = true;
  }
  function resizeRenderer() {
    if (!renderer || !camera) return;
    const wrap = $('stageWrap');
    const width = Math.max(1, wrap.clientWidth), height = Math.max(1, wrap.clientHeight);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  }

  function makeProjectile(x, y, z, friendly, power = 1, spread = 0) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, friendly ? 0.58 : 0.34, 8),
      new THREE.MeshBasicMaterial({ color: friendly ? 0x79f9ff : 0xff668e, transparent: true, opacity: 0.96 })
    );
    mesh.position.set(x, y, z); mesh.rotation.z = spread * 0.08; scene.add(mesh);
    const glow = new THREE.PointLight(friendly ? 0x66edff : 0xff416f, friendly ? 1.3 : 0.65, 3.2);
    mesh.add(glow);
    const item = { mesh, vy: friendly ? 20 : -7.1, vx: spread, power, friendly, radius: friendly ? 0.34 : 0.42 };
    (friendly ? playerShots : enemyShots).push(item);
  }
  function firePlayer() {
    if (!player || !running || paused) return;
    const x = player.position.x, y = player.position.y + 0.78, z = player.position.z + 0.2;
    sound(610 + weapon * 55, 0.045, 'triangle', 0.016, 110);
    if (weapon === 1) makeProjectile(x, y, z, true, 1);
    if (weapon === 2) { makeProjectile(x - 0.28, y, z, true, 1, -0.7); makeProjectile(x + 0.28, y, z, true, 1, 0.7); }
    if (weapon >= 3) { makeProjectile(x, y, z, true, 2); makeProjectile(x - 0.57, y - 0.12, z, true, 1, -1.15); makeProjectile(x + 0.57, y - 0.12, z, true, 1, 1.15); }
  }
  function spawnEnemy() {
    if (boss || !running || paused) return;
    const roll = Math.random();
    const kind = wave >= 3 && roll > 0.84 ? 'tank' : wave >= 2 && roll > 0.55 ? 'weaver' : 'scout';
    const mesh = createEnemyMesh(kind);
    const x = (Math.random() - 0.5) * fieldBounds.x * 1.72;
    const z = -5 + Math.random() * 4;
    const spec = {
      scout: { hp: 1, speed: 3.15 + wave * 0.2, points: 100, fire: 2.5, size: 0.68 },
      weaver: { hp: 2, speed: 2.65 + wave * 0.13, points: 180, fire: 1.9, size: 0.82 },
      tank: { hp: 4, speed: 1.65 + wave * 0.1, points: 300, fire: 2.25, size: 1.12 }
    }[kind];
    mesh.scale.setScalar(spec.size); mesh.position.set(x, 10.8, z); scene.add(mesh);
    enemies.push({ mesh, kind, hp: spec.hp, maxHp: spec.hp, speed: spec.speed, points: spec.points, fire: Math.random() * spec.fire, phase: Math.random() * Math.PI * 2, originX: x, size: spec.size, radius: kind === 'tank' ? 1.0 : 0.68 });
  }
  function spawnBoss() {
    bossMesh = createBossMesh(); bossMesh.position.set(0, 10.2, -1.5); bossMesh.scale.set(0.7, 0.7, 0.7); scene.add(bossMesh);
    boss = { mesh: bossMesh, hp: 90 + wave * 16, maxHp: 90 + wave * 16, fire: 1.4, phase: 0, entering: true, direction: 1, points: 2200 + wave * 180 };
    ui.bossBar.classList.remove('hidden'); updateBossBar();
    setMessage('WARNING · HOSTILE FLAGSHIP DETECTED'); sound(140, 0.45, 'sawtooth', 0.04, -65);
    showToast('HOSTILE FLAGSHIP INBOUND');
  }
  function updateBossBar() {
    if (!boss) { ui.bossBar.classList.add('hidden'); return; }
    const pct = Math.max(0, boss.hp / boss.maxHp * 100);
    ui.bossFill.style.width = `${pct}%`; ui.bossText.textContent = `${Math.ceil(pct)}%`;
  }
  function createPickup(x, y, type) {
    const group = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), makeMaterial(type === 'repair' ? 0x74ffba : 0xffd37a, type === 'repair' ? 0x31ff9b : 0xffa23f, 1.7));
    group.add(gem);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.035, 6, 24), new THREE.MeshBasicMaterial({ color: type === 'repair' ? 0x68ffad : 0xffc56d })); group.add(ring);
    group.position.set(x, y, 0.5); scene.add(group);
    pickups.push({ mesh: group, type, phase: Math.random() * 6, radius: 0.75 });
  }
  function burst(x, y, z, hex, amount = 12, force = 4) {
    for (let i = 0; i < amount; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.045 + Math.random() * 0.075, 6, 5), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.95 }));
      mesh.position.set(x, y, z); scene.add(mesh);
      const angle = Math.random() * Math.PI * 2, speed = force * (0.35 + Math.random());
      particles.push({ mesh, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.45 + Math.random() * 0.65, maxLife: 1 });
    }
  }
  function destroyEnemy(index, award = true) {
    const enemy = enemies[index]; if (!enemy) return;
    burst(enemy.mesh.position.x, enemy.mesh.position.y, enemy.mesh.position.z, enemy.kind === 'weaver' ? color.violet : color.orange, enemy.kind === 'tank' ? 24 : 12, 4.6);
    removeObject(enemy.mesh); enemies.splice(index, 1);
    if (award) {
      score += enemy.points; kills++; killsInWave++;
      if (Math.random() < 0.16) createPickup(enemy.mesh.position.x, enemy.mesh.position.y, Math.random() < 0.22 ? 'repair' : 'weapon');
      sound(210 + Math.random() * 100, 0.09, 'square', 0.025, 220);
      updateHUD();
      if (killsInWave >= 14) spawnBoss();
    }
  }
  function damagePlayer(amount = 1) {
    if (invulnerable > 0 || !running) return;
    hull = Math.max(0, hull - amount); invulnerable = 1.25; shake = 0.42;
    burst(player.position.x, player.position.y, player.position.z, 0xff8090, 18, 3.7);
    sound(115, 0.22, 'sawtooth', 0.045, -60); updateHUD();
    if (hull <= 0) endGame(); else showToast('HULL DAMAGE');
  }
  function activateBomb() {
    if (!running || paused || gameOver) return;
    if (bombs <= 0) { showToast('NO BOMBS LEFT'); return; }
    bombs--; updateHUD(); shake = 0.65; sound(95, 0.5, 'sawtooth', 0.055, 640);
    burst(player.position.x, player.position.y, 0.1, color.cyan, 70, 11);
    enemies.forEach(enemy => burst(enemy.mesh.position.x, enemy.mesh.position.y, enemy.mesh.position.z, color.orange, 8, 5));
    while (enemies.length) { const enemy = enemies[0]; score += enemy.points; kills++; removeObject(enemy.mesh); enemies.shift(); }
    enemyShots.splice(0).forEach(shot => removeObject(shot.mesh));
    if (boss) { boss.hp -= Math.ceil(boss.maxHp * 0.22); updateBossBar(); if (boss.hp <= 0) defeatBoss(); }
    updateHUD(); showToast('SHOCKWAVE RELEASED');
  }
  function defeatBoss() {
    if (!boss) return;
    const x = boss.mesh.position.x, y = boss.mesh.position.y, z = boss.mesh.position.z;
    burst(x, y, z, 0xffa26d, 90, 10); burst(x, y, z, color.violet, 55, 7);
    score += boss.points; killsInWave = 0; removeObject(boss.mesh); boss = null; bossMesh = null; ui.bossBar.classList.add('hidden');
    bombs = Math.min(5, bombs + 1); hull = Math.min(5, hull + 1); weapon = Math.min(3, weapon + 1);
    wave++; spawnTimer = 0.9; updateHUD(); showToast('FLAGSHIP DESTROYED · WAVE ADVANCED'); setMessage('FLAGSHIP DESTROYED · FRONTIER SECURED');
    sound(330, 0.6, 'triangle', 0.045, 800);
  }
  function collectPickup(index) {
    const item = pickups[index]; if (!item) return;
    if (item.type === 'repair') { if (hull >= 5) score += 250; else hull = Math.min(5, hull + 1); showToast('HULL REPAIRED'); }
    else { if (weapon >= 3) score += 300; else weapon++; showToast(weapon >= 3 ? 'WEAPON MAXED' : `WEAPON UPGRADE · LEVEL ${weapon}`); }
    score += 100; burst(item.mesh.position.x, item.mesh.position.y, 0.5, item.type === 'repair' ? color.green : color.gold, 14, 3.2);
    removeObject(item.mesh); pickups.splice(index, 1); updateHUD(); sound(480, 0.16, 'sine', 0.04, 430);
  }

  function resetWorld() {
    for (const list of [enemies, playerShots, enemyShots, pickups, particles]) {
      while (list.length) { const item = list.pop(); removeObject(item.mesh); }
    }
    if (boss?.mesh) removeObject(boss.mesh);
    boss = null; bossMesh = null; ui.bossBar.classList.add('hidden');
    player.position.set(0, -7.1, 1.5); player.rotation.set(0, 0, 0); player.visible = true;
  }
  function startGame() {
    try {
      if (!initialized) initScene();
    } catch (error) {
      ui.overlay.classList.remove('hidden'); ui.overlayKicker.textContent = 'INITIALIZATION ERROR'; ui.overlayTitle.innerHTML = '3D ENGINE <span>OFFLINE</span>';
      ui.overlayCopy.textContent = error.message || 'The 3D engine could not start. Reload the page while connected to the internet.';
      ui.overlayStats.innerHTML = '<span>CHECK YOUR CONNECTION</span><span>THEN RELOAD</span>';
      ui.start.textContent = 'RELOAD PAGE ↻'; ui.start.onclick = () => window.location.reload();
      ui.loading.classList.add('hidden'); return;
    }
    resetWorld();
    score = 0; hull = 5; bombs = 3; weapon = 1; wave = 1; kills = 0; killsInWave = 0;
    fireTimer = 0.15; spawnTimer = 0.45; elapsed = 0; invulnerable = 0; shake = 0;
    running = true; paused = false; gameOver = false;
    ui.overlay.classList.add('hidden'); ui.loading.classList.add('hidden'); ui.pause.disabled = false;
    ui.pause.textContent = 'Ⅱ'; ui.start.onclick = null;
    setMessage('MISSION ACTIVE · CLEAR THE HOSTILE SQUADRON'); updateHUD();
    try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume(); } catch { /* Sound may be unavailable. */ }
    renderer.domElement.focus({ preventScroll: true });
    clock.getDelta();
  }
  function pauseGame() {
    if (!running || gameOver) return;
    paused = !paused;
    ui.pause.textContent = paused ? '▶' : 'Ⅱ';
    if (paused) {
      showOverlay('MISSION PAUSED', 'Take a breather, pilot. The frontier will be waiting.', 'RESUME MISSION', 'PAUSED · PRESS P OR ESC TO RESUME', 'MISSION PAUSED');
      ui.start.onclick = () => { paused = false; ui.overlay.classList.add('hidden'); ui.pause.textContent = 'Ⅱ'; clock.getDelta(); setMessage('MISSION ACTIVE'); };
      setMessage('MISSION PAUSED');
    } else {
      ui.overlay.classList.add('hidden'); ui.pause.textContent = 'Ⅱ'; setMessage('MISSION ACTIVE'); clock.getDelta();
    }
  }
  function showOverlay(title, copy, button, foot, kicker = 'VEXUNO ORIGINAL · 001') {
    ui.overlayKicker.textContent = kicker;
    ui.overlayTitle.textContent = title;
    ui.overlayCopy.textContent = copy;
    ui.overlayStats.innerHTML = '<span><b>P</b> RESUME</span><span><b>M</b> SOUND</span><span><b>SPACE</b> BOMB</span>';
    ui.start.innerHTML = `${button} <span>↗</span>`;
    ui.overlayFoot.textContent = foot;
    ui.overlay.classList.remove('hidden');
  }
  function endGame() {
    running = false; paused = false; gameOver = true; ui.pause.disabled = true; ui.pause.textContent = 'Ⅱ';
    record.missions++; record.kills += kills; saveRecord();
    ui.bossBar.classList.add('hidden');
    showOverlay('MISSION OVER', `Final score: ${String(score).padStart(6, '0')}. You downed ${kills} hostiles and reached wave ${wave}.`, 'FLY AGAIN', `PERSONAL BEST ${String(record.best).padStart(6, '0')} · SAVED ON THIS DEVICE`, 'FLIGHT LOG UPDATED');
    ui.overlayTitle.innerHTML = 'MISSION <span>OVER</span>';
    ui.start.onclick = startGame; setMessage('MISSION ENDED · PILOT STANDING BY'); sound(180, 0.55, 'sawtooth', 0.04, -120);
    updateHUD();
  }

  function updatePlayer(dt) {
    const speed = 8.6;
    let dx = 0, dy = 0;
    if (keys.has('arrowleft') || keys.has('a')) dx--;
    if (keys.has('arrowright') || keys.has('d')) dx++;
    if (keys.has('arrowup') || keys.has('w')) dy++;
    if (keys.has('arrowdown') || keys.has('s')) dy--;
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    if (pointerActive && pointerTarget) {
      player.position.x += (pointerTarget.x - player.position.x) * Math.min(1, dt * 11);
      player.position.y += (pointerTarget.y - player.position.y) * Math.min(1, dt * 11);
    } else {
      player.position.x += dx * speed * dt;
      player.position.y += dy * speed * dt;
    }
    const visibleHalfWidth = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - player.position.z) * camera.aspect * 0.88;
    const horizontalLimit = Math.min(fieldBounds.x, visibleHalfWidth);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -horizontalLimit, horizontalLimit);
    player.position.y = THREE.MathUtils.clamp(player.position.y, fieldBounds.yMin, fieldBounds.yMax);
    player.rotation.z += ((-dx * 0.18) - player.rotation.z) * Math.min(1, dt * 9);
    player.rotation.x += ((dy * -0.05) - player.rotation.x) * Math.min(1, dt * 5);
    if (playerGlow) playerGlow.scale.y = 0.75 + Math.sin(elapsed * 22) * 0.17;
    if (invulnerable > 0) { invulnerable -= dt; player.visible = Math.floor(elapsed * 16) % 2 === 0; } else player.visible = true;
    fireTimer -= dt;
    if (fireTimer <= 0) { firePlayer(); fireTimer = Math.max(0.14, 0.34 - weapon * 0.045); }
  }
  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i]; const mesh = enemy.mesh;
      mesh.position.y -= enemy.speed * dt;
      if (enemy.kind === 'weaver') mesh.position.x = enemy.originX + Math.sin(elapsed * 2.4 + enemy.phase) * 2.0;
      else mesh.position.x = enemy.originX + Math.sin(elapsed * 1.4 + enemy.phase) * 0.28;
      mesh.rotation.z = Math.sin(elapsed * 2.5 + enemy.phase) * 0.08;
      enemy.fire -= dt;
      if (enemy.fire <= 0 && mesh.position.y < 7.5) {
        makeProjectile(mesh.position.x, mesh.position.y - 0.55, mesh.position.z + 0.6, false);
        enemy.fire = enemy.kind === 'tank' ? 1.75 : 2.3 + Math.random() * 1.1;
      }
      const dx = mesh.position.x - player.position.x, dy = mesh.position.y - player.position.y;
      if (Math.abs(dx) < enemy.radius + 0.48 && Math.abs(dy) < enemy.radius + 0.55 && Math.abs(mesh.position.z - player.position.z) < 2.7) {
        destroyEnemy(i, false); damagePlayer(); continue;
      }
      if (mesh.position.y < -10.2) { removeObject(mesh); enemies.splice(i, 1); damagePlayer(); }
    }
  }
  function updateBoss(dt) {
    if (!boss) return;
    boss.phase += dt;
    const mesh = boss.mesh;
    if (boss.entering) { mesh.position.y += (4.6 - mesh.position.y) * Math.min(1, dt * 1.5); if (mesh.position.y < 4.75) boss.entering = false; }
    else {
      mesh.position.x = Math.sin(boss.phase * 0.65) * 7.0;
      mesh.position.y = 4.8 + Math.sin(boss.phase * 1.1) * 0.6;
      mesh.rotation.z = Math.sin(boss.phase * 0.8) * 0.035;
    }
    boss.fire -= dt;
    if (boss.fire <= 0 && !boss.entering) {
      const bx = mesh.position.x, by = mesh.position.y - 1.2, bz = mesh.position.z + 0.9;
      for (const spread of [-1.4, 0, 1.4]) makeProjectile(bx, by, bz, false, 1, spread);
      boss.fire = 1.15 - Math.min(0.35, wave * 0.025);
    }
    const dx = mesh.position.x - player.position.x, dy = mesh.position.y - player.position.y;
    if (!boss.entering && Math.abs(dx) < 2.25 && Math.abs(dy) < 1.7) damagePlayer();
  }
  function updateProjectiles(dt) {
    for (let i = playerShots.length - 1; i >= 0; i--) {
      const shot = playerShots[i]; shot.mesh.position.y += shot.vy * dt; shot.mesh.position.x += shot.vx * dt;
      if (shot.mesh.position.y > 12) { removeObject(shot.mesh); playerShots.splice(i, 1); continue; }
      let hit = false;
      if (boss && Math.abs(shot.mesh.position.x - boss.mesh.position.x) < 2.65 && Math.abs(shot.mesh.position.y - boss.mesh.position.y) < 1.55) {
        boss.hp -= shot.power * 2.2; updateBossBar(); burst(shot.mesh.position.x, shot.mesh.position.y, shot.mesh.position.z, color.orange, 3, 1.8);
        removeObject(shot.mesh); playerShots.splice(i, 1); hit = true;
        if (boss?.hp <= 0) defeatBoss();
      }
      if (hit) continue;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (Math.abs(shot.mesh.position.x - enemy.mesh.position.x) < enemy.radius && Math.abs(shot.mesh.position.y - enemy.mesh.position.y) < enemy.radius + 0.2) {
          enemy.hp -= shot.power; burst(shot.mesh.position.x, shot.mesh.position.y, shot.mesh.position.z, color.cyan, 4, 1.9);
          removeObject(shot.mesh); playerShots.splice(i, 1);
          if (enemy.hp <= 0) destroyEnemy(j, true);
          hit = true; break;
        }
      }
    }
    for (let i = enemyShots.length - 1; i >= 0; i--) {
      const shot = enemyShots[i]; shot.mesh.position.y += shot.vy * dt; shot.mesh.position.x += shot.vx * dt;
      if (shot.mesh.position.y < -11) { removeObject(shot.mesh); enemyShots.splice(i, 1); continue; }
      const dx = shot.mesh.position.x - player.position.x, dy = shot.mesh.position.y - player.position.y;
      if (Math.abs(dx) < 0.72 && Math.abs(dy) < 0.72) { removeObject(shot.mesh); enemyShots.splice(i, 1); damagePlayer(); }
    }
  }
  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const item = pickups[i]; item.mesh.position.y -= 2.4 * dt; item.mesh.rotation.y += dt * 1.8; item.mesh.rotation.z += dt * 1.2;
      item.mesh.position.x += Math.sin(elapsed * 2 + item.phase) * dt * 0.7;
      const dx = item.mesh.position.x - player.position.x, dy = item.mesh.position.y - player.position.y;
      if (Math.abs(dx) < 1.05 && Math.abs(dy) < 1.1) { collectPickup(i); continue; }
      if (item.mesh.position.y < -11) { removeObject(item.mesh); pickups.splice(i, 1); }
    }
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const item = particles[i]; item.life -= dt; item.mesh.position.x += item.vx * dt; item.mesh.position.y += item.vy * dt; item.vy -= 1.7 * dt;
      item.mesh.material.opacity = Math.max(0, item.life / item.maxLife); item.mesh.scale.multiplyScalar(Math.max(0.9, 1 - dt * 0.8));
      if (item.life <= 0) { removeObject(item.mesh); particles.splice(i, 1); }
    }
  }
  function updateScene(dt) {
    elapsed += dt;
    if (starField) {
      const positions = starField.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) { positions[i + 1] -= dt * (1.3 + (i % 13) * 0.06); if (positions[i + 1] < -25) positions[i + 1] = 25; }
      starField.geometry.attributes.position.needsUpdate = true;
    }
    if (sun) sun.material.rotation = Math.sin(elapsed * 0.08) * 0.04;
    updateParticles(dt);
    if (!running || paused) return;
    updatePlayer(dt); updateEnemies(dt); updateBoss(dt); updateProjectiles(dt); updatePickups(dt);
    if (!boss) {
      spawnTimer -= dt;
      const maxEnemies = Math.min(8, 3 + wave);
      if (spawnTimer <= 0 && enemies.length < maxEnemies && killsInWave < 14) {
        spawnEnemy(); spawnTimer = Math.max(0.43, 1.08 - wave * 0.045) * (0.72 + Math.random() * 0.58);
      }
      if (killsInWave >= 14 && !boss) spawnBoss();
    }
    if (shake > 0) { shake = Math.max(0, shake - dt); camera.position.x = (Math.random() - 0.5) * shake * 0.34; camera.position.y = (Math.random() - 0.5) * shake * 0.34; }
    else { camera.position.x += (0 - camera.position.x) * Math.min(1, dt * 8); camera.position.y += (0 - camera.position.y) * Math.min(1, dt * 8); }
  }
  function frame() {
    animationId = requestAnimationFrame(frame);
    if (!renderer || !scene) return;
    const dt = Math.min(clock.getDelta(), 0.035);
    updateScene(dt);
    renderer.render(scene, camera);
  }

  function pointerToWorld(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    const visibleHalfWidth = Math.min(fieldBounds.x, Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - player.position.z) * camera.aspect * 0.88);
    return { x: THREE.MathUtils.clamp((nx - 0.5) * visibleHalfWidth * 2, -visibleHalfWidth, visibleHalfWidth), y: THREE.MathUtils.clamp((0.5 - ny) * 17.7, fieldBounds.yMin, fieldBounds.yMax) };
  }
  function setupInput() {
    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) event.preventDefault();
      if (key === 'm' && !event.repeat) toggleMute();
      if ((key === 'p' || key === 'escape') && !event.repeat) { if (running || paused) pauseGame(); }
      if (key === ' ' && !event.repeat) activateBomb();
      if (key === 'enter' && !running && !paused) { startGame(); }
      keys.add(key);
    }, { passive: false });
    window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
    window.addEventListener('blur', () => { keys.clear(); if (running && !paused) pauseGame(); });
    $('stageWrap').addEventListener('pointerdown', (event) => {
      if (!renderer || !running) return;
      pointerActive = true; pointerTarget = pointerToWorld(event);
      if (event.pointerType !== 'mouse') $('stageWrap').setPointerCapture?.(event.pointerId);
    });
    $('stageWrap').addEventListener('pointermove', (event) => { if (pointerActive && renderer) pointerTarget = pointerToWorld(event); });
    const stopPointer = () => { pointerActive = false; pointerTarget = null; };
    $('stageWrap').addEventListener('pointerup', stopPointer); $('stageWrap').addEventListener('pointercancel', stopPointer); $('stageWrap').addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') stopPointer(); });
    document.querySelectorAll('[data-move]').forEach(button => {
      const keyMap = { up: 'w', left: 'a', down: 's', right: 'd' }; const key = keyMap[button.dataset.move];
      const start = (event) => { event.preventDefault(); keys.add(key); };
      const stop = (event) => { event.preventDefault(); keys.delete(key); };
      button.addEventListener('pointerdown', start); button.addEventListener('pointerup', stop); button.addEventListener('pointerleave', stop); button.addEventListener('pointercancel', stop);
    });
    ui.touchBomb.addEventListener('pointerdown', (event) => { event.preventDefault(); activateBomb(); });
    ui.start.onclick = startGame;
    ui.pause.addEventListener('click', pauseGame);
    ui.mute.addEventListener('click', toggleMute);
    ui.resetRecord.addEventListener('click', () => {
      if (!window.confirm('Reset your SUNSET STRIKE 3D personal best and flight log on this device?')) return;
      record = { ...fallbackRecord }; try { localStorage.removeItem(STORE_KEY); } catch { /* Ignore unavailable storage. */ }
      renderRecord(); showToast('FLIGHT LOG RESET');
    });
  }

  function boot() {
    setupInput(); renderRecord(); updateHUD();
    try {
      initScene();
      ui.loading.classList.add('hidden');
      renderer.render(scene, camera);
      frame();
    } catch (error) {
      ui.loading.classList.add('hidden');
      ui.overlayKicker.textContent = 'INITIALIZATION ERROR';
      ui.overlayTitle.innerHTML = '3D ENGINE <span>OFFLINE</span>';
      ui.overlayCopy.textContent = error.message || 'The 3D engine could not start. Make sure you are online and reload the page.';
      ui.overlayStats.innerHTML = '<span>WEBGL IS REQUIRED</span><span>CHECK YOUR BROWSER</span>';
      ui.start.textContent = 'RELOAD PAGE ↻'; ui.start.onclick = () => window.location.reload();
      ui.overlay.classList.remove('hidden');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
