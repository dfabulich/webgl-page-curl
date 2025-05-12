import * as THREE from 'three';
import { calculateCurledVertexPosition, calculateFlippedVertexPosition } from './curlMath.js';

// Global variables with limited scope
let scene, camera, renderer;
let planeMesh; // Holds red screenshot
let originalVertexPositions; // Array to store original vertex positions
let isAnimatingRedPlaneOut = false;
let redHTMLBodyContent = '';
let blueHTMLBodyContent = '';

const FRUSTUM_SIZE = 5;
let curlParameters = {
    curlAmount: 0.0, // 0 (flat) to target value (e.g., 1.0 or 1.5 for full curl and move away)
    curlRadius: 0.5, 
    curlAngle: Math.PI / 4, // Angle of the curl axis (45 degrees for bottom-right curl)
    animationSpeed: 0.01,
    curlTargetAmount: 1.1 // Value of curlAmount to consider animation complete
};

// Function to store the original positions from a geometry
function storeOriginalPositions(geometry) {
    const positions = geometry.attributes.position;
    const originalPositions = new Float32Array(positions.count * 3);
    
    for (let i = 0; i < positions.count; i++) {
        originalPositions[i * 3] = positions.getX(i);
        originalPositions[i * 3 + 1] = positions.getY(i);
        originalPositions[i * 3 + 2] = positions.getZ(i);
    }
    
    // Debug: Log first vertex from original store
    console.log(`Stored original first vertex: (${originalPositions[0].toFixed(2)}, ${originalPositions[1].toFixed(2)}, ${originalPositions[2].toFixed(2)})`);
    
    return originalPositions;
}

// Initialize only HTML content, not THREE.js
export async function init() {
    const htmlContentDiv = document.getElementById('html-content');
    try {
        const redResponse = await fetch('red.html');
        if (!redResponse.ok) throw new Error(`HTTP error loading red.html: ${redResponse.status}`);
        redHTMLBodyContent = await redResponse.text().then(text => new DOMParser().parseFromString(text, 'text/html').body.innerHTML);

        const blueResponse = await fetch('blue.html');
        if (!blueResponse.ok) throw new Error(`HTTP error loading blue.html: ${blueResponse.status}`);
        blueHTMLBodyContent = await blueResponse.text().then(text => new DOMParser().parseFromString(text, 'text/html').body.innerHTML);
        
        htmlContentDiv.innerHTML = redHTMLBodyContent;
    } catch (error) {
        console.error("Error loading HTML content:", error);
        htmlContentDiv.innerHTML = '<p style="color:red;">Error loading initial content.</p>';
    }

    // Set up the go function to be called later
    window.go = go;
}

// Handle window resize events
function onWindowResize() {
    if (!camera || !renderer) return; // Exit if THREE.js elements aren't initialized
    
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Create new plane with segments for deformation if planeMesh exists
    if (planeMesh) {
        const newPlaneGeometry = new THREE.PlaneGeometry(FRUSTUM_SIZE * aspect, FRUSTUM_SIZE, 32, 32);
        planeMesh.geometry.dispose();
        planeMesh.geometry = newPlaneGeometry.clone();
        newPlaneGeometry.dispose();
        
        // Store new original positions
        originalVertexPositions = storeOriginalPositions(planeMesh.geometry);
    }
}

// Function to deform the plane geometry for the curl effect
function updatePageCurl(planeMesh, amount, radius, angle) {
    const geometry = planeMesh.geometry;
    const positions = geometry.attributes.position;
    const geomWidth = geometry.parameters.width;
    const geomHeight = geometry.parameters.height;

    // Debug: Check if originalVertexPositions is defined
    if (!originalVertexPositions) {
        console.error("ERROR: originalVertexPositions is undefined! Creating it now...");
        originalVertexPositions = storeOriginalPositions(geometry);
    }

    // Verify we have the correct number of originalVertexPositions 
    if (originalVertexPositions.length !== positions.count * 3) {
        console.error(`ERROR: originalVertexPositions.length (${originalVertexPositions.length}) doesn't match expected (${positions.count * 3}). Regenerating...`);
        originalVertexPositions = storeOriginalPositions(geometry);
    }

    // Use stored original positions for each transformation
    for (let i = 0; i < positions.count; i++) {
        // Read from originalVertexPositions instead of current positions
        const x = originalVertexPositions[i * 3];
        const y = originalVertexPositions[i * 3 + 1];
        const z = originalVertexPositions[i * 3 + 2]; // Usually 0 for a fresh PlaneGeometry
        
        // Apply the curl transformation using our function
        const newPosition = calculateCurledVertexPosition(
            x, y, geomWidth, geomHeight, amount
        );
        
        // Write transformed position back to mesh
        positions.setXYZ(i, newPosition.x, newPosition.y, newPosition.z);
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
}

// Animation loop
function animate() {
    if (!isAnimatingRedPlaneOut) {
        // If not animating, we don't need to keep requesting animation frames
        return;
    }

    requestAnimationFrame(animate);

    if (planeMesh) {
        curlParameters.curlAmount += curlParameters.animationSpeed;
        console.log(`curlParameters.curlAmount: ${curlParameters.curlAmount}`);

        updatePageCurl(
            planeMesh, 
            curlParameters.curlAmount, 
            curlParameters.curlRadius, 
            curlParameters.curlAngle
        );

        if (curlParameters.curlAmount > curlParameters.curlTargetAmount) {
            console.log("Red screenshot curled out. Revealing blue HTML content.");
            if (planeMesh.material.map) planeMesh.material.map.dispose();
            planeMesh.material.dispose();
            scene.remove(planeMesh);
            planeMesh = null; 
            
            // Hide canvas, revealing the underlying blue HTML content
            renderer.domElement.style.display = 'none'; 
            document.getElementById('html-content').innerHTML = blueHTMLBodyContent;
            console.log("Canvas hidden. Revealing final blue HTML content.");

            isAnimatingRedPlaneOut = false;
            
            // Clean up THREE.js resources
            if (renderer) {
                renderer.dispose();
                renderer = null;
            }
            if (scene) {
                scene = null;
            }
            if (camera) {
                camera = null;
            }
            originalVertexPositions = null;
            curlParameters.curlAmount = 0.0; // Reset for next time
        }
    }
    
    if (renderer && renderer.domElement.style.display !== 'none') {
        renderer.render(scene, camera);
    }
}

// Main function to trigger the page curl transition
async function go() {
    if (isAnimatingRedPlaneOut) {
        console.log("Animation already in progress.");
        return;
    }

    const htmlContentDiv = document.getElementById('html-content');
    
    try {
        console.log("Starting transition...");
        
        // Initialize THREE.js components
        scene = new THREE.Scene();
        const aspect = window.innerWidth / window.innerHeight;
        const fov = 75; // Field of View
        camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
        // Adjust camera Z to fit FRUSTUM_SIZE plane in view
        camera.position.z = (FRUSTUM_SIZE / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));

        renderer = new THREE.WebGLRenderer({ alpha: true }); 
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);
        
        // Create plane for red screenshot
        const planeGeometry = new THREE.PlaneGeometry(FRUSTUM_SIZE * aspect, FRUSTUM_SIZE, 32, 32);
        planeMesh = new THREE.Mesh(planeGeometry.clone(), new THREE.MeshBasicMaterial({ 
            transparent: true, 
            opacity: 0,
            side: THREE.DoubleSide
        }));
        planeMesh.position.z = 0; 
        scene.add(planeMesh);
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 2);
        scene.add(directionalLight);
        
        // Store original positions
        originalVertexPositions = storeOriginalPositions(planeMesh.geometry);
        
        // Add window resize event listener
        window.addEventListener('resize', onWindowResize, false);
        
        // Make canvas visible
        renderer.domElement.style.display = 'block';
        
        // 1. Capture red screenshot (from visible html-content)
        htmlContentDiv.innerHTML = redHTMLBodyContent; // Ensure red is showing
        await new Promise(resolve => requestAnimationFrame(resolve)); // Allow DOM to update if needed
        console.log("Capturing red screenshot from #html-content...");
        const redCanvas = await html2canvas(htmlContentDiv, { 
            useCORS: true, 
            logging: true, 
            width: htmlContentDiv.offsetWidth, 
            height: htmlContentDiv.offsetHeight, 
            x:0, y:0, 
            scrollX: -htmlContentDiv.scrollLeft, 
            scrollY: -htmlContentDiv.scrollTop 
        });
        console.log("Red screenshot captured.");

        // 2. Apply red screenshot to canvas plane
        const redTexture = new THREE.CanvasTexture(redCanvas);
        redTexture.needsUpdate = true;
        planeMesh.material = new THREE.MeshBasicMaterial({ 
            map: redTexture, 
            transparent: false, 
            side: THREE.DoubleSide
        });
        planeMesh.material.opacity = 1;
        console.log("Red screenshot applied to canvas plane.");

        // 3. Switch underlying DOM to blue (it's covered by the canvas)
        htmlContentDiv.innerHTML = blueHTMLBodyContent;
        console.log("Underlying DOM switched to blue content."); 

        // 4. Start the animation
        isAnimatingRedPlaneOut = true;
        curlParameters.curlAmount = 0.0; // Reset curl amount
        animate(); // Start animation loop
        
    } catch (error) {
        console.error("Error in go function:", error);
        htmlContentDiv.innerHTML = redHTMLBodyContent; // Restore red content
        if (renderer) renderer.domElement.style.display = 'none'; // Hide canvas on error
        
        // Clean up resources on error
        if (planeMesh && planeMesh.material) {
            if (planeMesh.material.map) planeMesh.material.map.dispose();
            planeMesh.material.dispose();
        }
        if (renderer) renderer.dispose();
    }
} 