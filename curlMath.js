export function calculateCurledVertexPosition(originalX, originalY, geomWidth, geomHeight, amount, radius, angle) {
    const halfWidth = geomWidth / 2;
    const halfHeight = geomHeight / 2;
    const curlOriginX = halfWidth;
    const curlOriginY = -halfHeight;

    let new_x = originalX;
    let new_y = originalY;
    let new_z = 0; // Assuming plane starts flat at z=0 in its local space

    let dx = originalX - curlOriginX;
    let dy = originalY - curlOriginY;

    let x_rotated = dx * Math.cos(angle) + dy * Math.sin(angle);
    let y_rotated = -dx * Math.sin(angle) + dy * Math.cos(angle);

    const curlInfluenceLimit = amount * (Math.sqrt(geomWidth * geomWidth + geomHeight * geomHeight) * 0.75);

    if (x_rotated > 0 && x_rotated < curlInfluenceLimit) {
        let distToCurlLine = x_rotated;
        let y_falloff_distance = Math.abs(y_rotated);
        let curlStrengthFalloff = Math.max(0, 1 - (y_falloff_distance / (geomWidth * 0.5)));

        if (distToCurlLine < radius * Math.PI * curlStrengthFalloff) {
            if (curlStrengthFalloff > 0.01) {
                let currentRadius = radius * curlStrengthFalloff;
                let theta = distToCurlLine / currentRadius;
                let curled_x_rotated = currentRadius * Math.sin(theta);
                let curled_z_rotated = currentRadius * (1 - Math.cos(theta));
                curled_z_rotated += amount * geomHeight * 0.2; 

                new_x = (curled_x_rotated * Math.cos(-angle) + y_rotated * Math.sin(-angle)) + curlOriginX;
                new_y = (-curled_x_rotated * Math.sin(-angle) + y_rotated * Math.cos(-angle)) + curlOriginY;
                new_z = curled_z_rotated;
            }
        } else if (curlStrengthFalloff > 0.01) {
            let currentRadius = radius * curlStrengthFalloff;
            let lifted_z = 2 * currentRadius;
            lifted_z += amount * geomHeight * 0.2; 
            let tangent_extension = distToCurlLine - (radius * Math.PI * curlStrengthFalloff);
            let curled_x_rotated = currentRadius * Math.sin(Math.PI) + tangent_extension;
            new_x = (curled_x_rotated * Math.cos(-angle) + y_rotated * Math.sin(-angle)) + curlOriginX;
            new_y = (-curled_x_rotated * Math.sin(-angle) + y_rotated * Math.cos(-angle)) + curlOriginY;
            new_z = lifted_z;
        }
    }
    return { x: new_x, y: new_y, z: new_z };
} 