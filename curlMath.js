export function calculateCurledVertexPosition(originalX, originalY, geomWidth, geomHeight, amount, radius, angle) {
    const halfWidth = geomWidth / 2;
    const halfHeight = geomHeight / 2;
    const curlOriginX = halfWidth;
    const curlOriginY = -halfHeight;

    let final_x = originalX;
    let final_y = originalY;
    let final_z = 0; 

    let dx = originalX - curlOriginX;
    let dy = originalY - curlOriginY;

    let x_rotated = dx * Math.cos(angle) + dy * Math.sin(angle);
    let y_rotated = -dx * Math.sin(angle) + dy * Math.cos(angle);

    const curlInfluenceLimit = amount * (Math.sqrt(geomWidth * geomWidth + geomHeight * geomHeight) * 0.75);

    if (x_rotated >= 0 && x_rotated < curlInfluenceLimit) {
        let distToCurlLine = x_rotated;
        let y_falloff_distance = Math.abs(y_rotated);
        let curlStrengthFalloff = Math.max(0, 1 - (y_falloff_distance / (geomWidth * 0.5)));

        let shaped_x_component_in_rotated_coords = 0;
        let shaped_z_component_in_rotated_coords = 0;

        if (curlStrengthFalloff > 0.01) {
            if (distToCurlLine < radius * Math.PI * curlStrengthFalloff) { 
                let currentRadius = radius * curlStrengthFalloff;
                let theta = distToCurlLine / currentRadius;
                shaped_x_component_in_rotated_coords = currentRadius * Math.sin(theta);
                shaped_z_component_in_rotated_coords = currentRadius * (1 - Math.cos(theta));
            } else { 
                let currentRadius = radius * curlStrengthFalloff;
                shaped_z_component_in_rotated_coords = 2 * currentRadius;
                let tangent_extension = distToCurlLine - (radius * Math.PI * curlStrengthFalloff);
                shaped_x_component_in_rotated_coords = tangent_extension; 
            }
        }
        
        const z_lift_from_amount = amount * geomHeight * 0.2;
        shaped_z_component_in_rotated_coords += z_lift_from_amount;

        let pos_x_unrotated = shaped_x_component_in_rotated_coords * Math.cos(-angle) + y_rotated * Math.sin(-angle);
        let pos_y_unrotated = -shaped_x_component_in_rotated_coords * Math.sin(-angle) + y_rotated * Math.cos(-angle);

        final_x = pos_x_unrotated + curlOriginX;
        final_y = pos_y_unrotated + curlOriginY;
        final_z = shaped_z_component_in_rotated_coords;

        const overall_translate_y_factor = 0.70; 
        const overall_translate_x_factor = -0.15; 

        final_x += amount * geomWidth * overall_translate_x_factor;
        final_y += amount * geomHeight * overall_translate_y_factor;
    }
    return { x: final_x, y: final_y, z: final_z };
} 