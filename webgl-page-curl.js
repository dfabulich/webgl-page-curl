const vertexShaderSource = `
attribute vec2 a_position;   // Input: Vertex positions (in clip space -1 to 1)
attribute vec2 a_texCoord;   // Input: Texture coordinates (0 to 1)

varying vec2 vUv;            // Output: Interpolated texture coordinates to fragment shader

void main() {
  vUv = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0); // Output clip space position
                      // z = 0.0, w = 1.0 for a 2D quad
}
`;

const fragmentShaderSource = `
precision mediump float; // Added default precision for floats

#define PI 3.14159265359

uniform vec2 resolution;      // Viewport resolution (not strictly needed for this logic)
uniform float curlAmount;     // Animation progress (0.0 to 1.0+, determines curl position)
uniform float radius;         // Curl radius
uniform sampler2D frontTexture; // Texture for the front of the page

varying vec2 vUv; // Input UV coordinates [0,1]x[0,1]

// Function to check if UV coordinates are within the page bounds [0,1]
bool isInBounds(vec2 uvCoords) {
  return uvCoords.x >= 0.0 && uvCoords.x <= 1.0 && uvCoords.y >= 0.0 && uvCoords.y <= 1.0;
}

void main() {
  // Check if initial vUv is within bounds before proceeding
  if (!isInBounds(vUv)) {
    discard; // Discard fragments outside the original page area
  }

  // If curlAmount is essentially zero, just show the front texture unmodified and opaque.
  if (curlAmount < 0.0001) {
    gl_FragColor = texture2D(frontTexture, vUv);
    return;
  }

  // --- 1. Define Curl Geometry based on curlAmount ---

  // Define the start and end points of the curl path in UV space
  vec2 curlStartPos = vec2(1.0, 0.0); // Bottom-Right corner
  vec2 curlEndTargetPos = vec2(0.0, 1.0); // Top-Left corner

  // Vector representing the full direction and length of the curl animation path
  vec2 curlPathVector = curlEndTargetPos - curlStartPos; // (-1.0, 1.0)

  // The path length is the hypotenuse of the curl path vector plus
  // the radius of the curl cylinder, plus another radius to account for the
  // shadow that falls on the back side of the page.
  float curlPathLength = length(curlPathVector) + (radius * 2.0);
  vec2 curlPathDir = normalize(curlPathVector); // Direction from BR to TL

  // Calculate the current position of the center of the curl axis based on curlAmount
  // This corresponds to 'dragPos' or 'mouse' in Andrew's examples.
  float curlProgressDist = curlAmount * curlPathLength;
  vec2 curlAxisPos = curlStartPos + curlPathDir * curlProgressDist;

  // Define the reference direction for distance calculations.
  // This points FROM the curlAxisPos back TOWARDS the curlStartPos.
  // Equivalent to Andrew's 'dir' or 'mouseDir'.
  // Note: If curlAmount is 0, curlAxisPos = curlStartPos, making this a zero vector.
  // We handle this edge case later, but for calculations assume curlAmount > 0.
  // If curlAmount > 0, this is simply the opposite of curlPathDir.
  vec2 axisReferenceDir = -curlPathDir; // normalize(curlStartPos - curlAxisPos) simplified

  // --- 2. Calculate Distances for Scenario Determination (Revised Method) ---

  // Define a fixed reference point for projections
  vec2 refPoint = curlStartPos;

  // Calculate vectors from the reference point
  vec2 fragmentVecFromRef = vUv - refPoint;
  vec2 curlAxisVecFromRef = curlAxisPos - refPoint;

  // Project these vectors onto the axisReferenceDir
  // distCurlAxisFromOrigin: Projection distance of curlAxisPos from refPoint
  // distFragmentAlongAxisRefDir: Projection distance of fragment from refPoint
  float distCurlAxisFromOrigin = dot(curlAxisVecFromRef, axisReferenceDir);
  float distFragmentAlongAxisRefDir = dot(fragmentVecFromRef, axisReferenceDir);

  // Calculate the perpendicular distance of the fragment FROM the curl axis line.
  // Positive values are "ahead" of the curl axis (relative to axisReferenceDir),
  // negative values are "behind".
  // This corresponds to Andrew's 'dist'.
  // Handle edge case where curlAmount = 0
  float distFragmentFromCurlAxis = 0.0;
  if (curlAmount < 0.0001) {
    distFragmentFromCurlAxis = radius + 1.0; // Ensure it's > radius -> Scenario 1
  } else {
    distFragmentFromCurlAxis = distFragmentAlongAxisRefDir - distCurlAxisFromOrigin;
  }


  // --- 4. Determine Scenario and Calculate Final UV / Color ---

  vec4 color = vec4(0.0); // Default to transparent black

  // Use the calculated distFragmentFromCurlAxis to determine the scenario
  if (distFragmentFromCurlAxis > radius) {
    // Scenario 1: Ahead of curl, outside the cylinder radius.
    // This area should be transparent, revealing the underlying next page.
    color = vec4(0.0); // Transparent
    
    // Cast a shadow if the fragment is within one radius of the curl axis.
    color.a = 1.0 - pow(clamp((distFragmentFromCurlAxis - radius) / radius, 0., 1.) * 1.5, .2);
  } else if (distFragmentFromCurlAxis >= 0.0) {
    // Scenario 2: On the curl cylinder itself

    // Find the point on the curl axis line closest to the original vUv
    // This is the point from which we measure the angle theta.
    vec2 linePoint = vUv - distFragmentFromCurlAxis * axisReferenceDir;

    // Calculate the angle theta based on the distance from the axis
    // Clamp input to asin to avoid domain errors due to floating point inaccuracies
    float asinInput = clamp(distFragmentFromCurlAxis / radius, -1.0, 1.0);
    float theta = asin(asinInput);

    // Calculate the unrolled UV coordinate for the front face (p1)
    float distForP1 = theta * radius;
    vec2 p1 = linePoint + axisReferenceDir * distForP1;

    // Calculate the unrolled UV coordinate for the back face (p2)
    float angleForP2 = PI - theta;
    float distForP2 = angleForP2 * radius;
    vec2 p2 = linePoint + axisReferenceDir * distForP2;

    // Check if the calculated back-face UV (p2) is within the page bounds
    bool seeingBack = isInBounds(p2);

    if (seeingBack) {
      // Back side coordinates p2 are valid. Sample front texture at p2.
      color = texture2D(frontTexture, p2);
      // Optional: Slightly darken the back face
      color.rgb *= 0.9;
    } else {
      // Seeing the front side (p2 was out of bounds). Use p1.
      // p1 is assumed to be in bounds based on the curl geometry.
      color = texture2D(frontTexture, p1);
      // Add shading based on curl angle (theta) to simulate curvature
      float light = 0.7 + 0.3 * cos(theta); // Simple lighting model
      color.rgb *= light;
    }

  } else {
    // Scenario 3: Behind/Under the curl

    // Find the point on the curl axis line closest to the original vUv
    vec2 linePoint = vUv - distFragmentFromCurlAxis * axisReferenceDir;

    // Calculate the unrolled UV coordinate 'p' for the back face.
    // The distance along the unrolled page is half the circumference plus the
    // (negative) distance behind the axis.
    float distForP = PI * radius + abs(distFragmentFromCurlAxis);
    vec2 p = linePoint + axisReferenceDir * distForP;

    // Check if the calculated back-face UV (p) is within the page bounds
    if (isInBounds(p)) {
      // Back side coordinate 'p' is valid. Use it for sampling.
      color = texture2D(frontTexture, p);
      color.rgb *= 0.9;
    } else {
      // If 'p' is out of bounds, use the original fragment UV.
      color = texture2D(frontTexture, vUv);
    }
  }

  gl_FragColor = color;
}
`;

// Animation loop
function animate(timestamp, state) {
  if (state.done) return;
  requestAnimationFrame(timestamp => animate(timestamp, state));
  if (!state.startTime) state.startTime = timestamp;

  const elapsedTime = timestamp - state.startTime;
  const progress = Math.min(elapsedTime / state.durationInMs, 1.0);
  // state.curlAmount = progress; // Raw WebGL will use progress directly or a mapped value for curlAmount uniform
  // For now, just ensure animation runs. curlAmount can be set if used by a placeholder in animate.
  state.curlAmount = progress * 1.0; // Restore scaling to allow full curl

  if (state.logging)
    console.log(
      `curlAmount: ${state.curlAmount.toFixed(3)}, progress: ${(progress * 100).toFixed(1)}%`
    );

  try {
    // Raw WebGL rendering
    if (state.gl && state.canvas && state.shaderProgram && state.frontTextureGL) {
      const gl = state.gl;
      gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // Also clear depth buffer if depth testing is ever enabled

      gl.useProgram(state.shaderProgram);

      // Activate texture unit 0 and bind the texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, state.frontTextureGL);

      // Set uniforms
      gl.uniform2f(state.uniformLocations.resolution, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(state.uniformLocations.curlAmount, state.curlAmount);
      gl.uniform1f(state.uniformLocations.radius, state.curlRadius);
      // frontTexture uniform (sampler) was set to 0 (texture unit) once during init.

      // Draw the quad
      // Make sure attributes are still bound and enabled if they were unbound elsewhere
      // For this setup, they are set once and remain bound/enabled.
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // 4 vertices for a TRIANGLE_STRIP quad

      gl.useProgram(null); // Good practice to unbind program after use
      gl.bindTexture(gl.TEXTURE_2D, null); // Unbind texture
    }
  } catch (error) {
    state.done = true;
    state.reject(error);
  }

  if (progress >= 1) {
    if (state.logging) console.log('Animation complete');
    state.done = true;
    state.resolve();
  }
}

// Helper function to compile a shader
function compileShader(gl, source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const errorInfo = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(
      `Failed to compile shader (${type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment'}): ${errorInfo}`
    );
  }
  return shader;
}

// Helper function to create (link) a shader program
function createShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = compileShader(gl, vsSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const errorInfo = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Failed to link shader program: ${errorInfo}`);
  }
  // Shaders are now part of the program and can be deleted.
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

/**
 * Captures a screenshot of the parent element of the given element.
 *
 * @param {HTMLElement} element - The element to capture the screenshot of.
 * @param {Function} html2canvas - The html2canvas library.
 * @param {Object} options - The options object.
 * @param {boolean} [options.logging=false] - Enable verbose logging.
 * @returns {Promise<HTMLCanvasElement>} A promise that resolves to a canvas element containing the screenshot.
 */
export async function captureScreenshotOfParentElement(
  element,
  html2canvas,
  options = { logging: false }
) {
  const parentElement = element.parentElement;
  const rect = parentElement.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const dpr = window.devicePixelRatio || 1;

  const canvas = await html2canvas(parentElement, {
    useCORS: true,
    logging: options.logging,
    width: width, // html2canvas uses these for the canvas element's width/height attributes
    height: height,
    scale: dpr, // This tells html2canvas to render at the device pixel ratio
    x: 0,
    y: 0,
    scrollX: -parentElement.scrollLeft,
    scrollY: -parentElement.scrollTop,
  });
  // Ensure the canvas element itself (if ever displayed) is sized via CSS pixels
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  if (options.logging) console.log('Screenshot captured', canvas.outerHTML);
  return canvas;
}

/**
 * Performs a page curl transition on an element.
 *
 * @param {Object} args - The arguments object.
 * @param {HTMLElement} args.element - The element to apply the curl effect to.
 * @param {HTMLCanvasElement} args.screenshotCanvas - The canvas containing the screenshot of the element.
 * @param {(string|Function)} args.nextPageContent - HTML string or function to update the element content after curl.
 * @param {number} [args.durationInMs=1000] - Duration of the animation in milliseconds.
 * @param {boolean} [args.logging=false] - Enable verbose logging.
 * @param {number} [args.curlRadius=0.1] - Radius of the page curl (in normalized coordinates, relative to hypotenuse).
 * @returns {Promise<void>} A promise that resolves when the animation completes.
 * @throws {Error} If required arguments are missing or parent element is not positioned correctly.
 */
export async function curl(args) {
  // Validate required arguments
  if (!args.element) {
    throw new Error('Missing required argument: element');
  }
  if (!args.screenshotCanvas) {
    throw new Error('Missing required argument: screenshotCanvas');
  }
  if (!args.nextPageContent) {
    throw new Error('Missing required argument: nextPageContent');
  }

  const { element, screenshotCanvas, nextPageContent } = args;

  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const state = {
    done: false,
    logging: args.logging ?? false,
    durationInMs: args.durationInMs ?? 1000,
    curlAmount: 0.0, // Current state of the curl animation
    curlRadius: args.curlRadius ?? 0.2, // Retain for shader uniform later
    startTime: null,
    // WebGL specific state
    canvas: null, // Will hold our new canvas element
    gl: null, // Will hold the WebGL context
    shaderProgram: null, // Will hold the linked shader program
    // Add locations and buffers to state
    attributeLocations: {},
    buffers: {},
    frontTextureGL: null, // For WebGL texture object
    uniformLocations: {}, // To store uniform locations
    resolve: resolve,
    reject: reject,
  };

  try {
    if (state.logging) console.log('Starting transition with raw WebGL...');

    const parentElement = element.parentElement;
    if (
      parentElement !== document.body &&
      window.getComputedStyle(parentElement).position !== 'relative'
    ) {
      throw new Error(
        'Parent element must have position: relative. The curl animation will be appended to the parent element with absolute positioning, relative to the parent element.'
      );
    }

    const rect = parentElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const dpr = window.devicePixelRatio || 1;

    if (state.logging) console.log({ width, height, dpr });

    // Create canvas and get WebGL context
    state.canvas = document.createElement('canvas');
    state.canvas.width = width * dpr; // Set backing store size
    state.canvas.height = height * dpr; // Set backing store size

    // Attempt to get WebGL2 first, fallback to WebGL1
    // Request alpha for transparency, antialias can be true/false based on preference/performance
    const glContextAttributes = { alpha: true, antialias: false };
    state.gl = state.canvas.getContext('webgl2', glContextAttributes);
    if (!state.gl) {
      if (state.logging) console.log('WebGL2 not supported, falling back to WebGL1.');
      state.gl = state.canvas.getContext('webgl', glContextAttributes);
    }
    if (!state.gl) {
      throw new Error('WebGL not supported in this browser.');
    }

    // Set viewport - typically done once, but good practice if canvas size changes
    state.gl.viewport(0, 0, state.gl.drawingBufferWidth, state.gl.drawingBufferHeight);

    // Set all necessary styles directly on canvas to position it exactly over the element
    const elementZIndex = Number(window.getComputedStyle(element).zIndex) || 0;
    const canvasZIndex = elementZIndex + 1;

    Object.assign(state.canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: `${width}px`,
      height: `${height}px`,
      zIndex: canvasZIndex,
      pointerEvents: 'none',
      backgroundColor: 'transparent', // Ensure CSS background is also transparent
    });
    parentElement.appendChild(state.canvas);

    // Compile shaders and link program
    try {
      state.shaderProgram = createShaderProgram(state.gl, vertexShaderSource, fragmentShaderSource);
    } catch (shaderError) {
      console.error('Shader Compilation/Linking Error:', shaderError);
      throw shaderError; // Re-throw to be caught by outer try-finally
    }

    if (state.logging) console.log('Raw WebGL shaders compiled and program linked.');

    // Switch underlying DOM to next page (it's covered by the canvas)
    if (typeof nextPageContent === 'string') {
      element.innerHTML = nextPageContent;
    } else {
      nextPageContent(element);
    }
    if (state.logging) console.log('Underlying DOM switched to next page content.');

    // --- IMPORTANT: Setup WebGL resources BEFORE starting animation ----
    const gl = state.gl; // Use a local gl for this setup block for convenience

    // --- Define Geometry and Create Buffers ---
    // A fullscreen quad using TRIANGLE_STRIP (4 vertices)
    // prettier-ignore
    const positions = new Float32Array([
      -1.0,  1.0,  // Top-left
      -1.0, -1.0,  // Bottom-left
      1.0,  1.0,  // Top-right
      1.0, -1.0   // Bottom-right
    ]);
    // prettier-ignore
    const texCoords = new Float32Array([
      0.0, 1.0,  // UV for Top-left
      0.0, 0.0,  // UV for Bottom-left
      1.0, 1.0,  // UV for Top-right
      1.0, 0.0   // UV for Bottom-right
    ]);

    // Create buffer for positions
    state.buffers.position = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, state.buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Create buffer for texture coordinates
    state.buffers.texCoord = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, state.buffers.texCoord);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    // --- Get Attribute Locations and Set Up Pointers ---
    state.attributeLocations.position = gl.getAttribLocation(state.shaderProgram, 'a_position');
    state.attributeLocations.texCoord = gl.getAttribLocation(state.shaderProgram, 'a_texCoord');

    gl.enableVertexAttribArray(state.attributeLocations.position);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.buffers.position);
    gl.vertexAttribPointer(state.attributeLocations.position, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(state.attributeLocations.texCoord);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.buffers.texCoord);
    gl.vertexAttribPointer(state.attributeLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
    if (state.logging) console.log('Raw WebGL buffers created and attributes set up.');

    // --- Create and Configure Texture ---
    state.frontTextureGL = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, state.frontTextureGL);
    // Flip texture data vertically on upload
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, screenshotCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    if (state.logging) console.log('Raw WebGL texture created from screenshotCanvas.');

    // --- Get Uniform Locations ---
    state.uniformLocations.resolution = gl.getUniformLocation(state.shaderProgram, 'resolution');
    state.uniformLocations.curlAmount = gl.getUniformLocation(state.shaderProgram, 'curlAmount');
    state.uniformLocations.radius = gl.getUniformLocation(state.shaderProgram, 'radius');
    state.uniformLocations.frontTexture = gl.getUniformLocation(
      state.shaderProgram,
      'frontTexture'
    );
    if (state.logging) console.log('Uniform locations obtained.');

    // --- Set Initial Uniforms (some are set per frame) ---
    gl.useProgram(state.shaderProgram); // Use program before setting uniforms
    gl.uniform1i(state.uniformLocations.frontTexture, 0); // Tell shader to use texture unit 0 for frontTexture
    // Resolution, curlAmount and radius are set in animate loop
    gl.useProgram(null); // Unbind program for now (will be bound in animate)
    // --- End of WebGL resource setup ---

    // Start animation loop
    requestAnimationFrame(timestamp => animate(timestamp, state));
    await promise;
  } finally {
    // Clean up WebGL resources
    if (state.shaderProgram && state.gl) {
      if (!state.gl.isContextLost()) {
        // Check if context is still valid
        state.gl.deleteProgram(state.shaderProgram);
      }
      state.shaderProgram = null;
    }
    if (state.buffers.position && state.gl) state.gl.deleteBuffer(state.buffers.position);
    if (state.buffers.texCoord && state.gl) state.gl.deleteBuffer(state.buffers.texCoord);
    if (state.frontTextureGL && state.gl) {
      if (!state.gl.isContextLost()) {
        state.gl.deleteTexture(state.frontTextureGL);
      }
      state.frontTextureGL = null;
    }
    // ... (canvas removal and rest of cleanup)
    if (state.canvas && state.canvas.parentNode) {
      state.canvas.remove();
    }
    state.canvas = null;
    state.gl = null; // Context is effectively lost with canvas removal or can be explicitly handled if needed

    state.done = true;
    if (state.logging) console.log('All resources cleaned up (raw WebGL path).');
  }
}
