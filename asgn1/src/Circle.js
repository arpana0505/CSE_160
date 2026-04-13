// Circle.js  –  Brush shape: circle made from triangle fan
class Circle {
  constructor() {
    this.position = [0, 0];
    this.color    = [1, 1, 1, 1];
    this.size     = 10;
    this.segments = 12;
  }

  render() {
    gl.uniform4f(u_FragColor, ...this.color);
    gl.uniform1f(u_Size, 1.0);

    const [cx, cy] = this.position;
    const r = this.size / 300;   // radius in GL units
    const n = this.segments;

    // Build triangle fan: center + n triangles
    const verts = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const a0 = (i     / n) * Math.PI * 2;
      const a1 = ((i+1) / n) * Math.PI * 2;
      const base = i * 6;
      verts[base + 0] = cx;
      verts[base + 1] = cy;
      verts[base + 2] = cx + Math.cos(a0) * r;
      verts[base + 3] = cy + Math.sin(a0) * r;
      verts[base + 4] = cx + Math.cos(a1) * r;
      verts[base + 5] = cy + Math.sin(a1) * r;
    }

    drawTriangleFromVerts(verts);
  }
}