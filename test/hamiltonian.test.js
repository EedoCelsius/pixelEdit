import assert from 'assert';
import { buildGraph, findDegree2CutSet, useHamiltonianService } from '../src/services/hamiltonian.js';

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
  const paths = service.traverseFree(pixels);
  assert.strictEqual(paths.length, 1);
  const covered = new Set(paths.flat());
  assert.strictEqual(covered.size, pixels.length);
}
