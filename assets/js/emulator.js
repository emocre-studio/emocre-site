// Emulador compartilhado entre a home (overlay da demo) e a página /play.
// Espera no DOM: #gameLoading, #gameCloseBtn, #gameWishlistBtn, #wishlistPrompt.
// Depende dos globais Nostalgist, nipplejs e trackEvent.
const EMULATOR_ROM_URL = 'https://emocre.com/assets/emocre-30.bin';
const EMULATOR_ROM_ID = 'emocre-30';

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

// Controle físico via Gamepad API. O input driver do RetroArch no emscripten não
// recebe o gamepad de forma confiável, então em vez de configurá-lo lemos os pads
// aqui e traduzimos para os MESMOS KeyboardEvent sintéticos que o joypad de toque
// dispara — caminho já comprovado até o emulador.
//
// Índices do mapeamento "standard" da Gamepad API: 0=baixo, 1=direita, 2=esquerda,
// 3=topo, 9=start, 12..15=d-pad. Os três botões do Mega Drive ficam na linha
// natural do polegar (baixo/direita/esquerda); o de cima repete o C para alcance.
const GAMEPAD_BUTTON_KEYS = {
  0: 'KeyA',       // A
  1: 'KeyZ',       // B
  2: 'KeyX',       // C
  3: 'KeyX',       // C (botão de cima)
  9: 'Enter',      // START
  12: 'ArrowUp',
  13: 'ArrowDown',
  14: 'ArrowLeft',
  15: 'ArrowRight',
};
// Analógico também anda: nem todo controle publica o d-pad em 12..15 (alguns o
// entregam só como eixo), então lemos o stick esquerdo além dos botões.
const GAMEPAD_AXIS_THRESHOLD = 0.5;

let gamepadFrame = null;
let gamepadKeys = new Set();

function readGamepadKeys() {
  const keys = new Set();
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    if (!pad) continue;
    pad.buttons.forEach((button, i) => {
      if (button.pressed && GAMEPAD_BUTTON_KEYS[i]) keys.add(GAMEPAD_BUTTON_KEYS[i]);
    });
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    if (x <= -GAMEPAD_AXIS_THRESHOLD) keys.add('ArrowLeft');
    if (x >= GAMEPAD_AXIS_THRESHOLD) keys.add('ArrowRight');
    if (y <= -GAMEPAD_AXIS_THRESHOLD) keys.add('ArrowUp');
    if (y >= GAMEPAD_AXIS_THRESHOLD) keys.add('ArrowDown');
  }
  return keys;
}

function pollGamepads() {
  gamepadFrame = requestAnimationFrame(pollGamepads);
  if (!nostalgistInstance) return;
  const keys = readGamepadKeys();
  gamepadKeys.forEach(key => { if (!keys.has(key)) simulateKey(key, 'keyup'); });
  keys.forEach(key => { if (!gamepadKeys.has(key)) simulateKey(key, 'keydown'); });
  gamepadKeys = keys;
}

function startGamepadPolling() {
  if (gamepadFrame === null) pollGamepads();
}

function stopGamepadPolling() {
  if (gamepadFrame !== null) { cancelAnimationFrame(gamepadFrame); gamepadFrame = null; }
  gamepadKeys.forEach(key => simulateKey(key, 'keyup'));
  gamepadKeys = new Set();
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
  startGamepadPolling();
}

// Encerra o emulador e abre o prompt de wishlist; cada página define
// finalizeClose() com o destino pós-prompt (restaurar a home ou sair de /play).
function shutdownEmulator() {
  if (demoTimer) { clearTimeout(demoTimer); demoTimer = null; }
  releaseDirKeys();
  stopGamepadPolling();
  if (nostalgistInstance) { nostalgistInstance.exit(); nostalgistInstance = null; }
  document.getElementById('gameCloseBtn').style.display = 'none';
  document.getElementById('gameWishlistBtn').style.display = 'none';
  const joypad = document.getElementById('virtual-joypad');
  if (joypad) joypad.style.display = 'none';
  document.getElementById('wishlistPrompt').style.display = 'flex';
}
