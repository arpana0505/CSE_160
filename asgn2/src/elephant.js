// elephant.js — CSE 160 Assignment 2: 3D Elephant
// All drawing in renderScene(), tick() animates, full joint hierarchy

'use strict';

// ── Shaders ──────────────────────────────────────────────────────────────────
const VSHADER = `
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotation;
  uniform mat4 u_ProjectionMatrix;
  uniform mat4 u_ViewMatrix;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotation * u_ModelMatrix * a_Position;
  }
`;
const FSHADER = `
  precision mediump float;
  uniform vec4 u_Color;
  void main() {
    gl_FragColor = u_Color;
  }
`;

// ── GL globals ────────────────────────────────────────────────────────────────
let gl, canvas;
let u_ModelMatrix, u_GlobalRotation, u_Color, u_ProjectionMatrix, u_ViewMatrix;
let a_Position;
let cubeBuffer, cylinderBuffer, cylinderVertCount;

// ── Animation / UI state ──────────────────────────────────────────────────────
let g_globalRotX = 0, g_globalRotY = 20;
let g_animOn = false;
let g_pokeOn = false;
let g_time = 0;
let g_lastTime = 0;
let g_fps = 0, g_frameCount = 0, g_fpsTimer = 0;

// Slider-controlled joint angles
let g_trunkBase  = 0;   // trunk base (1st joint)
let g_trunkMid   = 0;   // trunk mid  (2nd joint)
let g_trunkTip   = 0;   // trunk tip  (3rd joint) — 3-level chain
let g_earLeft    = 0;
let g_earRight   = 0;
let g_tailBase   = 0;
let g_tailTip    = 0;

// Per-leg 3-level joint angles [upper, lower, foot]
let g_legAngles = [
  [0, 0, 0],  // front-left
  [0, 0, 0],  // front-right
  [0, 0, 0],  // back-left
  [0, 0, 0],  // back-right
];

// Mouse rotation
let g_mouseDown = false;
let g_lastMX = 0, g_lastMY = 0;

// Poke animation
let g_pokeT = 0;

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  canvas = document.getElementById('webgl');
  gl = canvas.getContext('webgl');
  if (!gl) { console.error('No WebGL'); return; }

  gl.enable(gl.DEPTH_TEST);

  // Compile shaders
  if (!initShaders(gl, VSHADER, FSHADER)) { console.error('Shader init failed'); return; }

  u_ModelMatrix    = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_GlobalRotation = gl.getUniformLocation(gl.program, 'u_GlobalRotation');
  u_Color          = gl.getUniformLocation(gl.program, 'u_Color');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  u_ViewMatrix       = gl.getUniformLocation(gl.program, 'u_ViewMatrix');

  // Orthographic projection scaled to fit elephant
  const proj = new Matrix4();
  proj.setOrtho(-1.8, 1.8, -1.5, 1.5, 0.1, 100);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, proj.elements);

  // Camera looking at origin from Z=3
  const view = new Matrix4();
  view.setLookAt(0, 0, 3,  0, 0, 0,  0, 1, 0);
  gl.uniformMatrix4fv(u_ViewMatrix, false, view.elements);
  a_Position       = gl.getAttribLocation(gl.program, 'a_Position');

  initBuffers();
  setupMouse();

  gl.clearColor(0.13, 0.13, 0.18, 1.0);

  renderScene();
  tick(0);
}

// ── Buffer init ───────────────────────────────────────────────────────────────
function initBuffers() {
  // Cube: 6 faces × 2 triangles × 3 verts, unit cube centered at origin
  const cv = [
    // front
    -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5,
    -0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // back
     0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,
     0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5,
    // left
    -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5,-0.5,-0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5,
    // right
     0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5,
     0.5,-0.5, 0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5,
    // top
    -0.5, 0.5, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5,-0.5,
    -0.5, 0.5, 0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5,
    // bottom
    -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5,
    -0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5,
  ];
  cubeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cv), gl.STATIC_DRAW);

  // Cylinder (non-cube primitive): used for legs and trunk segments
  const SEGS = 16;
  const cyVerts = [];
  for (let i = 0; i < SEGS; i++) {
    const a0 = (i / SEGS) * Math.PI * 2;
    const a1 = ((i + 1) / SEGS) * Math.PI * 2;
    const x0 = Math.cos(a0) * 0.5, z0 = Math.sin(a0) * 0.5;
    const x1 = Math.cos(a1) * 0.5, z1 = Math.sin(a1) * 0.5;
    // side quad
    cyVerts.push(x0,-0.5,z0, x1,-0.5,z1, x1, 0.5,z1);
    cyVerts.push(x0,-0.5,z0, x1, 0.5,z1, x0, 0.5,z0);
    // top cap
    cyVerts.push(0, 0.5,0, x0, 0.5,z0, x1, 0.5,z1);
    // bottom cap
    cyVerts.push(0,-0.5,0, x1,-0.5,z1, x0,-0.5,z0);
  }
  cylinderVertCount = cyVerts.length / 3;
  cylinderBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cylinderBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cyVerts), gl.STATIC_DRAW);
}

// ── Draw primitives ───────────────────────────────────────────────────────────
function drawCube(M, color) {
  gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
  gl.uniform4f(u_Color, color[0], color[1], color[2], color[3]);
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

function drawCylinder(M, color) {
  gl.uniformMatrix4fv(u_ModelMatrix, false, M.elements);
  gl.uniform4f(u_Color, color[0], color[1], color[2], color[3]);
  gl.bindBuffer(gl.ARRAY_BUFFER, cylinderBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(gl.TRIANGLES, 0, cylinderVertCount);
}

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  body:  [0.47, 0.47, 0.52, 1],
  dark:  [0.35, 0.35, 0.40, 1],
  light: [0.62, 0.62, 0.67, 1],
  tusk:  [0.95, 0.92, 0.82, 1],
  eye:   [0.10, 0.10, 0.10, 1],
  toe:   [0.28, 0.28, 0.32, 1],
  pink:  [0.85, 0.60, 0.60, 1],
};

// ── Render ────────────────────────────────────────────────────────────────────
function renderScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Global rotation matrix (uniform passed to vertex shader)
  const GR = new Matrix4();
  GR.setRotate(g_globalRotX, 1, 0, 0);
  GR.rotate(g_globalRotY, 0, 1, 0);
  gl.uniformMatrix4fv(u_GlobalRotation, false, GR.elements);

  drawElephant();
}

function drawElephant() {
  // Poke animation overrides
  let pokeBodyY = 0, pokeTrunk = 0, pokeEar = 0;
  if (g_pokeOn) {
    const pt = Math.min(g_pokeT, 1.0);
    pokeBodyY   = Math.sin(pt * Math.PI * 3) * 0.08;
    pokeTrunk   = Math.sin(pt * Math.PI * 2) * 60;
    pokeEar     = Math.sin(pt * Math.PI * 4) * 30;
  }

  // Animation angles
  let trunkBase = g_trunkBase, trunkMid = g_trunkMid, trunkTip = g_trunkTip;
  let earL = g_earLeft, earR = g_earRight;
  let tailBase = g_tailBase, tailTip = g_tailTip;
  let legA = g_legAngles.map(a => [...a]);

  if (g_animOn) {
    const t = g_time;
    trunkBase = 20 * Math.sin(t * 1.2);
    trunkMid  = 15 * Math.sin(t * 1.5 + 0.5);
    trunkTip  = 10 * Math.sin(t * 2.0 + 1.0);
    earL      = 15 * Math.sin(t * 1.8);
    earR      = -15 * Math.sin(t * 1.8);
    tailBase  = 20 * Math.sin(t * 2.2);
    tailTip   = 15 * Math.sin(t * 2.8);

    // Walking gait: legs in pairs
    const walk = 25;
    legA[0] = [ walk * Math.sin(t * 2),       walk * 0.5 * Math.sin(t * 2 + 0.8),  8 * Math.sin(t * 2 + 1.2)];
    legA[1] = [-walk * Math.sin(t * 2),       -walk * 0.5 * Math.sin(t * 2 + 0.8), -8 * Math.sin(t * 2 + 1.2)];
    legA[2] = [-walk * Math.sin(t * 2),       -walk * 0.5 * Math.sin(t * 2 + 0.8), -8 * Math.sin(t * 2 + 1.2)];
    legA[3] = [ walk * Math.sin(t * 2),        walk * 0.5 * Math.sin(t * 2 + 0.8),  8 * Math.sin(t * 2 + 1.2)];
  }

  if (g_pokeOn) {
    trunkBase += pokeTrunk;
    trunkMid  += pokeTrunk * 0.5;
    earL      += pokeEar;
    earR      -= pokeEar;
  }

  // ── BODY (root) ──
  const bodyM = new Matrix4();
  bodyM.setTranslate(0, pokeBodyY, 0);
  bodyM.scale(0.9, 0.6, 1.4);
  drawCube(bodyM, C.body);

  // ── HEAD ──
  const headBase = new Matrix4();
  headBase.setTranslate(0, 0.18, 0.85);

  const headM = new Matrix4(headBase);
  headM.scale(0.65, 0.58, 0.55);
  drawCube(headM, C.body);

  // ── TUSKS (cylinders, non-cube primitive) ──
  [[-0.16, 1], [0.16, -1]].forEach(([x, side]) => {
    const tM = new Matrix4(headBase);
    tM.translate(x, -0.18, 0.3);
    tM.rotate(side * 8, 0, 1, 0);
    tM.rotate(-20, 1, 0, 0);
    tM.scale(0.04, 0.04, 0.28);
    drawCylinder(tM, C.tusk);
  });

  // ── EYES ──
  [[-0.18, 1], [0.18, -1]].forEach(([x]) => {
    const eM = new Matrix4(headBase);
    eM.translate(x, 0.08, 0.26);
    eM.scale(0.08, 0.08, 0.06);
    drawCube(eM, C.eye);
  });

  // ── EARS (joint 1) ──
  // Left ear: pivot at its inner edge
  const earLPivot = new Matrix4(headBase);
  earLPivot.translate(-0.325, 0, 0);
  earLPivot.rotate(earL, 0, 0, 1);

  const earLM = new Matrix4(earLPivot);
  earLM.translate(-0.2, 0, 0);
  earLM.scale(0.35, 0.45, 0.06);
  drawCube(earLM, C.light);

  const earRPivot = new Matrix4(headBase);
  earRPivot.translate(0.325, 0, 0);
  earRPivot.rotate(earR, 0, 0, 1);

  const earRM = new Matrix4(earRPivot);
  earRM.translate(0.2, 0, 0);
  earRM.scale(0.35, 0.45, 0.06);
  drawCube(earRM, C.light);

  // ── TRUNK — 3-level chain ──
  // Level 1: trunk base attaches to head, rotates at head connection
  const trunkPivot1 = new Matrix4(headBase);
  trunkPivot1.translate(0, -0.24, 0.25);
  trunkPivot1.rotate(trunkBase, 1, 0, 0);

  const trunk1M = new Matrix4(trunkPivot1);
  trunk1M.translate(0, -0.15, 0);
  trunk1M.scale(0.16, 0.30, 0.16);
  drawCylinder(trunk1M, C.body);

  // Level 2: mid trunk
  const trunkPivot2 = new Matrix4(trunkPivot1);
  trunkPivot2.translate(0, -0.30, 0);
  trunkPivot2.rotate(trunkMid, 1, 0, 0);

  const trunk2M = new Matrix4(trunkPivot2);
  trunk2M.translate(0, -0.13, 0);
  trunk2M.scale(0.13, 0.26, 0.13);
  drawCylinder(trunk2M, C.body);

  // Level 3: trunk tip
  const trunkPivot3 = new Matrix4(trunkPivot2);
  trunkPivot3.translate(0, -0.26, 0);
  trunkPivot3.rotate(trunkTip, 1, 0, 0);

  const trunk3M = new Matrix4(trunkPivot3);
  trunk3M.translate(0, -0.10, 0);
  trunk3M.scale(0.10, 0.20, 0.10);
  drawCylinder(trunk3M, C.dark);

  // Pink tip
  const tipM = new Matrix4(trunkPivot3);
  tipM.translate(0, -0.22, 0);
  tipM.scale(0.09, 0.06, 0.09);
  drawCylinder(tipM, C.pink);

  // ── TAIL — 2-level chain ──
  const tailPivot1 = new Matrix4();
  tailPivot1.setTranslate(0, 0.08, -0.72);
  tailPivot1.rotate(tailBase, 1, 0, 0);

  const tail1M = new Matrix4(tailPivot1);
  tail1M.translate(0, -0.08, 0);
  tail1M.scale(0.055, 0.18, 0.055);
  drawCylinder(tail1M, C.body);

  const tailPivot2 = new Matrix4(tailPivot1);
  tailPivot2.translate(0, -0.18, 0);
  tailPivot2.rotate(tailTip, 1, 0, 0);

  const tail2M = new Matrix4(tailPivot2);
  tail2M.translate(0, -0.06, 0);
  tail2M.scale(0.04, 0.13, 0.04);
  drawCylinder(tail2M, C.dark);

  // ── LEGS — 4 legs, each 3-level: upper / lower / foot ──
  // positions: [x, z]
  const legPos = [[-0.35, 0.42], [0.35, 0.42], [-0.35, -0.42], [0.35, -0.42]];
  legPos.forEach(([lx, lz], i) => {
    const [upper, lower, foot] = legA[i];

    // Upper leg pivot at hip
    const hip = new Matrix4();
    hip.setTranslate(lx, -0.22, lz);
    hip.rotate(upper, 1, 0, 0);

    const upperM = new Matrix4(hip);
    upperM.translate(0, -0.18, 0);
    upperM.scale(0.20, 0.36, 0.20);
    drawCylinder(upperM, C.body);

    // Lower leg (knee)
    const knee = new Matrix4(hip);
    knee.translate(0, -0.36, 0);
    knee.rotate(lower, 1, 0, 0);

    const lowerM = new Matrix4(knee);
    lowerM.translate(0, -0.14, 0);
    lowerM.scale(0.17, 0.28, 0.17);
    drawCylinder(lowerM, C.dark);

    // Foot (ankle)
    const ankle = new Matrix4(knee);
    ankle.translate(0, -0.28, 0);
    ankle.rotate(foot, 1, 0, 0);

    const footM = new Matrix4(ankle);
    footM.translate(0, -0.06, 0.04);
    footM.scale(0.22, 0.12, 0.28);
    drawCube(footM, C.toe);

    // Toenails (3 small cubes on each foot)
    [-0.06, 0, 0.06].forEach(tx => {
      const toeM = new Matrix4(ankle);
      toeM.translate(tx, -0.12, 0.14);
      toeM.scale(0.055, 0.055, 0.05);
      drawCube(toeM, C.tusk);
    });
  });
}

// ── Animation tick ────────────────────────────────────────────────────────────
function tick(timestamp) {
  const dt = (timestamp - g_lastTime) / 1000;
  g_lastTime = timestamp;

  // FPS counter
  g_frameCount++;
  g_fpsTimer += dt;
  if (g_fpsTimer >= 0.5) {
    g_fps = Math.round(g_frameCount / g_fpsTimer);
    g_frameCount = 0;
    g_fpsTimer = 0;
    document.getElementById('fps').textContent = g_fps + ' fps';
  }

  if (g_animOn) {
    g_time += dt;
    updateAnimationAngles();
  }
  if (g_pokeOn) {
    g_pokeT += dt * 1.5;
    if (g_pokeT > 1.0) { g_pokeOn = false; g_pokeT = 0; }
  }

  renderScene();
  requestAnimationFrame(tick);
}

function updateAnimationAngles() {
  // (kept here for future separation)
}

// ── Mouse ─────────────────────────────────────────────────────────────────────
function setupMouse() {
  canvas.addEventListener('mousedown', e => {
    if (e.shiftKey) {
      // Poke!
      g_pokeOn = true;
      g_pokeT  = 0;
      return;
    }
    g_mouseDown = true;
    g_lastMX = e.clientX;
    g_lastMY = e.clientY;
  });
  canvas.addEventListener('mousemove', e => {
    if (!g_mouseDown) return;
    const dx = e.clientX - g_lastMX;
    const dy = e.clientY - g_lastMY;
    g_globalRotY += dx * 0.5;
    g_globalRotX += dy * 0.5;
    g_lastMX = e.clientX;
    g_lastMY = e.clientY;
    renderScene();
  });
  canvas.addEventListener('mouseup',   () => g_mouseDown = false);
  canvas.addEventListener('mouseleave',() => g_mouseDown = false);
}

// ── Shader helpers (inline, no cuon-utils dependency) ─────────────────────────
function initShaders(gl, vs, fs) {
  const prog = createProgram(gl, vs, fs);
  if (!prog) return false;
  gl.useProgram(prog);
  gl.program = prog;
  return true;
}
function createProgram(gl, vs, fs) {
  const v = loadShader(gl, gl.VERTEX_SHADER,   vs);
  const f = loadShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram();
  gl.attachShader(p, v); gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); return null; }
  return p;
}
function loadShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); gl.deleteShader(s); return null; }
  return s;
}