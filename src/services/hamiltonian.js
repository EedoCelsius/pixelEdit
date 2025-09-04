const MAX_DIMENSION = 65536; // from utils
const TIME_LIMIT = 7500; // from constants/hamiltonian.js

// Return a direction priority for a given offset.
function dirPriority(dx, dy) {
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
    const nbs = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nPixel = x + dx + MAX_DIMENSION * (y + dy);
        if (set.has(nPixel)) {
          const idx = indexMap.get(nPixel);
          nbs.push({ idx, order: dirPriority(dx, dy) });
        }
      }
    }
    nbs.sort((a, b) => a.order - b.order);
    neighbors[i] = nbs.map((n) => n.idx);
  }

  const degrees = neighbors.map((nbs) => nbs.length);

  return { nodes, neighbors, degrees, indexMap };
}

// Check if removing specific edges disconnects the graph
function isGraphDisconnectedByEdges(neighbors, total, edges) {
  const blocked = new Map();
  for (const [a, b] of edges) {
    if (!blocked.has(a)) blocked.set(a, new Set());
    if (!blocked.has(b)) blocked.set(b, new Set());
    blocked.get(a).add(b);
    blocked.get(b).add(a);
  }
  const visited = new Uint8Array(total);
  const stack = [0];
  visited[0] = 1;
  while (stack.length) {
    const node = stack.pop();
    for (const nb of neighbors[node]) {
      if (blocked.get(node)?.has(nb)) continue;
      if (visited[nb]) continue;
      visited[nb] = 1;
      stack.push(nb);
    }
  }
  for (let i = 0; i < total; i++) if (!visited[i]) return true;
  return false;
}

// Partition graph by cutting edges connecting adjacent pixels that
// share no common neighbor. Up to two edges are considered.
// Returns { cutEdges, parts } where parts are subgraphs in the same format as buildGraph.
function partitionAtEdgeCut(nodes, neighbors) {
  const total = neighbors.length;
  const candidateEdges = [];
  for (let i = 0; i < neighbors.length; i++) {
    const setI = new Set(neighbors[i]);
    for (const nb of neighbors[i]) {
      if (i >= nb) continue;
      let hasCommon = false;
      for (const nb2 of neighbors[nb]) {
        if (nb2 !== i && setI.has(nb2)) {
          hasCommon = true;
          break;
        }
      }
      if (!hasCommon) candidateEdges.push([i, nb]);
    }
  }

  const tryEdges = (edges) => {
    if (!isGraphDisconnectedByEdges(neighbors, total, edges)) return null;
    const blocked = new Map();
    for (const [a, b] of edges) {
      if (!blocked.has(a)) blocked.set(a, new Set());
      if (!blocked.has(b)) blocked.set(b, new Set());
      blocked.get(a).add(b);
      blocked.get(b).add(a);
    }
    const visited = new Uint8Array(total);
    const parts = [];
    for (let i = 0; i < total; i++) {
      if (visited[i]) continue;
      const stack = [i];
      visited[i] = 1;
      const comp = [];
      while (stack.length) {
        const node = stack.pop();
        comp.push(nodes[node]);
        for (const nb of neighbors[node]) {
          if (blocked.get(node)?.has(nb)) continue;
          if (visited[nb]) continue;
          visited[nb] = 1;
          stack.push(nb);
        }
      }
      parts.push(buildGraph(comp));
    }
    return { cutEdges: edges, parts };
  };

  for (const edge of candidateEdges) {
    const res = tryEdges([edge]);
    if (res) return res;
  }
  for (let i = 0; i < candidateEdges.length; i++) {
    for (let j = i + 1; j < candidateEdges.length; j++) {
      const res = tryEdges([candidateEdges[i], candidateEdges[j]]);
      if (res) return res;
    }
  }
  return null;
}

// Merge path covers across cut edges. `anchorPairs` is an array of [aPixel, bPixel].
function stitchPaths(paths, anchorPairs) {
  const combined = [...paths];
  for (const [aPixel, bPixel] of anchorPairs) {
    const ai = combined.findIndex(
      (p) => p[0] === aPixel || p[p.length - 1] === aPixel,
    );
    const bi = combined.findIndex(
      (p) => p[0] === bPixel || p[p.length - 1] === bPixel,
    );
    if (ai !== -1 && bi !== -1 && ai !== bi) {
      const aPath = combined.splice(ai, 1)[0];
      const bIndex = bi > ai ? bi - 1 : bi;
      const bPath = combined.splice(bIndex, 1)[0];
      if (aPath[aPath.length - 1] !== aPixel) aPath.reverse();
      if (bPath[0] !== bPixel) bPath.reverse();
      combined.push([...aPath, ...bPath]);
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
import { instantiate } from '@assemblyscript/loader';

let wasmBytesPromise;
async function getWasmBytes() {
  if (!wasmBytesPromise) {
    wasmBytesPromise = fetch('pathCoverSolver.wasm').then((r) => r.arrayBuffer());
  }
  return wasmBytesPromise;
}

async function instantiateSolver() {
  const bytes = await getWasmBytes();
  return instantiate(bytes);
}

class PathCoverSolver {
  constructor(nodes, neighbors, degrees, indexMap, opts) {
    this.nodes = nodes;
    this.neighbors = neighbors;
    this.baseDegrees = degrees;
    this.indexMap = indexMap;
    this.opts = opts;

    this.total = nodes.length;

    this.anchors = (opts.anchors || []).map((a) => indexMap.get(a));
    for (const a of opts.anchors || []) {
      if (indexMap.get(a) === undefined) throw new Error('Anchor pixel missing');
    }

    this.isAscending = opts.degreeOrder !== 'descending';

    this.best = { paths: null, pathCount: Infinity, level: -1, anchors: 0 };
    this.startTime = Date.now();
    this.timeExceeded = false;
    this.completed = false;
    this.requiredAnchors = this.anchors.length;
  }

  updateBest(acc, activeCount, currentPath = null) {
    const candidatePaths = currentPath ? [...acc, currentPath] : acc;
    const pathsCopy = candidatePaths.map((p) => p.slice());
    const pathCount = candidatePaths.length + activeCount;
    let anchors = 0;
    for (const a of this.anchors) {
      for (const p of candidatePaths) {
        if (p[0] === a || p[p.length - 1] === a) {
          anchors++;
          break;
        }
      }
    }
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

  remove(ctx, node) {
    ctx.remaining[node] = 0;
    for (const nb of this.neighbors[node]) if (ctx.remaining[nb]) ctx.degrees[nb]--;
  }

  restore(ctx, node) {
    for (const nb of this.neighbors[node]) if (ctx.remaining[nb]) ctx.degrees[nb]++;
    ctx.remaining[node] = 1;
  }

  chooseStart(ctx) {
    let bestIdx = -1;
    let best = this.isAscending ? Infinity : -1;
    for (let i = 0; i < ctx.degrees.length; i++) {
      if (!ctx.remaining[i]) continue;
      const d = ctx.degrees[i];
      if (this.isAscending ? d < best : d > best) {
        best = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  checkForBetterMemo(ctx, acc) {
    const k = ctx.remaining.join('');
    const prev = ctx.memo.get(k);
    if (prev != null && acc.length >= prev) return true;
    ctx.memo.set(k, acc.length);
    return false;
  }

  sortedNeighbor(ctx, node) {
    const result = [];
    for (const nb of this.neighbors[node]) {
      const d = ctx.degrees[nb];
      let inserted = false;
      for (let i = 0; i < result.length; i++) {
        const cd = ctx.degrees[result[i]];
        if (this.isAscending ? d < cd : d > cd) {
          result.splice(i, 0, nb);
          inserted = true;
          break;
        }
      }
      if (!inserted) result.push(nb);
    }
    return result;
  }

  async search(ctx, activeCount, acc) {
    this.updateBest(acc, activeCount);
    if (this.checkForBetterMemo(ctx, acc)) return;
    if (activeCount === 0) return;
    const isFirst = acc.length === 0;
    const startNode = isFirst && ctx.start != null ? ctx.start : this.chooseStart(ctx);
    this.remove(ctx, startNode);
    await this.extend(ctx, startNode, [startNode], activeCount - 1, acc, isFirst);
    this.restore(ctx, startNode);
  }

  async extend(ctx, node, path, activeCount, acc, isFirst) {
    this.updateBest(acc, activeCount, path);
    const nbs = this.sortedNeighbor(ctx, node);
    for (const nb of nbs) {
      if (!ctx.remaining[nb]) continue;
      this.remove(ctx, nb);
      path.push(nb);
      await this.extend(ctx, nb, path, activeCount - 1, acc, isFirst);
      if (this.timeExceeded || this.completed) return;
      path.pop();
      this.restore(ctx, nb);
    }

    this.checkTimeout();
    if (this.timeExceeded || this.completed) return;
    await new Promise(resolve => setTimeout(resolve));

    acc.push(path.slice());
    await this.search(ctx, activeCount, acc);
    acc.pop();
  }

  async run() {
    const starts = this.anchors.length ? this.anchors : [null];
    const tasks = starts.map((start) => {
      const ctx = {
        remaining: new Uint8Array(this.total).fill(1),
        degrees: Uint8Array.from(this.baseDegrees),
        memo: new Map(),
        start,
      };
      return this.search(ctx, this.total, []);
    });
    await Promise.all(tasks);
    return this.best.paths.map((p) => p.map((i) => this.nodes[i]));
  }
}

async function solve(input, opts = {}) {
  let nodes, neighbors, degrees, indexMap;
  if (input && input.nodes && input.neighbors && input.degrees) {
    ({ nodes, neighbors, degrees } = input);
    indexMap = new Map(nodes.map((p, i) => [p, i]));
  } else {
    ({ nodes, neighbors, degrees, indexMap } = buildGraph(input));
  }

  const partition = partitionAtEdgeCut(nodes, neighbors);
  if (partition) {
    const results = [];
    for (const part of partition.parts) {
      const anchorSet = new Set();
      if (opts.anchors) {
        for (const a of opts.anchors) if (part.nodes.includes(a)) anchorSet.add(a);
      }
      for (const [aIdx, bIdx] of partition.cutEdges) {
        const aPixel = nodes[aIdx];
        const bPixel = nodes[bIdx];
        if (part.nodes.includes(aPixel)) anchorSet.add(aPixel);
        if (part.nodes.includes(bPixel)) anchorSet.add(bPixel);
      }
      const partOpts = { anchors: [...anchorSet] };
      if (opts.degreeOrder) partOpts.degreeOrder = opts.degreeOrder;
      results.push(solve(part, partOpts));
    }
    const paths = (await Promise.all(results)).flat();
    const anchorPairs = partition.cutEdges.map(([a, b]) => [nodes[a], nodes[b]]);
    return stitchPaths(paths, anchorPairs);
  }

  const solver = new PathCoverSolver(nodes, neighbors, degrees, indexMap, opts);
  return await solver.run();
}

class HamiltonianService {
  async traverseWithStart(pixels, start) {
    const { nodes, neighbors, indexMap } = buildGraph(pixels);
    const { components, compIndex } = getComponents(neighbors);
    const startIdx = indexMap.get(start);
    if (startIdx === undefined) throw new Error('Start pixel missing');

    const result = [];
    for (let i = 0; i < components.length; i++) {
      const compPixels = components[i].map((idx) => nodes[idx]);
      if (compIndex[startIdx] === i) {
        result.push(...await solve(compPixels, { anchors: [start] }));
      } else {
        result.push(...await solve(compPixels));
      }
    }
    return result;
  }

  async traverseWithStartEnd(pixels, start, end) {
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
        result.push(...await solve(compPixels, { anchors: [start, end] }));
      } else {
        result.push(...await solve(compPixels));
      }
    }
    return result;
  }

  async traverseFree(pixels) {
    const { nodes, neighbors } = buildGraph(pixels);
    const { components } = getComponents(neighbors);
    const result = [];
    for (const comp of components) {
      const compPixels = comp.map((idx) => nodes[idx]);
      result.push(...await solve(compPixels));
    }
    return result;
  }
}

export const useHamiltonianService = () => new HamiltonianService();

export { buildGraph, partitionAtEdgeCut, solve };
