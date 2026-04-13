// Point.js
// Brush shape: GL_POINTS
class Point {
  constructor() {
    this.position = [0, 0];
    this.color    = [1, 1, 1, 1];
    this.size     = 10;
  }

  render() {
    //Set color uniform
    gl.uniform4f(u_FragColor, ...this.color);

    //Set size uniform
    gl.uniform1f(u_Size, this.size);

    // Upload single vertex
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.position), gl.DYNAMIC_DRAW);

    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.drawArrays(gl.POINTS, 0, 1);
  }
}