// ============================================================
// asg0.js - CSE160 Assignment 0
// ============================================================

function main() {
  var canvas = document.getElementById('myCanvas');
  if (!canvas) { console.log('Failed to get canvas'); return; }

  var ctx = canvas.getContext('2d');
  if (!ctx) { console.log('Failed to get 2D context'); return; }

  drawBlackCanvas(ctx, canvas);

  // Draw default red vector on load
  var v1 = new Vector3([2.25, 2.25, 0]);
  drawVector(v1, 'red');
}

// Clear canvas to black
function drawBlackCanvas(ctx, canvas) {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Draw a vector from center of canvas, scaled by 20
function drawVector(v, color) {
  var canvas = document.getElementById('myCanvas');
  var ctx = canvas.getContext('2d');

  var centerX = canvas.width / 2;
  var centerY = canvas.height / 2;
  var scale = 20;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + v.elements[0] * scale, centerY - v.elements[1] * scale);
  ctx.stroke();
}

// Helper: copy a Vector3 so we don't mutate the original
function copyVec(v) {
  return new Vector3([v.elements[0], v.elements[1], v.elements[2]]);
}

// Draw v1 (red) and v2 (blue)
function handleDrawEvent() {
  var canvas = document.getElementById('myCanvas');
  var ctx = canvas.getContext('2d');
  drawBlackCanvas(ctx, canvas);

  var v1 = new Vector3([
    parseFloat(document.getElementById('v1x').value),
    parseFloat(document.getElementById('v1y').value),
    0
  ]);
  var v2 = new Vector3([
    parseFloat(document.getElementById('v2x').value),
    parseFloat(document.getElementById('v2y').value),
    0
  ]);

  drawVector(v1, 'red');
  drawVector(v2, 'blue');
}

// Perform and visualize the selected operation
function handleDrawOperationEvent() {
  var canvas = document.getElementById('myCanvas');
  var ctx = canvas.getContext('2d');
  drawBlackCanvas(ctx, canvas);

  var v1 = new Vector3([
    parseFloat(document.getElementById('v1x').value),
    parseFloat(document.getElementById('v1y').value),
    0
  ]);
  var v2 = new Vector3([
    parseFloat(document.getElementById('v2x').value),
    parseFloat(document.getElementById('v2y').value),
    0
  ]);
  var scalar = parseFloat(document.getElementById('scalar').value);
  var op = document.getElementById('operation').value;

  // Always draw v1 and v2 first
  drawVector(v1, 'red');
  drawVector(v2, 'blue');

  if (op === 'add') {
    // copy v1 so we don't destroy it, then add v2 into the copy
    var v3 = copyVec(v1);
    v3.add(v2);
    drawVector(v3, 'green');

  } else if (op === 'sub') {
    var v3 = copyVec(v1);
    v3.sub(v2);
    drawVector(v3, 'green');

  } else if (op === 'mul') {
    var v3 = copyVec(v1);
    var v4 = copyVec(v2);
    v3.mul(scalar);
    v4.mul(scalar);
    drawVector(v3, 'green');
    drawVector(v4, 'green');

  } else if (op === 'div') {
    var v3 = copyVec(v1);
    var v4 = copyVec(v2);
    v3.div(scalar);
    v4.div(scalar);
    drawVector(v3, 'green');
    drawVector(v4, 'green');

  } else if (op === 'magnitude') {
    console.log('Magnitude of v1: ' + v1.magnitude());
    console.log('Magnitude of v2: ' + v2.magnitude());

  } else if (op === 'normalize') {
    console.log('Magnitude of v1: ' + v1.magnitude());
    console.log('Magnitude of v2: ' + v2.magnitude());
    var n1 = copyVec(v1);
    var n2 = copyVec(v2);
    n1.normalize();
    n2.normalize();
    drawVector(n1, 'green');
    drawVector(n2, 'green');

  } else if (op === 'angle') {
    var angle = angleBetween(v1, v2);
    console.log('Angle between v1 and v2: ' + angle + ' degrees');

  } else if (op === 'area') {
    var area = areaTriangle(v1, v2);
    console.log('Area of triangle formed by v1 and v2: ' + area);
  }
}

// Angle between v1 and v2 using dot product
function angleBetween(v1, v2) {
  var dot = Vector3.dot(v1, v2);
  var mag1 = v1.magnitude();
  var mag2 = v2.magnitude();
  var cosAngle = dot / (mag1 * mag2);
  cosAngle = Math.max(-1, Math.min(1, cosAngle)); // clamp for safety
  return Math.acos(cosAngle) * (180 / Math.PI);
}

// Area of triangle formed by v1 and v2
function areaTriangle(v1, v2) {
  var cross = Vector3.cross(v1, v2);
  return 0.5 * cross.magnitude();
}