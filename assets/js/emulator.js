// Emulador compartilhado entre a home (overlay da demo) e a página /play.
// Espera no DOM: #gameLoading, #gameCloseBtn, #gameWishlistBtn, #wishlistPrompt.
// Depende dos globais Nostalgist, nipplejs e trackEvent.
const EMULATOR_ROM_URL = 'https://emocre.com/assets/emocre-alpha-1.0.bin';
const EMULATOR_ROM_ID = 'emocre-alpha-1.0';

let nostalgistInstance = null;
let demoTimer = null;

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

function simulateKey(key, type) {
  if (!nostalgistInstance) return;
  const canvas = document.querySelector('canvas');
  if (canvas) canvas.dispatchEvent(new KeyboardEvent(type, { key, code: key, bubbles: true, cancelable: true }));
}

function setupJoypadEvents() {
  document.querySelectorAll('[data-key]').forEach(button => {
    const key = button.getAttribute('data-key');
    button.addEventListener('touchstart', e => { e.preventDefault(); simulateKey(key, 'keydown'); });
    button.addEventListener('touchend',   e => { e.preventDefault(); simulateKey(key, 'keyup'); });
    button.addEventListener('mousedown',  e => { e.preventDefault(); simulateKey(key, 'keydown'); });
    button.addEventListener('mouseup',    e => { e.preventDefault(); simulateKey(key, 'keyup'); });
    button.addEventListener('contextmenu', e => e.preventDefault());
  });
}

// Platformer tuning: independent per-axis thresholds on the normalized vector
// (vector.x > 0 = right, vector.y > 0 = up). Horizontal is forgiving so running
// is easy; vertical needs a more deliberate push so up/down (ladders, doors,
// crouch) don't fire by accident while moving sideways. Both can fire at once
// (diagonals). JOYSTICK_DEAD_ZONE gates out light touches near the center.
const JOYSTICK_DEAD_ZONE = 0.3;
const JOYSTICK_H_THRESHOLD = 0.35;
const JOYSTICK_V_THRESHOLD = 0.5;
let joystickManager = null;
let activeDirKeys = [];

function releaseDirKeys() {
  activeDirKeys.forEach(key => simulateKey(key, 'keyup'));
  activeDirKeys = [];
}

function applyDirKeys(keys) {
  activeDirKeys.filter(key => !keys.includes(key)).forEach(key => simulateKey(key, 'keyup'));
  keys.filter(key => !activeDirKeys.includes(key)).forEach(key => simulateKey(key, 'keydown'));
  activeDirKeys = keys;
}

function setupJoystick() {
  const zone = document.getElementById('joystickZone');
  if (!zone || typeof nipplejs === 'undefined') return;
  joystickManager = nipplejs.create({
    zone,
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: 'white',
    size: 180,
    threshold: 0.1,
    fadeTime: 100,
    restOpacity: 0.5,
  });
  joystickManager.on('move', (evt, data) => {
    if (!data.vector || data.force < JOYSTICK_DEAD_ZONE) { releaseDirKeys(); return; }
    const keys = [];
    if (data.vector.x >  JOYSTICK_H_THRESHOLD) keys.push('ArrowRight');
    else if (data.vector.x < -JOYSTICK_H_THRESHOLD) keys.push('ArrowLeft');
    if (data.vector.y >  JOYSTICK_V_THRESHOLD) keys.push('ArrowUp');
    else if (data.vector.y < -JOYSTICK_V_THRESHOLD) keys.push('ArrowDown');
    applyDirKeys(keys);
  });
  joystickManager.on('end', releaseDirKeys);
}

function createVirtualJoypad() {
  document.body.insertAdjacentHTML('beforeend', `
    <div id="virtual-joypad">
      <div class="joypad-container">
        <div class="joystick-zone" id="joystickZone"></div>
        <div class="right-panel">
          <button class="start-btn" data-key="Enter">START</button>
          <div class="action-buttons">
            <button class="action-btn" data-key="KeyA">A</button>
            <button class="action-btn" data-key="KeyZ">B</button>
            <button class="action-btn" data-key="KeyX">C</button>
          </div>
        </div>
      </div>
    </div>`);
  setupJoypadEvents();
}

async function launchEmulator() {
  const loading = document.getElementById('gameLoading');
  loading.style.display = 'flex';
  try {
    nostalgistInstance = await Nostalgist.megadrive(EMULATOR_ROM_URL);
  } finally {
    loading.style.display = 'none';
  }
  trackEvent('demo_play', { rom: EMULATOR_ROM_ID });
  demoTimer = setTimeout(() => trackEvent('demo_play_1min', { rom: EMULATOR_ROM_ID }), 60000);
  document.getElementById('gameCloseBtn').style.display = 'flex';
  document.getElementById('gameWishlistBtn').style.display = 'flex';
  const joypadJustCreated = isMobile() && !document.getElementById('virtual-joypad');
  if (joypadJustCreated) createVirtualJoypad();
  const joypad = document.getElementById('virtual-joypad');
  if (joypad) joypad.style.display = 'block';
  if (joypadJustCreated) setupJoystick();
}

// Encerra o emulador e abre o prompt de wishlist; cada página define
// finalizeClose() com o destino pós-prompt (restaurar a home ou sair de /play).
function shutdownEmulator() {
  if (demoTimer) { clearTimeout(demoTimer); demoTimer = null; }
  releaseDirKeys();
  if (nostalgistInstance) { nostalgistInstance.exit(); nostalgistInstance = null; }
  document.getElementById('gameCloseBtn').style.display = 'none';
  document.getElementById('gameWishlistBtn').style.display = 'none';
  const joypad = document.getElementById('virtual-joypad');
  if (joypad) joypad.style.display = 'none';
  document.getElementById('wishlistPrompt').style.display = 'flex';
}
