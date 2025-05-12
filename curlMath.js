export function calculateCurledVertexPosition(originalX, originalY, geomWidth, geomHeight, amount) {
    const halfWidth = geomWidth / 2;
    const halfHeight = geomHeight / 2;

    // Define Bottom-Right (BR) and Top-Left (TL) corners in world coordinates
    const br_x = halfWidth;
    const br_y = -halfHeight;
    const tl_x = -halfWidth;
    const tl_y = halfHeight;

    // Vector from BR to TL, defining the roll path
    const vec_br_tl_x = tl_x - br_x; // Should be -geomWidth
    const vec_br_tl_y = tl_y - br_y; // Should be geomHeight

    const H = Math.sqrt(vec_br_tl_x * vec_br_tl_x + vec_br_tl_y * vec_br_tl_y);

    if (H < 0.0001) { // Degenerate plane
        return { x: originalX, y: originalY, z: 0 };
    }

    // Calculate the two radii for the elliptical cylinder
    // We want the circumference to be H, so: 2π√((a² + b²)/2) = H
    // where a and b are the two radii
    // Let's use a ratio of 2:1 for the radii (you can adjust this ratio)
    const radiusRatio = 1/8; // a = 2b
    const R = H / (2 * Math.PI) / 1.0; // Average radius to maintain circumference
    const a = R * Math.sqrt(2 * radiusRatio * radiusRatio / (1 + radiusRatio * radiusRatio)); // Major radius
    const b = a / radiusRatio; // Minor radius

    // Unit vector along the roll path (from BR to TL)
    const path_ux = vec_br_tl_x / H;
    const path_uy = vec_br_tl_y / H;

    // Point relative to BR
    const p_rel_br_x = originalX - br_x;
    const p_rel_br_y = originalY - br_y;

    // Project point onto the roll path to find 'u'
    // u is distance from BR along the path towards TL
    const u = p_rel_br_x * path_ux + p_rel_br_y * path_uy;
    
    // Perpendicular distance from the roll path
    // v is component along (-path_uy, path_ux)
    const v = p_rel_br_x * (-path_uy) + p_rel_br_y * path_ux;

    // How far the cylinder's contact line has progressed along the path
    const u_peel_front = amount * H;

    let final_x = originalX;
    let final_y = originalY;
    let final_z = 0;

    // If u is "behind" or on the peel front, and within the original paper's projection [0, H]
    if (u <= u_peel_front && u >= -0.0001) { // Allow for small floating point inaccuracies for u starting at 0
        // Arc length of paper "sucked" onto the cylinder from this point u to the peel front
        const s_on_cylinder = u_peel_front - u;
        
        let theta = 0;
        if (R > 0.0001) { // Avoid division by zero if H (and thus R) is tiny
            theta = s_on_cylinder / R;
        }

        // For an elliptical cylinder, we need to adjust the z-coordinate based on the angle
        // We'll use the parametric equations for an ellipse:
        // x = a * cos(t)
        // y = b * sin(t)
        // where t is the angle parameter
        const z_deformed = a * (1 - Math.cos(theta)) + b * Math.sin(theta);
        
        // Deformed u-coordinate (position along path after wrapping)
        // For an elliptical cylinder, we need to adjust the u-coordinate as well
        const u_deformed = u_peel_front - (a * Math.sin(theta) - b * (1 - Math.cos(theta)));
        
        // The v-coordinate (distance along cylinder axis) remains 'v'
        const v_deformed = v;

        // Transform (u_deformed, v_deformed) back to world offset from BR
        // u_deformed is along (path_ux, path_uy)
        // v_deformed is along (-path_uy, path_ux)
        const world_dx_from_br = u_deformed * path_ux - v_deformed * path_uy;
        const world_dy_from_br = u_deformed * path_uy + v_deformed * path_ux;
        
        final_x = br_x + world_dx_from_br;
        final_y = br_y + world_dy_from_br;
        final_z = z_deformed;
    }
    // Else (if u > u_peel_front or u significantly < 0), the point is unaffected, uses initial final_x,y,z

    return { x: final_x, y: final_y, z: final_z };
}

export function calculateFlippedVertexPosition(originalX, originalY, geomWidth, geomHeight, amount, i) {
    // amount = 0: 0 degrees rotation
    // amount = 0.5: 90 degrees rotation (PI/2)
    // amount = 1.0: 180 degrees rotation (PI)
    const flip_angle = amount * Math.PI;
    
    // Find the center of the plane geometry
    const centerX = 0; // Assuming the plane's local origin is at its center in Three.js
    
    // Offset the point from the center
    const relativeX = originalX - centerX;
    
    // Standard 2D rotation formulas around Y-axis through the center
    // For a point (x, z) rotating around center by angle A:
    // x' = x * cos(A) - z * sin(A)
    // z' = x * sin(A) + z * cos(A)
    const rotatedX = relativeX * Math.cos(flip_angle);
    const rotatedZ = relativeX * Math.sin(flip_angle);
    
    // Then translate back to world-space
    const new_x = rotatedX + centerX;
    const new_y = originalY; // Y is the axis of rotation, so it doesn't change
    const new_z = rotatedZ;

    if (i == 0) {
        //console.log(`originalX: ${originalX}, originalY: ${originalY}, new_x: ${new_x}, new_y: ${new_y}, new_z: ${new_z}`);
    }
    
    return { x: new_x, y: new_y, z: new_z };
} 