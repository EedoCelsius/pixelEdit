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

// Locate a degree-2 cut set and partition the graph around it.
// Returns { cut, left, right } where cut is an array of vertex indices
// and left/right are subgraphs in the same format as buildGraph.
function partitionAtDegree2Cut(nodes, neighbors, degrees) {
  const degree2 = [];
  for (let i = 0; i < degrees.length; i++) if (degrees[i] === 2) degree2.push(i);
  const total = neighbors.length;

  let cut = null;
  for (const idx of degree2) {
    if (isGraphDisconnected(neighbors, total, [idx])) {
      cut = [idx];
      break;
    }
  }

  if (!cut) {
    for (let i = 0; i < degree2.length; i++) {
      for (let j = i + 1; j < degree2.length; j++) {
        const pair = [degree2[i], degree2[j]];
        if (isGraphDisconnected(neighbors, total, pair)) {
          cut = pair;
          break;
        }
      }
      if (cut) break;
    }
  }

  if (!cut) return null;

  const cutLookup = new Set(cut);
  const visited = new Uint8Array(neighbors.length);
  for (const c of cut) visited[c] = 1;
  const parts = [];

  for (let i = 0; i < neighbors.length; i++) {
    if (visited[i]) continue;
    const stack = [i];
    visited[i] = 1;
    const comp = [];
    const adjCuts = new Map();
    while (stack.length) {
      const node = stack.pop();
      comp.push(node);
      for (const nb of neighbors[node]) {
        if (cutLookup.has(nb)) {
          if (!adjCuts.has(nb)) adjCuts.set(nb, node);
          continue;
        }
        if (visited[nb]) continue;
        visited[nb] = 1;
        stack.push(nb);
      }
    }
    const compIndices = [...comp];
    const indexMap = new Map(compIndices.map((idx, j) => [idx, j]));
    const partNeighbors = compIndices.map((origIdx) => {
      const list = [];
      for (const nb of neighbors[origIdx]) {
        if (cutLookup.has(nb)) continue;
        const mapped = indexMap.get(nb);
        if (mapped != null) list.push(mapped);
      }
      return list;
    });
    const partDegrees = partNeighbors.map((nbs) => nbs.length);
    const partNodes = compIndices.map((idx) => nodes[idx]);
    const cutNeighborPixels = {};
    for (const [cutIdx, nodeIdx] of adjCuts.entries()) {
      cutNeighborPixels[nodes[cutIdx]] = nodes[nodeIdx];
    }
    parts.push({
      nodes: partNodes,
      neighbors: partNeighbors,
      degrees: partDegrees,
      cutNeighbors: cutNeighborPixels,
    });
  }

  const [left, right] = parts;
  return { cut, left, right };
}

// Merge path covers across cut pixels using neighbor information.
// `cutInfos` is an array of { cutPixel, leftNeighbor, rightNeighbor }.
function stitchPaths(left, right, cutInfos) {
  const combined = [...left, ...right];
  for (const info of cutInfos) {
    const { cutPixel, leftNeighbor, rightNeighbor } = info;
    const li = combined.findIndex(
      (p) => p[0] === leftNeighbor || p[p.length - 1] === leftNeighbor,
    );
    const ri = combined.findIndex(
      (p) => p[0] === rightNeighbor || p[p.length - 1] === rightNeighbor,
    );
    if (li !== -1 && ri !== -1 && li !== ri) {
      const lPath = combined.splice(li, 1)[0];
      const rIndex = ri > li ? ri - 1 : ri;
      const rPath = combined.splice(rIndex, 1)[0];
      if (lPath[lPath.length - 1] !== leftNeighbor) lPath.reverse();
      if (rPath[0] !== rightNeighbor) rPath.reverse();
      combined.push([...lPath, cutPixel, ...rPath]);
    } else if (li !== -1 && li === ri) {
      const path = combined[li];
      if (path[path.length - 1] === leftNeighbor || path[path.length - 1] === rightNeighbor) {
        path.push(cutPixel);
      } else if (path[0] === leftNeighbor || path[0] === rightNeighbor) {
        path.unshift(cutPixel);
      } else {
        combined.push([cutPixel]);
      }
    } else if (li !== -1 || ri !== -1) {
      const idx = li !== -1 ? li : ri;
      const path = combined[idx];
      const neighbor = li !== -1 ? leftNeighbor : rightNeighbor;
      if (path[path.length - 1] === neighbor) path.push(cutPixel);
      else if (path[0] === neighbor) path.unshift(cutPixel);
      else combined.push([cutPixel]);
    } else {
      combined.push([cutPixel]);
    }
  }
  return combined;
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

    this.best = { paths: null, pathCount: Infinity, level: -1, anchors: 0 };
    this.memo = new Map();
    this.startTime = Date.now();
    this.timeExceeded = false;
    this.completed = false;
    this.requiredAnchors = (this.start != null ? 1 : 0) + (this.end != null ? 1 : 0);
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

  updateBest(acc, activeCount, currentPath = null) {
    const candidatePaths = currentPath ? [...acc, currentPath] : acc;
    const pathsCopy = candidatePaths.map((p) => p.slice());
    const pathCount = candidatePaths.length + activeCount;
    let startCovered = false;
    let endCovered = false;
    if (this.start != null) {
      for (const p of candidatePaths) {
        if (p.includes(this.start)) {
          startCovered = true;
          break;
        }
      }
    }
    if (this.end != null) {
      for (const p of candidatePaths) {
        if (p.includes(this.end)) {
          endCovered = true;
          break;
        }
      }
    }
    const anchors = (startCovered ? 1 : 0) + (endCovered ? 1 : 0);
    const isFull = activeCount === 0;
    const isFullPath = isFull && candidatePaths.length === 1;
    let level = 0;
    if (isFullPath) {
      if (anchors === this.requiredAnchors) level = 3;
      else if (anchors > 0) level = 2;
      else level = 1;
    } else if (anchors > 0) {
      level = 1;
    }

    const better =
      !this.best.paths ||
      level > this.best.level ||
      (level === this.best.level &&
        (pathCount < this.best.pathCount ||
          (pathCount === this.best.pathCount && anchors > this.best.anchors)));

    if (better) {
      this.best = { paths: pathsCopy, pathCount, level, anchors };
      if (level === 3 || (level === 2 && this.requiredAnchors === 1)) {
        this.completed = true;
      }
    }
  }

  checkTimeout() {
    if (Date.now() - this.startTime > TIME_LIMIT) {
      this.timeExceeded = true;
    }
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
    if (this.timeExceeded || this.completed) return;
    this.updateBest(acc, activeCount);
    if (this.completed) return;
    this.checkTimeout();
    if (this.timeExceeded) return;
    const k = this.key();
    const prev = this.memo.get(k);
    if (prev != null && acc.length >= prev) return;
    this.memo.set(k, acc.length);
    if (activeCount === 0) return;
    const isFirst = acc.length === 0;
    const startNode = isFirst && this.start != null ? this.start : this.chooseStart();
    this.remove(startNode);
    this.extend(startNode, [startNode], activeCount - 1, acc, isFirst);
    this.restore(startNode);
  }

  extend(node, path, activeCount, acc, isFirst) {
    if (this.timeExceeded || this.completed) return;
    this.updateBest(acc, activeCount, path);
    if (this.completed) return;
    this.checkTimeout();
    if (this.timeExceeded) return;
    const nbs = this.neighbors[node];
    nbs.sort(this.neighborComparator.bind(this, node));
    for (const nb of nbs) {
      if (!this.remaining[nb]) continue;
      this.remove(nb);
      path.push(nb);
      this.extend(nb, path, activeCount - 1, acc, isFirst);
      path.pop();
      this.restore(nb);
      if (this.timeExceeded || this.completed) return;
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

  const partition = partitionAtDegree2Cut(nodes, neighbors, degrees);
  if (partition) {
    const { cut, left, right } = partition;
    const cutPixels = cut.map((i) => nodes[i]);
    const parts = [left, right];
    const results = [];
    for (const part of parts) {
      if (!part) {
        results.push([]);
        continue;
      }
      const partOpts = {};
      const mandatory = Object.values(part.cutNeighbors || {});
      if (mandatory[0] != null) partOpts.start = mandatory[0];
      if (mandatory[1] != null) partOpts.end = mandatory[1];
      if (opts.start != null && part.nodes.includes(opts.start)) {
        if (partOpts.start == null) partOpts.start = opts.start;
        else if (partOpts.end == null && opts.start !== partOpts.start)
          partOpts.end = opts.start;
      }
      if (opts.end != null && part.nodes.includes(opts.end)) {
        if (partOpts.end == null && opts.end !== partOpts.start) partOpts.end = opts.end;
        else if (partOpts.start == null) partOpts.start = opts.end;
      }
      if (opts.degreeOrder) partOpts.degreeOrder = opts.degreeOrder;
      results.push(solve(part, partOpts));
    }
    const leftRes = results[0] || [];
    const rightRes = results[1] || [];
    const cutInfos = cutPixels.map((cp) => ({
      cutPixel: cp,
      leftNeighbor: left?.cutNeighbors?.[cp],
      rightNeighbor: right?.cutNeighbors?.[cp],
    }));
    return stitchPaths(leftRes, rightRes, cutInfos);
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

export { buildGraph, partitionAtDegree2Cut, solve };
