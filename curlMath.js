/* This function calculates the new position of a vertex on a plane during a page curl transition.
In this implementation, we're wrapping the plane around an elliptical cylinder, rolling up from the
bottom-right corner of the plane towards the top-left corner, traveling along the
hypotenuse of the plane.

Initially, the cylinder picks up the bottom-right corner of the plane, which begins
rolling with the cylinder towards the top-left corner. At amount = 1, the cylinder
has rolled up to the top-left corner, and the bottom-right corner is now at the
top-left corner.
*/
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

    const hypotenuse = Math.sqrt(vec_br_tl_x * vec_br_tl_x + vec_br_tl_y * vec_br_tl_y);

    if (hypotenuse < 0.0001) { // Degenerate plane
        return { x: originalX, y: originalY, z: 0 };
    }

    // Calculate the two radii for the elliptical cylinder
    // We want the circumference to be equal to the hypotenuse, so: 2π√((a² + b²)/2) = H
    // where a and b are the two radii
    const radiusRatio = 1/8;
    const averageRadius = hypotenuse / (2 * Math.PI) / 1.0; // Average radius to maintain circumference
    const a = averageRadius * Math.sqrt(2 * radiusRatio * radiusRatio / (1 + radiusRatio * radiusRatio)); // Major radius
    const b = a / radiusRatio; // Minor radius

    // Unit vector along the roll path (from BR to TL)
    const path_ux = vec_br_tl_x / hypotenuse;
    const path_uy = vec_br_tl_y / hypotenuse;

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
    const u_peel_front = amount * hypotenuse;

    let final_x = originalX;
    let final_y = originalY;
    let final_z = 0;

    // If u is "behind" or on the peel front, and within the original paper's projection [0, H]
    if (u <= u_peel_front && u >= -0.0001) { // Allow for small floating point inaccuracies for u starting at 0
        // Arc length of paper "sucked" onto the cylinder from this point u to the peel front
        const s_on_cylinder = u_peel_front - u;
        
        let theta = 0;
        if (averageRadius > 0.0001) { // Avoid division by zero if H (and thus R) is tiny
            theta = s_on_cylinder / averageRadius;
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
