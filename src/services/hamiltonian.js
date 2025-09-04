const MAX_DIMENSION = 65536; // from utils
const TIME_LIMIT = 7500; // from constants/hamiltonian.js

// Build adjacency info for pixels with 8-way connectivity
// Returns { nodes, neighbors, degrees, indexMap }
function buildGraph(pixels) {
  const set = new Set(pixels);
  const nodes = Array.from(set);
  const indexMap = new Map(nodes.map((p, i) => [p, i]));
  const neighbors = nodes.map(() => []);

  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    const x = p % MAX_DIMENSION;
    const y = Math.floor(p / MAX_DIMENSION);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nPixel = x + dx + MAX_DIMENSION * (y + dy);
        if (set.has(nPixel)) neighbors[i].push(indexMap.get(nPixel));
      }
    }
  }

  const degrees = neighbors.map((nbs) => nbs.length);

  return { nodes, neighbors, degrees, indexMap };
}

// Check if removing specific vertices disconnects the graph
function isGraphDisconnected(neighbors, total, removed) {
  const blocked = new Uint8Array(total);
  for (const r of removed) blocked[r] = 1;
  let start = -1;
  for (let i = 0; i < total; i++) {
    if (!blocked[i]) {
      start = i;
      break;
    }
  }
  if (start === -1) return false;
  const stack = [start];
  blocked[start] = 1;
  while (stack.length) {
    const node = stack.pop();
    for (const nb of neighbors[node]) {
      if (blocked[nb]) continue;
      blocked[nb] = 1;
      stack.push(nb);
    }
  }
  for (let i = 0; i < total; i++) if (!blocked[i]) return true;
  return false;
}

// Attempt to find a minimal set of degree-2 vertices whose removal
// disconnects the graph. Only single vertices or pairs are considered.
// Returns an array of vertex indices or null if no such cut set exists.
function findDegree2CutSet(neighbors, degrees) {
  const degree2 = [];
  for (let i = 0; i < degrees.length; i++) if (degrees[i] === 2) degree2.push(i);
  const total = neighbors.length;

  for (const idx of degree2) {
    if (isGraphDisconnected(neighbors, total, [idx])) return [idx];
  }

  for (let i = 0; i < degree2.length; i++) {
    for (let j = i + 1; j < degree2.length; j++) {
      const pair = [degree2[i], degree2[j]];
      if (isGraphDisconnected(neighbors, total, pair)) return pair;
    }
  }
  return null;
}

// Partition graph around a cut set. Returns arrays of indices for each
// component, including the cut vertices adjacent to that component.
function partitionAtCut(nodes, neighbors, cutSet) {
  const cuts = Array.isArray(cutSet) ? cutSet : [cutSet];
  const cutLookup = new Set(cuts);
  const visited = new Uint8Array(neighbors.length);
  for (const c of cuts) visited[c] = 1;
  const res = [];

  for (let i = 0; i < neighbors.length; i++) {
    if (visited[i]) continue;
    const stack = [i];
    visited[i] = 1;
    const comp = [];
    const adjCuts = new Set();
    while (stack.length) {
      const node = stack.pop();
      comp.push(node);
      for (const nb of neighbors[node]) {
        if (cutLookup.has(nb)) {
          adjCuts.add(nb);
          continue;
        }
        if (visited[nb]) continue;
        visited[nb] = 1;
        stack.push(nb);
      }
    }
    const partIndices = [...comp, ...adjCuts];
    const indexMap = new Map(partIndices.map((idx, j) => [idx, j]));
    const partNeighbors = partIndices.map((origIdx) => {
      const list = [];
      for (const nb of neighbors[origIdx]) {
        const mapped = indexMap.get(nb);
        if (mapped != null) list.push(mapped);
      }
      return list;
    });
    const partDegrees = partNeighbors.map((nbs) => nbs.length);
    const partNodes = partIndices.map((idx) => nodes[idx]);
    res.push({ nodes: partNodes, neighbors: partNeighbors, degrees: partDegrees });
  }
  return res;
}

// Merge two path covers using the shared cut pixel
function stitchPaths(left, right, cutPixel) {
  const li = left.findIndex((p) => p.includes(cutPixel));
  const ri = right.findIndex((p) => p.includes(cutPixel));
  const lPath = left.splice(li, 1)[0];
  const rPath = right.splice(ri, 1)[0];
  if (lPath[lPath.length - 1] !== cutPixel) lPath.reverse();
  if (rPath[0] !== cutPixel) rPath.reverse();
  const joined = lPath.concat(rPath.slice(1));
  return [...left, ...right, joined];
}

// Find connected components from an adjacency list
function getComponents(neighbors) {
  const n = neighbors.length;
  const compIndex = new Int32Array(n);
  compIndex.fill(-1);
  const components = [];
  let cid = 0;

  for (let i = 0; i < n; i++) {
    if (compIndex[i] !== -1) continue;
    const stack = [i];
    compIndex[i] = cid;
    const comp = [];
    while (stack.length) {
      const node = stack.pop();
      comp.push(node);
      for (const nb of neighbors[node]) {
        if (compIndex[nb] === -1) {
          compIndex[nb] = cid;
          stack.push(nb);
        }
      }
    }
    components.push(comp);
    cid++;
  }

  return { components, compIndex };
}

// Core solver using backtracking to find minimum path cover
class PathCoverSolver {
  constructor(nodes, neighbors, degrees, indexMap, opts) {
    this.nodes = nodes;
    this.neighbors = neighbors;
    this.degrees = degrees;
    this.indexMap = indexMap;
    this.opts = opts;

    this.xs = new Int32Array(nodes.length);
    this.ys = new Int32Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i];
      this.xs[i] = p % MAX_DIMENSION;
      this.ys[i] = Math.floor(p / MAX_DIMENSION);
    }

    this.total = nodes.length;
    this.remaining = new Uint8Array(this.total);
    this.remaining.fill(1);

    this.start = opts.start != null ? indexMap.get(opts.start) : null;
    this.end = opts.end != null ? indexMap.get(opts.end) : null;
    this.isAscending = opts.degreeOrder !== 'descending';

    if (opts.start != null && this.start === undefined) throw new Error('Start pixel missing');
    if (opts.end != null && this.end === undefined) throw new Error('End pixel missing');

    this.best = { paths: null };
    this.memo = new Map();
    this.startTime = Date.now();
    this.timeExceeded = false;
  }

  dirOrder(dx, dy) {
    if (dx === 0 && dy === -1) return 0; // up
    if (dx === 1 && dy === 0) return 1; // right
    if (dx === 0 && dy === 1) return 2; // down
    if (dx === -1 && dy === 0) return 3; // left
    if (dx === -1 && dy === -1) return 4; // left-up
    if (dx === -1 && dy === 1) return 5; // left-down
    if (dx === 1 && dy === 1) return 6; // right-down
    if (dx === 1 && dy === -1) return 7; // right-up
    return 8;
  }

  checkTime(acc) {
    if (Date.now() - this.startTime > TIME_LIMIT) {
      if (!this.best.paths || acc.length < this.best.paths.length)
        this.best.paths = acc.map((p) => p.slice());
      this.timeExceeded = true;
      return true;
    }
    return false;
  }

  remove(node) {
    this.remaining[node] = 0;
    for (const nb of this.neighbors[node]) if (this.remaining[nb]) this.degrees[nb]--;
  }

  restore(node) {
    for (const nb of this.neighbors[node]) if (this.remaining[nb]) this.degrees[nb]++;
    this.remaining[node] = 1;
  }

  chooseStart() {
    let bestIdx = -1;
    let best = this.isAscending ? Infinity : -1;
    for (let i = 0; i < this.degrees.length; i++) {
      if (!this.remaining[i]) continue;
      const d = this.degrees[i];
      if (this.isAscending ? d < best : d > best) {
        best = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  key() {
    return this.remaining.join('');
  }

  neighborComparator(node, a, b) {
    const da = this.degrees[a];
    const db = this.degrees[b];
    if (da !== db) return this.isAscending ? da - db : db - da;
    const orderA = this.dirOrder(this.xs[a] - this.xs[node], this.ys[a] - this.ys[node]);
    const orderB = this.dirOrder(this.xs[b] - this.xs[node], this.ys[b] - this.ys[node]);
    return orderA - orderB;
  }

  search(activeCount, acc) {
    if (this.timeExceeded) return;
    if (this.checkTime(acc)) return;
    const k = this.key();
    const prev = this.memo.get(k);
    if (prev != null && acc.length >= prev) return;
    this.memo.set(k, acc.length);
    if (this.best.paths && acc.length >= this.best.paths.length) return;
    if (activeCount === 0) {
      this.best.paths = acc.map((p) => p.slice());
      return;
    }
    const isFirst = acc.length === 0;
    const startNode = isFirst && this.start != null ? this.start : this.chooseStart();
    this.remove(startNode);
    this.extend(startNode, [startNode], activeCount - 1, acc, isFirst);
    this.restore(startNode);
  }

  extend(node, path, activeCount, acc, isFirst) {
    if (this.timeExceeded) return;
    if (this.checkTime(acc)) return;
    if (this.best.paths && acc.length + 1 >= this.best.paths.length) return;
    const nbs = this.neighbors[node];
    nbs.sort(this.neighborComparator.bind(this, node));
    for (const nb of nbs) {
      if (!this.remaining[nb]) continue;
      this.remove(nb);
      path.push(nb);
      this.extend(nb, path, activeCount - 1, acc, isFirst);
      path.pop();
      this.restore(nb);
      if (this.timeExceeded) return;
    }

    if (!isFirst || this.end == null || node === this.end) {
      acc.push(path.slice());
      this.search(activeCount, acc);
      acc.pop();
    }
  }

  run() {
    this.search(this.total, []);
    let paths = [];
    if (this.best.paths) {
      paths = this.best.paths.map((p) => p.map((i) => this.nodes[i]));
    }
    const covered = new Set(paths.flat());
    for (const node of this.nodes) {
      if (!covered.has(node)) paths.push([node]);
    }
    return paths;
  }
}

function solve(input, opts = {}) {
  let nodes, neighbors, degrees, indexMap;
  if (input && input.nodes && input.neighbors && input.degrees) {
    ({ nodes, neighbors, degrees } = input);
    indexMap = new Map(nodes.map((p, i) => [p, i]));
  } else {
    ({ nodes, neighbors, degrees, indexMap } = buildGraph(input));
  }

  const cutSet = findDegree2CutSet(neighbors, degrees);
  if (cutSet && cutSet.length) {
    const parts = partitionAtCut(nodes, neighbors, cutSet);
    const cutPixels = cutSet.map((i) => nodes[i]);
    const results = [];
    for (const part of parts) {
      const partOpts = {};
      if (opts.start != null && part.nodes.includes(opts.start)) partOpts.start = opts.start;
      if (opts.end != null && part.nodes.includes(opts.end)) partOpts.end = opts.end;
      if (opts.degreeOrder) partOpts.degreeOrder = opts.degreeOrder;
      results.push(solve(part, partOpts));
    }
    let combined = results.shift();
    for (const res of results) {
      let merged = false;
      for (const cp of cutPixels) {
        if (combined.some((p) => p.includes(cp)) && res.some((p) => p.includes(cp))) {
          combined = stitchPaths(combined, res, cp);
          merged = true;
          break;
        }
      }
      if (!merged) combined = combined.concat(res);
    }
    return combined;
  }

  const solver = new PathCoverSolver(nodes, neighbors, degrees, indexMap, opts);
  return solver.run();
}

class HamiltonianService {
  traverseWithStart(pixels, start) {
    const { nodes, neighbors, indexMap } = buildGraph(pixels);
    const { components, compIndex } = getComponents(neighbors);
    const startIdx = indexMap.get(start);
    if (startIdx === undefined) throw new Error('Start pixel missing');

    const result = [];
    for (let i = 0; i < components.length; i++) {
      const compPixels = components[i].map((idx) => nodes[idx]);
      if (compIndex[startIdx] === i) {
        result.push(...solve(compPixels, { start }));
      } else {
        result.push(...solve(compPixels));
      }
    }
    return result;
  }

  traverseWithStartEnd(pixels, start, end) {
    const { nodes, neighbors, indexMap } = buildGraph(pixels);
    const { components, compIndex } = getComponents(neighbors);
    const startIdx = indexMap.get(start);
    const endIdx = indexMap.get(end);
    if (startIdx === undefined) throw new Error('Start pixel missing');
    if (endIdx === undefined) throw new Error('End pixel missing');
    if (compIndex[startIdx] !== compIndex[endIdx]) throw new Error('Start and end pixels are disconnected');

    const result = [];
    for (let i = 0; i < components.length; i++) {
      const compPixels = components[i].map((idx) => nodes[idx]);
      if (compIndex[startIdx] === i) {
        result.push(...solve(compPixels, { start, end }));
      } else {
        result.push(...solve(compPixels));
      }
    }
    return result;
  }

  traverseFree(pixels) {
    const { nodes, neighbors } = buildGraph(pixels);
    const { components } = getComponents(neighbors);
    const result = [];
    for (const comp of components) {
      const compPixels = comp.map((idx) => nodes[idx]);
      result.push(...solve(compPixels));
    }
    return result;
  }
}

export const useHamiltonianService = () => new HamiltonianService();

export { buildGraph, findDegree2CutSet, solve };
