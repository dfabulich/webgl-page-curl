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
        
        const newPosition = calculateCurledVertexPosition(
            x, y, geomWidth, geomHeight, amount
        );
        
        positions.setXYZ(i, newPosition.x, newPosition.y, newPosition.z);
    }
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    state.renderer.render(state.scene, state.camera);
}

// Animation loop
function animate(state) {
    if (state.done) return;
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

export async function curl(element, nextPageContent, options = {animationSpeed: 0.01, curlTargetAmount: 1.1}) {
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

        const parentElement = element.parentElement;
        if (parentElement !== document.body && window.getComputedStyle(parentElement).position !== 'relative') {
            throw new Error("Parent element must have position: relative. The curl animation will be appended to the parent element with absolute positioning, relative to the parent element.");
        }
        
        const rect = parentElement.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const aspect = width / height;
        
        if (state.logging) console.log({width, height, aspect});

        state.scene = new THREE.Scene();
        const fov = 75; // Field of View
        const FRUSTUM_SIZE = 5;
        state.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
        // Adjust camera Z to fit FRUSTUM_SIZE plane in view
        state.camera.position.z = (FRUSTUM_SIZE / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));

        state.renderer = new THREE.WebGLRenderer({ alpha: true }); 
        state.renderer.setPixelRatio(window.devicePixelRatio);
        state.renderer.setSize(width, height);
        parentElement.appendChild(state.renderer.domElement);
        
        // Style the canvas element
        const canvasElement = state.renderer.domElement;
        
        // Calculate appropriate z-index
        const elementZIndex = parseInt(window.getComputedStyle(element).zIndex) || 0;
        const canvasZIndex = isNaN(elementZIndex) ? 2 : elementZIndex + 1;
        
        // Set all necessary styles directly on canvas to position it exactly over the element
        Object.assign(canvasElement.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: `${width}px`,
            height: `${height}px`,
            zIndex: canvasZIndex.toString(),
            pointerEvents: 'none', // Allow clicks to pass through
            backgroundColor: 'transparent'
        });
        
        // Create plane for screenshot with element's aspect ratio
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
        const canvas = await html2canvas(element.parentElement, { 
            useCORS: true, 
            logging: state.logging, 
            width: element.parentElement.offsetWidth, 
            height: element.parentElement.offsetHeight, 
            x:0, y:0, 
            scrollX: -element.parentElement.scrollLeft, 
            scrollY: -element.parentElement.scrollTop 
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
        if (1) return;
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
