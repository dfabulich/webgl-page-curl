const vertexShaderSource = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShaderSource = `
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

    // --- 1. Define Curl Geometry based on curlAmount ---

    // Define the start and end points of the curl path in UV space
    vec2 curlStartPos = vec2(1.0, 0.0); // Bottom-Right corner
    vec2 curlEndTargetPos = vec2(0.0, 1.0); // Top-Left corner

    // Vector representing the full direction and length of the curl animation path
    vec2 curlPathVector = curlEndTargetPos - curlStartPos; // (-1.0, 1.0)
    float curlPathLength = length(curlPathVector) + radius; // sqrt(2)
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


    // Check if initial vUv is within bounds before proceeding
    if (!isInBounds(vUv)) {
       discard; // Discard fragments outside the original page area
    }


    // Use the calculated distFragmentFromCurlAxis to determine the scenario
    if (distFragmentFromCurlAxis > radius) {
        // Scenario 1: Ahead of curl, outside the cylinder radius.
        // This area should be transparent, revealing the underlying next page.
        color = vec4(0.0); // Transparent
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
  requestAnimationFrame((timestamp) => animate(timestamp, state));
  if (!state.startTime) state.startTime = timestamp;

  const elapsedTime = timestamp - state.startTime;
  const progress = Math.min(elapsedTime / state.durationInMs, 1.0); // Ensure progress doesn't exceed 1
  state.curlAmount = progress;

  if (state.logging)
    console.log(
      `curlAmount: ${state.curlAmount.toFixed(3)}, progress: ${(progress * 100).toFixed(1)}%`
    );

  try {
    // Update shader uniform instead of geometry
    if (state.planeMesh && state.planeMesh.material.uniforms) {
      state.planeMesh.material.uniforms.curlAmount.value = state.curlAmount;
    }
    // Render the scene
    state.renderer.render(state.scene, state.camera);
  } catch (error) {
    state.done = true;
    state.reject(error);
  }

  // Check completion based on progress (not curlAmount directly)
  if (progress >= 1) {
    if (state.logging) console.log('Animation complete');
    state.done = true;
    state.resolve();
  }
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
  const canvas = await html2canvas(parentElement, {
    useCORS: true,
    logging: options.logging,
    width: width,
    height: height,
    x: 0,
    y: 0,
    scrollX: -parentElement.scrollLeft,
    scrollY: -parentElement.scrollTop,
  });
  if (options.logging) console.log('Screenshot captured', canvas.outerHTML);
  return canvas;
}

/**
 * Performs a page curl transition on an element.
 *
 * @param {Object} args - The arguments object.
 * @param {Object} args.THREE - The THREE.js library.
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
  if (!args.THREE) {
    throw new Error('Missing required argument: THREE (THREE.js library)');
  }
  if (!args.element) {
    throw new Error('Missing required argument: element');
  }
  if (!args.screenshotCanvas) {
    throw new Error('Missing required argument: screenshotCanvas');
  }
  if (!args.nextPageContent) {
    throw new Error('Missing required argument: nextPageContent');
  }

  const { THREE, element, screenshotCanvas, nextPageContent } = args;

  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const state = {
    done: false,
    logging: args.logging ?? false,
    durationInMs: args.durationInMs ?? 1000,
    curlAmount: 0.0, // Current state of the curl animation for the shader
    curlRadius: args.curlRadius ?? 0.2, // Default curl radius for shader
    startTime: null,
    scene: null,
    camera: null,
    renderer: null,
    planeMesh: null,
    resolve: resolve,
    reject: reject,
  };

  try {
    if (state.logging) console.log('Starting transition...');

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
    const aspect = width / height;

    if (state.logging) console.log({ width, height, aspect });

    state.scene = new THREE.Scene();
    const fov = 75; // Field of View
    const FRUSTUM_SIZE = 5;
    state.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
    // Adjust camera Z to fit FRUSTUM_SIZE plane in view
    state.camera.position.z = FRUSTUM_SIZE / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));

    state.renderer = new THREE.WebGLRenderer({ alpha: true });
    state.renderer.setPixelRatio(window.devicePixelRatio);
    state.renderer.setSize(width, height);
    parentElement.appendChild(state.renderer.domElement);

    // Define uniforms for the shader
    const uniforms = {
      resolution: { value: new THREE.Vector2(width, height) },
      curlAmount: { value: state.curlAmount },
      radius: { value: state.curlRadius },
      frontTexture: { value: new THREE.CanvasTexture(screenshotCanvas) },
    };

    // Create shader material
    const shaderMaterial = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShaderSource,
      fragmentShader: fragmentShaderSource,
      transparent: true, // Crucial for seeing through the back/underneath
      side: THREE.DoubleSide, // Render both sides for the effect
    });

    // Set all necessary styles directly on canvas to position it exactly over the element
    const canvasElement = state.renderer.domElement;

    const elementZIndex = Number(window.getComputedStyle(element).zIndex) || 0;
    const canvasZIndex = elementZIndex + 1;

    Object.assign(canvasElement.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: `${width}px`,
      height: `${height}px`,
      zIndex: canvasZIndex,
      pointerEvents: 'none', // Allow clicks to pass through
      backgroundColor: 'transparent',
    });

    // Create plane for screenshot with element's aspect ratio
    const planeGeometry = new THREE.PlaneGeometry(FRUSTUM_SIZE * aspect, FRUSTUM_SIZE, 1, 1); // Segments can be 1x1 for shader
    state.planeMesh = new THREE.Mesh(planeGeometry, shaderMaterial);
    state.planeMesh.position.z = 0;
    state.scene.add(state.planeMesh);

    // Add lighting
    // NOTE: Lighting might need adjustment or removal as the shader does its own simple lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    state.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 2);
    state.scene.add(directionalLight);

    if (state.logging) console.log('Shader material applied to canvas plane.');

    // Switch underlying DOM to next page (it's covered by the canvas)
    if (typeof nextPageContent === 'string') {
      element.innerHTML = nextPageContent;
    } else {
      nextPageContent(element);
    }
    if (state.logging) console.log('Underlying DOM switched to next page content.');

    // Start animation loop
    requestAnimationFrame(timestamp => animate(timestamp, state));
    await promise;
  } finally {
    // Clean up all resources regardless of success or failure

    // Clean up THREE.js resources
    if (state.planeMesh) {
      if (state.planeMesh.geometry) state.planeMesh.geometry.dispose();
      if (state.planeMesh.material) {
        if (state.planeMesh.material.map) state.planeMesh.material.map.dispose();
        state.planeMesh.material.dispose();
      }
      state.planeMesh = null;
    }

    if (state.scene) {
      state.scene = null;
    }

    // Dispose of renderer
    if (state.renderer) {
      state.renderer.dispose();
      // In case the animation didn't complete and remove the canvas
      if (state.renderer.domElement && state.renderer.domElement.parentNode) {
        state.renderer.domElement.remove();
      }
      state.renderer = null;
    }

    state.done = true;
    state.scene = null;
    state.camera = null;
    state.renderer = null;
    state.planeMesh = null; // Should be nulled out already by scene cleanup

    if (state.logging) console.log('All resources cleaned up');
  }
}
