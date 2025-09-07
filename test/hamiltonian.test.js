import test from 'node:test';
import assert from 'node:assert';
import {
  buildGraphFromPixels,
  partitionAtEdgeCut,
  useHamiltonianService,
  solveFromPixels,
} from '../src/services/hamiltonian.js';

const MAX_DIMENSION = 65536;
const coordToIndex = (x, y) => x + MAX_DIMENSION * y;

test('buildGraphFromPixels orders neighbors around a center pixel', () => {
  const grid = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      grid.push(coordToIndex(x, y));
    }
  }
  const neighbors = buildGraphFromPixels(grid);
  const center = coordToIndex(1, 1);
  const centerIdx = grid.indexOf(center);
  const neighborPixels = neighbors[centerIdx].map((i) => grid[i]);
  const expected = [
    coordToIndex(1, 0), // up
    coordToIndex(2, 1), // right
    coordToIndex(1, 2), // down
    coordToIndex(0, 1), // left
    coordToIndex(0, 0), // left-up
    coordToIndex(0, 2), // left-down
    coordToIndex(2, 2), // right-down
    coordToIndex(2, 0), // right-up
  ];
  assert.deepStrictEqual(neighborPixels, expected);
});

test('partitionAtEdgeCut detects a bridge in a line of three pixels', () => {
  const p0 = coordToIndex(0, 0);
  const p1 = coordToIndex(1, 0);
  const p2 = coordToIndex(2, 0);
  const neighbors = buildGraphFromPixels([p0, p1, p2]);
  const res = partitionAtEdgeCut(neighbors);
  assert(res);
  assert.strictEqual(res.edges.length, 1);
  assert.strictEqual(res.parts.length, 2);
});

test('solveFromPixels respects start and end anchors', async () => {
  const p0 = coordToIndex(0, 0);
  const p1 = coordToIndex(1, 0);
  const p2 = coordToIndex(2, 0);
  const p3 = coordToIndex(3, 0);
  const pixels = [p0, p1, p2, p3];
  const paths = await solveFromPixels(pixels, { anchors: [p0, p3] });
  assert.strictEqual(paths.length, 1);
  const path = paths[0];
  assert.strictEqual(path.length, pixels.length);
  assert(path.includes(p0) && path.includes(p3));
  assert(
    (path[0] === p0 && path.at(-1) === p3) ||
      (path[0] === p3 && path.at(-1) === p0)
  );
});

test('solveFromPixels returns separate paths for disconnected pixels', async () => {
  const a = coordToIndex(0, 0);
  const b = coordToIndex(5, 0);
  const paths = await solveFromPixels([a, b]);
  assert.strictEqual(paths.length, 2);
  assert(paths.some((p) => p.length === 1 && p[0] === a));
  assert(paths.some((p) => p.length === 1 && p[0] === b));
});

test('HamiltonianService.traverseFree covers all pixels in a 2x2 square', async () => {
  const service = useHamiltonianService();
  const pixels = [
    coordToIndex(0, 0),
    coordToIndex(1, 0),
    coordToIndex(0, 1),
    coordToIndex(1, 1),
  ];
  const paths = await service.traverseFree(pixels);
  assert.strictEqual(paths.length, 1);
  const covered = new Set(paths.flat());
  assert.strictEqual(covered.size, pixels.length);
});
