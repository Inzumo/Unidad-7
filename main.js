// ==========================================
// ATLUS: Multiverse Physical System — v4
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
  {
    name: "Mundo 01 · The Dark Hour",
    letterTarget: "A",
    color: "#0099ff",
    bg: "#050b14",
    desc: "Carga el Evoker: mantén el clic, apunta y suelta. Empuja la letra hacia la Luna Llena.",
    gravity: { x: 0, y: 0 },
    phrases: ["Memento Mori", "The Dark Hour", "Are you afraid of death?", "The clock is ticking", "Death is not the end"],
    winCondition: "orbitMoon",
    music: "music/p3.mp3"
  },
  {
    name: "Mundo 02 · The TV World",
    letterTarget: "T",
    color: "#ffcc00",
    bg: "#1a1600",
    desc: "La letra salta entre televisores. Haz clic en el TV correcto cuando esté dentro, 5 veces.",
    gravity: { x: 0, y: 0 },
    phrases: ["Reach out to the truth", "I am thou", "Thou art I", "Can you see through the fog?", "The truth is out there"],
    winCondition: "hitsTVs",
    music: "music/p4.mp3"
  },
  {
    name: "Mundo 03 · The Metaverse",
    letterTarget: "L",
    color: "#ff0033",
    bg: "#120003",
    desc: "Escapa de Mementos: arrastra la letra por el laberinto hasta la salida roja.",
    gravity: { x: 0, y: 0 },
    phrases: ["You'll never see it coming", "Take your heart", "Wake up, get up, get out there", "Are you free?", "Steal back your future"],
    winCondition: "reachEscape",
    music: "music/p5.mp3"
  },
  {
    name: "Mundo 04 · Tower of Babel",
    letterTarget: "U",
    color: "#ff00aa",
    bg: "#14000b",
    desc: "Arrastra los bloques con el mouse para apilarlos debajo de la letra y elevarla hasta la cima.",
    gravity: { x: 0, y: 1.2 },
    phrases: ["It's a nightmare", "Don't look down", "Love is over", "What do you desire?", "Will you climb?"],
    winCondition: "stackTower",
    music: "music/catherine.mp3"
  },
  {
    name: "Mundo 05 · Archetype Threads",
    letterTarget: "S",
    color: "#e6b800",
    bg: "#0d0c03",
    desc: "Tensa los hilos: haz clic en los 3 anclajes dorados para bajar la letra al centro.",
    gravity: { x: 0, y: -0.1 },
    phrases: ["The world is a story", "Fantasy lives on", "You are its author", "Who are you?", "What story will you write?"],
    winCondition: "connectThreads",
    music: "music/metaphor.mp3"
  }
];

// P3
let isCharging = false;
let chargeStart = 0;
let chargePower = 0;

// P4
let TVS = [];
let tvLetterPos = { x: 0, y: 0 };
let tvCurrentIndex = 0;
let tvHitCount = 0;
let tvLastMove = 0;
let tvJumpSpeed = 2000;
let tvVulnerable = false;
let tvVulnerableTimer = 0;

// P5 — Mementos
let mementosWalls = [];
let escapeZone = { x: 0, y: 0, w: 220, h: 160 };

// Catherine
let catherineState = {
  towerBodies: [],
  spawnInterval: 1800,
  lastSpawn: 0
};

// Metaphor
let anchors = [];

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

  // MouseConstraint con stiffness alto para que arrastre bien los bloques
  canvasMouse = Mouse.create(canvas.elt);
  canvasMouse.pixelRatio = pixelDensity();
  mouseConstraint = MouseConstraint.create(engine, {
    mouse: canvasMouse,
    constraint: {
      stiffness: 0.8,      // <-- FIX 2: alta para arrastrar bloques pesados
      damping: 0.1,
      render: { visible: false }
    }
  });
  World.add(world, mouseConstraint);

  createBoundaries();
  setupWorldSelect();
  updateWordBar();

  escapeZone.x = width - 280;
  escapeZone.y = height - 240;
}

// ==========================================
// SELECCIÓN DE MUNDO
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
}

// ==========================================
// RESET GENERAL
// ==========================================
function resetWorld() {
  for (let l of letters) World.remove(world, l.body);
  letters = [];
  for (let c of constraints) World.remove(world, c);
  constraints = [];
  for (let w of mementosWalls) World.remove(world, w);
  mementosWalls = [];
  for (let b of catherineState.towerBodies) World.remove(world, b);
  catherineState.towerBodies = [];
  particles = [];
  floatingPhrases = [];
  TVS = [];
  anchors = [];
  isCharging = false;
  chargePower = 0;
  tvHitCount = 0;
  tvVulnerable = false;
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
    (sound) => {
      bgMusic = sound;
      bgMusic.setVolume(musicMuted ? 0 : 0.35);
      bgMusic.loop();
    },
    (err) => console.warn("Música no cargada:", dim.music)
  );
}

function stopMusic() {
  if (bgMusic) { bgMusic.stop(); bgMusic = null; }
}

// ==========================================
// DRAW
// ==========================================
function draw() {
  if (!gameState.started) { background("#06060a"); return; }

  const dim = DIMENSIONS[gameState.currentDimension];
  background(gameState.inHub ? "#0a0a12" : dim.bg);

  if (gameState.inHub) { drawHub(); return; }

  drawAmbientEffects();
  drawFloatingPhrases();

  // P4 no usa Matter
  if (gameState.currentDimension === 1) {
    drawTVWorld();
    drawParticles();
    return;
  }

  Engine.update(engine);
  drawConstraints();
  drawParticles();
  for (let l of letters) l.display();

  if (gameState.currentDimension === 0) drawCharge();
  if (gameState.currentDimension === 2) { drawMementosWalls(); drawEscapeZone(); }
  if (gameState.currentDimension === 3) { drawCatherineTower(); applyCatherineLift(); }
  if (gameState.currentDimension === 4) drawAnchors();

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

  let x = width / 2, y = height / 2;
  if (gameState.currentDimension === 0) { x = width / 2 + 300; y = height / 2; }
  if (gameState.currentDimension === 2) { x = width * 0.15; y = height * 0.15; }
  if (gameState.currentDimension === 3) { x = width / 2; y = height - 200; }
  if (gameState.currentDimension === 4) { x = width / 2; y = 200; }

  let body = Bodies.rectangle(x, y, 60, 80, {
    restitution: 0.6,
    friction: 0.05,
    density: 0.002
  });

  letters.push(new LetterBody(body, activeChar, gameState.currentDimension));
  World.add(world, body);

  if (gameState.currentDimension === 4) {
    let anchor = Constraint.create({
      pointA: { x: width / 2, y: 80 },
      bodyB: body,
      stiffness: 0.03,
      damping: 0.02
    });
    constraints.push(anchor);
    World.add(world, anchor);
  }
}

class LetterBody {
  constructor(body, char, index) {
    this.body = body;
    this.char = char;
    this.index = index;
  }

  display() {
    let pos = this.body.position;
    let angle = this.body.angle;
    let dim = DIMENSIONS[this.index];
    push();
    translate(pos.x, pos.y);
    rotate(angle);
    rectMode(CENTER);
    strokeWeight(4);
    stroke(dim.color);
    fill("#111116");
    rect(0, 0, 60, 80, 8);
    textAlign(CENTER, CENTER);
    textSize(44);
    textFont('Montserrat');
    fill(dim.color);
    noStroke();
    text(this.char, 0, -2);
    pop();
  }
}

// ==========================================
// APLICAR DIMENSIÓN
// ==========================================
function applyDimension(index) {
  const prevIndex = gameState.currentDimension;

  // Limpiar mundo ANTERIOR
  if (prevIndex === 3) {
    for (let b of catherineState.towerBodies) World.remove(world, b);
    catherineState.towerBodies = [];
  }
  if (prevIndex === 2) {
    for (let w of mementosWalls) World.remove(world, w);
    mementosWalls = [];
  }

  gameState.currentDimension = index;
  let dim = DIMENSIONS[index];

  world.gravity.x = dim.gravity.x;
  world.gravity.y = dim.gravity.y;

  for (let c of constraints) World.remove(world, c);
  constraints = [];
  particles = particles.filter(p => !p.permanent);

  for (let l of letters) World.remove(world, l.body);
  letters = [];

  // Inicializar mundo
  if (index === 1) {
    setupTVs();
    createTVLetter();
    document.getElementById('p4-hud').classList.remove('hidden');
    updateP4Hud();
  } else if (index === 2) {
    buildMementosLabyrinth();
    createLetters();
    document.getElementById('p4-hud').classList.add('hidden');
  } else if (index === 3) {
    // Catherine: spawnear 3 bloques de inicio
    catherineState.towerBodies = [];
    catherineState.lastSpawn = 0;
    catherineState.spawnInterval = 1800;
    createLetters();
    for (let i = 0; i < 3; i++) {
      spawnCatherineBlock(-100 - i * 150);
    }
    document.getElementById('catherine-hud').classList.remove('hidden');
    document.getElementById('p4-hud').classList.add('hidden');
  } else {
    createLetters();
    document.getElementById('p4-hud').classList.add('hidden');
    document.getElementById('catherine-hud').classList.add('hidden');
  }

  if (index === 4) {
    anchors = [
      { x: width * 0.2, y: 100, tensioned: false },
      { x: width * 0.5, y: 80, tensioned: false },
      { x: width * 0.8, y: 100, tensioned: false }
    ];
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
// P3 — EVOKER
// ==========================================
function drawCharge() {
  if (isCharging) {
    let chargeTime = millis() - chargeStart;
    chargePower = constrain(map(chargeTime, 0, 1500, 0, 1), 0, 1);
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

// ==========================================
// P4 — TVs (FIX 4: no chocan con el panel)
// ==========================================
function setupTVs() {
  TVS = [];
  const padX = 220;
  const padTop = 180;
  const yBottom = height - 420; // <-- Muy arriba para no chocar con el panel

  TVS.push({ x: padX, y: padTop, r: 80 });                    // arriba izq
  TVS.push({ x: width - padX, y: padTop, r: 80 });            // arriba der
  TVS.push({ x: width / 2, y: height / 2 - 60, r: 90 });      // centro
  TVS.push({ x: padX, y: yBottom, r: 80 });                   // abajo izq
  TVS.push({ x: width - padX, y: yBottom, r: 80 });           // abajo der
}

function createTVLetter() {
  tvCurrentIndex = floor(random(TVS.length));
  tvLetterPos.x = TVS[tvCurrentIndex].x;
  tvLetterPos.y = TVS[tvCurrentIndex].y;
  tvHitCount = 0;
  tvLastMove = millis();
  tvJumpSpeed = 2000;
  tvVulnerable = false;
}

function drawTVWorld() {
  for (let i = 0; i < TVS.length; i++) {
    let tv = TVS[i];
    let isActive = (i === tvCurrentIndex) && !tvVulnerable;
    let isVuln = (i === tvCurrentIndex) && tvVulnerable;
    push();
    noFill();
    stroke(isVuln ? "#ffffff" : (isActive ? "#ffcc00" : "#444"));
    strokeWeight(isActive || isVuln ? 4 : 2);
    rect(tv.x - tv.r, tv.y - tv.r, tv.r * 2, tv.r * 2, 14);
    pop();
    if (isActive || isVuln) {
      push();
      stroke(255, 204, 0, 40);
      strokeWeight(1);
      for (let y = tv.y - tv.r; y < tv.y + tv.r; y += 6) {
        line(tv.x - tv.r, y, tv.x + tv.r, y);
      }
      pop();
    }
  }
  push();
  textAlign(CENTER, CENTER);
  textFont('Montserrat');
  textSize(64);
  fill(tvVulnerable ? "#ffffff" : "#ffcc00");
  noStroke();
  text("?", tvLetterPos.x, tvLetterPos.y);
  pop();

  if (!tvVulnerable && millis() - tvLastMove > tvJumpSpeed) {
    let next;
    do { next = floor(random(TVS.length)); } while (next === tvCurrentIndex && TVS.length > 1);
    tvCurrentIndex = next;
    tvLetterPos.x = TVS[tvCurrentIndex].x;
    tvLetterPos.y = TVS[tvCurrentIndex].y;
    tvLastMove = millis();
    spawnStaticParticles();
  }

  if (tvVulnerable && millis() - tvVulnerableTimer > 1000) {
    tvVulnerable = false;
    tvJumpSpeed = max(600, tvJumpSpeed - 200);
  }
}

function updateP4Hud() {
  document.getElementById('p4-hits').textContent = `CHANNEL ${tvHitCount} / 5`;
}

// ==========================================
// P5 — MEMENTOS (FIX 3: laberinto visible)
// ==========================================
function buildMementosLabyrinth() {
  for (let w of mementosWalls) World.remove(world, w);
  mementosWalls = [];

  const t = 30;
  const opts = { isStatic: true, friction: 0.3 };
  const w = width, h = height;

  // Laberinto en zigzag con huecos claros
  const walls = [
    // 1. Horizontal superior (hueco a la derecha)
    Bodies.rectangle(w * 0.35, h * 0.22, w * 0.5, t, opts),
    // 2. Vertical izquierda
    Bodies.rectangle(w * 0.10, h * 0.40, t, h * 0.3, opts),
    // 3. Horizontal media (hueco a la izquierda)
    Bodies.rectangle(w * 0.65, h * 0.48, w * 0.5, t, opts),
    // 4. Vertical derecha
    Bodies.rectangle(w * 0.90, h * 0.40, t, h * 0.28, opts),
    // 5. Horizontal baja (hueco a la derecha)
    Bodies.rectangle(w * 0.35, h * 0.70, w * 0.5, t, opts),
    // 6. Vertical baja izquierda
    Bodies.rectangle(w * 0.10, h * 0.85, t, h * 0.2, opts),
    // 7. Bloque final
    Bodies.rectangle(w * 0.55, h * 0.88, w * 0.3, t, opts)
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
    rectMode(CENTER);
    noStroke();
    fill(255, 0, 51, 120);
    rect(0, 0, wWidth, wHeight);
    stroke(255, 0, 51, 255);
    strokeWeight(3);
    noFill();
    rect(0, 0, wWidth, wHeight);
    pop();
  }
  pop();
}

function drawEscapeZone() {
  push();
  noFill();
  stroke(255, 0, 51, 220);
  strokeWeight(3);
  drawingContext.setLineDash([10, 8]);
  rect(escapeZone.x, escapeZone.y, escapeZone.w, escapeZone.h, 14);
  drawingContext.setLineDash([]);
  textAlign(CENTER, CENTER);
  textSize(16);
  fill(255, 0, 51, 240);
  noStroke();
  textFont('Montserrat');
  text("ESCAPE", escapeZone.x + escapeZone.w / 2, escapeZone.y + escapeZone.h / 2);
  pop();
}

// ==========================================
// CATHERINE (FIX 1 y 2)
// ==========================================
function spawnCatherineBlock(yPos = -50) {
  let block = Bodies.rectangle(
    width / 2 + random(-250, 250),
    yPos,
    55, 55,
    { friction: 0.6, density: 0.0008, restitution: 0.1 }
  );
  World.add(world, block);
  catherineState.towerBodies.push(block);
  return block;
}

function drawCatherineTower() {
  // Base visual
  push();
  noStroke();
  fill(255, 0, 170, 40);
  rect(0, height - 40, width, 40);
  pop();

  // Spawnear bloques
  if (millis() - catherineState.lastSpawn > catherineState.spawnInterval) {
    spawnCatherineBlock(-50);
    catherineState.lastSpawn = millis();
    catherineState.spawnInterval = max(700, catherineState.spawnInterval - 60);
  }

  // Dibujar bloques
  push();
  for (let b of catherineState.towerBodies) {
    push();
    translate(b.position.x, b.position.y);
    rotate(b.angle);
    rectMode(CENTER);
    strokeWeight(2);
    stroke("#ff00aa");
    fill("#1a0015");
    rect(0, 0, 55, 55, 4);
    stroke(255, 0, 170, 100);
    line(-27, -27, 27, 27);
    line(-27, 27, 27, -27);
    pop();
  }
  pop();

  // HUD de altura
  if (letters.length > 0) {
    let letterY = letters[0].body.position.y;
    let altura = constrain(map(height - letterY, 0, height - 100, 0, 100), 0, 100);
    document.getElementById('cath-height').textContent = `ALTURA: ${floor(altura)}%`;
  }
}

function applyCatherineLift() {
  if (letters.length === 0) return;
  let letterBody = letters[0].body;
  let blocksBelow = catherineState.towerBodies.filter(b =>
    b.position.y > letterBody.position.y &&
    Math.abs(b.position.x - letterBody.position.x) < 90
  ).length;

  if (blocksBelow > 0) {
    Body.applyForce(letterBody, letterBody.position, {
      x: 0, y: -0.003 * blocksBelow
    });
  }
}

// ==========================================
// METAPHOR
// ==========================================
function drawAnchors() {
  push();
  for (let a of anchors) {
    noStroke();
    fill(a.tensioned ? "#e6b800" : "#444");
    ellipse(a.x, a.y, 36, 36);
    if (a.tensioned) {
      noFill();
      stroke(230, 184, 0, 100);
      strokeWeight(2);
      ellipse(a.x, a.y, 60, 60);
      stroke(230, 184, 0, 180);
      strokeWeight(2);
      if (letters.length > 0) {
        let pos = letters[0].body.position;
        line(a.x, a.y, pos.x, pos.y);
      }
    }
  }
  pop();
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
    let tv = TVS[tvCurrentIndex];
    let d = dist(mouseX, mouseY, tv.x, tv.y);
    if (d < tv.r) {
      tvHitCount++;
      tvVulnerable = true;
      tvVulnerableTimer = millis();
      spawnHitEffect(tv.x, tv.y);
      showNotification(`CHANNEL ${tvHitCount}`, "Reach out to the truth");
      updateP4Hud();
      if (tvHitCount >= 5) setTimeout(() => sealLetter('T'), 600);
    } else {
      spawnMissEffect(mouseX, mouseY);
      tvJumpSpeed = max(400, tvJumpSpeed - 300);
    }
  }

  if (gameState.currentDimension === 4) {
    for (let a of anchors) {
      if (dist(mouseX, mouseY, a.x, a.y) < 30) a.tensioned = true;
    }
  }
}

function mouseReleased() {
  if (gameState.currentDimension === 0 && isCharging && letters.length > 0) {
    let chargeTime = millis() - chargeStart;
    let power = map(chargeTime, 0, 1500, 0.03, 0.18);
    power = constrain(power, 0.03, 0.18);
    let target = letters[0].body;
    let dir = Vector.sub({ x: mouseX, y: mouseY }, target.position);
    dir = Vector.normalise(dir);
    dir = Vector.mult(dir, power);
    Body.applyForce(target, target.position, dir);
    for (let i = 0; i < 10; i++) {
      particles.push({
        type: 'projectile',
        pos: { x: mouseX, y: mouseY },
        vel: { x: dir.x * 100 + random(-1, 1), y: dir.y * 100 + random(-1, 1) },
        life: 25
      });
    }
    isCharging = false;
    chargePower = 0;
  }
}

// ==========================================
// CONDICIONES DE VICTORIA
// ==========================================
function checkLetterFound() {
  if (gameState.inHub) return;
  if (gameState.currentDimension === 1) return;
  if (letters.length === 0) return;

  let l = letters[0];
  let pos = l.body.position;
  let dim = DIMENSIONS[gameState.currentDimension];
  let found = false;

  switch (dim.winCondition) {
    case "orbitMoon":
      found = dist(pos.x, pos.y, width / 2 - 240, height / 2) < 80;
      break;
    case "reachEscape":
      found = pos.x > escapeZone.x && pos.x < escapeZone.x + escapeZone.w &&
              pos.y > escapeZone.y && pos.y < escapeZone.y + escapeZone.h;
      break;
    case "stackTower":
      found = pos.y < height - 550;
      break;
    case "connectThreads":
      if (anchors.every(a => a.tensioned)) {
        found = dist(pos.x, pos.y, width / 2, height / 2) < 150;
      }
      break;
  }
  if (found) sealLetter(l.char);
}

// ==========================================
// SELLAR LETRA
// ==========================================
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
  textAlign(CENTER, CENTER);
  textFont('Montserrat');
  textSize(120);
  fill("#ffcc00");
  noStroke();
  text("A T L U S", width / 2, height / 2 - 80);

  textSize(14);
  textFont('Space Grotesk');
  fill("#888");
  const games = ["P3", "P4", "P5", "Catherine", "Metaphor"];
  for (let i = 0; i < 5; i++) {
    text(games[i], width / 2 - 260 + i * 130, height / 2 - 10);
  }
  textSize(22);
  fill("#ffffff");
  text("Five worlds. One word. Your move.", width / 2, height / 2 + 60);
  textSize(14);
  fill("#888");
  text("El mundo es una historia, y tú eres su autor.", width / 2, height / 2 + 100);
  pop();

  if (frameCount % 3 === 0) {
    particles.push({
      type: 'gold',
      pos: { x: random(width), y: height + 20 },
      vel: { x: random(-1, 1), y: random(-3, -1) },
      life: 120
    });
  }
}

// ==========================================
// AMBIENTE
// ==========================================
function drawAmbientEffects() {
  let dim = DIMENSIONS[gameState.currentDimension];

  if (gameState.currentDimension === 0) {
    let pulse = sin(frameCount * 0.03) * 8;
    push();
    noStroke();
    fill(0, 153, 255, 30);
    ellipse(width / 2 - 240, height / 2, 180 + pulse, 180 + pulse);
    fill(0, 153, 255, 60);
    ellipse(width / 2 - 240, height / 2, 150 + pulse * 0.5, 150 + pulse * 0.5);
    fill(180, 220, 255, 200);
    ellipse(width / 2 - 240, height / 2, 120, 120);
    noFill();
    stroke(dim.color);
    strokeWeight(2);
    drawingContext.setLineDash([6, 6]);
    ellipse(width / 2 - 240, height / 2, 140 + pulse, 140 + pulse);
    drawingContext.setLineDash([]);
    pop();
  }

  if (gameState.currentDimension === 1) {
    push();
    noStroke();
    fill(255, 204, 0, 15);
    rect(0, 0, width, height);
    stroke(0, 0, 0, 30);
    strokeWeight(1);
    for (let y = 0; y < height; y += 4) line(0, y, width, y);
    pop();
  }

  if (gameState.currentDimension === 2) {
    push();
    stroke(255, 255, 255, 15);
    strokeWeight(2);
    for (let i = 0; i < 8; i++) {
      let x = (frameCount * 2 + i * 200) % (width + 200) - 100;
      line(x, 0, x + 100, height);
    }
    pop();
  }

  if (gameState.currentDimension === 3) {
    push();
    noFill();
    stroke(255, 0, 170, 20);
    strokeWeight(1);
    let offset = frameCount * 0.5;
    for (let x = -100; x < width + 100; x += 80) {
      for (let y = -100; y < height + 100; y += 80) {
        push();
        translate(x + offset % 80, y + offset % 80);
        rotate(PI / 4);
        rect(0, 0, 40, 40);
        pop();
      }
    }
    pop();
  }

  if (gameState.currentDimension === 4 && frameCount % 20 === 0) {
    particles.push({
      type: 'rune',
      pos: { x: random(width), y: height + 20 },
      vel: { x: random(-0.3, 0.3), y: random(-1, -0.3) },
      life: 200,
      char: random(["✦", "◆", "✧", "◇", "✶"])
    });
  }
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
      type: 'hit',
      pos: { x, y },
      vel: { x: random(-5, 5), y: random(-5, 5) },
      life: 40
    });
  }
}

function spawnMissEffect(x, y) {
  particles.push({ type: 'miss', pos: { x, y }, life: 40 });
}

// ==========================================
// FRASES FLOTANTES
// ==========================================
function spawnFloatingPhrases() {
  floatingPhrases = [];
  let dim = DIMENSIONS[gameState.currentDimension];
  for (let i = 0; i < 3; i++) {
    floatingPhrases.push({
      text: random(dim.phrases),
      x: random(100, width - 100),
      y: random(150, height - 150),
      life: 300,
      maxLife: 300
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

// ==========================================
// CONSTRAINTS
// ==========================================
function drawConstraints() {
  if (gameState.currentDimension === 4) return;
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
}