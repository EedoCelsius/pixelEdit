import assert from 'assert';
import { test } from 'node:test';
import {
  buildGraphFromPixels,
  partitionAtEdgeCut,
  useHamiltonianService,
} from '../src/services/hamiltonian.js';

const MAX_DIMENSION = 65536;
const coordToIndex = (x, y) => x + MAX_DIMENSION * y;

test('buildGraphFromPixels returns 8-way neighbors', () => {
  const center = coordToIndex(2, 2);
  const grid = [];
  for (let x = 1; x <= 3; x++) {
    for (let y = 1; y <= 3; y++) {
      grid.push(coordToIndex(x, y));
    }
  }
  const neighbors = buildGraphFromPixels(grid);
  const centerIdx = grid.indexOf(center);
  const neighborPixels = neighbors[centerIdx]
    .map((i) => grid[i])
    .sort((a, b) => a - b);
  const expected = [
    coordToIndex(2, 1), // up
    coordToIndex(3, 2), // right
    coordToIndex(2, 3), // down
    coordToIndex(1, 2), // left
    coordToIndex(1, 1), // left-up
    coordToIndex(1, 3), // left-down
    coordToIndex(3, 3), // right-down
    coordToIndex(3, 1), // right-up
  ].sort((a, b) => a - b);
  assert.deepStrictEqual(neighborPixels, expected);
});

test('partitionAtEdgeCut identifies bridge in a line', () => {
  const pixels = [
    coordToIndex(0, 0),
    coordToIndex(1, 0),
    coordToIndex(2, 0),
    coordToIndex(3, 0),
    coordToIndex(4, 0),
  ];
  const neighbors = buildGraphFromPixels(pixels);
  const res = partitionAtEdgeCut(neighbors);
  assert(res);
  assert.strictEqual(res.edges.length, 1);
  assert.strictEqual(res.parts.length, 2);
});

test('traverseFree covers all pixels', async () => {
  const pixels = [
    coordToIndex(0, 0),
    coordToIndex(1, 0),
    coordToIndex(1, 1),
    coordToIndex(0, 1),
  ]; // 2x2 square
  const service = useHamiltonianService();
  const paths = await service.traverseFree(pixels);
  assert.strictEqual(paths.length, 1);
  const covered = new Set(paths.flat());
  assert.strictEqual(covered.size, pixels.length);
});

test('traverseWithStart respects starting anchor', async () => {
  const pixels = [
    coordToIndex(0, 0),
    coordToIndex(1, 0),
    coordToIndex(2, 0),
  ];
  const start = pixels[0];
  const service = useHamiltonianService();
  const paths = await service.traverseWithStart(pixels, start);
  assert.strictEqual(paths.length, 1);
  assert.strictEqual(paths[0][0], start);
});

test('traverseWithStartEnd respects both anchors', async () => {
  const pixels = [
    coordToIndex(0, 0),
    coordToIndex(1, 0),
    coordToIndex(2, 0),
    coordToIndex(3, 0),
  ];
  const start = pixels[0];
  const end = pixels[3];
  const service = useHamiltonianService();
  const paths = await service.traverseWithStartEnd(pixels, start, end);
  assert.strictEqual(paths.length, 1);
  const path = paths[0];
  assert.strictEqual(path[0], start);
  assert.strictEqual(path[path.length - 1], end);
});

