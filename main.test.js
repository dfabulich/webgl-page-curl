import { describe, it, expect } from 'vitest';
import { calculateCurledVertexPosition } from './curlMath.js';

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

  // We can add more tests here later
}); 