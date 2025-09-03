import assert from 'assert';
import {
  buildGraph,
  findDegree2CutSet,
  useHamiltonianService,
  solve,
  stitchPaths,
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

// Test solver on the same graph
{
  const service = useHamiltonianService();
  const paths = await service.traverseFree(pixels);
  assert.strictEqual(paths.length, 1);
  const covered = new Set(paths.flat());
  assert.strictEqual(covered.size, pixels.length);
}

// Test solver with descending degree order
{
  const paths = await solve(pixels, { degreeOrder: 'descending' });
  assert.strictEqual(paths.length, 1);
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

// Ensure cut pixel is excluded and neighbor becomes start
{
  const cut = coordToIndex(1, 1);
  const left = coordToIndex(0, 1);
  const right = coordToIndex(2, 1);
  const path = (await solve([left, cut, right], { start: cut }))[0];
  assert.strictEqual(path.length, 3);
  assert.strictEqual(path[1], cut);
  assert.notStrictEqual(path[0], cut);
  assert.notStrictEqual(path[2], cut);
}

// Separate component still yields minimal paths with anchors satisfied
{
  const s1 = coordToIndex(0, 0);
  const s2 = coordToIndex(1, 0);
  const e = coordToIndex(2, 0);
  const o1 = coordToIndex(4, 0);
  const o2 = coordToIndex(5, 0);
  const paths = await solve([s1, s2, e, o1, o2], { start: s1, end: e });
  assert.strictEqual(paths.length, 2);
  const endpoints = paths.flatMap((p) => [p[0], p[p.length - 1]]);
  assert(endpoints.includes(s1));
  assert(endpoints.includes(e));
}

// Verify stitching joins paths using neighbor endpoints
{
  const cut = 42;
  const left = [[1]];
  const right = [[3]];
  const merged = stitchPaths(left, right, cut, 1, 3);
  assert.deepStrictEqual(merged, [[1, cut, 3]]);
}
