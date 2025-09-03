import assert from 'assert';
import {
  buildGraph,
  findCornerCutSet,
  useHamiltonianService,
  solve,
} from '../src/services/hamiltonian.js';

const MAX_DIMENSION = 65536;
const coordToIndex = (x, y) => x + MAX_DIMENSION * y;

// Construct a diagonal chain: P0(0,0), P1(1,1), P2(2,2), P3(3,3)
const P0 = coordToIndex(0, 0);
const P1 = coordToIndex(1, 1);
const P2 = coordToIndex(2, 2);
const P3 = coordToIndex(3, 3);
const diagonal = [P0, P1, P2, P3];

// Test corner-based cut detection
{
  const { nodes, neighbors, indexMap } = buildGraph(diagonal);
  const cut = findCornerCutSet(nodes, neighbors);
  assert(Array.isArray(cut));
  const idx1 = indexMap.get(P1);
  const idx2 = indexMap.get(P2);
  assert.strictEqual(cut.length, 2);
  assert(cut.includes(idx1));
  assert(cut.includes(idx2));
}

// Construct diamond graph: A(1,0), B(0,1), C(2,1), D(1,2)
const A = coordToIndex(1, 0);
const B = coordToIndex(0, 1);
const C = coordToIndex(2, 1);
const D = coordToIndex(1, 2);
const diamond = [A, B, C, D];

// Test solver on the diamond graph
{
  const service = useHamiltonianService();
  const paths = service.traverseFree(diamond);
  assert.strictEqual(paths.length, 1);
  const covered = new Set(paths.flat());
  assert.strictEqual(covered.size, diamond.length);
}

// Test solver with descending degree order
{
  const paths = solve(diamond, { degreeOrder: 'descending' });
  assert.strictEqual(paths.length, 1);
  const covered = new Set(paths.flat());
  assert.strictEqual(covered.size, diamond.length);
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

// Test stitching when a cut pixel lies in the middle of a path
{
  const Q0 = coordToIndex(0, 0);
  const Q1 = coordToIndex(1, 1);
  const Q2 = coordToIndex(2, 2);
  const Q3 = coordToIndex(3, 3);
  const Q4 = coordToIndex(1, 3);
  const Q5 = coordToIndex(3, 1);
  const star = [Q0, Q1, Q2, Q3, Q4, Q5];
  const paths = solve(star);
  assert.strictEqual(paths.length, 2);
  const covered = new Set(paths.flat());
  assert.strictEqual(covered.size, star.length);
  const pathWithQ2 = paths.find((p) => p.includes(Q2));
  const occurrences = pathWithQ2.filter((p) => p === Q2).length;
  assert.strictEqual(occurrences, 2);
}
