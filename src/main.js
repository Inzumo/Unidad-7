// ==========================================
// ATLUS: Multiverse Physical System (p5.js + Matter.js)
// ==========================================

const { Engine, World, Bodies, Body, Constraint, Vector, Composite, Mouse, MouseConstraint } = Matter;

let engine, world;
let letters = [];
let constraints = [];
let currentDimension = 0;
let mouseConstraint;

// Configuración de los 5 Universos (Dimensiones)
const DIMENSIONS = [
  {
    name: "Persona 3: The Dark Hour",
    letterTarget: "A",
    color: "#0099ff",
    bg: "#050b14",
    desc: "[A] Estasis y Gravedad Cero: Haz clic para disparar impulsos cinéticos y estabilizar la letra 'A' en la Luna Llena.",
    gravity: { x: 0, y: 0 },
    stiffness: 0.01,
    friction: 0.001
  },
  {
    name: "Persona 4: The TV World",
    letterTarget: "T",
    color: "#ffcc00",
    bg: "#1a1600",
    desc: "[T] Niebla y Repulsión: El cursor despeja la niebla con una fuerza repulsiva. Empuja la 'T' para sintonizar la verdad.",
    gravity: { x: 0, y: 0.2 },
    stiffness: 0.05,
    friction: 0.05
  },
  {
    name: "Persona 5: Metaverse Rebellion",
    letterTarget: "L",
    color: "#ff0033",
    bg: "#120003",
    desc: "[L] Resortes y Tensión: Estira y suelta la letra 'L' como una resortera elástica para generar oscilación.",
    gravity: { x: 0, y: 0.8 },
    stiffness: 0.15,
    friction: 0.01
  },
  {
    name: "Catherine: Tower of Babel",
    letterTarget: "U",
    color: "#ff00aa",
    bg: "#14000b",
    desc: "[U] Bloques y Vértigo: Colisiones rígidas con alto peso. Apila y mantén en equilibrio la letra 'U' sobre la base.",
    gravity: { x: 0, y: 1.5 },
    stiffness: 0.8,
    friction: 0.4
  },
  {
    name: "Metaphor: Archetype Threads",
    letterTarget: "S",
    color: "#e6b800",
    bg: "#0d0c03",
    desc: "[S] Red de Hilos y Suspensión: Tensión elástica múltiple. Ajusta la red de hilos místico-dorados en baja gravedad.",
    gravity: { x: 0, y: -0.1 },
    stiffness: 0.03,
    friction: 0.02
  }
];

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvas-holder");

  // Crear motor físico de Matter.js
  engine = Engine.create();
  world = engine.world;

  // Mouse Constraint para arrastrar cuerpos
  let canvasMouse = Mouse.create(canvas.elt);
  canvasMouse.pixelRatio = pixelDensity();
  mouseConstraint = MouseConstraint.create(engine, {
    mouse: canvasMouse,
    constraint: {
      stiffness: 0.2,
      render: { visible: false }
    }
  });
  World.add(world, mouseConstraint);

  // Crear los límites de la pantalla (Límites)
  createBoundaries();

  // Crear las 5 letras de A - T - L - U - S
  createLetters();

  // Escuchadores de botones de interfaz
  setupUI();

  // Inicializar la primera dimensión
  applyDimension(0);
}

function draw() {
  background(DIMENSIONS[currentDimension].bg);

  // Actualizar motor físico
  Engine.update(engine);

  // Efectos visuales específicos de la dimensión activa
  drawDimensionEffects();

  // Renderizar restricciones (Hilos / Resortes)
  drawConstraints();

  // Renderizar cada letra de ATLUS
  for (let l of letters) {
    l.display();
  }

  // Interacción específica según dimensión
  handleInteractiveForces();
}

// -----------------------------------------------------------------
// CREACIÓN DE ELEMENTOS FÍSICOS
// -----------------------------------------------------------------

function createBoundaries() {
  let thickness = 100;
  let options = { isStatic: true, friction: 0.5 };

  World.add(world, [
    Bodies.rectangle(width / 2, height + thickness / 2, width * 2, thickness, options), // Suelo
    Bodies.rectangle(-thickness / 2, height / 2, thickness, height * 2, options),        // Izquierda
    Bodies.rectangle(width + thickness / 2, height / 2, thickness, height * 2, options), // Derecha
    Bodies.rectangle(width / 2, -thickness / 2, width * 2, thickness, options)         // Techo
  ]);
}

function createLetters() {
  const chars = ["A", "T", "L", "U", "S"];
  const startX = width / 2 - 240;
  const spacing = 120;

  for (let i = 0; i < chars.length; i++) {
    let x = startX + i * spacing;
    let y = height / 2;

    // Cuerpo rectangular como caja de colisión para la letra
    let body = Bodies.rectangle(x, y, 70, 90, {
      restitution: 0.6,
      friction: 0.05,
      density: 0.002
    });

    letters.push(new LetterBody(body, chars[i], i));
    World.add(world, body);
  }
}

// Clase para envolver el cuerpo rígido y dibujar la letra
class LetterBody {
  constructor(body, char, index) {
    this.body = body;
    this.char = char;
    this.index = index;
  }

  display() {
    let pos = this.body.position;
    let angle = this.body.angle;

    push();
    translate(pos.x, pos.y);
    rotate(angle);

    // Resaltar la letra del universo activo
    let isTarget = (this.index === currentDimension);
    
    rectMode(CENTER);
    strokeWeight(isTarget ? 4 : 2);
    stroke(isTarget ? "#ffffff" : DIMENSIONS[currentDimension].color);
    fill(isTarget ? DIMENSIONS[currentDimension].color : "#111116");
    rect(0, 0, 70, 90, 8);

    // Glifo Tipográfico
    textAlign(CENTER, CENTER);
    textSize(52);
    textFont('Montserrat');
    fill(isTarget ? "#ffffff" : DIMENSIONS[currentDimension].color);
    noStroke();
    text(this.char, 0, -2);
    pop();
  }
}

// -----------------------------------------------------------------
// LÓGICA DE CAMBIO DE DIMENSIONES Y LEYES FÍSICAS
// -----------------------------------------------------------------

function applyDimension(index) {
  currentDimension = index;
  let dim = DIMENSIONS[index];

  // 1. Cambiar Gravedad Global
  world.gravity.x = dim.gravity.x;
  world.gravity.y = dim.gravity.y;

  // 2. Limpiar restricciones anteriores
  for (let c of constraints) {
    World.remove(world, c);
  }
  constraints = [];

  // 3. Crear restricciones/resortes según la dimensión
  if (index === 2) { 
    // Persona 5: Resortera en la letra 'L' (índice 2)
    let target = letters[2].body;
    let spring = Constraint.create({
      pointA: { x: target.position.x, y: target.position.y - 100 },
      bodyB: target,
      stiffness: dim.stiffness,
      damping: 0.05
    });
    constraints.push(spring);
    World.add(world, spring);
  } else if (index === 4) { 
    // Metaphor: Red de hilos dorados conectando todas las letras
    for (let i = 0; i < letters.length - 1; i++) {
      let thread = Constraint.create({
        bodyA: letters[i].body,
        bodyB: letters[i + 1].body,
        stiffness: dim.stiffness,
        damping: 0.02
      });
      constraints.push(thread);
      World.add(world, thread);
    }
  }

  // Actualizar Texto de la Interfaz
  document.getElementById("goal-title").innerText = dim.name;
  document.getElementById("goal-title").style.color = dim.color;
  document.getElementById("goal-panel").style.borderLeftColor = dim.color;
  document.getElementById("goal-desc").innerText = dim.desc;
}

// -----------------------------------------------------------------
// FUERZAS INTERACTIVAS Y EFECTOS
// -----------------------------------------------------------------

function handleInteractiveForces() {
  // Universo P4: Campo de Repulsión al mover el mouse cerca
  if (currentDimension === 1) {
    let mouseVec = { x: mouseX, y: mouseY };
    for (let l of letters) {
      let d = dist(mouseX, mouseY, l.body.position.x, l.body.position.y);
      if (d < 150) {
        let force = Vector.sub(l.body.position, mouseVec);
        force = Vector.normalise(force);
        force = Vector.mult(force, 0.005);
        Body.applyForce(l.body, l.body.position, force);
      }
    }
  }
}

function mousePressed() {
  // Universo P3: Disparo de Impulso Cinético con el Evoker
  if (currentDimension === 0) {
    let targetLetter = letters[0].body; // Letra 'A'
    let mouseVec = { x: mouseX, y: mouseY };
    let force = Vector.sub(targetLetter.position, mouseVec);
    force = Vector.normalise(force);
    force = Vector.mult(force, 0.08);
    Body.applyForce(targetLetter, targetLetter.position, force);
  }
}

function drawDimensionEffects() {
  push();
  // P3: Dibujar objetivo de la Luna Llena
  if (currentDimension === 0) {
    noFill();
    stroke("#0099ff");
    strokeWeight(2);
    drawingContext.setLineDash([6, 6]);
    ellipse(width / 2 - 240, height / 2, 140, 140);
  }

  // P4: Campo de Visión / Luz de las Gafas
  if (currentDimension === 1) {
    noStroke();
    fill(255, 204, 0, 30);
    ellipse(mouseX, mouseY, 300, 300);
  }
  pop();
}

function drawConstraints() {
  push();
  stroke(DIMENSIONS[currentDimension].color);
  strokeWeight(2);
  for (let c of constraints) {
    let posA = c.pointA;
    let posB = c.bodyB ? c.bodyB.position : c.pointB;

    if (c.bodyA) posA = c.bodyA.position;

    line(posA.x, posA.y, posB.x, posB.y);
  }
  pop();
}

// -----------------------------------------------------------------
// EVENTOS Y NAVEGACIÓN DE LA UI
// -----------------------------------------------------------------

function setupUI() {
  const buttons = document.querySelectorAll(".dim-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      buttons.forEach(b => b.classList.remove("active"));
      
      let targetBtn = e.target.closest(".dim-btn");
      targetBtn.classList.add("active");

      let dimIndex = parseInt(targetBtn.getAttribute("data-dim"));
      applyDimension(dimIndex);
    });
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}