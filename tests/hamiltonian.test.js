import { describe, it, expect } from 'vitest';
import { useHamiltonianService } from '../src/services/hamiltonian.js';

const MAX_DIMENSION = 65536;
const coordToIndex = (x, y) => x + MAX_DIMENSION * y;

describe('articulation with multiple components', () => {
  it('solves and stitches three branches around a cut vertex', () => {
    const center = coordToIndex(10, 10);
    const a = coordToIndex(9, 9);
    const b = coordToIndex(9, 11);
    const c = coordToIndex(11, 9);
    const pixels = [center, a, b, c];
    const service = useHamiltonianService();
    const paths = service.traverseFree(pixels);
    expect(paths.length).toBe(2);
    const flat = paths.flat();
    const set = new Set(flat);
    expect(set.size).toBe(pixels.length);
    expect([...set].sort((x, y) => x - y)).toEqual(pixels.slice().sort((x, y) => x - y));
    const centerPath = paths.find((p) => p.includes(center));
    expect(centerPath.length).toBe(3);
  });
});
