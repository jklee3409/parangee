/** Dense original-texture mesh rendered in one GPU draw call. */
export class MeshRenderer {
  constructor(canvas, image) {
    this.gl = canvas.getContext('webgl', { alpha: false, antialias: true, depth: false });
    if (!this.gl) throw new Error('WebGL unavailable');
    const gl = this.gl;
    const shader = (type, source) => {
      const item = gl.createShader(type);
      gl.shaderSource(item, source); gl.compileShader(item);
      if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) throw new Error('Shader compilation failed');
      return item;
    };
    const vertex = shader(gl.VERTEX_SHADER, 'attribute vec2 position; attribute vec2 uv; varying vec2 tex; void main(){ tex=uv; gl_Position=vec4(position.x*2.0-1.0,1.0-position.y*2.0,0.0,1.0); }');
    const fragment = shader(gl.FRAGMENT_SHADER, 'precision mediump float; varying vec2 tex; uniform sampler2D image; void main(){ gl_FragColor=texture2D(image,tex); }');
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertex); gl.attachShader(this.program, fragment); gl.linkProgram(this.program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('Shader linking failed');
    gl.useProgram(this.program);
    this.nx = 64; this.ny = 60;
    this.vertices = new Float32Array((this.nx + 1) * (this.ny + 1) * 4);
    const indices = [];
    for (let y = 0; y < this.ny; y++) for (let x = 0; x < this.nx; x++) {
      const a = y * (this.nx + 1) + x, b = a + 1, c = a + this.nx + 1, d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
    this.count = indices.length;
    this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW);
    for (const [name, offset] of [['position', 0], ['uv', 8]]) {
      const location = gl.getAttribLocation(this.program, name);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 16, offset);
    }
    this.indices = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }
  draw(model, breath) {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    let i = 0;
    for (let y = 0; y <= this.ny; y++) for (let x = 0; x <= this.nx; x++) {
      const u = x / this.nx, v = y / this.ny, point = model.deform(u, v, breath);
      this.vertices[i++] = point[0] / model.width; this.vertices[i++] = point[1] / model.height;
      this.vertices[i++] = u; this.vertices[i++] = v;
    }
    gl.viewport(0, 0, model.width, model.height);
    gl.clearColor(.96, .97, .98, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
  }
  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.buffer); gl.deleteBuffer(this.indices); gl.deleteTexture(this.texture); gl.deleteProgram(this.program);
  }
}
