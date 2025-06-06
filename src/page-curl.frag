precision mediump float; // Added default precision for floats

#define PI 3.14159265359

uniform float curlAmount;     // Animation progress (0.0 to 1.0+, determines curl position)
uniform float radius;         // Curl radius
uniform sampler2D t; // Texture for the front of the page

varying vec2 vUv; // Input UV coordinates [0,1]x[0,1]

// Function to check if UV coordinates are within the page bounds [0,1]
bool isInBounds(vec2 uvCoords) {
  return uvCoords.x >= 0.0 && uvCoords.x <= 1.0 && uvCoords.y >= 0.0 && uvCoords.y <= 1.0;
}

void main() {
  // use local variables so we can minify them
  float _curlAmount = curlAmount;
  float _radius = radius;
  // Check if initial vUv is within bounds before proceeding
  if (!isInBounds(vUv)) {
    discard; // Discard fragments outside the original page area
  }

  // If curlAmount is essentially zero, just show the front texture unmodified and opaque.
  if (_curlAmount < 0.0001) {
    gl_FragColor = texture2D(t, vUv);
    return;
  }

  // --- 1. Define Curl Geometry based on curlAmount ---

  // Define the start and end points of the curl path in UV space
  vec2 curlStartPos = vec2(1.0, 0.0); // Bottom-Right corner
  vec2 curlEndTargetPos = vec2(0.0, 1.0); // Top-Left corner

  // Vector representing the full direction and length of the curl animation path
  vec2 curlPathVector = curlEndTargetPos - curlStartPos; // (-1.0, 1.0)

  // The path length is the hypotenuse of the curl path vector plus
  // half the circumference of the curl cylinder.
  float curlPathLength = length(curlPathVector) + (_radius * PI);
  vec2 curlPathDir = normalize(curlPathVector); // Direction from BR to TL

  // Calculate the current position of the center of the curl axis based on curlAmount
  // This corresponds to 'dragPos' or 'mouse' in Andrew's examples.
  float curlProgressDist = _curlAmount * curlPathLength;
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
  if (_curlAmount < 0.0001) {
    distFragmentFromCurlAxis = _radius + 1.0; // Ensure it's > radius -> Scenario 1
  } else {
    distFragmentFromCurlAxis = distFragmentAlongAxisRefDir - distCurlAxisFromOrigin;
  }


  // --- 4. Determine Scenario and Calculate Final UV / Color ---

  vec4 color = vec4(0.0); // Default to transparent black

  // Use the calculated distFragmentFromCurlAxis to determine the scenario
  if (distFragmentFromCurlAxis > _radius) {
    // Scenario 1: Ahead of curl, outside the cylinder radius.
    // This area should be transparent, revealing the underlying next page.
    color = vec4(0.0); // Transparent
    
    // Cast a shadow if the fragment is within one radius of the curl axis.
    color.a = 1.0 - pow(clamp((distFragmentFromCurlAxis - _radius) / _radius, 0., 1.) * 1.5, .2);
  } else if (distFragmentFromCurlAxis >= 0.0) {
    // Scenario 2: On the curl cylinder itself

    // Find the point on the curl axis line closest to the original vUv
    // This is the point from which we measure the angle theta.
    vec2 linePoint = vUv - distFragmentFromCurlAxis * axisReferenceDir;

    // Calculate the angle theta based on the distance from the axis
    // Clamp input to asin to avoid domain errors due to floating point inaccuracies
    float asinInput = clamp(distFragmentFromCurlAxis / _radius, -1.0, 1.0);
    float theta = asin(asinInput);

    // Calculate the unrolled UV coordinate for the front face (p1)
    float distForP1 = theta * _radius;
    vec2 p1 = linePoint + axisReferenceDir * distForP1;

    // Calculate the unrolled UV coordinate for the back face (p2)
    float angleForP2 = PI - theta;
    float distForP2 = angleForP2 * _radius;
    vec2 p2 = linePoint + axisReferenceDir * distForP2;

    // Check if the calculated back-face UV (p2) is within the page bounds
    bool seeingBack = isInBounds(p2);

    if (seeingBack) {
      // Back side coordinates p2 are valid. Sample front texture at p2.
      color = texture2D(t, p2);
      // Optional: Slightly darken the back face
      color.rgb *= 0.9;
    } else {
      // Seeing the front side (p2 was out of bounds). Use p1.
      // p1 is assumed to be in bounds based on the curl geometry.
      color = texture2D(t, p1);
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
    float distForP = PI * _radius + abs(distFragmentFromCurlAxis);
    vec2 p = linePoint + axisReferenceDir * distForP;

    // Check if the calculated back-face UV (p) is within the page bounds
    if (isInBounds(p)) {
      // Back side coordinate 'p' is valid. Use it for sampling.
      color = texture2D(t, p);
      color.rgb *= 0.9;
    } else {
      // If 'p' is out of bounds, use the original fragment UV.
      color = texture2D(t, vUv);
    }
  }

  gl_FragColor = color;
}