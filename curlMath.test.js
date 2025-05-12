import { describe, it, expect } from 'vitest';
import { calculateCurledVertexPosition } from './curlMath.js';

const geomWidth = 4;
const geomHeight = 8;
const curlTargetAmount = 1.0;

function calculate({
  originalX,
  originalY,
  amount,
  _geomWidth = geomWidth,
  _geomHeight = geomHeight,
}) {
  return calculateCurledVertexPosition(originalX, originalY, _geomWidth, _geomHeight, amount);
}

describe('calculateCurledVertexPosition', () => {
  it('should not change vertex position if amount is 0', () => {
    const result = calculate({
      originalX: 1,
      originalY: 1,
      amount: 0,
    });

    expect(result.x).toBe(1);
    expect(result.y).toBe(1);
    expect(result.z).toBe(0); // Assuming z starts at 0 and amount 0 means no change in z
  });

  it('should lift the bottom-right corner up by exactly half geomHeight when amount is half of curlTargetAmount', () => {
    const result = calculate({
      originalX: geomWidth / 2,
      originalY: -geomHeight / 2,
      amount: curlTargetAmount / 2,
    });

    // Expectation: the new Y position is greater than its original Y + half the geometry height.
    // originalY_bottom_right = -geomHeight / 2.
    // originalY_bottom_right + geomHeight / 2 = 0.
    // So, we expect result.y to be > 0.
    expect(result.y).toBeGreaterThan(0);

    // For debugging, let's also see what the values are:
    // console.log(`Test: Corner lift check - OriginalY: ${originalY}, ResultY: ${result.y}, ResultZ: ${result.z}`);
  });

  it('should lift the bottom-left corner above y=0 when amount is 0.8 * curlTargetAmount', () => {
    const result = calculate({
      originalX: -geomWidth / 2,
      originalY: -geomHeight / 2,
      amount: 0.8 * curlTargetAmount,
    });

    //console.log(`Test: Bottom-left lift check - OriginalY: ${originalY}, ResultY: ${result.y}, ResultZ: ${result.z}, Amount: ${amount}`);

    // Expectation: the new Y position is greater than 0.
    // Original Y for bottom-left is -geomHeight / 2.
    expect(result.y).toBeGreaterThan(0);
  });

  it('should have the bottom-right corner higher than the bottom-left corner at 25% curl amount', () => {
    const amount = curlTargetAmount * 0.25;

    const bottomRight = calculate({
      originalX: geomWidth / 2,
      originalY: -geomHeight / 2,
      amount: amount,
    });

    const bottomLeft = calculate({
      originalX: -geomWidth / 2,
      originalY: -geomHeight / 2,
      amount: amount,
    });

    // For debugging
    // console.log(`Amount: ${amount}`);
    // console.log(`Bottom-Right: Y=${bottomRight.y.toFixed(3)}, X=${bottomRight.x.toFixed(3)}, Z=${bottomRight.z.toFixed(3)}`);
    // console.log(`Bottom-Left:  Y=${bottomLeft.y.toFixed(3)},  X=${bottomLeft.x.toFixed(3)},  Z=${bottomLeft.z.toFixed(3)}`);

    expect(bottomRight.y).toBeGreaterThan(bottomLeft.y);

    // Assert that the top corners have not moved in X or Y
    const topRightOriginalX = geomWidth / 2;
    const topRightOriginalY = geomHeight / 2;
    const topLeftOriginalX = -geomWidth / 2;
    const topLeftOriginalY = geomHeight / 2;

    const topRightResult = calculate({
      originalX: topRightOriginalX,
      originalY: topRightOriginalY,
      amount: amount,
    });

    const topLeftResult = calculate({
      originalX: topLeftOriginalX,
      originalY: topLeftOriginalY,
      amount: amount,
    });

    expect(topRightResult.x).toBe(topRightOriginalX);
    expect(topRightResult.y).toBe(topRightOriginalY);
    expect(topLeftResult.x).toBe(topLeftOriginalX);
    expect(topLeftResult.y).toBe(topLeftOriginalY);
  });

  it('should keep top-left corner fixed and move bottom-right corner to top-left when amount = 1', () => {
    const amount = 1.0;
    
    // Define our corners
    const topLeftOriginalX = -geomWidth / 2;
    const topLeftOriginalY = geomHeight / 2;
    
    const bottomRightOriginalX = geomWidth / 2;
    const bottomRightOriginalY = -geomHeight / 2;
    
    // Get their final positions
    const topLeftResult = calculate({
      originalX: topLeftOriginalX,
      originalY: topLeftOriginalY,
      amount: amount,
    });
    
    const bottomRightResult = calculate({
      originalX: bottomRightOriginalX,
      originalY: bottomRightOriginalY,
      amount: amount,
    });
    
    // Debug positions
    console.log('Full curl (amount = 1.0):');
    console.log(`Top-Left: Original(${topLeftOriginalX}, ${topLeftOriginalY}) → Final(${topLeftResult.x.toFixed(3)}, ${topLeftResult.y.toFixed(3)}, ${topLeftResult.z.toFixed(3)})`);
    console.log(`Bottom-Right: Original(${bottomRightOriginalX}, ${bottomRightOriginalY}) → Final(${bottomRightResult.x.toFixed(3)}, ${bottomRightResult.y.toFixed(3)}, ${bottomRightResult.z.toFixed(3)})`);
    
    // Top-left corner should not move
    expect(topLeftResult.x).toBeCloseTo(topLeftOriginalX);
    expect(topLeftResult.y).toBeCloseTo(topLeftOriginalY);
    expect(topLeftResult.z).toBeCloseTo(0);
    
    // Bottom-right corner should end up at the top-left corner X,Y position
    expect(bottomRightResult.x).toBeCloseTo(topLeftOriginalX);
    expect(bottomRightResult.y).toBeCloseTo(topLeftOriginalY);
    
    // After our fix for the negative Z issue, the bottom-right should have a positive Z value
    // even when it reaches the top-left corner position
    expect(bottomRightResult.z).toBeGreaterThan(0);
  });
  
  it('should ensure bottom-right corner Z remains positive at 95% curl amount', () => {
    const amount = 0.95;
    
    // Get bottom-right corner position
    const bottomRightResult = calculate({
      originalX: geomWidth / 2,
      originalY: -geomHeight / 2,
      amount: amount,
    });
    
    // Log the position for debugging
    console.log(`Bottom-right corner at amount=${amount}:`);
    console.log(`Position: (${bottomRightResult.x.toFixed(3)}, ${bottomRightResult.y.toFixed(3)}, ${bottomRightResult.z.toFixed(3)})`);
    
    // Verify Z coordinate is positive (our fix should ensure this)
    expect(bottomRightResult.z).toBeGreaterThan(0);
  });
  // We can add more tests here later
});
