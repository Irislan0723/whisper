/*
 * Whisper's browser adaptation of clawd-on-desk's Clawd pet core.
 * Source artwork and state metadata are retained in this directory. Electron
 * window/IPC calls are replaced by DOM, Pointer Events, localStorage,
 * visualViewport and a narrow parent/frame message bridge.
 */
(() => {
  'use strict';
  const root = document.getElementById('clawdRoot');
  if (!root) return;

  const KEYS = { enabled:'whisper_clawd_enabled', size:'whisper_clawd_size', position:'whisper_clawd_position' };
  const SIZES = { small:78, medium:104, large:136 };
  const ASSET = 'clawd/assets/';
  const STATES = {
    idle:'clawd-idle-follow.svg', roam:'clawd-mini-crabwalk.svg', look:'clawd-idle-look.svg', yawning:'clawd-idle-yawn.svg',
    dozing:'clawd-idle-doze.svg', collapsing:'clawd-collapse-sleep.svg', thinking:'clawd-working-thinking.svg',
    working:'clawd-working-typing.svg', juggling:'clawd-headphones-groove.svg', sweeping:'clawd-working-sweeping.svg',
    error:'clawd-error.svg', attention:'clawd-happy.svg', notification:'clawd-notification.svg',
    carrying:'clawd-working-carrying.svg', sleeping:'clawd-sleeping.svg', waking:'clawd-wake.svg', dizzy:'clawd-dizzy.svg'
  };
  const REACTIONS = {
    drag:'clawd-react-drag.svg', left:'clawd-react-left.svg', right:'clawd-react-right.svg',
    peek:'clawd-mini-peek.svg', shy:'clawd-aegyo-shy.svg',
    annoyed:'clawd-react-annoyed.svg', double:['clawd-react-double.svg','clawd-react-double-jump.svg']
  };
  // Mirrors the original state-priority.js ordering for the web-supported states.
  const PRIORITY = { error:8, notification:7, sweeping:6, attention:5, carrying:4, juggling:4, working:3, thinking:2, roaming:1, roam:1, idle:1, yawning:1, dozing:1, sleeping:0, waking:1, dizzy:5, reaction:5 };
  const TIMING = { attention:4000, error:5000, notification:5000, carrying:3000, dizzy:6000, yawn:3000, wake:1500, mouseIdle:20000, mouseSleep:120000 };

  const visual = root.querySelector('.clawd-visual');
  const hit = root.querySelector('.clawd-hit');
  let enabled = read(KEYS.enabled) === '1';
  let sizeName = Object.prototype.hasOwnProperty.call(SIZES, read(KEYS.size)) ? read(KEYS.size) : 'medium';
  let point = null, activeState = 'idle', baseState = 'idle', temporary = null;
  let drag = null, roamTimer = 0, tickTimer = 0, stateTimer = 0, lastActivity = Date.now(), clickTimer = 0, clickCount = 0, pressTimer = 0, pressHandled = false, lastPeek = 0, musicPlaying = false, covered = false;
  let pausedForVisibility = document.visibilityState !== 'visible';

  function read(key) { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } }
  function write(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  function viewport() {
    const vv = window.visualViewport;
    return vv ? { left:vv.offsetLeft, top:vv.offsetTop, width:vv.width, height:vv.height } : { left:0, top:0, width:innerWidth, height:innerHeight };
  }
  function petSize() { return SIZES[sizeName]; }
  function clamp(candidate) {
    const v = viewport(), s = petSize(), edge = 8, bottomReserve = 72;
    return {
      x: Math.round(Math.max(v.left + edge, Math.min(v.left + v.width - s - edge, Number(candidate.x) || 0))),
      y: Math.round(Math.max(v.top + edge, Math.min(v.top + v.height - s - bottomReserve, Number(candidate.y) || 0)))
    };
  }
  function defaultPoint() {
    const v = viewport(), s = petSize();
    return clamp({ x:v.left + 12, y:v.top + v.height - s - 84 });
  }
  function restorePoint() {
    try {
      const saved = JSON.parse(read(KEYS.position));
      return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? clamp(saved) : defaultPoint();
    } catch (_) { return defaultPoint(); }
  }
  function paintPoint(roaming) {
    if (!point) point = restorePoint();
    point = clamp(point);
    root.classList.toggle('clawd-roaming', !!roaming);
    root.style.transform = `translate3d(${point.x}px,${point.y}px,0)`;
  }
  function savePoint() { if (point) write(KEYS.position, JSON.stringify(point)); }
  function setSize(next) {
    sizeName = Object.prototype.hasOwnProperty.call(SIZES, next) ? next : 'medium';
    write(KEYS.size, sizeName);
    root.style.setProperty('--clawd-size', `${petSize()}px`);
    paintPoint(false);
  }
  function display(file) {
    if (!file || !visual) return;
    // Rebuilds the SVG document like the original renderer's state swap.
    visual.replaceChildren();
    const object = document.createElement('object');
    object.type = 'image/svg+xml';
    object.data = `${ASSET}${file}?r=${Date.now()}`;
    object.setAttribute('aria-hidden', 'true');
    visual.appendChild(object);
  }
  function fallbackState() { return musicPlaying ? 'juggling' : (baseState === 'roam' ? 'idle' : baseState); }
  function clearStateTimer() { if (stateTimer) { clearTimeout(stateTimer); stateTimer = 0; } }
  function setState(state, options = {}) {
    if (musicPlaying && state === 'idle') state = 'juggling';
    if (!enabled || !STATES[state]) return false;
    const incoming = PRIORITY[state] ?? 1;
    const current = PRIORITY[activeState] ?? 1;
    if (!options.force && temporary && incoming < current) return false;
    clearStateTimer();
    activeState = state;
    if (!options.temporary) baseState = state;
    temporary = options.temporary ? state : null;
    root.dataset.clawdState = state;
    display(STATES[state]);
    if (options.duration) {
      stateTimer = setTimeout(() => {
        temporary = null;
        setState(options.returnTo || fallbackState(), { force:true });
      }, options.duration);
    }
    return true;
  }
  function showReaction(file, duration) {
    if (!enabled || !file) return;
    clearStateTimer();
    temporary = 'reaction'; activeState = 'reaction'; root.dataset.clawdState = 'reaction'; display(file);
    stateTimer = setTimeout(() => { temporary = null; setState(fallbackState(), { force:true }); }, duration);
  }
  function activity() {
    lastActivity = Date.now();
    if (!enabled) return;
    if (activeState === 'sleeping' || activeState === 'dozing' || activeState === 'yawning') {
      baseState = 'idle';
      setState('waking', { temporary:true, duration:TIMING.wake, returnTo:'idle', force:true });
    }
  }
  function setMusicPlaying(next) {
    const changed = musicPlaying !== !!next;
    musicPlaying = !!next;
    if (!enabled || !changed) return;
    if (musicPlaying && !temporary && !['working','thinking'].includes(activeState)) setState('juggling', { force:true });
    else if (!musicPlaying && activeState === 'juggling') setState('idle', { force:true });
  }
  function stopRoam() { if (roamTimer) { clearTimeout(roamTimer); roamTimer = 0; } root.classList.remove('clawd-roaming'); }
  function stopTick() { if (tickTimer) { clearInterval(tickTimer); tickTimer = 0; } }
  function startTick() { if (!tickTimer && enabled && !pausedForVisibility && !covered) tickTimer = setInterval(tick, 1000); }
  function roamToRandomSpot() {
    const v = viewport(), s = petSize(), edge = 10;
    const x = v.left + edge + Math.random() * Math.max(0, v.width - s - edge * 2);
    const y = v.top + edge + Math.random() * Math.max(0, v.height - s - 84 - edge);
    setState('roam', { force:true });
    point = clamp({ x, y }); paintPoint(true); savePoint();
    setTimeout(() => { if (activeState === 'roam') setState('idle', { force:true }); }, 5600);
  }
  function chooseIdleMoment() {
    const choice = Math.random();
    if (choice < 0.55) return roamToRandomSpot();
    if (choice < 0.85) {
      baseState = 'dozing';
      return setState('yawning', { temporary:true, duration:TIMING.yawn, returnTo:'dozing', force:true });
    }
    return setState('look', { temporary:true, duration:3000, returnTo:'idle', force:true });
  }
  function scheduleRoam(delay) {
    stopRoam();
    if (!enabled || pausedForVisibility || covered) return;
    roamTimer = setTimeout(() => {
      if (!enabled || pausedForVisibility || covered || drag || temporary || activeState !== 'idle' || Date.now() - lastActivity < TIMING.mouseIdle) return scheduleRoam(9000 + Math.random() * 16000);
      chooseIdleMoment();
      scheduleRoam(22000 + Math.random() * 26000);
    }, delay == null ? 22000 + Math.random() * 26000 : delay);
  }
  function tick() {
    if (!enabled || pausedForVisibility || covered || drag || temporary || musicPlaying) return;
    const idleFor = Date.now() - lastActivity;
    if (idleFor >= TIMING.mouseSleep && activeState !== 'sleeping') setState('sleeping', { force:true });
  }
  function start() {
    root.hidden = !enabled;
    if (!enabled) { stopRoam(); clearStateTimer(); return; }
    point = restorePoint(); setSize(sizeName); baseState = 'idle'; temporary = null; activeState = 'idle'; setState('idle', { force:true });
    startTick();
    scheduleRoam();
  }
  function setEnabled(next) {
    enabled = !!next; write(KEYS.enabled, enabled ? '1' : '0');
    root.hidden = !enabled;
    if (!enabled) { stopRoam(); stopTick(); clearStateTimer(); return; }
    lastActivity = Date.now(); start();
  }
  function setCovered(next) {
    covered = !!next;
    root.classList.toggle('clawd-covered', covered);
    if (covered) { stopRoam(); stopTick(); } else { activity(); startTick(); scheduleRoam(); }
  }
  function resetPosition() { point = defaultPoint(); savePoint(); paintPoint(false); }
  function clearPress() { if (pressTimer) { clearTimeout(pressTimer); pressTimer = 0; } }

  function finishDrag(event, cancelled) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    try { hit.releasePointerCapture(event.pointerId); } catch (_) {}
    const moved = drag.moved, held = pressHandled; drag = null; clearPress(); root.classList.remove('clawd-dragging');
    if (moved) {
      savePoint(); lastActivity = Date.now();
      if (!cancelled) setState('dizzy', { temporary:true, duration:TIMING.dizzy, returnTo:'idle', force:true });
      scheduleRoam(90000);
    } else if (!cancelled && !held) {
      clickCount += 1;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        const count = clickCount; clickCount = 0;
        if (count >= 4) showReaction(REACTIONS.annoyed, 3500);
        else if (count >= 2) showReaction(REACTIONS.double[Math.floor(Math.random() * REACTIONS.double.length)], 3500);
        else showReaction(event.clientX < point.x + petSize() / 2 ? REACTIONS.left : REACTIONS.right, 2500);
      }, 400);
    }
  }
  hit.addEventListener('pointerdown', event => {
    if (!enabled || event.button > 0) return;
    event.preventDefault(); event.stopPropagation(); activity(); stopRoam();
    pressHandled = false;
    drag = { pointerId:event.pointerId, startX:event.clientX, startY:event.clientY, origin:{ ...point }, moved:false };
    hit.setPointerCapture(event.pointerId);
    pressTimer = setTimeout(() => {
      if (!drag || drag.moved) return;
      pressHandled = true; showReaction(REACTIONS.shy, 2800);
    }, 650);
  });
  hit.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) {
      drag.moved = true; clearPress(); root.classList.add('clawd-dragging'); showReaction(REACTIONS.drag, 300000);
    }
    if (drag.moved) { point = clamp({ x:drag.origin.x + dx, y:drag.origin.y + dy }); paintPoint(false); }
  });
  hit.addEventListener('pointerup', event => finishDrag(event, false));
  hit.addEventListener('pointercancel', event => finishDrag(event, true));
  hit.addEventListener('lostpointercapture', event => finishDrag(event, true));
  hit.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse' || !enabled || drag || temporary || Date.now() - lastPeek < 6000) return;
    lastPeek = Date.now(); showReaction(REACTIONS.peek, 1700);
  });

  window.addEventListener('resize', () => { if (enabled) paintPoint(false); }, { passive:true });
  window.visualViewport?.addEventListener('resize', () => { if (enabled && !drag) paintPoint(false); }, { passive:true });
  document.addEventListener('visibilitychange', () => {
    pausedForVisibility = document.visibilityState !== 'visible';
    if (pausedForVisibility) { stopRoam(); stopTick(); } else { activity(); startTick(); scheduleRoam(14000 + Math.random() * 9000); }
  });
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || !event.data || typeof event.data !== 'object') return;
    const data = event.data;
    if (data.type === 'whisper:pet-state' && STATES[data.state]) {
      const durations = { attention:TIMING.attention, error:TIMING.error, notification:TIMING.notification, dizzy:TIMING.dizzy };
      setState(data.state, { temporary:!['thinking','working'].includes(data.state), duration:durations[data.state] || Number(data.duration) || 0, returnTo:'idle' });
      if (data.state !== 'sleeping') activity();
    } else if (data.type === 'whisper:pet-activity') activity();
    else if (data.type === 'whisper:pet-overlay') setCovered(!!data.open);
    else if (data.type === 'whisper:pet-config') {
      if (typeof data.enabled === 'boolean') setEnabled(data.enabled);
      if (data.size) setSize(data.size);
      if (data.resetPosition) resetPosition();
    }
  });
  window.WhisperClawd = { setCovered, setEnabled, setSize, setMusicPlaying, resetPosition, state:(name, options) => setState(name, options), activity };
  setSize(sizeName); start();
})();
