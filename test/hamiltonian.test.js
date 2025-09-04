import assert from 'assert';
import {
  buildGraph,
  partitionAtDegree2Cut,
  useHamiltonianService,
  solve,
  stitchPaths,
} from '../src/services/hamiltonian.js';

const MAX_DIMENSION = 65536;
const coordToIndex = (x, y) => x + MAX_DIMENSION * y;

// Construct linear graph: A(0,0), B(1,0), C(2,0)
const A = coordToIndex(0, 0);
const B = coordToIndex(1, 0);
const C = coordToIndex(2, 0);
const pixels = [A, B, C];

// Test cut detection and partitioning
{
  const { nodes, neighbors, degrees } = buildGraph(pixels);
  const res = partitionAtDegree2Cut(nodes, neighbors, degrees);
  assert(res);
  assert(Array.isArray(res.cut));
  assert.strictEqual(res.cut.length, 1);
  assert(res.left && res.right);
  const cutPixel = nodes[res.cut[0]];
  assert(!res.left.nodes.includes(cutPixel));
  assert(!res.right.nodes.includes(cutPixel));
}

// Test solver on the same graph
{
  const service = useHamiltonianService();
  const paths = service.traverseFree(pixels);
  assert.strictEqual(paths.length, 1);
  const covered = new Set(paths.flat());
  assert.strictEqual(covered.size, pixels.length);
}

// Test solver with descending degree order
{
  const paths = solve(pixels, { degreeOrder: 'descending' });
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

// Test stitching when cut pixel lies in the middle of a path
{
  const left = [[1, 4, 2, 3]];
  const right = [[4, 5]];
  const res = stitchPaths([...left], [...right], 4);
  assert.deepStrictEqual(res, [[2, 3], [1, 4, 5]]);
}

// Test stitching when cut pixel is excluded from subpaths
{
  const left = [[1, 2]];
  const right = [[3, 4]];
  const res = stitchPaths([...left], [...right], 5, 2, 3);
  assert.deepStrictEqual(res, [[1, 2, 5, 3, 4]]);
}
