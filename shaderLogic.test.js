import { describe, it, expect } from 'vitest';
import { calculateShaderLogic } from './shaderLogic.js';

const defaultRadius = 0.2;
const hypotenuse = Math.sqrt(2); // length(vec2(0,1) - vec2(1,0))

// Helper to call calculateShaderLogic with default radius
function calculate(vUv, curlAmount, radius = defaultRadius) {
  return calculateShaderLogic(vUv, curlAmount, radius);
}

describe('calculateShaderLogic', () => {
  it('should return scenario 1 for points ahead of the curl', () => {
    const vUv = { x: 0.5, y: 0.5 };
    // proj for (0.5, 0.5) is 0.7071
    // curlAxisPos = 0.1 * 1.414 = 0.1414
    // dist = 0.7071 - 0.1414 = 0.5657
    // dist > radius (0.2), so scenario 1 is correct
    const curlAmount = 0.1; 
    const result = calculate(vUv, curlAmount);
    expect(result.scenario).toBe(1);
    expect(result.finalUV).toEqual(vUv);
    expect(result.shouldDiscard).toBe(false);
  });

  it('should return scenario 3 for points behind the curl axis', () => {
    const vUv = { x: 0.9, y: 0.1 }; // Point near bottom-right
    // proj for (0.9, 0.1) is 0.1414
    // curlAxisPos = 0.5 * 1.414 = 0.7071
    // dist = 0.1414 - 0.7071 = -0.5657
    // dist < 0, so scenario 3 is correct
    const curlAmount = 0.5; 
    const result = calculate(vUv, curlAmount);
    expect(result.scenario).toBe(3);
    expect(result.finalUV).toEqual(vUv); // Scenario 3 uses original UV
    expect(result.shouldDiscard).toBe(false); // Shader makes it transparent, logic doesn't discard
  });

  it('should discard points initially outside the [0,1] bounds', () => {
    const vUv = { x: -0.1, y: 0.5 }; 
    const curlAmount = 0.5;
    const result = calculate(vUv, curlAmount);
    expect(result.shouldDiscard).toBe(true);
  });
  
  it('should return scenario 2.1 (back) for points that map to in-bounds p2', () => {
    // This test case previously expected scenario 2, but calculated p2 is in bounds.
    const vUv = { x: 0.5, y: 0.5 }; 
    const radius = 0.1;
    const curlAmount = 0.46;
    const result = calculate(vUv, curlAmount, radius);
    
    // Log p2 for verification
    // Calculated p2: (0.3604, 0.6396)
    // console.log(`Scenario 2.1 Test: p2=(${result.finalUV.x.toFixed(4)}, ${result.finalUV.y.toFixed(4)})`);

    expect(result.scenario).toBe(2.1); // Expect back-face scenario because p2 is in bounds
    expect(result.finalUV.x).not.toBeCloseTo(vUv.x); 
    expect(result.finalUV.y).not.toBeCloseTo(vUv.y);
    expect(isInBounds(result.finalUV)).toBe(true); // Verify finalUV (p2) is in bounds
    expect(result.shouldDiscard).toBe(false); 
  });

  it('should return scenario 2 (front) for points where p2 is out of bounds', () => {
    // This test case previously expected scenario 2.1, but calculated p2 is out of bounds.
    const vUv = { x: 0.1, y: 0.9 };
    const radius = 0.2;
    const curlAmount = 0.83; 
    const result = calculate(vUv, curlAmount, radius);
    
    // Log p1 and p2 for verification
    // Calculated p2: (-0.2011, 1.2011) -> Out of bounds
    // We need to verify p1 IS in bounds.
    // p1 for this case is approx (0.097, 0.903) with clamp
    // console.log(`Scenario 2 Test: p2=(${p2.x...}), p1=(${result.finalUV.x.toFixed(4)}, ${result.finalUV.y.toFixed(4)})`);

    expect(result.scenario).toBe(2); // Expect front-face scenario because p2 is out of bounds
    expect(result.finalUV.x).not.toBe(vUv.x); // Check for exact inequality 
    expect(result.finalUV.y).not.toBe(vUv.y); // Check for exact inequality
    expect(isInBounds(result.finalUV)).toBe(true); // Verify finalUV (p1) is in bounds
    expect(result.shouldDiscard).toBe(false); 
  });

  it('should return scenario 2.1 (back) and not discard when p1 might be out of bounds but p2 is in bounds', () => {
    // This test case previously expected scenario 2 and discard=true, but p2 is in bounds.
    const vUv = { x: 0.9, y: 0.1 };
    const radius = 0.1;
    const curlAmount = 0.065;
    const result = calculate(vUv, curlAmount, radius);

    // Log p1 and p2 for verification
    // Calculated p2: (0.7495, 0.2505) -> In bounds
    // Calculated p1: (0.8985, 0.1015) -> Also In bounds!
    // Since p2 is in bounds, scenario 2.1 should be chosen.
    // console.log(`Scenario 2.1 Test (was Discard): p2=(${result.finalUV.x.toFixed(4)}, ${result.finalUV.y.toFixed(4)})`);

    expect(result.scenario).toBe(2.1); // Expect back-face because p2 is in bounds
    expect(result.shouldDiscard).toBe(false); // Should not discard since p2 is chosen and in bounds
    expect(isInBounds(result.finalUV)).toBe(true); // Verify finalUV (p2) is in bounds

  });
  
  // Helper function copied from shaderLogic.js for use in tests
  function isInBounds(uvCoords) {
    return uvCoords.x >= 0.0 && uvCoords.x <= 1.0 && uvCoords.y >= 0.0 && uvCoords.y <= 1.0;
  }
}); 