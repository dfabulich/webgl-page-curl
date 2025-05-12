import { describe, it, expect } from 'vitest';
import { calculateCurledVertexPosition } from './curlMath.js';

const geomWidth = 4;
const geomHeight = 5.5;
const curlTargetAmount = 1.5;
const radius = 0.5;
const angle = Math.PI / 4;

function calculate({
    originalX,
    originalY,
    amount,
    _geomWidth = geomWidth,
    _geomHeight = geomHeight,
    _radius = radius,
    _angle = angle
}) {
  return calculateCurledVertexPosition(
    originalX, originalY, _geomWidth, _geomHeight, amount, _radius, _angle
);
}

describe('calculateCurledVertexPosition', () => {
  it('should not change vertex position if amount is 0', () => {

    const result = calculate({
        originalX: 1, 
        originalY: 1, 
        amount: 0});

    expect(result.x).toBe(1);
    expect(result.y).toBe(1);
    expect(result.z).toBe(0); // Assuming z starts at 0 and amount 0 means no change in z
  });

  it('should lift the bottom-right corner up by more than half geomHeight when amount is half of curlTargetAmount', () => {

    const result = calculate({
        originalX: geomWidth / 2, 
        originalY: -geomHeight / 2, 
        amount: curlTargetAmount / 2});

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
        amount: 0.8 * curlTargetAmount});

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
        amount: amount
    });

    const bottomLeft = calculate({
        originalX: -geomWidth / 2,
        originalY: -geomHeight / 2,
        amount: amount
    });

    // For debugging
    // console.log(`Amount: ${amount}`);
    // console.log(`Bottom-Right: Y=${bottomRight.y.toFixed(3)}, X=${bottomRight.x.toFixed(3)}, Z=${bottomRight.z.toFixed(3)}`);
    // console.log(`Bottom-Left:  Y=${bottomLeft.y.toFixed(3)},  X=${bottomLeft.x.toFixed(3)},  Z=${bottomLeft.z.toFixed(3)}`);

    expect(bottomRight.y).toBeGreaterThan(bottomLeft.y);
  });

  // We can add more tests here later
}); 