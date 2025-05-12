import * as THREE from 'three';
import { calculateCurledVertexPosition, calculateFlippedVertexPosition } from './curlMath.js';

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
    let redHTMLBodyContent = '';
    let blueHTMLBodyContent = '';
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
    window.go = async () => {
        return curl(htmlContentDiv, blueHTMLBodyContent);
    }
}

// Handle window resize events
function onWindowResize(state) {
    if (!state.camera || !state.renderer) return; // Exit if THREE.js elements aren't initialized
    
    const aspect = window.innerWidth / window.innerHeight;
    state.camera.aspect = aspect;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(window.innerWidth, window.innerHeight);

    // Create new plane with segments for deformation if planeMesh exists
    if (state.planeMesh) {
        const newPlaneGeometry = new THREE.PlaneGeometry(FRUSTUM_SIZE * aspect, FRUSTUM_SIZE, 32, 32);
        state.planeMesh.geometry.dispose();
        state.planeMesh.geometry = newPlaneGeometry.clone();
        newPlaneGeometry.dispose();
        
        // Store new original positions
        state.originalVertexPositions = storeOriginalPositions(state.planeMesh.geometry);
    }
}

// Function to deform the plane geometry for the curl effect
function updatePageCurl(state, amount) {
    const geometry = state.planeMesh.geometry;
    const positions = geometry.attributes.position;
    const geomWidth = geometry.parameters.width;
    const geomHeight = geometry.parameters.height;

    // Debug: Check if originalVertexPositions is defined
    if (!state.originalVertexPositions) {
        console.error("ERROR: originalVertexPositions is undefined! Creating it now...");
        state.originalVertexPositions = storeOriginalPositions(geometry);
    }

    // Verify we have the correct number of originalVertexPositions 
    if (state.originalVertexPositions.length !== positions.count * 3) {
        console.error(`ERROR: originalVertexPositions.length (${state.originalVertexPositions.length}) doesn't match expected (${positions.count * 3}). Regenerating...`);
        state.originalVertexPositions = storeOriginalPositions(geometry);
    }

    // Use stored original positions for each transformation
    for (let i = 0; i < positions.count; i++) {
        // Read from originalVertexPositions instead of current positions
        const x = state.originalVertexPositions[i * 3];
        const y = state.originalVertexPositions[i * 3 + 1];
        const z = state.originalVertexPositions[i * 3 + 2]; // Usually 0 for a fresh PlaneGeometry
        
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
function animate(state) {
    // Always request animation frame while animating
    requestAnimationFrame(() => animate(state));

    if (state.planeMesh) {
        state.curlAmount += state.animationSpeed;
        console.log(`curlAmount: ${state.curlAmount}`);

        updatePageCurl(
            state, 
            state.curlAmount
        );

        if (state.curlAmount > state.curlTargetAmount) {
            console.log("Red screenshot curled out. Revealing blue HTML content.");
            if (state.planeMesh.material.map) state.planeMesh.material.map.dispose();
            state.planeMesh.material.dispose();
            state.scene.remove(state.planeMesh);
            state.planeMesh = null; 
            
            // Hide canvas, revealing the underlying blue HTML content
            state.renderer.domElement.style.display = 'none'; 
            console.log("Canvas hidden. Revealing final blue HTML content.");

            // Stop animation by removing planeMesh
            
            // Clean up THREE.js resources
            if (state.renderer) {
                state.renderer.dispose();
                state.renderer = null;
            }
            if (state.scene) {
                state.scene = null;
            }
            if (state.camera) {
                state.camera = null;
            }
            state.originalVertexPositions = null;
        }
    }
    
    if (state.renderer && state.renderer.domElement.style.display !== 'none') {
        state.renderer.render(state.scene, state.camera);
    }
}

// Main function to trigger the page curl transition
async function curl(htmlContentDiv, nextPageContent, options = {animationSpeed: 0.01, curlTargetAmount: 1.1}) {
    const state = {
        animationSpeed: 0.01,
        curlTargetAmount: 1.1,
        curlAmount: 0.0,
        scene: null,
        camera: null,
        renderer: null,
        planeMesh: null,
        originalVertexPositions: null
    };
    
    if (options) {
        state.animationSpeed = options.animationSpeed ?? 0.01;
        state.curlTargetAmount = options.curlTargetAmount ?? 1.1;
    }

    try {
        console.log("Starting transition...");
        
        // Initialize THREE.js components
        state.scene = new THREE.Scene();
        const aspect = window.innerWidth / window.innerHeight;
        const fov = 75; // Field of View
        const FRUSTUM_SIZE = 5;
        state.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
        // Adjust camera Z to fit FRUSTUM_SIZE plane in view
        state.camera.position.z = (FRUSTUM_SIZE / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));

        state.renderer = new THREE.WebGLRenderer({ alpha: true }); 
        state.renderer.setPixelRatio(window.devicePixelRatio);
        state.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(state.renderer.domElement);
        
        // Create plane for red screenshot
        const planeGeometry = new THREE.PlaneGeometry(FRUSTUM_SIZE * aspect, FRUSTUM_SIZE, 32, 32);
        state.planeMesh = new THREE.Mesh(planeGeometry.clone(), new THREE.MeshBasicMaterial({ 
            transparent: true, 
            opacity: 0,
            side: THREE.DoubleSide
        }));
        state.planeMesh.position.z = 0; 
        state.scene.add(state.planeMesh);
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        state.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 2);
        state.scene.add(directionalLight);
        
        // Store original positions
        state.originalVertexPositions = storeOriginalPositions(state.planeMesh.geometry);
        
        // Add window resize event listener
        window.addEventListener('resize', () => onWindowResize(state), false);
        
        // Make canvas visible
        state.renderer.domElement.style.display = 'block';
        
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
        state.planeMesh.material = new THREE.MeshBasicMaterial({ 
            map: redTexture, 
            transparent: false, 
            side: THREE.DoubleSide
        });
        state.planeMesh.material.opacity = 1;
        console.log("Red screenshot applied to canvas plane.");

        // 3. Switch underlying DOM to blue (it's covered by the canvas)
        htmlContentDiv.innerHTML = nextPageContent;
        console.log("Underlying DOM switched to blue content."); 

        // 4. Start the animation
        animate(state); // Start animation loop
        
    } catch (error) {
        console.error("Error in curl function:", error);
        if (state.renderer) state.renderer.domElement.style.display = 'none'; // Hide canvas on error
        
        // Clean up resources on error
        if (state.planeMesh && state.planeMesh.material) {
            if (state.planeMesh.material.map) state.planeMesh.material.map.dispose();
            state.planeMesh.material.dispose();
        }
        if (state.renderer) state.renderer.dispose();
    }
} 