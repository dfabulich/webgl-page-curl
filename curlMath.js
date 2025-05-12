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

    const R = H / (2 * Math.PI); // Cylinder radius

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

        // Deformed u-coordinate (position along path after wrapping)
        // Stays at u_peel_front if R=0, otherwise moves back by R*sin(theta)
        const u_deformed = u_peel_front - (R > 0.0001 ? R * Math.sin(theta) : 0);
        // Deformed z-coordinate (height due to wrapping)
        const z_deformed = (R > 0.0001 ? R * (1 - Math.cos(theta)) : 0);
        
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