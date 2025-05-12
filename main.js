import * as THREE from 'three';
import { calculateCurledVertexPosition, calculateFlippedVertexPosition } from './curlMath.js';

// Function to store the original positions from a geometry
function storeOriginalPositions(geometry, logging) {
    const positions = geometry.attributes.position;
    const originalPositions = new Float32Array(positions.count * 3);
    
    for (let i = 0; i < positions.count; i++) {
        originalPositions[i * 3] = positions.getX(i);
        originalPositions[i * 3 + 1] = positions.getY(i);
        originalPositions[i * 3 + 2] = positions.getZ(i);
    }
    
    // Debug: Log first vertex from original store
    if (logging) console.log(`Stored original first vertex: (${originalPositions[0].toFixed(2)}, ${originalPositions[1].toFixed(2)}, ${originalPositions[2].toFixed(2)})`);
    
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
        await curl(htmlContentDiv, blueHTMLBodyContent, {logging: true});
        console.log("Curl complete.");
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
        state.originalVertexPositions = storeOriginalPositions(geometry, state.logging);
    }

    // Verify we have the correct number of originalVertexPositions 
    if (state.originalVertexPositions.length !== positions.count * 3) {
        console.error(`ERROR: originalVertexPositions.length (${state.originalVertexPositions.length}) doesn't match expected (${positions.count * 3}). Regenerating...`);
        state.originalVertexPositions = storeOriginalPositions(geometry, state.logging);
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
    state.renderer.render(state.scene, state.camera);
}

// Animation loop
function animate(state) {
    if (state.done) return;
    // Always request animation frame while animating
    requestAnimationFrame(() => animate(state));

    state.curlAmount += state.animationSpeed;
    if (state.logging) console.log(`curlAmount: ${state.curlAmount}`);

    try {
        updatePageCurl(
            state, 
            state.curlAmount
        );
    } catch (error) {
        state.done = true;
        state.reject(error);
    }

    if (state.curlAmount > state.curlTargetAmount) {
        state.done = true;        
        state.resolve();
    }
}

// Main function to trigger the page curl transition
async function curl(element, nextPageContent, options = {animationSpeed: 0.01, curlTargetAmount: 1.1}) {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    const state = {
        done: false,
        logging: false,
        animationSpeed: 0.01,
        curlTargetAmount: 1.1,
        curlAmount: 0.0,
        scene: null,
        camera: null,
        renderer: null,
        planeMesh: null,
        originalVertexPositions: null,
        resolve: resolve,
        reject: reject
    };
        
    if (options) {
        state.animationSpeed = options.animationSpeed ?? 0.01;
        state.curlTargetAmount = options.curlTargetAmount ?? 1.1;
        state.logging = options.logging ?? false;
    }

    try {
        if (state.logging) console.log("Starting transition...");
        
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
        
        // Create plane for screenshot
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
        state.originalVertexPositions = storeOriginalPositions(state.planeMesh.geometry, state.logging);
                
        // Make canvas visible
        state.renderer.domElement.style.display = 'block';
        
        if (state.logging) console.log("Capturing screenshot from element...");
        const canvas = await html2canvas(element, { 
            useCORS: true, 
            logging: state.logging, 
            width: element.offsetWidth, 
            height: element.offsetHeight, 
            x:0, y:0, 
            scrollX: -element.scrollLeft, 
            scrollY: -element.scrollTop 
        });
        if (state.logging) console.log("Screenshot captured.");

        // 2. Apply screenshot to canvas plane
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        state.planeMesh.material = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: false, 
            side: THREE.DoubleSide
        });
        state.planeMesh.material.opacity = 1;
        if (state.logging) console.log("Screenshot applied to canvas plane.");

        // 3. Switch underlying DOM to next page (it's covered by the canvas)
        element.innerHTML = nextPageContent;
        if (state.logging) console.log("Underlying DOM switched to next page content."); 

        // 4. Start the animation
        animate(state); // Start animation loop
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
        state.originalVertexPositions = null;
        
        if (state.logging) console.log("All resources cleaned up");
    }
}
