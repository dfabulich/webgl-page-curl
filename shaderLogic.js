const PI = Math.PI;

/**
 * Checks if UV coordinates are within the page bounds [0,1].
 * @param {object} uvCoords - Object with x and y properties.
 * @returns {boolean}
 */
function isInBounds(uvCoords) {
  return uvCoords.x >= 0.0 && uvCoords.x <= 1.0 && uvCoords.y >= 0.0 && uvCoords.y <= 1.0;
}

/**
 * Simulates the core logic of the pageCurl.frag shader.
 * Calculates the final UV coordinates and determines visibility based on curl parameters.
 *
 * @param {object} vUv - Input UV coordinates {x, y} (varying vec2 vUv)
 * @param {number} curlAmount - Animation progress (uniform float curlAmount)
 * @param {number} radius - Curl radius (uniform float radius)
 * @returns {object} Result object: { finalUV: {x, y}, scenario: number, shouldDiscard: boolean }
 */
export function calculateShaderLogic(vUv, curlAmount, radius) {
  // 1. Define Curl Geometry (matches shader)
  const origin = { x: 1.0, y: 0.0 };
  const endPoint = { x: 0.0, y: 1.0 };
  const curlVec = { x: endPoint.x - origin.x, y: endPoint.y - origin.y };
  const hypotenuse = Math.sqrt(curlVec.x * curlVec.x + curlVec.y * curlVec.y);
  const curlDir = { x: curlVec.x / hypotenuse, y: curlVec.y / hypotenuse };

  const curlAxisPos = curlAmount * hypotenuse;

  // 2. Calculate fragment's relationship to the curl axis
  const uvRelOrigin = { x: vUv.x - origin.x, y: vUv.y - origin.y };
  const proj = uvRelOrigin.x * curlDir.x + uvRelOrigin.y * curlDir.y;
  const dist = proj - curlAxisPos;

  let finalUV = { ...vUv };
  let scenario = 0;
  let shouldDiscard = false;
  let calculated = false; // Has a scenario been determined?

  // Check if initial vUv is even within bounds
  if (!isInBounds(vUv)) {
      return { finalUV: finalUV, scenario: 0, shouldDiscard: true };
  }

  // 3. Determine Scenario & Calculate Final UV
  if (dist > radius) {
    // Scenario 1: Ahead of curl, flat part
    scenario = 1;
    finalUV = { ...vUv };
    calculated = true;
    // No discard check needed here as initial bounds check passed
  } else if (dist >= 0.0) {
    // Scenario 2: On the curl
    scenario = 2;
    calculated = true;
    const linePoint = {
      x: vUv.x - dist * curlDir.x,
      y: vUv.y - dist * curlDir.y,
    };
    // Clamp asin input to avoid NaN from floating point errors slightly > 1
    const asinInput = Math.max(-1.0, Math.min(1.0, dist / radius)); 
    const theta = Math.asin(asinInput);

    const p1 = {
      x: linePoint.x + curlDir.x * theta * radius,
      y: linePoint.y + curlDir.y * theta * radius,
    }; // Unrolled front UV
    const p2 = {
      x: linePoint.x + curlDir.x * (PI - theta) * radius,
      y: linePoint.y + curlDir.y * (PI - theta) * radius,
    }; // Unrolled back UV

    const seeingBack = isInBounds(p2);

    if (seeingBack) {
      // Back side is visible - results in transparency (discard visually)
      finalUV = p2;
      // We don't discard here in the logic test, 
      // but the shader would make it transparent.
      // Mark as scenario 2b for testing?
      scenario = 2.1; // Indicate back-face scenario
    } else {
      // Seeing front side
      finalUV = p1;
      if (!isInBounds(finalUV)) {
        // If front UV is out of bounds, discard
        shouldDiscard = true;
      }
    }
  } else {
    // Scenario 3: Behind/Under the curl
    scenario = 3;
    calculated = true;
    finalUV = { ...vUv }; // Uses original UVs for sampling back/next page
    // Shader makes this transparent, so effectively discarded visually
    // but logic-wise, it's valid if vUv is in bounds.
  }
  
  // Final discard check based on shader logic:
  // Discard if it *wasn't* calculated (shouldn't happen due to initial check),
  // OR if it was Scenario 2 (front) and finalUV is out of bounds.
  if (!calculated || (scenario === 2 && shouldDiscard)) {
      shouldDiscard = true;
  }

  return { finalUV, scenario, shouldDiscard };
} 