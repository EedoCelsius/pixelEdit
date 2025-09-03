import assert from 'assert';
import {
  buildGraph,
  findDegree2CutSet,
  useHamiltonianService,
  solve,
  stitchPaths,
  mergeCutPaths,
  partitionAtCut,
} from '../src/services/hamiltonian.js';

const MAX_DIMENSION = 65536;
const coordToIndex = (x, y) => x + MAX_DIMENSION * y;

// Construct diamond graph: A(1,0), B(0,1), C(2,1), D(1,2)
const A = coordToIndex(1, 0);
const B = coordToIndex(0, 1);
const C = coordToIndex(2, 1);
const D = coordToIndex(1, 2);
const pixels = [A, B, C, D];

// Test cut detection
{
  const { neighbors, degrees } = buildGraph(pixels);
  const cut = findDegree2CutSet(neighbors, degrees);
  assert(Array.isArray(cut));
  assert.strictEqual(cut.length, 2);
}

// Test partitionAtCut removes cut pixels from components
{
  const { nodes, neighbors, degrees } = buildGraph(pixels);
  const cut = findDegree2CutSet(neighbors, degrees);
  const parts = partitionAtCut(nodes, neighbors, cut);
  const cutPixels = cut.map((i) => nodes[i]);
  for (const part of parts) {
    for (const cp of cutPixels) {
      assert(!part.nodes.includes(cp));
    }
  }
}

// Test solver on the same graph
{
  const service = useHamiltonianService();
  const paths = await service.traverseFree(pixels);
  const covered = new Set(paths.flat());
  assert.strictEqual(covered.size, pixels.length);
}

// Test solver with descending degree order
{
  const paths = await solve(pixels, { degreeOrder: 'descending' });
  const covered = new Set(paths.flat());
  assert.strictEqual(covered.size, pixels.length);
}

// Test neighbor coverage without assuming order
{
  const center = coordToIndex(2, 2);
  const grid = [];
  for (let x = 0; x <= 4; x++) {
    for (let y = 0; y <= 4; y++) {
      grid.push(coordToIndex(x, y));
    }
  }
  const { nodes, neighbors, indexMap } = buildGraph(grid);
  const centerIdx = indexMap.get(center);
  const neighborPixels = neighbors[centerIdx]
    .map((i) => nodes[i])
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
}

// Test stitchPaths splitting when cut pixel is internal
{
  const left = [[1, 2, 3, 4]];
  const right = [[3, 5]];
  const merged = stitchPaths(left, right, 3);
  assert.deepStrictEqual(merged, [
    [3, 4],
    [1, 2, 3, 5],
  ]);
}

// Test merging two paths sharing the same start tile
{
  const first = [[0, 1]];
  const second = [[0, 2]];
  const merged = stitchPaths(first, second, 0);
  assert.deepStrictEqual(merged, [[1, 0, 2]]);
}

// Test stitching when cut pixel is missing from segments
{
  const left = [[1]];
  const right = [[2]];
  const merged = stitchPaths(left, right, 0);
  assert.deepStrictEqual(merged, [[1, 0, 2]]);
}

// Test merging three paths sharing a cut pixel
{
  const first = [[0, 1]];
  const second = [[2, 0]];
  const third = [[0, 3]];
  let merged = stitchPaths(first, second, 0);
  merged = stitchPaths(merged, third, 0);
  assert.deepStrictEqual(merged, [
    [0, 2],
    [1, 0, 3],
  ]);
}

// Test merging paths across multiple cut pixels to avoid duplication
{
  const paths = [
    [1, 10, 2],
    [2, 20],
    [1, 30],
  ];
  const merged = mergeCutPaths(paths, [1, 2]);
  assert.deepStrictEqual(merged, [[20, 2, 10, 1, 30]]);
}

// Test mergeCutPaths returns multiple paths when stitching cannot create one
// continuous path around a cut pixel
{
  const paths = [
    [0, 1],
    [0, 2],
    [0, 3],
  ];
  const merged = mergeCutPaths(paths, [0]);
  assert.strictEqual(merged.length, 2);
  for (const p of merged) assert(Array.isArray(p));
}

// Test removing duplicate endpoints in a circular path
{
  const paths = [
    [1, 2],
    [2, 3],
    [3, 1],
  ];
  const merged = mergeCutPaths(paths, [1, 2, 3]);
  assert.deepStrictEqual(merged, [[3, 2, 1]]);
}

// Test solver-level fallback when start-end path cannot cover all pixels
{
  const coords = [
    [1, 1], // center
    [0, 2], // left arm
    [2, 2], // right arm
    [1, 0], // top arm
  ];
  const pixels = coords.map(([x, y]) => coordToIndex(x, y));
  const start = coordToIndex(0, 2);
  const end = coordToIndex(2, 2);
  const result = await solve(pixels, { start, end });
  const startOnly = await solve(pixels, { start });
  const endOnly = await solve(pixels, { start: end });
const eqStart = JSON.stringify(result) === JSON.stringify(startOnly);
const eqEnd = JSON.stringify(result) === JSON.stringify(endOnly);
assert(eqStart || eqEnd);
}

// Test time limit fallback preserves partial anchor path
{
  const origNow = Date.now;
  let call = 0;
  Date.now = () => (call++ % 4 === 3 ? 8000 : 0);
  try {
    const idx = (x, y) => x + MAX_DIMENSION * y;
    const pixels = [idx(0, 0), idx(1, 0), idx(0, 1)];
    const result = await solve(pixels, { start: pixels[0], end: pixels[1] });
    assert(result.some((p) => p.length > 1));
  } finally {
    Date.now = origNow;
  }
}

// Test solver returns start-to-end path when available using concurrent anchors
{
  const idx = (x, y) => x + MAX_DIMENSION * y;
  const pixels = [idx(0, 0), idx(1, 0), idx(2, 0)];
  const start = idx(0, 0);
  const end = idx(2, 0);
  const result = await solve(pixels, { start, end });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0][0], start);
  assert.strictEqual(result[0][result[0].length - 1], end);
}

// Test unanchored solve merges partitions without duplicating cut pixel
{
  const idx = (x, y) => x + MAX_DIMENSION * y;
  const pixels = [idx(0, 0), idx(1, 0), idx(2, 0)];
  const result = await solve(pixels);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].length, 3);
}
