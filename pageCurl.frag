#define PI 3.14159265359

uniform vec2 resolution;      // Viewport resolution
uniform float curlAmount;     // Animation progress (0.0 to 1.0+)
uniform float radius;         // Curl radius
uniform sampler2D frontTexture; // Texture for the front of the page

varying vec2 vUv; // UV coordinates from vertex shader ([0,1] range)

// Function to check if UV coordinates are within the page bounds [0,1]
bool isInBounds(vec2 uvCoords) {
    return uvCoords.x >= 0.0 && uvCoords.x <= 1.0 && uvCoords.y >= 0.0 && uvCoords.y <= 1.0;
}

void main() {
    // 1. Define Curl Geometry based on standard [0,1] UVs
    vec2 origin = vec2(1.0, 0.0);        // Bottom-Right corner
    vec2 endPoint = vec2(0.0, 1.0);      // Top-Left corner
    vec2 curlDir = normalize(endPoint - origin);
    float hypotenuse = length(endPoint - origin);

    // Map curlAmount (0 to 1+) to the distance the axis travels
    float curlAxisPos = curlAmount * hypotenuse; 

    // 2. Calculate fragment's relationship to the curl axis
    float proj = dot(vUv - origin, curlDir); // Fragment's projection onto curlDir
    float dist = proj - curlAxisPos;         // Fragment's perpendicular distance from axis

    vec2 finalUV = vUv;
    vec4 color = vec4(0.0); // Default to transparent black
    bool isCurlZone = false;
    bool calculatedColor = false; // Flag to track if color has been set

    // 3. Determine Scenario & Calculate Final UV / Color
    if (dist > radius) {
        // Scenario 1: Ahead of curl, flat part
        finalUV = vUv;
        if (isInBounds(finalUV)) {
          color = texture2D(frontTexture, finalUV);
          calculatedColor = true;
        }
    } else if (dist >= 0.0) {
        // Scenario 2: On the curl
        isCurlZone = true;
        vec2 linePoint = vUv - dist * curlDir; // Point on axis closest to fragment
        float theta = asin(dist / radius);

        vec2 p1 = linePoint + curlDir * theta * radius; // Unrolled front UV
        vec2 p2 = linePoint + curlDir * (PI - theta) * radius; // Unrolled back UV

        // Check if the *back* position is valid to decide visibility
        bool seeingBack = isInBounds(p2);

        if (seeingBack) {
            // Back side is visible - make it transparent
            color = vec4(0.0);
            calculatedColor = true;
            finalUV = p2; // Still need finalUV for bounds check later
        } else {
            // Seeing front side
            finalUV = p1;
            if (isInBounds(finalUV)) {
              color = texture2D(frontTexture, finalUV);
              // Add shading based on curl angle (theta) to simulate curvature
              float light = 0.7 + 0.3 * cos(theta); // Simple lighting model
              color.rgb *= light;
              calculatedColor = true;
            } else {
              // If front UV is out of bounds, make transparent
              color = vec4(0.0);
              calculatedColor = true;
            }
        }

    } else {
        // Scenario 3: Behind/Under the curl - make it transparent
        isCurlZone = true;
        finalUV = vUv; // Use original UV for bounds check consistency
        color = vec4(0.0);
        calculatedColor = true;
    }

    // Discard fragment if it wasn't explicitly calculated (e.g., outside initial bounds)
    // or if it's in the curl zone but its calculated finalUV is out of bounds (unless it was the back/underneath part made transparent)
    if (!calculatedColor || (isCurlZone && !isInBounds(finalUV) && color.a != 0.0)) {
       discard; 
    }

    gl_FragColor = color;
} 