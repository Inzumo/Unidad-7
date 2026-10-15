// ==========================================
// ATLUS: Multiverse Physical System
// ==========================================

import { createLabPanel } from './labPanel.js';

const { Engine, World, Bodies, Body, Constraint, Vector, Composite, Mouse, MouseConstraint } = Matter;

let engine, world;
let letters = [];
let constraints = [];
let particles = [];
let floatingPhrases = [];
let mouseConstraint;

// ==========================================
// ESTADO GLOBAL
// ==========================================
const gameState = {
  currentDimension: 0,
  foundLetters: JSON.parse(localStorage.getItem('atlus_found') || '{"A":false,"T":false,"L":false,"U":false,"S":false}'),
  inHub: false,
  transitionTimer: 0,
  transitionColor: [0, 0, 0]
};

// ==========================================
// CONFIGURACIÓN DE LOS 5 MUNDOS
// ==========================================
const DIMENSIONS = [
  {
    name: "Persona 3: The Dark Hour",
    letterTarget: "A",
    color: "#0099ff",
    accent: "#00ffcc",
    bg: "#050b14",
    desc: "Estasis y gravedad cero. Dispara impulsos con el cursor para colocar la 'A' dentro de la órbita de la Luna Llena.",
    gravity: { x: 0, y: 0 },
    friction: 0.001,
    phrases: ["Memento Mori", "The Dark Hour", "Are you afraid of death?", "The clock is ticking", "Death is not the end"],
    cursor: "crosshair",
    winCondition: "orbitMoon"
  },
  {
    name: "Persona 4: The TV World",
    letterTarget: "T",
    color: "#ffcc00",
    accent: "#ff8800",
    bg: "#1a1600",
    desc: "Niebla y repulsión. Mueve el cursor para despejar la niebla y revelar la 'T' oculta.",
    gravity: { x: 0, y: 0.2 },
    friction: 0.05,
    phrases: ["Reach out to the truth", "I am thou", "Thou art I", "Can you see through the fog?", "The truth is out there"],
    cursor: "cell",
    winCondition: "revealFog"
  },
  {
    name: "Persona 5: Metaverse Rebellion",
    letterTarget: "L",
    color: "#ff0033",
    accent: "#ffffff",
    bg: "#120003",
    desc: "Resortes y tensión. Arrastra la 'L' y suéltala para traerla al centro del Metaverso.",
    gravity: { x: 0, y: 0.8 },
    friction: 0.01,
    phrases: ["You'll never see it coming", "Take your heart", "Wake up, get up, get out there", "Are you free?", "Steal back your future"],
    cursor: "pointer",
    winCondition: "bringToCenter"
  },
  {
    name: "Catherine: Tower of Babel",
    letterTarget: "U",
    color: "#ff00aa",
    accent: "#ffffff",
    bg: "#14000b",
    desc: "Bloques y vértigo. La 'U' está enterrada bajo bloques. Apila y despeja para liberarla.",
    gravity: { x: 0, y: 1.5 },
    friction: 0.4,
    phrases: ["It's a nightmare", "Don't look down", "Love is over", "What do you desire?", "Will you climb?"],
    cursor: "move",
    winCondition: "freeU"
  },
  {
    name: "Metaphor: Archetype Threads",
    letterTarget: "S",
    color: "#e6b800",
    accent: "#ffdd44",
    bg: "#0d0c03",
    desc: "Red de hilos y suspensión. Conecta los hilos dorados para bajar la 'S' al centro.",
    gravity: { x: 0, y: -0.1 },
    friction: 0.02,
    phrases: ["The world is a story", "Fantasy lives on", "You are its author", "Who are you?", "What story will you write?"],
    cursor: "text",
    winCondition: "connectThreads"
  }
];

// ==========================================
// SETUP
// ==========================================
function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvas-holder");

  engine = Engine.create();
  world = engine.world;

  let canvasMouse = Mouse.create(canvas.elt);
  canvasMouse.pixelRatio = pixelDensity();
  mouseConstraint = MouseConstraint.create(engine, {
    mouse: canvasMouse,
    constraint: { stiffness: 0.2, render: { visible: false } }
  });
  World.add(world, mouseConstraint);

  createBoundaries();
  setupUI();
  updateWorldSignature();
  updateWordBar();

  if (Object.values(gameState.foundLetters).every(v => v)) {
    goToHub();
  } else {
    applyDimension(gameState.currentDimension);
    createLetters();
  }
}

// ==========================================
// DRAW
// ==========================================
function draw() {
  const dim = DIMENSIONS[gameState.currentDimension];
  background(gameState.inHub ? "#0a0a12" : dim.bg);

  if (gameState.inHub) {
    drawHub();
    return;
  }

  Engine.update(engine);

  drawAmbientEffects();
  drawFloatingPhrases();
  drawConstraints();
  drawParticles();

  for (let l of letters) l.display();

  handleInteractiveForces();
  checkLetterFound();
  drawTransition();
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
// CREAR LETRAS (solo la del mundo activo, si no se ha encontrado)
// ==========================================
function createLetters() {
  letters = [];
  const chars = ["A", "T", "L", "U", "S"];
  const activeChar = chars[gameState.currentDimension];

  if (gameState.foundLetters[activeChar]) return;

  let x = width / 2;
  let y = height / 2;

  // Posiciones iniciales distintas por mundo
  if (gameState.currentDimension === 0) { x = width / 2 + 300; y = height / 2; }
  if (gameState.currentDimension === 1) { x = width / 2; y = height / 2; } // oculta bajo niebla
  if (gameState.currentDimension === 2) { x = width - 200; y = 200; }
  if (gameState.currentDimension === 3) { x = width / 2; y = height - 150; }
  if (gameState.currentDimension === 4) { x = width / 2; y = 150; }

  let body = Bodies.rectangle(x, y, 70, 90, {
    restitution: 0.6,
    friction: 0.05,
    density: 0.002
  });

  letters.push(new LetterBody(body, activeChar, gameState.currentDimension));
  World.add(world, body);

  // Resorte para P5
  if (gameState.currentDimension === 2) {
    let spring = Constraint.create({
      pointA: { x: width - 200, y: 100 },
      bodyB: body,
      stiffness: 0.02,
      damping: 0.05
    });
    constraints.push(spring);
    World.add(world, spring);
  }

  // Hilos para Metaphor
  if (gameState.currentDimension === 4) {
    let anchor = Constraint.create({
      pointA: { x: width / 2, y: 100 },
      bodyB: body,
      stiffness: 0.03,
      damping: 0.02
    });
    constraints.push(anchor);
    World.add(world, anchor);
  }

  // Bloques para Catherine
  if (gameState.currentDimension === 3) {
    for (let i = 0; i < 4; i++) {
      let block = Bodies.rectangle(
        width / 2 - 100 + i * 70,
        height - 400,
        60, 60,
        { friction: 0.4, density: 0.005, restitution: 0.1 }
      );
      World.add(world, block);
      particles.push({ body: block, type: 'block' });
    }
  }
}

// ==========================================
// CLASE LETTER
// ==========================================
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

    // P4: ocultar la letra bajo la niebla
    if (this.index === 1) {
      let d = dist(mouseX, mouseY, pos.x, pos.y);
      if (d > 80) return; // invisible lejos del cursor
    }

    push();
    translate(pos.x, pos.y);
    rotate(angle);

    rectMode(CENTER);
    strokeWeight(4);
    stroke(dim.color);
    fill("#111116");
    rect(0, 0, 70, 90, 8);

    textAlign(CENTER, CENTER);
    textSize(52);
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
  gameState.currentDimension = index;
  let dim = DIMENSIONS[index];

  world.gravity.x = dim.gravity.x;
  world.gravity.y = dim.gravity.y;

  for (let c of constraints) World.remove(world, c);
  constraints = [];
  particles = particles.filter(p => p.type !== 'block');

  // Limpiar letras y rehacer
  for (let l of letters) World.remove(world, l.body);
  letters = [];

  if (!gameState.foundLetters[dim.letterTarget]) {
    createLetters();
  }

  document.getElementById("goal-title").innerText = dim.name;
  document.getElementById("goal-title").style.color = dim.color;
  document.getElementById("goal-panel").style.borderLeftColor = dim.color;
  document.getElementById("goal-desc").innerText = dim.desc;

  document.body.className = "cursor-" + ["p3","p4","p5","catherine","metaphor"][index];

  updateWorldSignature();

  // Frases flotantes temáticas
  spawnFloatingPhrases();
}

// ==========================================
// FUERZAS INTERACTIVAS
// ==========================================
function handleInteractiveForces() {
  // P4: repulsión al mover el mouse
  if (gameState.currentDimension === 1) {
    for (let l of letters) {
      let d = dist(mouseX, mouseY, l.body.position.x, l.body.position.y);
      if (d < 150) {
        let force = Vector.sub(l.body.position, { x: mouseX, y: mouseY });
        force = Vector.normalise(force);
        force = Vector.mult(force, 0.005);
        Body.applyForce(l.body, l.body.position, force);
      }
    }
  }
}

function mousePressed() {
  if (gameState.inHub) return;

  // P3: proyectil hacia la letra
  if (gameState.currentDimension === 0 && letters.length > 0) {
    let target = letters[0].body;
    let force = Vector.sub(target.position, { x: mouseX, y: mouseY });
    force = Vector.normalise(force);
    force = Vector.mult(force, 0.08);
    Body.applyForce(target, target.position, force);

    // Partícula del proyectil
    particles.push({
      type: 'projectile',
      pos: { x: mouseX, y: mouseY },
      life: 30
    });
  }
}

// ==========================================
// CONDICIONES DE VICTORIA
// ==========================================
function checkLetterFound() {
  if (letters.length === 0 || gameState.inHub) return;

  let l = letters[0];
  let pos = l.body.position;
  let dim = DIMENSIONS[gameState.currentDimension];
  let found = false;

  switch (dim.winCondition) {
    case "orbitMoon": {
      let moonX = width / 2 - 240;
      let moonY = height / 2;
      found = dist(pos.x, pos.y, moonX, moonY) < 80;
      break;
    }
    case "revealFog": {
      found = dist(mouseX, mouseY, pos.x, pos.y) < 60;
      break;
    }
    case "bringToCenter": {
      found = dist(pos.x, pos.y, width / 2, height / 2) < 100;
      break;
    }
    case "freeU": {
      // La 'U' está libre si está en la parte baja y no hay bloques cerca
      let bloquesCerca = particles.filter(p =>
        p.type === 'block' && dist(p.body.position.x, p.body.position.y, pos.x, pos.y) < 80
      ).length;
      found = pos.y > height - 250 && bloquesCerca === 0;
      break;
    }
    case "connectThreads": {
      found = dist(pos.x, pos.y, width / 2, height / 2) < 120;
      break;
    }
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

  showNotification(`LETRA "${char}" RECUPERADA`);
  updateWordBar();

  // Efecto: partículas doradas
  for (let i = 0; i < 40; i++) {
    particles.push({
      type: 'gold',
      pos: { x: letters[0].body.position.x, y: letters[0].body.position.y },
      vel: { x: random(-6, 6), y: random(-6, 6) },
      life: 60
    });
  }

  World.remove(world, letters[0].body);
  letters = [];

  if (Object.values(gameState.foundLetters).every(v => v)) {
    setTimeout(goToHub, 1500);
  } else {
    setTimeout(() => {
      let next = Object.values(gameState.foundLetters).findIndex(v => !v);
      if (next >= 0) applyDimension(next);
    }, 1500);
  }
}

// ==========================================
// HUB FINAL
// ==========================================
function goToHub() {
  gameState.inHub = true;
  letters = [];
  constraints = [];
  World.clear(world, false);
  createBoundaries();

  document.getElementById("goal-title").innerText = "A T L U S";
  document.getElementById("goal-title").style.color = "#ffcc00";
  document.getElementById("goal-panel").style.borderLeftColor = "#ffcc00";
  document.getElementById("goal-desc").innerText = "Cinco mundos. Una palabra. Tu turno.";
  document.getElementById("world-signature").innerHTML = "";
  document.body.className = "";
}

function drawHub() {
  push();
  textAlign(CENTER, CENTER);
  textFont('Montserrat');
  textSize(140);
  fill("#ffcc00");
  noStroke();
  text("ATLUS", width / 2, height / 2 - 40);

  textSize(20);
  textFont('Space Grotesk');
  fill("#ffffff");
  text("Five worlds. One word. Your move.", width / 2, height / 2 + 60);

  textSize(14);
  fill("#888");
  text("El mundo es una historia, y tú eres su autor.", width / 2, height / 2 + 100);
  pop();

  // Partículas doradas
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
// EFECTOS AMBIENTALES
// ==========================================
function drawAmbientEffects() {
  let dim = DIMENSIONS[gameState.currentDimension];

  // P3: Luna llena pulsante
  if (gameState.currentDimension === 0) {
    let pulse = sin(frameCount * 0.03) * 8;
    push();
    noFill();
    stroke(dim.color);
    strokeWeight(2);
    drawingContext.setLineDash([6, 6]);
    ellipse(width / 2 - 240, height / 2, 140 + pulse, 140 + pulse);
    drawingContext.setLineDash([]);
    // Halo
    for (let i = 0; i < 3; i++) {
      stroke(0, 153, 255, 30 - i * 10);
      strokeWeight(2);
      ellipse(width / 2 - 240, height / 2, 160 + i * 20, 160 + i * 20);
    }
    pop();
  }

  // P4: niebla amarilla
  if (gameState.currentDimension === 1) {
    push();
    noStroke();
    fill(255, 204, 0, 20);
    rect(0, 0, width, height);
    // Scanlines
    stroke(0, 0, 0, 40);
    strokeWeight(1);
    for (let y = 0; y < height; y += 4) {
      line(0, y, width, y);
    }
    pop();
  }

  // P5: líneas cinéticas
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

  // Catherine: rombos rosa
  if (gameState.currentDimension === 3) {
    push();
    noFill();
    stroke(255, 0, 170, 15);
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

  // Metaphor: runas doradas
  if (gameState.currentDimension === 4) {
    if (frameCount % 20 === 0) {
      particles.push({
        type: 'rune',
        pos: { x: random(width), y: height + 20 },
        vel: { x: random(-0.3, 0.3), y: random(-1, -0.3) },
        life: 200,
        char: random(["✦", "◆", "✧", "◇", "✶"])
      });
    }
  }
}

// ==========================================
// DIBUJAR PARTÍCULAS
// ==========================================
function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];

    if (p.type === 'projectile') {
      push();
      fill(0, 153, 255);
      noStroke();
      ellipse(p.pos.x, p.pos.y, 12, 12);
      pop();
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'gold') {
      push();
      fill(255, 204, 0, p.life);
      noStroke();
      ellipse(p.pos.x, p.pos.y, 6, 6);
      pop();
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      p.vel.y += 0.1;
      p.life -= 2;
      if (p.life <= 0) particles.splice(i, 1);
    } else if (p.type === 'rune') {
      push();
      textAlign(CENTER, CENTER);
      textSize(20);
      fill(230, 184, 0, p.life);
      noStroke();
      text(p.char, p.pos.x, p.pos.y);
      pop();
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
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
      // Reemplazar por otra frase
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
// TRANSICIÓN
// ==========================================
function drawTransition() {
  if (gameState.transitionTimer > 0) {
    push();
    noStroke();
    fill(0, 0, 0, map(gameState.transitionTimer, 0, 60, 0, 255));
    rect(0, 0, width, height);
    pop();
    gameState.transitionTimer--;
  }
}

// ==========================================
// UI
// ==========================================
function setupUI() {
  const buttons = document.querySelectorAll(".dim-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (gameState.inHub) return;
      buttons.forEach(b => b.classList.remove("active"));
      let targetBtn = e.target.closest(".dim-btn");
      targetBtn.classList.add("active");
      let dimIndex = parseInt(targetBtn.getAttribute("data-dim"));
      gameState.transitionTimer = 30;
      setTimeout(() => applyDimension(dimIndex), 400);
    });
  });
}

function updateWordBar() {
  document.querySelectorAll('.word-slot').forEach(slot => {
    const letter = slot.dataset.letter;
    if (gameState.foundLetters[letter]) {
      slot.textContent = letter;
      slot.classList.add('found');
    }
  });
}

function showNotification(text) {
  let n = document.getElementById('notification');
  n.textContent = text;
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 1800);
}

function updateWorldSignature() {
  const sigs = [
    // P3: reloj
    `<svg viewBox="0 0 24 24" fill="none" stroke="#0099ff" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    // P4: TV
    `<svg viewBox="0 0 24 24" fill="none" stroke="#ffcc00" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>`,
    // P5: máscara
    `<svg viewBox="0 0 24 24" fill="none" stroke="#ff0033" stroke-width="2"><path d="M12 2C6 2 2 6 2 12s4 10 10 10 10-4 10-10S18 2 12 2z"/><circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/></svg>`,
    // Catherine: copa
    `<svg viewBox="0 0 24 24" fill="none" stroke="#ff00aa" stroke-width="2"><path d="M8 2h8l-1 7a4 4 0 01-6 0L8 2z"/><path d="M12 13v7"/><path d="M8 22h8"/></svg>`,
    // Metaphor: pluma
    `<svg viewBox="0 0 24 24" fill="none" stroke="#e6b800" stroke-width="2"><path d="M20 4c-4 0-8 4-8 8l-4 4-4 4 4-4 4-4c4 0 8-4 8-8z"/></svg>`
  ];
  document.getElementById('world-signature').innerHTML = sigs[gameState.currentDimension] || "";
}

// ==========================================
// RESIZE
// ==========================================
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}