attribute vec2 a_position;   // Input: Vertex positions (in clip space -1 to 1)
attribute vec2 a_texCoord;   // Input: Texture coordinates (0 to 1)

varying vec2 vUv;            // Output: Interpolated texture coordinates to fragment shader

void main() {
  vUv = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0); // Output clip space position
                      // z = 0.0, w = 1.0 for a 2D quad
} 