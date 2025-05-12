import { describe, it, expect } from 'vitest';
import { calculateCurledVertexPosition } from './curlMath.js';

const curlTargetAmount = 1.5;

describe('calculateCurledVertexPosition', () => {
  it('should not change vertex position if amount is 0', () => {
    const originalX = 1;
    const originalY = 1;
    const geomWidth = 4;
    const geomHeight = 5.5;
    const amount = 0;
    const radius = 0.5;
    const angle = Math.PI / 4;

    const result = calculateCurledVertexPosition(
      originalX,
      originalY,
      geomWidth,
      geomHeight,
      amount,
      radius,
      angle
    );

    expect(result.x).toBe(originalX);
    expect(result.y).toBe(originalY);
    expect(result.z).toBe(0); // Assuming z starts at 0 and amount 0 means no change in z
  });

  it('should lift the bottom-right corner up by more than half geomHeight when amount is half of curlTargetAmount', () => {
    const geomWidth = 4;
    const geomHeight = 5.5;
    // Bottom-right corner
    const originalX = geomWidth / 2;
    const originalY = -geomHeight / 2;
    
    const amount = curlTargetAmount / 2; // curlTargetAmount is 1.5, so amount is 0.75
    const radius = 0.5; // Consistent with main.js curlParameters
    const angle = Math.PI / 4; // Consistent with main.js curlParameters

    const result = calculateCurledVertexPosition(
      originalX,
      originalY,
      geomWidth,
      geomHeight,
      amount,
      radius,
      angle
    );

    // Expectation: the new Y position is greater than its original Y + half the geometry height.
    // originalY_bottom_right = -geomHeight / 2.
    // originalY_bottom_right + geomHeight / 2 = 0.
    // So, we expect result.y to be > 0.
    expect(result.y).toBeGreaterThan(0);
    
    // For debugging, let's also see what the values are:
    // console.log(`Test: Corner lift check - OriginalY: ${originalY}, ResultY: ${result.y}, ResultZ: ${result.z}`);
  });

  // We can add more tests here later
}); 