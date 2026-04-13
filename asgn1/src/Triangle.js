// Triangle.js  –  Brush shape: triangle
// Supports:
//   • Interactive brush mode: uses position/size/angle to build verts
//   • Picture mode: uses rawVerts directly (set by buildPictureShapes)
class Triangle {
  constructor() {
    this.position     = [0, 0];
    this.color        = [1, 1, 1, 1];
    this.size         = 10;
    this.angle        = 0;     // radians – stroke direction
    this.rawVerts     = null;  // [x1,y1,x2,y2,x3,y3] in GL coords
    this.isPictureShape = false;
  }

  render() {
    gl.uniform4f(u_FragColor, ...this.color);
    gl.uniform1f(u_Size, 1.0);  // size handled via vertex coords

    let verts;

    if (this.rawVerts) {
      // Direct coords (picture shapes or custom)
      verts = new Float32Array(this.rawVerts);
    } else {
      // ★ Awesome: direction-aligned brush triangle
      // Build an isoceles triangle pointing along this.angle
      const s = this.size / 300;   // half-size in GL units
      const a = this.angle;

      // Front tip
      const fx = this.position[0] + Math.cos(a) * s * 1.4;
      const fy = this.position[1] + Math.sin(a) * s * 1.4;

      // Two base corners, perpendicular to stroke direction
      const px = Math.cos(a + Math.PI / 2) * s;
      const py = Math.sin(a + Math.PI / 2) * s;

      const bx = this.position[0] - Math.cos(a) * s * 0.7;
      const by = this.position[1] - Math.sin(a) * s * 0.7;

      verts = new Float32Array([
        fx,      fy,
        bx + px, by + py,
        bx - px, by - py,
      ]);
    }

    drawTriangleFromVerts(verts);
  }
}