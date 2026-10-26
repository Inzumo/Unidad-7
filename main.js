// ==========================================
// ATLUS: Multiverse Physical System — v10.1
// ==========================================

const { Engine, World, Bodies, Body, Constraint, Vector, Mouse, MouseConstraint } = Matter;

let engine, world;
let letters = [];
let constraints = [];
let particles = [];
let floatingPhrases = [];
let mouseConstraint;
let canvasMouse;
let bgMusic = null;
let musicMuted = false;

const LETTER_ORDER = ["A", "T", "L", "U", "S"];

const gameState = {
  currentDimension: 0,
  foundLetters: JSON.parse(localStorage.getItem('atlus_found') || '{"A":false,"T":false,"L":false,"U":false,"S":false}'),
  inHub: false,
  started: false
};

const DIMENSIONS = [
  { name: "Mundo 01 · The Dark Hour", letterTarget: "A", color: "#0099ff", bg: "#050b14",
    desc: "Dispara a las 5 sombras con el Evoker: apunta, mantén clic para cargar y suelta.",
    gravity: { x: 0, y: 0 },
    phrases: ["Memento Mori", "The Dark Hour", "Are you afraid of death?", "The clock is ticking", "Death is not the end"],
    winCondition: "killShadows", music: "music/p3.mp3" },
  { name: "Mundo 02 · The TV World", letterTarget: "T", color: "#ffcc00", bg: "#1a1600",
    desc: "La letra salta entre TVs. Haz clic en el TV activo 5 veces. Hay cooldown entre clics.",
    gravity: { x: 0, y: 0 },
    phrases: ["Reach out to the truth", "I am thou", "Thou art I", "Can you see through the fog?", "The truth is out there"],
    winCondition: "hitsTVs", music: "music/p4.mp3" },
  { name: "Mundo 03 · The Metaverse", letterTarget: "L", color: "#ff0033", bg: "#120003",
    desc: "Escapa de Mementos: arrastra la letra por el laberinto hasta la salida roja.",
    gravity: { x: 0, y: 0 },
    phrases: ["You'll never see it coming", "Take your heart", "Wake up, get up, get out there", "Are you free?", "Steal back your future"],
    winCondition: "reachEscape", music: "music/p5.mp3" },
  { name: "Mundo 04 · Tower of Babel", letterTarget: "U", color: "#ff00aa", bg: "#14000b",
    desc: "Sube la torre: ← → mover, ↑ subir/romper bloque, ↓ bajar. Si un bloque cae encima, ¡estás aplastado!",
    gravity: { x: 0, y: 0 },
    phrases: ["It's a nightmare", "Don't look down", "Love is over", "What do you desire?", "Will you climb?"],
    winCondition: "stackTower", music: "music/catherine.mp3" },
  { name: "Mundo 05 · Archetype Threads", letterTarget: "S", color: "#e6b800", bg: "#0d0c03",
    desc: "Batalla contra Homo Gorleo: ataca sus debilidades (Ala y Pierna) con Cyc.",
    gravity: { x: 0, y: 0 },
    phrases: ["The world is a story", "Fantasy lives on", "You are its author", "Who are you?", "What story will you write?"],
    winCondition: "defeatGorleo", music: "music/metaphor.mp3" }
];

// P3
let isCharging = false;
let chargeStart = 0;
let chargePower = 0;
let shadows = [];
let shadowsKilled = 0;
const TOTAL_SHADOWS = 5;

// P4
let TVS = [];
let tvLetterPos = { x: 0, y: 0 };
let tvCurrentIndex = 0;
let tvHitCount = 0;
let tvLastMove = 0;
let tvJumpSpeed = 1000;
let tvVulnerable = false;
let tvVulnerableTimer = 0;
let tvCooldown = 0;
const TV_COOLDOWN = 500;

// P5
let mementosWalls = [];
let escapeZone = { x: 0, y: 0, w: 220, h: 160 };

// Catherine
let catherineState = {
  cellSize: 55,
  cols: 9,
  rows: 10,
  offsetX: 0,
  offsetY: 0,
  grid: [],
  fallingBlocks: [],
  letterCol: 4,
  letterRow: 8,
  moveCooldown: 0,
  spawnInterval: 1400,
  lastSpawn: 0,
  maxHeightReached: 0,
  gameOver: false,
  gameOverTimer: 0
};

// Metaphor
let metaphorBattle = {
  active: false,
  playerHP: 100, playerMaxHP: 100,
  potions: 2, turn: 0,
  turnIcons: 1, maxTurnIcons: 2,
  phase: 'player',
  boss: {
    hp: 150, maxHp: 150,
    wingHP: 40, wingMaxHP: 40,
    legHP: 60, legMaxHP: 60,
    apples: 2, applesAvailable: false,
    wingDestroyed: false, legDestroyed: false
  },
  selectedTarget: 'body',
  log: [],
  enemyActionDelay: 0,
  message: '',
  messageTimer: 0,
  playerDefending: false
};

// ==========================================
// SETUP
// ==========================================
function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvas-holder");
  canvas.elt.style.position = "fixed";
  canvas.elt.style.zIndex = "1";

  engine = Engine.create();
  world = engine.world;

  canvasMouse = Mouse.create(canvas.elt);
  canvasMouse.pixelRatio = pixelDensity();
  mouseConstraint = MouseConstraint.create(engine, {
    mouse: canvasMouse,
    constraint: { stiffness: 0.8, damping: 0.1, render: { visible: false } }
  });
  World.add(world, mouseConstraint);

  createBoundaries();
  setupWorldSelect();
  updateWordBar();

  escapeZone.x = width - 280;
  escapeZone.y = height - 240;
}

// ==========================================
// SELECCIÓN
// ==========================================
function setupWorldSelect() {
  const selectScreen = document.getElementById('world-select');
  const gameUI = document.getElementById('game-ui');
  const cards = document.querySelectorAll('.world-card');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const dimIndex = parseInt(card.getAttribute('data-dim'));
      selectScreen.classList.add('fade-out');
      setTimeout(() => selectScreen.classList.add('hidden'), 600);
      gameUI.classList.remove('hidden');
      gameState.started = true;
      applyDimension(dimIndex);
    });
  });

  document.getElementById('back-to-select').addEventListener('click', () => {
    stopMusic();
    gameState.started = false;
    gameState.inHub = false;
    resetWorld();
    selectScreen.classList.remove('hidden');
    setTimeout(() => selectScreen.classList.remove('fade-out'), 50);
    gameUI.classList.add('hidden');
  });

  document.getElementById('toggle-music').addEventListener('click', () => {
    musicMuted = !musicMuted;
    if (bgMusic) bgMusic.setVolume(musicMuted ? 0 : 0.35);
    document.getElementById('toggle-music').textContent = musicMuted ? "🔇" : "🔊";
  });

  document.getElementById('reset-all').addEventListener('click', () => {
    if (!confirm("¿Reiniciar TODO el progreso?")) return;
    localStorage.removeItem('atlus_found');
    gameState.foundLetters = { A: false, T: false, L: false, U: false, S: false };
    updateWordBar();
    stopMusic();
    gameState.started = false;
    gameState.inHub = false;
    resetWorld();
    selectScreen.classList.remove('hidden');
    setTimeout(() => selectScreen.classList.remove('fade-out'), 50);
    gameUI.classList.add('hidden');
  });

  // Listener global para la R en Metaphor
  window.addEventListener('keydown', (e) => {
    if (gameState.started && gameState.currentDimension === 4) {
      if ((e.key === 'r' || e.key === 'R') && metaphorBattle.phase === 'defeat') {
        initMetaphorBattle();
      }
    }
  });
}

function resetWorld() {
  for (let l of letters) World.remove(world, l.body);
  letters = [];
  for (let c of constraints) World.remove(world, c);
  constraints = [];
  for (let w of mementosWalls) World.remove(world, w);
  mementosWalls = [];
  particles = [];
  floatingPhrases = [];
  TVS = [];
  shadows = [];
  shadowsKilled = 0;
  isCharging = false;
  chargePower = 0;
  tvHitCount = 0;
  tvVulnerable = false;
  tvCooldown = 0;
  metaphorBattle.active = false;
  catherineState.grid = [];
  catherineState.fallingBlocks = [];
  catherineState.gameOver = false;
  catherineState.gameOverTimer = 0;
  document.getElementById('p4-hud').classList.add('hidden');
  document.getElementById('catherine-hud').classList.add('hidden');
}

// ==========================================
// MÚSICA
// ==========================================
function playMusicForDimension(index) {
  stopMusic();
  const dim = DIMENSIONS[index];
  if (!dim.music) return;
  loadSound(dim.music,
    (sound) => { bgMusic = sound; bgMusic.setVolume(musicMuted ? 0 : 0.35); bgMusic.loop(); },
    (err) => console.warn("Música no cargada:", dim.music)
  );
}
function stopMusic() { if (bgMusic) { bgMusic.stop(); bgMusic = null; } }

// ==========================================
// DRAW
// ==========================================
function draw() {
  if (!gameState.started) { background("#06060a"); return; }

  const dim = DIMENSIONS[gameState.currentDimension];
  background(gameState.inHub ? "#0a0a12" : dim.bg);

  if (gameState.inHub) { drawHub(); return; }

  drawAmbientEffects();

  if (gameState.currentDimension === 1) {
    if (tvCooldown > 0) tvCooldown -= deltaTime;
    drawTVWorld();
    drawParticles();
    return;
  }

  if (gameState.currentDimension === 3) {
    updateCatherine(deltaTime);
    drawCatherineTower();
    drawParticles();
    return;
  }

  if (gameState.currentDimension === 4) {
    drawMetaphorBattle();
    drawParticles();
    return;
  }

  drawFloatingPhrases();
  Engine.update(engine);
  drawConstraints();
  drawParticles();
  for (let l of letters) l.display();

  if (gameState.currentDimension === 0) {
    drawShadows();
    drawCharge();
  }
  if (gameState.currentDimension === 2) {
    drawMementosWalls();
    drawEscapeZone();
  }

  checkLetterFound();
}

// ==========================================
// LÍMITES
// ==========================================
function createBoundaries() {
  let t = 100;
  let opts = { isStatic: true, friction: 0.5 };
  World.add(world, [
    Bodies.rectangle(width / 2, height + t / 2, width * 2, t, opts),
    Bodies.rectangle(-t / 2, height / 2, t, height * 2, opts),
    Bodies.rectangle(width + t / 2, height / 2, t, height * 2, opts),
    Bodies.rectangle(width / 2, -t / 2, width * 2, t, opts)
  ]);
}

// ==========================================
// CREAR LETRAS
// ==========================================
function createLetters() {
  letters = [];
  const chars = ["A", "T", "L", "U", "S"];
  const activeChar = chars[gameState.currentDimension];

  if (gameState.foundLetters[activeChar]) return;
  if (gameState.currentDimension === 1) return;
  if (gameState.currentDimension === 3) return;
  if (gameState.currentDimension === 4) return;

  let x = width / 2, y = height / 2;
  if (gameState.currentDimension === 0) { x = width / 2; y = height / 2; }
  if (gameState.currentDimension === 2) { x = width * 0.15; y = height * 0.15; }

  let body = Bodies.rectangle(x, y, 60, 80, {
    restitution: 0.6, friction: 0.05, density: 0.002
  });
  body.plugin = { isLetter: true };
  body.collisionFilter = { category: 0x0002, mask: 0xFFFFFFFF };

  letters.push(new LetterBody(body, activeChar, gameState.currentDimension));
  World.add(world, body);
}

class LetterBody {
  constructor(body, char, index) { this.body = body; this.char = char; this.index = index; }
  display() {
    let pos = this.body.position, angle = this.body.angle;
    let dim = DIMENSIONS[this.index];
    push();
    translate(pos.x, pos.y); rotate(angle);
    rectMode(CENTER); strokeWeight(4); stroke(dim.color); fill("#111116");
    rect(0, 0, 60, 80, 8);
    textAlign(CENTER, CENTER); textSize(44); textFont('Montserrat');
    fill(dim.color); noStroke(); text(this.char, 0, -2);
    pop();
  }
}

// ==========================================
// APLICAR DIMENSIÓN
// ==========================================
function applyDimension(index) {
  const prevIndex = gameState.currentDimension;
  if (prevIndex === 2) {
    for (let w of mementosWalls) World.remove(world, w);
    mementosWalls = [];
  }
  if (prevIndex === 0) shadows = [];
  if (prevIndex === 4) metaphorBattle.active = false;

  gameState.currentDimension = index;
  let dim = DIMENSIONS[index];
  world.gravity.x = dim.gravity.x;
  world.gravity.y = dim.gravity.y;

  for (let c of constraints) World.remove(world, c);
  constraints = [];
  particles = particles.filter(p => !p.permanent);
  for (let l of letters) World.remove(world, l.body);
  letters = [];

  if (index === 0) {
    createLetters();
    createShadows();
    document.getElementById('p4-hud').classList.add('hidden');
    document.getElementById('catherine-hud').classList.add('hidden');
  } else if (index === 1) {
    setupTVs();
    createTVLetter();
    tvCooldown = 0;
    document.getElementById('p4-hud').classList.remove('hidden');
    updateP4Hud();
  } else if (index === 2) {
    buildMementosLabyrinth();
    createLetters();
    document.getElementById('p4-hud').classList.add('hidden');
    document.getElementById('catherine-hud').classList.add('hidden');
  } else if (index === 3) {
    initCatherine();
    document.getElementById('catherine-hud').classList.remove('hidden');
    document.getElementById('p4-hud').classList.add('hidden');
  } else if (index === 4) {
    initMetaphorBattle();
    document.getElementById('p4-hud').classList.add('hidden');
    document.getElementById('catherine-hud').classList.add('hidden');
  }

  document.getElementById("goal-title").innerText = dim.name;
  document.getElementById("goal-title").style.color = dim.color;
  document.getElementById("goal-panel").style.borderLeftColor = dim.color;
  document.getElementById("goal-desc").innerText = dim.desc;

  const worldNum = String(index + 1).padStart(2, '0');
  document.getElementById("world-badge-num").textContent = `MUNDO ${worldNum}`;
  document.getElementById("world-badge-sub").textContent = dim.name.split("·")[1].trim();

  document.body.className = "cursor-" + ["p3","p4","p5","catherine","metaphor"][index];

  updateWorldSignature();
  spawnFloatingPhrases();
  playMusicForDimension(index);
}

// ==========================================
// P3 — SOMBRAS
// ==========================================
function createShadows() {
  shadows = [];
  shadowsKilled = 0;
  for (let i = 0; i < TOTAL_SHADOWS; i++) {
    let angle = (TWO_PI / TOTAL_SHADOWS) * i + random(-0.3, 0.3);
    let d = random(150, 250);
    shadows.push({
      angle: angle, dist: d, r: 30, alive: true,
      pulse: random(TWO_PI),
      orbitSpeed: random(0.005, 0.012) * (random() > 0.5 ? 1 : -1),
      x: width / 2, y: height / 2
    });
  }
}

function drawShadows() {
  if (letters.length === 0) return;
  let centerX = letters[0].body.position.x;
  let centerY = letters[0].body.position.y;

  push();
  for (let s of shadows) {
    if (!s.alive) continue;
    s.angle += s.orbitSpeed;
    s.x = centerX + cos(s.angle) * s.dist;
    s.y = centerY + sin(s.angle) * s.dist;
    s.pulse += 0.05;
    let pl = sin(s.pulse) * 5;

    for (let t = 1; t <= 5; t++) {
      let pastAngle = s.angle - s.orbitSpeed * t * 8;
      let px = centerX + cos(pastAngle) * s.dist;
      let py = centerY + sin(pastAngle) * s.dist;
      fill(0, 0, 0, 60 - t * 10);
      noStroke();
      ellipse(px, py, s.r * 2 - t * 8, s.r * 2 - t * 8);
    }

    fill(0, 0, 0, 220);
    noStroke();
    ellipse(s.x, s.y, s.r * 2 + pl, s.r * 2 + pl);

    noFill();
    stroke(255, 0, 51, 180 + sin(s.pulse * 2) * 75);
    strokeWeight(2);
    ellipse(s.x, s.y, s.r * 2 + 14 + pl, s.r * 2 + 14 + pl);

    fill(255, 0, 51);
    noStroke();
    ellipse(s.x - 8, s.y - 4, 7, 9);
    ellipse(s.x + 8, s.y - 4, 7, 9);
    fill(255, 200, 200, 200);
    ellipse(s.x - 8, s.y - 5, 3, 3);
    ellipse(s.x + 8, s.y - 5, 3, 3);
  }
  pop();

  push();
  textAlign(CENTER, CENTER);
  textFont('Montserrat');
  textSize(16);
  fill(0, 153, 255, 220);
  noStroke();
  text(`SOMBRAS: ${shadowsKilled} / ${TOTAL_SHADOWS}`, width / 2, 260);
  pop();
}

function drawCharge() {
  if (isCharging) {
    let chargeTime = millis() - chargeStart;
    chargePower = constrain(map(chargeTime, 0, 1200, 0, 1), 0, 1);
    push();
    noFill();
    stroke(0, 153, 255, 200);
    strokeWeight(3);
    ellipse(mouseX, mouseY, 80 * chargePower, 80 * chargePower);
    stroke(0, 153, 255, 100);
    strokeWeight(1);
    ellipse(mouseX, mouseY, 80, 80);
    stroke(0, 153, 255, 255);
    strokeWeight(2);
    line(mouseX - 15, mouseY, mouseX + 15, mouseY);
    line(mouseX, mouseY - 15, mouseX, mouseY + 15);
    pop();
  }
}

function shootAtShadow() {
  let closest = null;
  let minDist = 120;
  for (let s of shadows) {
    if (!s.alive) continue;
    let d = dist(mouseX, mouseY, s.x, s.y);
    if (d < minDist) { minDist = d; closest = s; }
  }
  for (let i = 0; i < 10; i++) {
    particles.push({
      type: 'projectile',
      pos: { x: mouseX, y: mouseY },
      vel: { x: random(-3, 3), y: random(-3, 3) },
      life: 25
    });
  }
  if (closest) {
    closest.alive = false;
    shadowsKilled++;
    for (let i = 0; i < 40; i++) {
      particles.push({
        type: 'hit', pos: { x: closest.x, y: closest.y },
        vel: { x: random(-8, 8), y: random(-8, 8) }, life: 50
      });
    }
    showNotification(`SOMBRA ELIMINADA`, `${shadowsKilled} / ${TOTAL_SHADOWS}`);
    if (shadowsKilled >= TOTAL_SHADOWS) setTimeout(() => sealLetter('A'), 800);
  } else {
    spawnMissEffect(mouseX, mouseY);
  }
}

// ==========================================
// P4 — TVs
// ==========================================
function setupTVs() {
  TVS = [];
  const padX = 220;
  const padTop = 180;
  const yBottom = height - 420;
  tvJumpSpeed = 1000; // Más rápido
  
  TVS.push({ x: padX, y: padTop, r: 80 });
  TVS.push({ x: width - padX, y: padTop, r: 80 });
  TVS.push({ x: width / 2, y: height / 2 - 60, r: 90 });
  TVS.push({ x: padX, y: yBottom, r: 80 });
  TVS.push({ x: width - padX, y: yBottom, r: 80 });
}

function createTVLetter() {
  tvCurrentIndex = floor(random(TVS.length));
  tvLetterPos.x = TVS[tvCurrentIndex].x;
  tvLetterPos.y = TVS[tvCurrentIndex].y;
  tvHitCount = 0;
  tvLastMove = millis();
  tvJumpSpeed = 1000;
  tvVulnerable = false;
  tvCooldown = 0;
}

function drawTVWorld() {
  for (let i = 0; i < TVS.length; i++) {
    let tv = TVS[i];
    let isActive = (i === tvCurrentIndex) && !tvVulnerable;
    let isVuln = (i === tvCurrentIndex) && tvVulnerable;
    
    push();
    translate(tv.x, tv.y);
    rectMode(CENTER);
    
    // Diseño Retro
    fill(30, 25, 10);
    stroke(isVuln ? "#ffffff" : (isActive ? "#ffcc00" : "#444"));
    strokeWeight(isActive || isVuln ? 4 : 2);
    rect(0, 0, tv.r * 2, tv.r * 2, 10);
    
    // Pantalla
    fill(10, 10, 5);
    noStroke();
    rect(0, 5, tv.r * 1.6, tv.r * 1.4, 8);
    
    // Scanlines
    if (isActive || isVuln) {
      stroke(255, 204, 0, 40);
      strokeWeight(1);
      for (let y = -tv.r * 0.7; y < tv.r * 0.7; y += 6) {
        line(-tv.r * 0.8, y, tv.r * 0.8, y);
      }
    }
    // Antenas
    stroke(isActive ? "#ffcc00" : "#444");
    strokeWeight(3);
    line(-20, -tv.r, -40, -tv.r - 30);
    line(20, -tv.r, 40, -tv.r - 30);
    // Botones
    fill(isActive ? "#ffcc00" : "#444");
    ellipse(tv.r * 0.7, tv.r * 0.4, 8, 8);
    ellipse(tv.r * 0.7, tv.r * 0.6, 8, 8);
    
    pop();
  }
  
  push();
  textAlign(CENTER, CENTER);
  textFont('Montserrat');
  textSize(64);
  fill(tvVulnerable ? "#ffffff" : "#ffcc00");
  noStroke();
  text("?", tvLetterPos.x, tvLetterPos.y);
  pop();

  if (tvCooldown > 0) {
    let cdRatio = tvCooldown / TV_COOLDOWN;
    push();
    noStroke();
    fill(255, 0, 51, 220);
    rect(width / 2 - 100, 180, 200 * cdRatio, 8, 4);
    noFill();
    stroke(255, 0, 51, 200);
    strokeWeight(1);
    rect(width / 2 - 100, 180, 200, 8, 4);
    fill(255, 0, 51, 200);
    textAlign(CENTER, CENTER);
    textSize(10);
    text("COOLDOWN", width / 2, 165);
    pop();
  }

  if (!tvVulnerable && millis() - tvLastMove > tvJumpSpeed) {
    let next;
    do { next = floor(random(TVS.length)); } while (next === tvCurrentIndex && TVS.length > 1);
    tvCurrentIndex = next;
    tvLetterPos.x = TVS[tvCurrentIndex].x;
    tvLetterPos.y = TVS[tvCurrentIndex].y;
    tvLastMove = millis();
    spawnStaticParticles();
  }

  if (tvVulnerable && millis() - tvVulnerableTimer > 800) {
    tvVulnerable = false;
    tvJumpSpeed = max(300, tvJumpSpeed - 150); // Se acelera mucho
  }
}

function updateP4Hud() {
  document.getElementById('p4-hits').textContent = `CHANNEL ${tvHitCount} / 5`;
}

// ==========================================
// P5 — MEMENTOS
// ==========================================
function buildMementosLabyrinth() {
  for (let w of mementosWalls) World.remove(world, w);
  mementosWalls = [];
  const t = 40; // Paredes gruesas
  const opts = { isStatic: true, friction: 0.1 };
  const w = width, h = height;
  
  const walls = [
    Bodies.rectangle(w * 0.35, h * 0.25, w * 0.5, t, opts),
    Bodies.rectangle(w * 0.10, h * 0.45, t, h * 0.35, opts),
    Bodies.rectangle(w * 0.65, h * 0.55, w * 0.5, t, opts),
    Bodies.rectangle(w * 0.90, h * 0.45, t, h * 0.3, opts),
    Bodies.rectangle(w * 0.35, h * 0.75, w * 0.5, t, opts),
    Bodies.rectangle(w * 0.10, h * 0.85, t, h * 0.2, opts),
    Bodies.rectangle(w * 0.55, h * 0.90, w * 0.3, t, opts)
  ];
  
  for (let wall of walls) { 
    World.add(world, wall); 
    mementosWalls.push(wall); 
  }
}

function drawMementosWalls() {
  push();
  for (let w of mementosWalls) {
    let wWidth = w.bounds.max.x - w.bounds.min.x;
    let wHeight = w.bounds.max.y - w.bounds.min.y;
    
    push();
    translate(w.position.x, w.position.y);
    
    // Sombra de la pared
    noStroke();
    fill(20, 0, 5, 200);
    rect(-wWidth/2 + 8, -wHeight/2 + 8, wWidth, wHeight, 4);
    
    // Cuerpo de la cinta
    fill(230, 0, 40);
    rect(-wWidth/2, -wHeight/2, wWidth, wHeight, 4);
    
    // Brillo
    fill(255, 100, 120, 150);
    rect(-wWidth/2, -wHeight/2, wWidth, wHeight * 0.2, 4);
    
    // Bordes
    stroke(0, 0, 0, 255);
    strokeWeight(3);
    noFill();
    rect(-wWidth/2, -wHeight/2, wWidth, wHeight, 4);
    
    // Líneas
    stroke(150, 0, 20, 150);
    strokeWeight(1);
    if (wWidth > wHeight) {
      line(-wWidth/2 + 10, 0, wWidth/2 - 10, 0);
    } else {
      line(0, -wHeight/2 + 10, 0, wHeight/2 - 10);
    }
    pop();
  }
  pop();
}

function drawEscapeZone() {
  push();
  let ez = escapeZone;
  let cx = ez.x + ez.w / 2;
  let cy = ez.y + ez.h / 2;
  
  // Fondo
  fill(50, 0, 10, 200);
  noStroke();
  rect(ez.x, ez.y, ez.w, ez.h, 14);
  
  // Energía
  stroke(255, 0, 50, 150);
  strokeWeight(2);
  for (let i = 0; i < 8; i++) {
    let a = (TWO_PI / 8) * i + frameCount * 0.05;
    let x1 = cx + cos(a) * (ez.w / 3);
    let y1 = cy + sin(a) * (ez.h / 3);
    let x2 = cx + cos(a) * (ez.w / 2);
    let y2 = cy + sin(a) * (ez.h / 2);
    line(x1, y1, x2, y2);
  }
  
  // Borde
  noFill();
  stroke(255, 0, 50, 255);
  strokeWeight(4);
  rect(ez.x, ez.y, ez.w, ez.h, 14);
  
  // Texto
  textAlign(CENTER, CENTER);
  textSize(18);
  fill(255);
  noStroke();
  textFont('Montserrat');
  text("ESCAPE", cx, cy);
  pop();
}

// ==========================================
// CATHERINE
// ==========================================
function initCatherine() {
  catherineState.cellSize = 55;
  catherineState.cols = 9;
  catherineState.rows = 10;

  catherineState.offsetX = (width - catherineState.cols * catherineState.cellSize) / 2;
  catherineState.offsetY = height - catherineState.rows * catherineState.cellSize - 120;

  catherineState.grid = [];
  for (let c = 0; c < catherineState.cols; c++) {
    catherineState.grid[c] = [];
    for (let r = 0; r < catherineState.rows; r++) {
      catherineState.grid[c][r] = null;
    }
  }

  for (let c = 0; c < catherineState.cols; c++) {
    catherineState.grid[c][catherineState.rows - 1] = 'floor';
  }

  catherineState.letterCol = 4;
  catherineState.letterRow = catherineState.rows - 2;
  catherineState.grid[4][catherineState.rows - 2] = 'letter';

  catherineState.fallingBlocks = [];
  catherineState.moveCooldown = 0;
  catherineState.spawnInterval = 1400;
  catherineState.lastSpawn = millis() - 1400;
  catherineState.maxHeightReached = 0;
  catherineState.gameOver = false;
  catherineState.gameOverTimer = 0;
}

function updateCatherine(dt) {
  if (catherineState.gameOver) {
    catherineState.gameOverTimer -= dt;
    if (catherineState.gameOverTimer <= 0) {
      initCatherine();
    }
    return;
  }

  catherineState.moveCooldown -= dt;
  if (catherineState.moveCooldown <= 0) {
    if (keyIsDown(LEFT_ARROW)) { moveCatherineLetter(-1); catherineState.moveCooldown = 150; }
    if (keyIsDown(RIGHT_ARROW)) { moveCatherineLetter(1); catherineState.moveCooldown = 150; }
    if (keyIsDown(UP_ARROW)) { moveCatherineLetterUp(); catherineState.moveCooldown = 200; }
    if (keyIsDown(DOWN_ARROW)) { moveCatherineLetterDown(); catherineState.moveCooldown = 200; }
  }

  // Bloques cayendo
  for (let i = catherineState.fallingBlocks.length - 1; i >= 0; i--) {
    let b = catherineState.fallingBlocks[i];
    b.y += b.speed;
    if (b.y >= b.targetY) {
      if (catherineState.grid[b.col][b.row] === 'letter') {
        catherineState.gameOver = true;
        catherineState.gameOverTimer = 1500;
        catherineState.fallingBlocks.splice(i, 1);
        continue;
      }
      if (catherineState.grid[b.col][b.row] === null) {
        catherineState.grid[b.col][b.row] = 'block';
      }
      catherineState.fallingBlocks.splice(i, 1);
    }
  }

  if (millis() - catherineState.lastSpawn > catherineState.spawnInterval) {
    spawnCatherineBlock();
    catherineState.lastSpawn = millis();
  }

  // Auto-subida si hay bloque justo debajo
  let belowRow = catherineState.letterRow + 1;
  if (belowRow < catherineState.rows &&
      catherineState.grid[catherineState.letterCol][belowRow] === 'block') {
    if (catherineState.letterRow > 0 &&
        catherineState.grid[catherineState.letterCol][catherineState.letterRow - 1] === null) {
      
      // Romper bloque de abajo
      catherineState.grid[catherineState.letterCol][belowRow] = null;
      
      // Subir letra
      catherineState.grid[catherineState.letterCol][catherineState.letterRow] = null;
      catherineState.letterRow -= 1;
      catherineState.grid[catherineState.letterCol][catherineState.letterRow] = 'letter';
      
      // Actualizar altura dinámicamente
      catherineState.maxHeightReached = catherineState.rows - 1 - catherineState.letterRow;

      // Partículas
      for(let i=0; i<10; i++){
        particles.push({
          type: 'hit', 
          pos: { x: catherineState.offsetX + catherineState.letterCol * catherineState.cellSize + catherineState.cellSize/2, 
                 y: catherineState.offsetY + belowRow * catherineState.cellSize + catherineState.cellSize/2 },
          vel: { x: random(-4, 4), y: random(-4, 0) },
          life: 30
        });
      }
    }
  }

  if (catherineState.letterRow <= 1 && !gameState.foundLetters['U']) {
    sealLetter('U');
  }
}

function moveCatherineLetter(dir) {
  let newCol = catherineState.letterCol + dir;
  if (newCol < 0 || newCol >= catherineState.cols) return;
  if (catherineState.grid[newCol][catherineState.letterRow] !== null) return;
  catherineState.grid[catherineState.letterCol][catherineState.letterRow] = null;
  catherineState.letterCol = newCol;
  catherineState.grid[catherineState.letterCol][catherineState.letterRow] = 'letter';
}

function moveCatherineLetterUp() {
  let newRow = catherineState.letterRow - 1;
  if (newRow < 0) return;

  let belowRow = catherineState.letterRow + 1;
  let belowCell = (belowRow < catherineState.rows)
    ? catherineState.grid[catherineState.letterCol][belowRow]
    : 'floor';

  if (belowCell !== 'block' && belowCell !== 'floor') return;
  if (catherineState.grid[catherineState.letterCol][newRow] !== null) return;

  // Romper bloque
  if (belowCell === 'block') {
    catherineState.grid[catherineState.letterCol][belowRow] = null;
  }

  catherineState.grid[catherineState.letterCol][catherineState.letterRow] = null;
  catherineState.letterRow = newRow;
  catherineState.grid[catherineState.letterCol][catherineState.letterRow] = 'letter';
  catherineState.maxHeightReached = catherineState.rows - 1 - catherineState.letterRow;

  for(let i=0; i<10; i++){
    particles.push({
      type: 'hit', 
      pos: { x: catherineState.offsetX + catherineState.letterCol * catherineState.cellSize + catherineState.cellSize/2, 
             y: catherineState.offsetY + catherineState.letterRow * catherineState.cellSize + catherineState.cellSize },
      vel: { x: random(-4, 4), y: random(-4, 0) },
      life: 30
    });
  }
}

function moveCatherineLetterDown() {
  let newRow = catherineState.letterRow + 1;
  if (newRow >= catherineState.rows) return;
  if (catherineState.grid[catherineState.letterCol][newRow] !== null) return;

  // 1. Bajar la letra
  catherineState.grid[catherineState.letterCol][catherineState.letterRow] = null;
  catherineState.letterRow = newRow;
  catherineState.grid[catherineState.letterCol][catherineState.letterRow] = 'letter';

  // 2. Arrastrar los bloques que estaban arriba de la letra hacia abajo
  for (let r = newRow - 1; r >= 0; r--) {
    let cell = catherineState.grid[catherineState.letterCol][r];
    if (cell === 'block') {
      catherineState.grid[catherineState.letterCol][r + 1] = 'block';
      catherineState.grid[catherineState.letterCol][r] = null;
    } else if (cell !== null) {
      break; // Se detiene si encuentra algo que no es bloque
    }
  }

  // 3. Actualizar contador de altura
  let currentHighest = 0;
  for (let c = 0; c < catherineState.cols; c++) {
    for (let r = 0; r < catherineState.rows; r++) {
      if (catherineState.grid[c][r] === 'letter' || catherineState.grid[c][r] === 'block') {
        let height = catherineState.rows - 1 - r;
        if (height > currentHighest) currentHighest = height;
      }
    }
  }
  catherineState.maxHeightReached = currentHighest;
}

function spawnCatherineBlock() {
  let cols = [];
  for (let c = 0; c < catherineState.cols; c++) {
    if (catherineState.grid[c][0] === null) cols.push(c);
  }
  if (cols.length === 0) return;

  let col = cols[floor(random(cols.length))];

  let targetRow = -1;
  for (let r = 0; r < catherineState.rows; r++) {
    if (catherineState.grid[col][r] === null) {
      targetRow = r;
    } else {
      break;
    }
  }
  if (targetRow < 0) return;

  catherineState.fallingBlocks.push({
    col: col,
    row: targetRow,
    y: catherineState.offsetY - 60,
    targetY: catherineState.offsetY + targetRow * catherineState.cellSize,
    speed: 8
  });
}

function drawCatherineTower() {
  const cs = catherineState.cellSize;
  const ox = catherineState.offsetX;
  const oy = catherineState.offsetY;

  push();
  noStroke();
  fill(20, 0, 15, 220);
  rect(ox - 10, oy - 10, catherineState.cols * cs + 20, catherineState.rows * cs + 20, 8);
  stroke(255, 0, 170, 150);
  strokeWeight(2);
  noFill();
  rect(ox - 10, oy - 10, catherineState.cols * cs + 20, catherineState.rows * cs + 20, 8);
  pop();

  push();
  for (let c = 0; c < catherineState.cols; c++) {
    for (let r = 0; r < catherineState.rows; r++) {
      noFill();
      stroke(255, 0, 170, 25);
      strokeWeight(1);
      rect(ox + c * cs, oy + r * cs, cs, cs);
    }
  }
  pop();

  push();
  for (let c = 0; c < catherineState.cols; c++) {
    for (let r = 0; r < catherineState.rows; r++) {
      let cell = catherineState.grid[c][r];
      if (cell === null) continue;
      let x = ox + c * cs;
      let y = oy + r * cs;

      if (cell === 'floor') {
        noStroke();
        fill(255, 0, 170, 90);
        rect(x + 2, y + 2, cs - 4, cs - 4, 4);
      } else if (cell === 'block') {
        noStroke();
        fill(255, 0, 170, 200);
        rect(x + 2, y + 2, cs - 4, cs - 4, 4);
        stroke(255, 150, 220, 255);
        strokeWeight(2);
        noFill();
        rect(x + 2, y + 2, cs - 4, cs - 4, 4);
        stroke(255, 100, 200, 150);
        strokeWeight(1);
        line(x + 8, y + 8, x + cs - 8, y + cs - 8);
        line(x + 8, y + cs - 8, x + cs - 8, y + 8);
      } else if (cell === 'letter') {
        noStroke();
        fill(20, 0, 15);
        rect(x + 2, y + 2, cs - 4, cs - 4, 8);
        stroke(255, 0, 170, 255);
        strokeWeight(3);
        noFill();
        rect(x + 2, y + 2, cs - 4, cs - 4, 8);
        fill(255, 0, 170);
        noStroke();
        textAlign(CENTER, CENTER);
        textFont('Montserrat');
        textSize(cs * 0.7);
        text('U', x + cs / 2, y + cs / 2);

        // Flecha para subir
        let belowRow = r + 1;
        if (belowRow < catherineState.rows && catherineState.grid[c][belowRow] === 'block') {
          let bounce = sin(frameCount * 0.2) * 5;
          fill(255, 200, 0);
          triangle(
            x + cs/2, y - 5 + bounce,
            x + cs/2 - 10, y + 5 + bounce,
            x + cs/2 + 10, y + 5 + bounce
          );
        }
      }
    }
  }
  pop();

  push();
  for (let b of catherineState.fallingBlocks) {
    let x = ox + b.col * cs;
    let y = b.y;
    noStroke();
    fill(255, 0, 170, 240);
    rect(x + 2, y + 2, cs - 4, cs - 4, 4);
    stroke(255, 150, 220, 255);
    strokeWeight(2);
    noFill();
    rect(x + 2, y + 2, cs - 4, cs - 4, 4);
  }
  pop();

  push();
  fill(255, 0, 170, 220);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(13);
  textFont('JetBrains Mono');
  text("← → mover   ↑ subir/romper bloque   ↓ bajar", width / 2, oy + catherineState.rows * cs + 40);
  pop();

  if (catherineState.gameOver) {
    push();
    fill(255, 0, 51, 150);
    noStroke();
    rect(0, 0, width, height);
    textAlign(CENTER, CENTER);
    textFont('Montserrat');
    textSize(72);
    fill(255);
    text("¡APLASTADO!", width / 2, height / 2 - 40);
    textSize(20);
    fill(255, 220, 100);
    text("Reiniciando...", width / 2, height / 2 + 40);
    pop();
  }

  document.getElementById('cath-height').textContent =
    `ALTURA: ${catherineState.maxHeightReached} / ${catherineState.rows - 3}`;
}

// ==========================================
// METAPHOR
// ==========================================
function initMetaphorBattle() {
  metaphorBattle = {
    active: true,
    playerHP: 100, playerMaxHP: 100,
    potions: 2, turn: 0,
    turnIcons: 1, maxTurnIcons: 2,
    phase: 'player',
    boss: {
      hp: 150, maxHp: 150,
      wingHP: 40, wingMaxHP: 40,
      legHP: 60, legMaxHP: 60,
      apples: 2, applesAvailable: false,
      wingDestroyed: false, legDestroyed: false
    },
    selectedTarget: 'body',
    log: [],
    enemyActionDelay: 0,
    message: '¡Un Homo Gorleo bloquea el camino!',
    messageTimer: 120,
    playerDefending: false
  };
  addBattleLog('¡Batalla contra Homo Gorleo!');
}

function addBattleLog(msg) {
  metaphorBattle.log.push(msg);
  if (metaphorBattle.log.length > 6) metaphorBattle.log.shift();
}

function drawMetaphorBattle() {
  if (frameCount % 20 === 0) {
    particles.push({
      type: 'rune',
      pos: { x: random(width), y: height + 20 },
      vel: { x: random(-0.3, 0.3), y: random(-1, -0.3) },
      life: 200,
      char: random(["✦", "◆", "✧", "◇", "✶"])
    });
  }

  push();
  let circleR = 200 + sin(frameCount * 0.03) * 8;
  for (let i = 0; i < 3; i++) {
    noFill();
    stroke(230, 184, 0, 30 - i * 8);
    strokeWeight(2 + i);
    drawingContext.setLineDash([15 - i * 3, 10]);
    ellipse(width / 2, height / 2 + 30, (circleR + i * 25) * 2, (circleR + i * 25) * 2);
    drawingContext.setLineDash([]);
  }
  for (let i = 0; i < 12; i++) {
    let angle = (TWO_PI / 12) * i + frameCount * 0.005;
    let sx = width / 2 + cos(angle) * circleR;
    let sy = height / 2 + 30 + sin(angle) * circleR;
    fill(230, 184, 0, 180 + sin(frameCount * 0.05 + i) * 75);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(22);
    text(["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ", "ᚾ", "ᛁ", "ᛃ"][i], sx, sy);
  }
  pop();

  drawHomoGorleo(width / 2, height / 2 - 60);

  if (metaphorBattle.boss.applesAvailable && metaphorBattle.boss.apples > 0) {
    push();
    for (let i = 0; i < metaphorBattle.boss.apples; i++) {
      let ax = width / 2 - 40 + i * 40;
      let ay = height / 2 - 210;
      fill(255, 0, 51, 60);
      noStroke();
      ellipse(ax, ay, 45, 45);
      fill(255, 0, 51, 200 + sin(frameCount * 0.1 + i) * 55);
      ellipse(ax, ay, 28, 28);
      fill(255, 200, 200, 200);
      ellipse(ax - 6, ay - 6, 8, 8);
      stroke(80, 50, 20);
      strokeWeight(2);
      line(ax, ay - 14, ax + 3, ay - 20);
    }
    fill(255, 200, 0);
    textAlign(CENTER, CENTER);
    textSize(12);
    textFont('JetBrains Mono');
    text("¡HAZ CLIC EN LAS MANZANAS!", width / 2, height / 2 - 245);
    pop();
  }

  push();
  translate(width / 2, height / 2 + 30);
  let sPulse = 200 + sin(frameCount * 0.05) * 55;
  fill(230, 184, 0, sPulse);
  noStroke();
  textAlign(CENTER, CENTER);
  textFont('Montserrat');
  textSize(64);
  text("S", 0, 0);
  pop();

  drawBattlePanel();

  if (metaphorBattle.phase === 'enemy') {
    metaphorBattle.enemyActionDelay--;
    if (metaphorBattle.enemyActionDelay <= 0) performEnemyAction();
  }

  if (metaphorBattle.phase === 'victory') {
    push();
    fill(230, 184, 0, 100 + sin(frameCount * 0.1) * 50);
    noStroke();
    rect(0, 0, width, height);
    textAlign(CENTER, CENTER);
    textFont('Montserrat');
    textSize(52);
    fill(255);
    text("¡GORLEO DERROTADO!", width / 2, height / 2 - 60);
    textSize(18);
    fill(255, 220, 100);
    text("La letra 'S' es liberada", width / 2, height / 2 + 10);
    pop();
    if (!gameState.foundLetters['S']) sealLetter('S');
  }

  if (metaphorBattle.phase === 'defeat') {
    push();
    fill(255, 0, 51, 100);
    noStroke();
    rect(0, 0, width, height);
    textAlign(CENTER, CENTER);
    textFont('Montserrat');
    textSize(52);
    fill(255);
    text("DERROTA...", width / 2, height / 2 - 40);
    textSize(16);
    text("Presiona R para reintentar", width / 2, height / 2 + 30);
    pop();
  }
}

function drawHomoGorleo(cx, cy) {
  let b = metaphorBattle.boss;
  push();
  translate(cx, cy);

  // Aura oscura
  for (let i = 0; i < 4; i++) {
    fill(60, 10, 80, 20 - i * 4);
    noStroke();
    ellipse(0, 0, 240 + i * 40, 240 + i * 40);
  }

  // Cuerpo base
  let bodyAlpha = map(b.hp, 0, b.maxHp, 80, 255);
  let bodyGrad = drawingContext.createRadialGradient(0, -30, 20, 0, 0, 100);
  bodyGrad.addColorStop(0, `rgba(120, 50, 160, ${bodyAlpha / 255})`);
  bodyGrad.addColorStop(1, `rgba(30, 5, 40, ${bodyAlpha / 255})`);
  drawingContext.fillStyle = bodyGrad;
  stroke(180, 80, 220, 255);
  strokeWeight(3);
  ellipse(0, 0, 180, 190);

  // Pelaje
  push();
  stroke(100, 40, 120, 150);
  strokeWeight(2);
  for(let i=0; i<16; i++) {
    let a = (TWO_PI/16)*i;
    line(cos(a)*80, sin(a)*80, cos(a)*110, sin(a)*110);
  }
  pop();

  // Ojos
  fill(255, 0, 50);
  noStroke();
  ellipse(-40, -50, 35, 45);
  ellipse(40, -50, 35, 45);
  fill(255, 200, 0);
  ellipse(-40, -50, 15, 25);
  ellipse(40, -50, 15, 25);
  fill(0);
  ellipse(-40, -45, 8, 15);
  ellipse(40, -45, 8, 15);

  // Cuernos
  push();
  fill(230, 184, 0);
  stroke(255, 230, 100);
  strokeWeight(2);
  beginShape();
  vertex(-60, -90);
  bezierVertex(-100, -160, -30, -180, -20, -120);
  endShape(CLOSE);
  beginShape();
  vertex(60, -90);
  bezierVertex(100, -160, 30, -180, 20, -120);
  endShape(CLOSE);
  pop();

  // Boca
  fill(10, 0, 5);
  stroke(255, 0, 50);
  strokeWeight(2);
  arc(0, 20, 100, 60, 0, PI);
  fill(255);
  noStroke();
  triangle(-40, 20, -30, 60, -20, 20);
  triangle(40, 20, 30, 60, 20, 20);
  triangle(-50, 40, -40, 10, -30, 40);
  triangle(50, 40, 40, 10, 30, 40);

  // Ala
  if (!b.wingDestroyed) {
    push();
    translate(90, -70);
    rotate(sin(frameCount * 0.05) * 0.1 - 0.3);
    fill(80, 20, 100, 200);
    stroke(180, 80, 220);
    strokeWeight(2);
    beginShape();
    vertex(0, 0);
    bezierVertex(50, -20, 80, -80, 30, -120);
    bezierVertex(10, -140, -20, -100, -10, -50);
    endShape(CLOSE);
    fill(255, 200, 0); noStroke();
    textSize(14); textFont('JetBrains Mono');
    text(b.wingHP, 20, -60);
    pop();
  } else {
    push();
    translate(90, -70);
    rotate(-0.8);
    fill(40, 10, 60, 100);
    noStroke(); ellipse(0, 0, 30, 50);
    pop();
  }

  // Pierna
  if (!b.legDestroyed) {
    push();
    translate(-70, 90);
    rotate(0.4);
    fill(80, 20, 100, 200);
    stroke(180, 80, 220);
    strokeWeight(2);
    ellipse(0, 0, 60, 100);
    stroke(255, 200, 0); strokeWeight(3);
    line(-20, 40, -30, 70);
    line(0, 45, 0, 75);
    line(20, 40, 30, 70);
    fill(255, 200, 0); noStroke();
    textSize(14); text(b.legHP, 0, 0);
    pop();
  } else {
    push();
    translate(-70, 90);
    rotate(1.0);
    fill(40, 10, 60, 100);
    noStroke(); ellipse(0, 0, 30, 40);
    pop();
  }

  // HP Bar
  let hpRatio = b.hp / b.maxHp;
  push();
  fill(20, 0, 10, 240); stroke(255, 0, 50); strokeWeight(2);
  rect(-100, -150, 200, 16, 2);
  let grad = drawingContext.createLinearGradient(-100, 0, 100, 0);
  grad.addColorStop(0, '#ff0033'); grad.addColorStop(1, '#e6b800');
  drawingContext.fillStyle = grad; noStroke();
  rect(-98, -148, 196 * hpRatio, 12, 2);
  fill(255); textAlign(CENTER, CENTER); textSize(11); textFont('JetBrains Mono');
  text(`HOMO GORLEO · ${b.hp} / ${b.maxHp}`, 0, -142);
  pop();

  if (metaphorBattle.selectedTarget === 'body') {
    push();
    noFill(); stroke(255, 200, 0, 200 + sin(frameCount * 0.1) * 55);
    strokeWeight(2); drawingContext.setLineDash([10, 10]);
    ellipse(0, 0, 220, 230);
    drawingContext.setLineDash([]);
    pop();
  }

  pop();
}

function drawBattlePanel() {
  let panelY = height - 210;
  push();

  let grad = drawingContext.createLinearGradient(0, panelY, 0, height);
  grad.addColorStop(0, 'rgba(15, 10, 5, 0.95)');
  grad.addColorStop(1, 'rgba(5, 5, 10, 0.98)');
  drawingContext.fillStyle = grad;
  noStroke();
  rect(0, panelY, width, 210);

  stroke(230, 184, 0, 200); strokeWeight(2);
  line(0, panelY, width, panelY);

  push();
  noStroke();
  fill(20, 20, 20, 240); rect(30, panelY + 25, 220, 18, 9);
  let hpRatio = metaphorBattle.playerHP / metaphorBattle.playerMaxHP;
  let hpGrad = drawingContext.createLinearGradient(30, 0, 250, 0);
  hpGrad.addColorStop(0, '#00cc66'); hpGrad.addColorStop(1, '#00ff88');
  drawingContext.fillStyle = hpGrad;
  rect(30, panelY + 25, 220 * hpRatio, 18, 9);
  stroke(0, 255, 100, 150); strokeWeight(1); noFill();
  rect(30, panelY + 25, 220, 18, 9);

  fill(255); textAlign(LEFT, CENTER); textSize(12); textFont('JetBrains Mono');
  text(`HP ${metaphorBattle.playerHP} / ${metaphorBattle.playerMaxHP}`, 30, panelY + 60);

  textSize(11); fill(230, 184, 0); text("TURNOS", 30, panelY + 85);
  for (let i = 0; i < metaphorBattle.maxTurnIcons; i++) {
    let filled = i < ceil(metaphorBattle.turnIcons);
    fill(filled ? 230 : 60, filled ? 184 : 60, 0); noStroke();
    text("★", 90 + i * 20, panelY + 85);
  }

  fill(255); textSize(11); text(`OBJETIVO`, 30, panelY + 110);
  fill(230, 184, 0); text(getTargetName().toUpperCase(), 100, panelY + 110);

  fill(255); text(`POCIONES`, 30, panelY + 135);
  fill(0, 255, 100); text(`${metaphorBattle.potions}`, 110, panelY + 135);
  pop();

  let btnY = panelY + 40;
  let btnW = 140;
  let btnH = 44;
  let btnGap = 18;
  let startX = 290;

  drawBattleButton(startX + (btnW + btnGap) * 0, btnY, btnW, btnH, "ATACAR", '#0099ff', () => performMetaphorAction('attack'));
  drawBattleButton(startX + (btnW + btnGap) * 1, btnY, btnW, btnH, "CYC (Viento)", '#e6b800', () => performMetaphorAction('skill'));
  drawBattleButton(startX + (btnW + btnGap) * 2, btnY, btnW, btnH, "DEFENDER", '#888888', () => performMetaphorAction('defend'));
  drawBattleButton(startX + (btnW + btnGap) * 3, btnY, btnW, btnH, "POCIÓN", '#00cc66', () => performMetaphorAction('potion'));

  textAlign(LEFT, TOP); textSize(10); textFont('JetBrains Mono');
  for (let i = 0; i < metaphorBattle.log.length; i++) {
    let alpha = map(i, 0, metaphorBattle.log.length - 1, 255, 80);
    fill(180, 180, 180, alpha);
    text("> " + metaphorBattle.log[i], startX + 620, btnY + i * 16);
  }

  if (metaphorBattle.messageTimer > 0) {
    metaphorBattle.messageTimer--;
    textAlign(CENTER, CENTER); textFont('Montserrat'); textSize(28);
    fill(230, 184, 0, min(255, metaphorBattle.messageTimer * 5));
    noStroke(); text(metaphorBattle.message, width / 2, panelY - 50);
  }
  pop();
}

function drawBattleButton(x, y, w, h, label, col, onClick) {
  push();
  let hovered = mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  let disabled = metaphorBattle.phase !== 'player';

  let grad = drawingContext.createLinearGradient(x, y, x, y + h);
  if (disabled) {
    grad.addColorStop(0, 'rgba(30,30,30,0.9)'); grad.addColorStop(1, 'rgba(15,15,15,0.9)');
  } else if (hovered) {
    grad.addColorStop(0, 'rgba(60,60,80,0.98)'); grad.addColorStop(1, 'rgba(30,30,45,0.98)');
  } else {
    grad.addColorStop(0, 'rgba(40,40,55,0.9)'); grad.addColorStop(1, 'rgba(20,20,30,0.9)');
  }
  drawingContext.fillStyle = grad;
  stroke(disabled ? 80 : (hovered ? 255 : col)); strokeWeight(2);
  rect(x, y, w, h, 6);

  if (hovered && !disabled) {
    noFill(); stroke(red(color(col)), green(color(col)), blue(color(col)), 100); strokeWeight(6);
    rect(x, y, w, h, 6);
  }

  fill(disabled ? 90 : (hovered ? 255 : 230)); noStroke();
  textAlign(CENTER, CENTER); textSize(13); textFont('Space Grotesk');
  text(label, x + w / 2, y + h / 2);
  pop();

  if (hovered && !disabled && mouseIsPressed) {
    onClick();
    metaphorBattle.messageTimer = 1;
  }
}

function getTargetName() {
  switch (metaphorBattle.selectedTarget) {
    case 'body': return 'Cuerpo';
    case 'wing': return 'Ala';
    case 'leg': return 'Pierna';
    default: return 'Cuerpo';
  }
}

function performMetaphorAction(action) {
  if (metaphorBattle.phase !== 'player') return;
  let boss = metaphorBattle.boss;
  let target = metaphorBattle.selectedTarget;
  let damage = 0;

  if (action === 'attack') {
    damage = 10 + floor(random(0, 5));
    if (target === 'body') boss.hp -= damage;
    else if (target === 'wing') boss.wingHP -= damage;
    else if (target === 'leg') boss.legHP -= damage;
    addBattleLog(`Ataque → ${damage} daño a ${getTargetName()}`);
  } else if (action === 'skill') {
    damage = 25 + floor(random(0, 8));
    let isWeakness = (target === 'wing' || target === 'leg');
    if (isWeakness) {
      damage = floor(damage * 1.5);
      addBattleLog(`¡Cyc (debilidad)! → ${damage}`);
      metaphorBattle.turnIcons = min(metaphorBattle.turnIcons + 0.5, metaphorBattle.maxTurnIcons);
    } else {
      addBattleLog(`Cyc → ${damage} a ${getTargetName()}`);
    }
    if (target === 'body') boss.hp -= damage;
    else if (target === 'wing') boss.wingHP -= damage;
    else if (target === 'leg') boss.legHP -= damage;
  } else if (action === 'defend') {
    metaphorBattle.playerDefending = true;
    addBattleLog('Te defiendes.');
  } else if (action === 'potion') {
    if (metaphorBattle.potions > 0) {
      metaphorBattle.potions--;
      metaphorBattle.playerHP = min(metaphorBattle.playerMaxHP, metaphorBattle.playerHP + 30);
      addBattleLog('Poción: +30 HP');
    } else {
      addBattleLog('Sin pociones.');
      return;
    }
  }

  if (boss.wingHP <= 0 && !boss.wingDestroyed) {
    boss.wingDestroyed = true;
    addBattleLog('¡Ala destruida!');
  }
  if (boss.legHP <= 0 && !boss.legDestroyed) {
    boss.legDestroyed = true;
    addBattleLog('¡Pierna destruida!');
  }

  if (boss.hp <= 0) {
    metaphorBattle.phase = 'victory';
    return;
  }

  metaphorBattle.turnIcons -= 1;
  if (metaphorBattle.turnIcons <= 0) {
    metaphorBattle.phase = 'enemy';
    metaphorBattle.enemyActionDelay = 60;
    metaphorBattle.turnIcons = 1;
  }
}

function performEnemyAction() {
  let boss = metaphorBattle.boss;

  if (boss.apples > 0 && boss.hp < boss.maxHp * 0.6 && random() < 0.4) {
    boss.apples--;
    boss.hp = min(boss.maxHp, boss.hp + 40);
    addBattleLog('¡Gorleo come manzana! +40 HP');
    if (boss.apples > 0) boss.applesAvailable = true;
  } else {
    let damage;
    if (random() < 0.5) {
      damage = boss.wingDestroyed ? 10 : 15;
      addBattleLog(`Wingbeat → ${damage}`);
    } else {
      damage = boss.legDestroyed ? 15 : 25;
      addBattleLog(`Spin Slash → ${damage}`);
    }

    if (metaphorBattle.playerDefending) {
      damage = floor(damage * 0.5);
      metaphorBattle.playerDefending = false;
    }
    metaphorBattle.playerHP -= damage;
    if (metaphorBattle.playerHP <= 0) {
      metaphorBattle.playerHP = 0;
      metaphorBattle.phase = 'defeat';
      return;
    }
  }

  metaphorBattle.phase = 'player';
  metaphorBattle.turnIcons = 1;
  metaphorBattle.turn++;
}

function handleMetaphorClick(mx, my) {
  if (!metaphorBattle.active || metaphorBattle.phase !== 'player') return;

  if (metaphorBattle.boss.applesAvailable && metaphorBattle.boss.apples > 0) {
    for (let i = 0; i < metaphorBattle.boss.apples; i++) {
      let ax = width / 2 - 40 + i * 40;
      let ay = height / 2 - 210;
      if (dist(mx, my, ax, ay) < 20) {
        metaphorBattle.boss.apples--;
        metaphorBattle.boss.applesAvailable = metaphorBattle.boss.apples > 0;
        addBattleLog('¡Manzana derribada!');
        for (let j = 0; j < 20; j++) {
          particles.push({
            type: 'hit', pos: { x: ax, y: ay },
            vel: { x: random(-5, 5), y: random(-5, 5) }, life: 30
          });
        }
        return;
      }
    }
  }

  let bx = width / 2;
  let by = height / 2 - 60;

  if (!metaphorBattle.boss.wingDestroyed && dist(mx, my, bx + 75, by - 65) < 40) {
    metaphorBattle.selectedTarget = 'wing';
    metaphorBattle.message = 'OBJETIVO: Ala';
    metaphorBattle.messageTimer = 60;
    return;
  }
  if (!metaphorBattle.boss.legDestroyed && dist(mx, my, bx - 65, by + 75) < 40) {
    metaphorBattle.selectedTarget = 'leg';
    metaphorBattle.message = 'OBJETIVO: Pierna';
    metaphorBattle.messageTimer = 60;
    return;
  }
  if (dist(mx, my, bx, by) < 80) {
    metaphorBattle.selectedTarget = 'body';
    metaphorBattle.message = 'OBJETIVO: Cuerpo';
    metaphorBattle.messageTimer = 60;
  }
}

// ==========================================
// MOUSE
// ==========================================
function mousePressed() {
  if (!gameState.started || gameState.inHub) return;

  if (gameState.currentDimension === 0 && letters.length > 0) {
    isCharging = true;
    chargeStart = millis();
  }

  if (gameState.currentDimension === 1) {
    if (tvCooldown > 0) {
      tvJumpSpeed = max(400, tvJumpSpeed - 200);
      spawnMissEffect(mouseX, mouseY);
      return;
    }
    let tv = TVS[tvCurrentIndex];
    let d = dist(mouseX, mouseY, tv.x, tv.y);
    if (d < tv.r) {
      tvHitCount++;
      tvVulnerable = true;
      tvVulnerableTimer = millis();
      spawnHitEffect(tv.x, tv.y);
      showNotification(`CHANNEL ${tvHitCount}`, "Reach out to the truth");
      updateP4Hud();
      tvCooldown = TV_COOLDOWN;
      if (tvHitCount >= 5) setTimeout(() => sealLetter('T'), 600);
    } else {
      spawnMissEffect(mouseX, mouseY);
      tvJumpSpeed = max(400, tvJumpSpeed - 300);
      tvCooldown = TV_COOLDOWN;
    }
  }

  if (gameState.currentDimension === 4) {
    handleMetaphorClick(mouseX, mouseY);
  }
}

function mouseReleased() {
  if (gameState.currentDimension === 0 && isCharging && letters.length > 0) {
    shootAtShadow();
    isCharging = false;
    chargePower = 0;
  }
}

// ==========================================
// VICTORIA
// ==========================================
function checkLetterFound() {
  if (gameState.inHub) return;
  if (letters.length === 0) return;
  if (gameState.currentDimension !== 2) return;

  let l = letters[0];
  let pos = l.body.position;
  if (pos.x > escapeZone.x && pos.x < escapeZone.x + escapeZone.w &&
      pos.y > escapeZone.y && pos.y < escapeZone.y + escapeZone.h) {
    sealLetter('L');
  }
}

function sealLetter(char) {
  if (gameState.foundLetters[char]) return;
  gameState.foundLetters[char] = true;
  localStorage.setItem('atlus_found', JSON.stringify(gameState.foundLetters));

  showNotification(`"${char}" — Descubierta`, "Una nueva letra se revela");
  updateWordBar();

  let px = width / 2, py = height / 2;
  if (letters.length > 0) {
    px = letters[0].body.position.x;
    py = letters[0].body.position.y;
    World.remove(world, letters[0].body);
  } else if (gameState.currentDimension === 1) {
    px = tvLetterPos.x;
    py = tvLetterPos.y;
  } else if (gameState.currentDimension === 3) {
    px = width / 2;
    py = height / 2;
  }
  letters = [];

  for (let i = 0; i < 50; i++) {
    particles.push({
      type: 'gold',
      pos: { x: px, y: py },
      vel: { x: random(-7, 7), y: random(-7, 7) },
      life: 70
    });
  }

  if (Object.values(gameState.foundLetters).every(v => v)) {
    setTimeout(goToHub, 1500);
  } else {
    setTimeout(() => {
      let next = Object.values(gameState.foundLetters).findIndex(v => !v);
      if (next >= 0) applyDimension(next);
    }, 1800);
  }
}

// ==========================================
// HUB
// ==========================================
function goToHub() {
  gameState.inHub = true;
  letters = [];
  constraints = [];
  resetWorld();
  World.clear(world, false);
  createBoundaries();

  document.getElementById("goal-title").innerText = "La palabra está completa";
  document.getElementById("goal-title").style.color = "#ffcc00";
  document.getElementById("goal-panel").style.borderLeftColor = "#ffcc00";
  document.getElementById("goal-desc").innerText = "Cinco mundos. Una palabra. Tu turno.";
  document.getElementById("world-signature").innerHTML = "";
  document.getElementById("world-badge-num").textContent = "COMPLETO";
  document.getElementById("world-badge-sub").textContent = "★";
  document.getElementById("p4-hud").classList.add("hidden");
  document.getElementById("catherine-hud").classList.add("hidden");
  document.body.className = "";
  stopMusic();
}

function drawHub() {
  push();
  let bgGrad = drawingContext.createRadialGradient(width/2, height/2, 100, width/2, height/2, 800);
  bgGrad.addColorStop(0, 'rgba(30, 30, 40, 1)');
  bgGrad.addColorStop(1, 'rgba(5, 5, 10, 1)');
  drawingContext.fillStyle = bgGrad;
  noStroke();
  rect(0, 0, width, height);
  pop();

  if (frameCount % 2 === 0) {
    particles.push({
      type: 'gold',
      pos: { x: random(width), y: height + 20 },
      vel: { x: random(-1, 1), y: random(-4, -2) },
      life: 150
    });
  }

  push();
  textAlign(CENTER, CENTER);
  
  textFont('Montserrat');
  textSize(140);
  fill(255, 0, 51, 100);
  text("A T L U S", width / 2 + 8, height / 2 - 80 + 8);
  fill("#ffcc00");
  text("A T L U S", width / 2, height / 2 - 80);
  
  stroke(255, 204, 0, 100);
  strokeWeight(2);
  line(width/2 - 200, height/2 + 10, width/2 + 200, height/2 + 10);

  const games = [
    { name: "P3", color: "#0099ff" },
    { name: "P4", color: "#ffcc00" },
    { name: "P5", color: "#ff0033" },
    { name: "Catherine", color: "#ff00aa" },
    { name: "Metaphor", color: "#e6b800" }
  ];
  
  textSize(16);
  textFont('Space Grotesk');
  for (let i = 0; i < 5; i++) {
    fill(games[i].color);
    text(games[i].name, width / 2 - 240 + i * 120, height / 2 + 40);
    noStroke();
    ellipse(width / 2 - 240 + i * 120, height / 2 + 60, 8, 8);
  }

  textSize(24);
  fill("#ffffff");
  text("Five worlds. One word. Your move.", width / 2, height / 2 + 110);
  
  textSize(14);
  fill("#888");
  text("El mundo es una historia, y tú eres su autor.", width / 2, height / 2 + 150);
  pop();
}


// ==========================================
// PARTÍCULAS
// ==========================================
function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    if (p.permanent) continue;

    if (p.type === 'projectile') {
      push(); fill(0, 153, 255, p.life * 8); noStroke();
      ellipse(p.pos.x, p.pos.y, 8, 8); pop();
      p.pos.x += p.vel.x; p.pos.y += p.vel.y; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'gold') {
      push(); fill(255, 204, 0, p.life); noStroke();
      ellipse(p.pos.x, p.pos.y, 6, 6); pop();
      p.pos.x += p.vel.x; p.pos.y += p.vel.y; p.vel.y += 0.1;
      p.life -= 2;
      if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'rune') {
      push(); textAlign(CENTER, CENTER); textSize(20);
      fill(230, 184, 0, p.life); noStroke();
      text(p.char, p.pos.x, p.pos.y); pop();
      p.pos.x += p.vel.x; p.pos.y += p.vel.y; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'static') {
      push(); fill(255, 255, 255, p.life * 8); noStroke();
      rect(p.pos.x, p.pos.y, 4, 4); pop();
      p.pos.x += p.vel.x; p.pos.y += p.vel.y; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'hit') {
      push(); fill(255, 204, 0, p.life * 6); noStroke();
      ellipse(p.pos.x, p.pos.y, 8, 8); pop();
      p.pos.x += p.vel.x; p.pos.y += p.vel.y; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'miss') {
      push(); textAlign(CENTER, CENTER); textSize(20);
      fill(255, 0, 0, p.life * 6); noStroke();
      text("STATIC...", p.pos.x, p.pos.y); pop();
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'ash') {
      push(); fill(0, 255, 100, p.life); noStroke();
      ellipse(p.pos.x, p.pos.y, 3, 3); pop();
      p.pos.x += p.vel.x; p.pos.y += p.vel.y; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'feather') {
      push();
      translate(p.pos.x, p.pos.y);
      p.angle += p.rotSpeed;
      rotate(p.angle);
      fill(255, 0, 170, p.life * 0.5);
      noStroke();
      ellipse(0, 0, 15, 5);
      pop();
      p.pos.x += p.vel.x; p.pos.y += p.vel.y; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
}

function spawnStaticParticles() {
  for (let i = 0; i < 15; i++) {
    particles.push({
      type: 'static',
      pos: { x: tvLetterPos.x + random(-40, 40), y: tvLetterPos.y + random(-40, 40) },
      vel: { x: random(-2, 2), y: random(-2, 2) },
      life: 30
    });
  }
}

function spawnHitEffect(x, y) {
  for (let i = 0; i < 30; i++) {
    particles.push({
      type: 'hit', pos: { x, y },
      vel: { x: random(-5, 5), y: random(-5, 5) }, life: 40
    });
  }
}

function spawnMissEffect(x, y) {
  particles.push({ type: 'miss', pos: { x, y }, life: 40 });
}

// ==========================================
// FRASES
// ==========================================
function spawnFloatingPhrases() {
  floatingPhrases = [];
  let dim = DIMENSIONS[gameState.currentDimension];
  for (let i = 0; i < 3; i++) {
    floatingPhrases.push({
      text: random(dim.phrases),
      x: random(100, width - 100),
      y: random(150, height - 150),
      life: 300, maxLife: 300
    });
  }
}

function drawFloatingPhrases() {
  push();
  textAlign(CENTER, CENTER);
  textFont('Space Grotesk');
  textSize(18);
  let dim = DIMENSIONS[gameState.currentDimension];
  for (let i = floatingPhrases.length - 1; i >= 0; i--) {
    let fp = floatingPhrases[i];
    let alpha = map(fp.life, 0, fp.maxLife, 0, 120);
    fill(red(color(dim.color)), green(color(dim.color)), blue(color(dim.color)), alpha);
    noStroke();
    text(`"${fp.text}"`, fp.x, fp.y + sin(frameCount * 0.02 + i) * 5);
    fp.life--;
    if (fp.life <= 0) {
      fp.text = random(dim.phrases);
      fp.x = random(100, width - 100);
      fp.y = random(150, height - 150);
      fp.life = fp.maxLife;
    }
  }
  pop();
}

function drawConstraints() {
  let dim = DIMENSIONS[gameState.currentDimension];
  push();
  stroke(dim.color);
  strokeWeight(3);
  for (let c of constraints) {
    let posA = c.pointA;
    let posB = c.bodyB ? c.bodyB.position : c.pointB;
    if (c.bodyA) posA = c.bodyA.position;
    line(posA.x, posA.y, posB.x, posB.y);
  }
  pop();
}

// ==========================================
// UI
// ==========================================
function updateWordBar() {
  document.querySelectorAll('.word-slot').forEach(slot => {
    const index = parseInt(slot.dataset.index);
    const letter = LETTER_ORDER[index];
    if (gameState.foundLetters[letter]) {
      slot.textContent = letter;
      slot.classList.add('found');
    } else {
      slot.textContent = "?";
      slot.classList.remove('found');
    }
  });

  let allFound = true;
  document.querySelectorAll('.brand-letter').forEach(el => {
    const index = parseInt(el.dataset.index);
    const letter = LETTER_ORDER[index];
    if (gameState.foundLetters[letter]) {
      if (el.textContent !== letter) {
        el.textContent = letter;
        el.classList.add('found');
      }
    } else {
      el.textContent = "_";
      el.classList.remove('found');
      allFound = false;
    }
  });

  const brandBar = document.getElementById('brand-bar');
  if (brandBar) {
    brandBar.classList.toggle('complete', allFound);
  }
}

function showNotification(title, subtitle) {
  let n = document.getElementById('notification');
  document.getElementById('notif-title').textContent = title;
  document.getElementById('notif-sub').textContent = subtitle || "";
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 2200);
}

function updateWorldSignature() {
  const sigs = [
    `<svg viewBox="0 0 24 24" fill="none" stroke="#0099ff" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="#ffcc00" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="#ff0033" stroke-width="2"><path d="M12 2C6 2 2 6 2 12s4 10 10 10 10-4 10-10S18 2 12 2z"/><circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="#ff00aa" stroke-width="2"><path d="M8 2h8l-1 7a4 4 0 01-6 0L8 2z"/><path d="M12 13v7"/><path d="M8 22h8"/></svg>`,
    `<svg viewBox="0 0 24 24" fill="none" stroke="#e6b800" stroke-width="2"><path d="M20 4c-4 0-8 4-8 8l-4 4-4 4 4-4 4-4c4 0 8-4 8-8z"/></svg>`
  ];
  document.getElementById('world-signature').innerHTML = sigs[gameState.currentDimension] || "";
}

// ==========================================
// RESIZE
// ==========================================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  escapeZone.x = width - 280;
  escapeZone.y = height - 240;
  if (gameState.currentDimension === 1 && gameState.started) setupTVs();
  if (gameState.currentDimension === 2 && gameState.started) buildMementosLabyrinth();
  if (gameState.currentDimension === 3 && gameState.started) initCatherine();
}

// ATLUS · atmosphere.js — cárgalo DESPUÉS de main.js
// Sobrescribe drawAmbientEffects() con una atmósfera propia por mundo
// y engancha el tema visual (colores CSS) al cambiar de mundo.

const hr = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };
const grad = (x0, y0, x1, y1, stops) => {
  const g = drawingContext.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
};
const glow = (x, y, r, rgb, a) => {
  const g = drawingContext.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  drawingContext.fillStyle = g; noStroke(); rect(x - r, y - r, r * 2, r * 2);
};

// ---------- Tema: color CSS + data-world + color por tarjeta ----------
const _applyDimension = applyDimension;
applyDimension = function (i) {
  _applyDimension(i);
  document.body.dataset.world = i;
  document.documentElement.style.setProperty('--c', DIMENSIONS[i].color);
};
const _goToHub = goToHub;
goToHub = function () {
  _goToHub();
  document.body.dataset.world = 'hub';
  document.documentElement.style.setProperty('--c', '#ffcc00');
};
document.querySelectorAll('.world-card').forEach((c) =>
  c.style.setProperty('--c', DIMENSIONS[+c.dataset.dim].color));

// ---------- Atmósferas ----------
function drawAmbientEffects() {
  const w = width, h = height, t = frameCount;
  const d = gameState.currentDimension;
  push(); noStroke();

  if (d === 0) { // P3 · The Dark Hour: luna verde, reloj, ataúdes, niebla
    drawingContext.fillStyle = grad(0, 0, 0, h, [[0, '#021a14'], [0.6, '#050b14'], [1, '#000']]);
    rect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      fill(200, 255, 230, 60 + 120 * abs(sin(t * 0.02 + i)));
      ellipse(hr(i) * w, hr(i + 99) * h * 0.7, 2, 2);
    }
    const mx = w - 200, my = 200;
    glow(mx, my, 330 + sin(t * 0.02) * 12, '0,255,120', 0.35);
    fill(170, 255, 200); ellipse(mx, my, 170, 170);
    fill(90, 200, 140, 120); ellipse(mx - 30, my - 20, 40, 40); ellipse(mx + 35, my + 25, 26, 26);
    push(); translate(mx, my); noFill(); stroke(0, 255, 120, 70); strokeWeight(2);
    ellipse(0, 0, 300, 300);
    for (let k = 0; k < 12; k++) { // reloj de las 12 (hora oscura)
      const a = k * TWO_PI / 12;
      line(cos(a) * 140, sin(a) * 140, cos(a) * 152, sin(a) * 152);
    }
    rotate(t * 0.004); line(0, 0, 0, -120); pop();
    for (let i = 0; i < 9; i++) { // ataúdes
      const x = (i + 0.5) * w / 9, bh = 90 + hr(i) * 60;
      fill(2, 8, 10); beginShape();
      vertex(x - 18, h); vertex(x - 26, h - bh * 0.7); vertex(x - 12, h - bh);
      vertex(x + 12, h - bh); vertex(x + 26, h - bh * 0.7); vertex(x + 18, h); endShape(CLOSE);
    }
    for (let i = 0; i < 3; i++) { glow(w / 2 + sin(t * 0.005 + i) * 200, h - 120 - i * 90, 380, '0,255,120', 0.06); }
  }

  if (d === 1) { // P4 · TV World: niebla dorada, ruido de TV, líneas
    drawingContext.fillStyle = grad(0, 0, w, h, [[0, '#2a2400'], [1, '#0e0b00']]);
    rect(0, 0, w, h);
    for (let i = 0; i < 6; i++) glow((hr(i) * w + t * (0.3 + i * 0.1)) % (w + 400) - 200, hr(i + 9) * h, 360, '255,230,120', 0.1);
    stroke(255, 204, 0, 22); strokeWeight(1);
    for (let y = (t * 3) % 8; y < h; y += 8) line(0, y, w, y);
    noStroke();
    for (let i = 0; i < 90; i++) { fill(255, 255, 220, hr(i + t * 0.7) * 40); rect(hr(i * 3 + t) * w, hr(i * 5 + t) * h, 3, 2); }
    fill(255, 204, 0, 8); textFont('Montserrat'); textAlign(CENTER, CENTER); textSize(min(w, h) * 0.9);
    text('?', w / 2, h / 2);
    if (t % 140 < 6) { fill(255, 255, 255, 14); rect(0, hr(t) * h, w, 40); } // glitch
  }

  if (d === 2) { // P5 · Metaverse: rayos rojo/negro, estrellas de carta de presentación
    background(8, 0, 4);
    push(); translate(w / 2, h / 2); rotate(t * 0.002);
    const n = 24, R = max(w, h);
    for (let k = 0; k < n; k += 2) {
      fill(170, 0, 25, 70);
      triangle(0, 0, cos(k * TWO_PI / n) * R, sin(k * TWO_PI / n) * R, cos((k + 1) * TWO_PI / n) * R, sin((k + 1) * TWO_PI / n) * R);
    }
    pop();
    glow(w / 2, h / 2, max(w, h) * 0.5, '0,0,0', 0.7);
    for (let i = 0; i < 14; i++) {
      const x = hr(i) * w, y = (hr(i + 7) * h + t * (0.4 + hr(i + 3))) % h, s = 8 + hr(i + 1) * 14;
      fill(255, 255, 255, 90); push(); translate(x, y); rotate(t * 0.01 * (i % 2 ? 1 : -1));
      beginShape(); for (let j = 0; j < 10; j++) { const a = -HALF_PI + j * PI / 5, r = j % 2 ? s * 0.4 : s; vertex(cos(a) * r, sin(a) * r); } endShape(CLOSE); pop();
    }
    fill(255, 0, 51, 150); rect(0, h - 14, w, 14); fill(0); for (let x = 0; x < w; x += 40) rect(x, h - 14, 20, 14);
  }

  if (d === 3) { // Catherine: pesadilla, escaleras, nubes de oveja, plumas
    drawingContext.fillStyle = grad(0, 0, 0, h, [[0, '#1a0030'], [0.55, '#2a0020'], [1, '#08000a']]);
    rect(0, 0, w, h);
    for (let i = 0; i < 8; i++) glow(hr(i) * w, (hr(i + 4) * h + t * 0.2 * (i % 3 + 1)) % h, 150, '255,150,220', 0.07); // algodón/oveja
    fill(255, 0, 170, 14);
    for (let i = 0; i < 12; i++) { const x = w * 0.1 + i * 55, y = h - i * 38 - 40 + sin(t * 0.02 + i) * 3; rect(x, y, 55, 14); } // escalera
    push(); translate(w * 0.12, h * 0.2); noFill(); stroke(255, 0, 170, 60); strokeWeight(2);
    ellipse(0, 0, 120, 120); rotate(t * 0.002); line(0, 0, 0, -48); rotate(t * 0.02); line(0, 0, 0, -34); pop();
    if (t % 10 === 0) particles.push({ type: 'feather', pos: { x: random(w), y: -20 }, vel: { x: random(-1, 1), y: random(1, 2) }, life: 300, angle: random(TWO_PI), rotSpeed: random(-0.02, 0.02) });
  }

  if (d === 4) { // Metaphor: amanecer dorado de fantasía, halo, estrellas, runas
    drawingContext.fillStyle = grad(0, 0, 0, h, [[0, '#1a1400'], [0.5, '#2b2106'], [1, '#07050a']]);
    rect(0, 0, w, h);
    glow(w / 2, h / 2, max(w, h) * 0.55, '230,184,0', 0.16 + sin(t * 0.02) * 0.03);
    push(); translate(w / 2, h / 2 + 30); stroke(230, 184, 0, 20); strokeWeight(2);
    for (let k = 0; k < 16; k++) { const a = k * TWO_PI / 16 + t * 0.002; line(cos(a) * 260, sin(a) * 260, cos(a) * max(w, h), sin(a) * max(w, h)); }
    pop(); noStroke();
    for (let i = 0; i < 60; i++) { fill(255, 235, 160, 40 + 150 * abs(sin(t * 0.03 + i))); const s = 1 + hr(i) * 3; rect(hr(i + 2) * w, hr(i + 8) * h, s, s); }
    for (let i = 0; i < 10; i++) { const y = h - ((t * (0.5 + hr(i)) + hr(i + 5) * h) % h); glow(hr(i) * w + sin(t * 0.02 + i) * 20, y, 14, '255,200,60', 0.5); } // brasas
  }
  pop();
}