import assert from 'assert';
import {
  buildGraph,
  partitionAtEdgeCut,
  useHamiltonianService,
  solve,
} from '../src/services/hamiltonian.js';

const MAX_DIMENSION = 65536;
const coordToIndex = (x, y) => x + MAX_DIMENSION * y;

// Construct diamond graph: A(1,0), B(0,1), C(2,1), D(1,2)
const A = coordToIndex(1, 0);
const B = coordToIndex(0, 1);
const C = coordToIndex(2, 1);
const D = coordToIndex(1, 2);
const pixels = [A, B, C, D];

// Test cut detection and partitioning
{
  const { nodes, neighbors } = buildGraph(pixels);
  const res = partitionAtEdgeCut(nodes, neighbors);
  assert(res);
  assert(Array.isArray(res.cutEdges));
  assert.strictEqual(res.cutEdges.length, 2);
  assert(res.parts[0] && res.parts[1]);
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

// Test solver with anchors
{
  const paths = await solve(pixels, { anchors: [A, D] });
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
