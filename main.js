import * as THREE from 'three';
import { calculateCurledVertexPosition } from './curlMath.js';

        let scene, camera, renderer;
        let planeMesh; // Holds red screenshot
        let blueScreenshotPlaneMesh; // Holds blue screenshot

        let redHTMLBodyContent = '';
        let blueHTMLBodyContent = '';

        const FRUSTUM_SIZE = 5; 
        let isAnimatingRedPlaneOut = false;

        let curlParameters = {
            curlAmount: 0.0, // 0 (flat) to target value (e.g., 1.0 or 1.5 for full curl and move away)
            curlRadius: 0.5, 
            curlAngle: Math.PI / 4, // Angle of the curl axis (45 degrees for bottom-right curl)
            animationSpeed: 0.001,
            curlTargetAmount: 1.0 // Value of curlAmount to consider animation complete
        };

        export async function init() { // Added export
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

            scene = new THREE.Scene();
            const aspect = window.innerWidth / window.innerHeight;
            const fov = 75; // Field of View
            camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
            // Adjust camera Z to fit FRUSTUM_SIZE plane in view
            camera.position.z = (FRUSTUM_SIZE / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));

            renderer = new THREE.WebGLRenderer({ alpha: true }); 
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement); // Canvas is now always in DOM, styled by CSS to overlay

            const planeGeometry = new THREE.PlaneGeometry(FRUSTUM_SIZE * aspect, FRUSTUM_SIZE);
            
            planeMesh = new THREE.Mesh(planeGeometry.clone(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
            planeMesh.position.z = 0; 
            scene.add(planeMesh);

            blueScreenshotPlaneMesh = new THREE.Mesh(planeGeometry.clone(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
            blueScreenshotPlaneMesh.position.z = -0.05; 
            scene.add(blueScreenshotPlaneMesh);

            // Add lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(1, 1, 2);
            scene.add(directionalLight);

            window.addEventListener('resize', onWindowResize, false);

            window.go = async function() {
                if (isAnimatingRedPlaneOut) {
                    console.log("Animation already in progress.");
                    return;
                }
                if (!planeMesh || !blueScreenshotPlaneMesh) {
                    console.error("Critical screenshot planes not found. Re-initializing might be needed.");
                    return;
                }

                renderer.domElement.style.display = 'block'; // Ensure canvas is visible for the transition

                const htmlContentDiv = document.getElementById('html-content');

                try {
                    console.log("Starting transition...");

                    // 1. Capture red screenshot (from visible html-content)
                    htmlContentDiv.innerHTML = redHTMLBodyContent; // Ensure red is showing
                    await new Promise(resolve => requestAnimationFrame(resolve)); // Allow DOM to update if it was blue
                    console.log("Capturing red screenshot from #html-content...");
                    const redCanvas = await html2canvas(htmlContentDiv, { useCORS: true, logging: true, width: htmlContentDiv.offsetWidth, height: htmlContentDiv.offsetHeight, x:0, y:0, scrollX: -htmlContentDiv.scrollLeft, scrollY: -htmlContentDiv.scrollTop });
                    console.log("Red screenshot captured.");

                    // 2. Apply red screenshot to front canvas plane (makes canvas opaque with red content)
                    if (planeMesh.material.map) planeMesh.material.map.dispose();
                    planeMesh.material.dispose();
                    const redTexture = new THREE.CanvasTexture(redCanvas);
                    redTexture.needsUpdate = true;
                    planeMesh.material = new THREE.MeshStandardMaterial({ 
                        map: redTexture, 
                        transparent: true, 
                        metalness: 0.2, 
                        roughness: 0.8 
                    });
                    planeMesh.material.opacity = 1;
                    planeMesh.position.y = 0; 
                    console.log("Red screenshot applied to canvas plane with StandardMaterial.");

                    // 3. Switch underlying DOM to blue & capture blue screenshot (DOM is covered by canvas)
                    htmlContentDiv.innerHTML = blueHTMLBodyContent;
                    await new Promise(resolve => requestAnimationFrame(resolve)); 
                    console.log("Capturing blue screenshot from #html-content (now blue, but covered)...");
                    const blueCanvas = await html2canvas(htmlContentDiv, { useCORS: true, logging: true, width: htmlContentDiv.offsetWidth, height: htmlContentDiv.offsetHeight, x:0, y:0, scrollX: -htmlContentDiv.scrollLeft, scrollY: -htmlContentDiv.scrollTop });
                    console.log("Blue screenshot captured.");
                     const blueDataURL = blueCanvas.toDataURL('image/png'); // Keep this for debugging for a bit
                    console.log(`DEBUG: blueCanvas data URL length: ${blueDataURL.length}`);

                    // 4. Apply blue screenshot to back canvas plane
                    if (blueScreenshotPlaneMesh.material.map) blueScreenshotPlaneMesh.material.map.dispose();
                    blueScreenshotPlaneMesh.material.dispose();
                    const blueTexture = new THREE.CanvasTexture(blueCanvas);
                    blueTexture.needsUpdate = true;
                    blueScreenshotPlaneMesh.material = new THREE.MeshBasicMaterial({ map: blueTexture, transparent: true });
                    blueScreenshotPlaneMesh.material.opacity = 1;
                    console.log("Blue screenshot applied to canvas back plane.");
                                        
                    // 5. Animate red screenshot plane away
                    onWindowResize(); 
                    isAnimatingRedPlaneOut = true;
                    console.log("Starting red screenshot animation.");

                } catch (error) {
                    console.error("Error in go function:", error);
                    htmlContentDiv.innerHTML = redHTMLBodyContent; // Restore red content
                    renderer.domElement.style.display = 'none'; // Hide canvas on error
                }
            };

            animate();
        }

        function onWindowResize() {
            const aspect = window.innerWidth / window.innerHeight;
            const fov = 75; // Ensure this matches init if used for z-calculation
            camera.aspect = aspect;
            // If fov or FRUSTUM_SIZE changes, camera.position.z might need re-evaluation here too
            // camera.position.z = (FRUSTUM_SIZE / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
            camera.updateProjectionMatrix();

            renderer.setSize(window.innerWidth, window.innerHeight);

            // Ensure new planes are created with segments for deformation
            const newPlaneGeometry = new THREE.PlaneGeometry(FRUSTUM_SIZE * aspect, FRUSTUM_SIZE, 32, 32);
            if (planeMesh) {
                planeMesh.geometry.dispose();
                planeMesh.geometry = newPlaneGeometry.clone();
            }
            if (blueScreenshotPlaneMesh) {
                blueScreenshotPlaneMesh.geometry.dispose();
                blueScreenshotPlaneMesh.geometry = newPlaneGeometry.clone();
            }
            newPlaneGeometry.dispose();
        }

        // Function to deform the plane geometry for the curl effect
        function updatePageCurl(geometry, amount, radius, angle) {
            const positions = geometry.attributes.position;
            const vertex = new THREE.Vector3();
            const geomWidth = geometry.parameters.width;
            const geomHeight = geometry.parameters.height;

            for (let i = 0; i < positions.count; i++) {
                vertex.fromBufferAttribute(positions, i); // Get original x, y (z is implicitly 0 for fresh plane)
                
                const newPosition = calculateCurledVertexPosition(
                    vertex.x, 
                    vertex.y, 
                    geomWidth, 
                    geomHeight, 
                    amount, 
                    radius, 
                    angle
                );
                
                positions.setXYZ(i, newPosition.x, newPosition.y, newPosition.z);
            }
            positions.needsUpdate = true;
            geometry.computeVertexNormals();
        }

        function animate() {
            requestAnimationFrame(animate);

            if (isAnimatingRedPlaneOut && planeMesh) {
                curlParameters.curlAmount += curlParameters.animationSpeed;
                console.log(`curlParameters.curlAmount: ${curlParameters.curlAmount}`);

                updatePageCurl(
                    planeMesh.geometry, 
                    curlParameters.curlAmount, 
                    curlParameters.curlRadius, 
                    curlParameters.curlAngle
                );

                if (curlParameters.curlAmount > curlParameters.curlTargetAmount) {
                    console.log("Red screenshot curled out. Blue screenshot plane is visible on canvas.");
                    if (planeMesh.material.map) planeMesh.material.map.dispose();
                    planeMesh.material.dispose();
                    scene.remove(planeMesh);
                    planeMesh = null; 
                    
                    // Hide canvas, revealing the underlying blue HTML content
                    renderer.domElement.style.display = 'none'; 
                    document.getElementById('html-content').innerHTML = blueHTMLBodyContent; // Ensure blue is set if not already
                    console.log("Canvas hidden. Switched to final blue HTML content.");

                    if (blueScreenshotPlaneMesh) {
                        if (blueScreenshotPlaneMesh.material.map) blueScreenshotPlaneMesh.material.map.dispose();
                        blueScreenshotPlaneMesh.material.dispose();
                        scene.remove(blueScreenshotPlaneMesh);
                        blueScreenshotPlaneMesh = null;
                    }
                    isAnimatingRedPlaneOut = false;
                    curlParameters.curlAmount = 0.0; // Reset for next time

                    // Prepare for next transition: re-create planes if they were nulled
                    // This might be better done at the start of go() or by not nulling them but just hiding/making transparent
                    const aspect = window.innerWidth / window.innerHeight;
                    const planeGeometry = new THREE.PlaneGeometry(FRUSTUM_SIZE * aspect, FRUSTUM_SIZE, 32, 32);
                    planeMesh = new THREE.Mesh(planeGeometry.clone(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
                    planeMesh.position.z = 0;
                    scene.add(planeMesh);

                    blueScreenshotPlaneMesh = new THREE.Mesh(planeGeometry.clone(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
                    blueScreenshotPlaneMesh.position.z = -0.05;
                    scene.add(blueScreenshotPlaneMesh);
                    // planeGeometry.dispose(); // Disposing the template geometry
                }
            }
            if (renderer.domElement.style.display !== 'none') { // Only render if canvas is visible
                 renderer.render(scene, camera);
            }
        }

        // init(); // Removed from here, will be called from x.html 