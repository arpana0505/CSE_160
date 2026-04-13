function initShaders(gl, vshader, fshader) {
  const program = createProgram(gl, vshader, fshader);
  if (!program) { console.error('Failed to create program'); return false; }
  gl.useProgram(program);
  gl.program = program;
  return true;
}
function createProgram(gl, vshader, fshader) {
  const vs = loadShader(gl, gl.VERTEX_SHADER,   vshader);
  const fs = loadShader(gl, gl.FRAGMENT_SHADER, fshader);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Link error: ' + gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader error: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// ── GLSL Shaders ────────────────────────────────────────────
const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform float u_Size;
  void main() {
    gl_Position  = a_Position;
    gl_PointSize = u_Size;
  }
`;

const FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

// ── Globals ──────────────────────────────────────────────────
let canvas, gl;
let a_Position, u_FragColor, u_Size;

let g_shapesList = [];

let g_brush    = 'point';
let g_color    = [1.0, 0.39, 0.78, 1.0];
let g_alpha    = 1.0;
let g_size     = 15;
let g_segments = 10;

let g_lastPos    = null;   //for gap-fill interpolation
let g_lastAngle  = 0;      //for direction-aligned triangles

// ── Entry Point ───────────────────────────────────────────────
function main() {
  canvas = document.getElementById('webgl');
  setupWebGL();
  connectVariablesToGLSL();

  canvas.onmousedown = (ev) => {
    g_lastPos = null;
    click(ev);
  };
  canvas.onmousemove = (ev) => {
    if (ev.buttons === 1) click(ev, true);
  };
  canvas.onmouseup = () => { g_lastPos = null; };

  updateColor();
  renderAllShapes();
}

// ── WebGL Setup ───────────────────────────────────────────────
function setupWebGL() {
  // preserveDrawingBuffer avoids lag at high shape counts
  gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (!gl) { alert('WebGL not supported'); return; }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.error('Shader init failed'); return;
  }
  a_Position  = gl.getAttribLocation( gl.program, 'a_Position');
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_Size      = gl.getUniformLocation(gl.program, 'u_Size');
}

// ── Click / Drag ──────────────────────────────────────────────
function click(ev, isDrag = false) {
  const [x, y] = evToGL(ev);

  //Awesome: fill gaps so no holes appear during fast mouse drag
  if (isDrag && g_lastPos) {
    const [lx, ly] = g_lastPos;
    const dist = Math.hypot(x - lx, y - ly);
    const step = (g_size / 560) * 1.2;
    if (dist > step) {
      const n = Math.ceil(dist / step);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        addShape(lx + (x-lx)*t, ly + (y-ly)*t, isDrag, lx, ly);
      }
    }
  }

  addShape(x, y, isDrag, ...(g_lastPos || [x, y]));
  g_lastPos = [x, y];

  renderAllShapes();
}

function addShape(x, y, isDrag, prevX, prevY) {
  let shape;

  if (g_brush === 'point') {
    shape = new Point();
    shape.position = [x, y];
    shape.size     = g_size;

  } else if (g_brush === 'triangle') {
    shape = new Triangle();
    shape.position = [x, y];
    shape.size     = g_size;
    //Awesome: align triangle along stroke direction
    if (isDrag && prevX !== undefined) {
      shape.angle = Math.atan2(y - prevY, x - prevX);
      g_lastAngle = shape.angle;
    } else {
      shape.angle = g_lastAngle;
    }

  } else {
    shape = new Circle();
    shape.position = [x, y];
    shape.size     = g_size;
    shape.segments = g_segments;
  }

  shape.color = [...g_color.slice(0, 3), g_alpha];
  g_shapesList.push(shape);
}

// ── Render ────────────────────────────────────────────────────
function renderAllShapes() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  for (const s of g_shapesList) s.render();
}

// ── UI Helpers ────────────────────────────────────────────────
function setBrush(type) {
  g_brush = type;
  ['point','triangle','circle'].forEach(t => {
    const id = 'btn-' + t;
    document.getElementById(id).classList.toggle('active', t === type);
  });
}

function updateColor() {
  const r = +document.getElementById('rSlider').value;
  const g = +document.getElementById('gSlider').value;
  const b = +document.getElementById('bSlider').value;
  g_color = [r/255, g/255, b/255, g_alpha];
}

function clearCanvas() {
  g_shapesList = [];
  g_lastPos    = null;
  renderAllShapes();
}

// ── Coordinate Conversion ─────────────────────────────────────
function evToGL(ev) {
  const rect = canvas.getBoundingClientRect();
  const x =  ((ev.clientX - rect.left) / canvas.width)  * 2 - 1;
  const y = -((ev.clientY - rect.top)  / canvas.height) * 2 + 1;
  return [x, y];
}

// ── Shared draw helper (used by Triangle and Circle classes) ──
// verts: Float32Array of [x,y, x,y, ...] already in GL coords
function drawTriangleFromVerts(verts) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(gl.TRIANGLES, 0, verts.length / 2);
}

// Convenience: draw one triangle from 6 raw coords
function drawTriangle(coords) {
  drawTriangleFromVerts(new Float32Array(coords));
}

// ── PICTURE: initials A K ─────────────────────────────────────
function drawMyPicture() {
  g_shapesList = [];

  // tiny helper to make a raw-vertex Triangle for the picture
  function tri(x1,y1, x2,y2, x3,y3, r,g,b, a=1.0) {
    const t = new Triangle();
    t.rawVerts = [x1,y1, x2,y2, x3,y3];
    t.color    = [r, g, b, a];
    return t;
  }
  // rectangle as two triangles
  function rect(x0,y0, x1,y1, r,g,b, a=1.0) {
    return [
      tri(x0,y0, x1,y0, x1,y1, r,g,b,a),
      tri(x0,y0, x0,y1, x1,y1, r,g,b,a),
    ];
  }
  function push(...items) {
    items.forEach(i => Array.isArray(i) ? g_shapesList.push(...i) : g_shapesList.push(i));
  }

  // ── Sky background ──
  const skyRows = [
    [0.03,0.05,0.15],[0.04,0.07,0.20],[0.05,0.09,0.25],[0.06,0.11,0.30]
  ];
  for (let i = 0; i < 4; i++) {
    const y0 = -1 + i*0.5, y1 = y0 + 0.5;
    const [r,g,b] = skyRows[i];
    push(...rect(-1,y0, 1,y1, r,g,b));
  }

  // ── Ground ──
  push(...rect(-1,-1, 1,-0.55, 0.08,0.20,0.08));

  // ── Stars ──
  const stars = [
    [-0.82,0.84],[-0.60,0.72],[-0.38,0.90],[-0.10,0.76],
    [ 0.15,0.88],[ 0.42,0.68],[ 0.70,0.82],[ 0.88,0.60],
    [-0.50,0.50],[ 0.28,0.50],[-0.70,0.30],[ 0.58,0.35],
    [ 0.00,0.40],[-0.25,0.65],[ 0.80,0.20],
  ];
  for (const [sx,sy] of stars) {
    const s = 0.025;
    push(tri(sx, sy+s, sx-s, sy-s, sx+s, sy-s, 1.0,0.95,0.70));
  }

  // ── Moon ──
  const [mx,my,mr] = [0.72, 0.60, 0.11];
  for (let i = 0; i < 12; i++) {
    const a0 = (i/12)*Math.PI*2, a1 = ((i+1)/12)*Math.PI*2;
    push(tri(mx,my,
             mx+Math.cos(a0)*mr, my+Math.sin(a0)*mr,
             mx+Math.cos(a1)*mr, my+Math.sin(a1)*mr,
             1.0,0.97,0.75));
  }

  // ── Hills ──
  function hill(cx,cy,rx,ry,r,g,b,segs=10) {
    for (let i=0;i<segs;i++) {
      const a0=Math.PI+(i/segs)*Math.PI, a1=Math.PI+((i+1)/segs)*Math.PI;
      push(tri(cx,cy, cx+Math.cos(a0)*rx,cy+Math.sin(a0)*ry,
                      cx+Math.cos(a1)*rx,cy+Math.sin(a1)*ry, r,g,b));
    }
  }
  hill(-0.60,-0.55, 0.50,0.30, 0.07,0.18,0.07);
  hill( 0.55,-0.55, 0.48,0.28, 0.06,0.16,0.06);
  hill( 0.00,-0.55, 0.35,0.20, 0.08,0.20,0.08);

  // ── Trees ──
  function tree(tx,ty,h,w,r,g,b) {
    push(...rect(tx-0.025,ty-h*0.35, tx+0.025,ty, 0.30,0.18,0.10)); // trunk
    push(tri(tx,ty+h,    tx-w,ty,    tx+w,ty,    r,g,b));
    push(tri(tx,ty+h*0.65,tx-w*0.8,ty-h*0.18,tx+w*0.8,ty-h*0.18, r*0.85,g*0.85,b));
    push(tri(tx,ty+h*0.40,tx-w*0.6,ty-h*0.30,tx+w*0.6,ty-h*0.30, r*0.72,g*0.72,b));
  }
  tree(-0.87,-0.55, 0.28,0.15, 0.12,0.50,0.18);
  tree(-0.68,-0.55, 0.22,0.12, 0.10,0.42,0.15);
  tree( 0.20,-0.55, 0.25,0.13, 0.11,0.46,0.17);
  tree( 0.88,-0.55, 0.26,0.14, 0.12,0.48,0.18);
  tree( 0.70,-0.55, 0.20,0.11, 0.09,0.38,0.14);


  //INITIALS:  A  K
  //Gold letters against the night scene. A = Arpana, K = Koilada
  //Each letter built entirely from triangles.

  const lc = [0.95, 0.80, 0.25]; // gold

  // ──Letter A  (left half of canvas, centered around x=-0.28)──
  //Two diagonal legs + a crossbar
  {
    const cx = -0.28;
    const top = 0.42, bot = -0.46;
    const sw = 0.07;  // stroke width
    const bY = -0.05; // crossbar y-range

    //Left leg (diagonal rect): bottom-left to top-center
    //We approximate as a thin parallelogram split into 2 tris
    const llx1 = cx - 0.28, lly1 = bot;
    const llx2 = cx,        lly2 = top;
    const off = sw * 0.5;

    //left leg
    push(tri(llx1-off, lly1, llx1+off, lly1, llx2+off, lly2, ...lc));
    push(tri(llx1-off, lly1, llx2-off, lly2, llx2+off, lly2, ...lc));

    //right leg
    const rlx1 = cx + 0.28, rly1 = bot;
    push(tri(rlx1-off, rly1, rlx1+off, rly1, llx2+off, lly2, ...lc));
    push(tri(rlx1-off, rly1, llx2-off, lly2, llx2+off, lly2, ...lc));

    //crossbar (horizontal bar around y = bY)
    push(...rect(cx-0.17, bY-0.045, cx+0.17, bY+0.045, ...lc));
  }

  //Letter K  (right half, x=+0.28) 
  //Vertical stem + upper diagonal arm + lower diagonal arm
  {
    const cx = 0.28;
    const top = 0.42, bot = -0.46;
    const sw = 0.065;
    const mid = 0.02; //y where arms meet the stem

    // Vertical stem
    push(...rect(cx-sw, bot, cx+sw, top, ...lc));

    //Upper arm: from stem-mid up to top-right corner
    //Approximate as parallelogram
    const ax1 = cx+sw,  ay1 = mid;
    const ax2 = cx+0.30, ay2 = top;
    const off = sw * 0.55;
    push(tri(ax1, ay1-off, ax1, ay1+off, ax2, ay2+off, ...lc));
    push(tri(ax1, ay1-off, ax2, ay2-off, ax2, ay2+off, ...lc));

    // Lower arm: from stem-mid down to bottom-right corner
    const bx2 = cx+0.30, by2 = bot;
    push(tri(ax1, ay1-off, ax1, ay1+off, bx2, by2+off, ...lc));
    push(tri(ax1, ay1-off, bx2, by2-off, bx2, by2+off, ...lc));
  }

  renderAllShapes();
}

//── Start ─────────────────────────────────────────────────────
window.onload = main;