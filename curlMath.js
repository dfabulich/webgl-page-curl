export function calculateCurledVertexPosition(originalX, originalY, geomWidth, geomHeight, amount, radius, angle) {
    const halfWidth = geomWidth / 2;
    const halfHeight = geomHeight / 2;
    const curlOriginX = halfWidth;
    const curlOriginY = -halfHeight;

    // 1. Apply universal overall translation first
    const overall_translate_y_factor = 0.70; 
    const overall_translate_x_factor = -0.15; 
    // Optional: a base z-lift for the whole plane as it starts moving
    // const base_z_lift_factor = 0.05;

    let new_x = originalX + amount * geomWidth * overall_translate_x_factor;
    let new_y = originalY + amount * geomHeight * overall_translate_y_factor;
    let new_z = 0; // Initial Z, will be modified by shaping if applicable
    // new_z += amount * geomHeight * base_z_lift_factor; // If adding base_z_lift

    // 2. Calculate additional displacements for shaping the curl
    let dx_for_shape = originalX - curlOriginX;
    let dy_for_shape = originalY - curlOriginY;

    // Rotate to curl-aligned coordinate system for shaping logic
    let x_rotated = dx_for_shape * Math.cos(angle) + dy_for_shape * Math.sin(angle);
    let y_rotated = -dx_for_shape * Math.sin(angle) + dy_for_shape * Math.cos(angle);

    const curlInfluenceLimit = amount * (Math.sqrt(geomWidth * geomWidth + geomHeight * geomHeight) * 0.75);

    if (x_rotated >= 0 && x_rotated < curlInfluenceLimit) {
        let distToCurlLine = x_rotated;
        let y_falloff_distance = Math.abs(y_rotated);
        let curlStrengthFalloff = Math.max(0, 1 - (y_falloff_distance / (geomWidth * 0.5)));

        let delta_x_shape_rotated = 0; // Additional x-offset in rotated coords due to curl shape
        let delta_z_shape = 0;       // Z-offset due to curl shape

        if (curlStrengthFalloff > 0.01) {
            if (distToCurlLine < radius * Math.PI * curlStrengthFalloff) { // Cylindrical part
                let currentRadius = radius * curlStrengthFalloff;
                let theta = distToCurlLine / currentRadius;
                
                let target_x_in_rotated_coords_for_shape = currentRadius * Math.sin(theta);
                delta_x_shape_rotated = target_x_in_rotated_coords_for_shape - x_rotated; // Difference from original projection
                
                delta_z_shape = currentRadius * (1 - Math.cos(theta));
            } else { // Flat lifted part (tangent)
                let currentRadius = radius * curlStrengthFalloff;
                delta_z_shape = 2 * currentRadius; // Max Z lift for this part of the shape
                // No additional x-displacement in rotated coords for simple tangent lift
                delta_x_shape_rotated = 0; 
            }
        }
        
        // Add the specific z-lift that grows with amount (peeling effect)
        delta_z_shape += amount * geomHeight * 0.2;
        new_z += delta_z_shape;

        // Convert the delta_x_shape_rotated (which is along the curl axis in rotated space)
        // back to unrotated coordinate deltas and add them to new_x, new_y.
        // The y-component of this delta in rotated space is 0.
        let additional_dx_unrotated = delta_x_shape_rotated * Math.cos(angle); // cos(-angle) = cos(angle)
        let additional_dy_unrotated = delta_x_shape_rotated * Math.sin(angle); // -sin(-angle) = sin(angle)

        new_x += additional_dx_unrotated;
        new_y += additional_dy_unrotated;
    }
    
    return { x: new_x, y: new_y, z: new_z };
} 