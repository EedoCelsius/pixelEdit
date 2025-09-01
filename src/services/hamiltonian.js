import { MAX_DIMENSION } from '../utils';

// Build adjacency info for pixels with 8-way connectivity
// Returns { nodes, neighbors, degrees, indexMap }
function buildGraph(pixels) {
  const start = performance.now()
  console.log("start", start)
  const set = new Set(pixels);
  const nodes = Array.from(set);
  const indexMap = new Map(nodes.map((p, i) => [p, i]));
  const neighbors = nodes.map(() => []);

  const xs = new Int32Array(nodes.length);
  const ys = new Int32Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    xs[i] = p % MAX_DIMENSION;
    ys[i] = Math.floor(p / MAX_DIMENSION);
  }

  for (let i = 0; i < nodes.length; i++) {
    const x = xs[i];
    const y = ys[i];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nPixel = x + dx + MAX_DIMENSION * (y + dy);
        if (set.has(nPixel)) neighbors[i].push(indexMap.get(nPixel));
      }
    }
  }

  const degrees = neighbors.map((nbs) => nbs.length);
  for (const nbs of neighbors) nbs.sort((a, b) => degrees[a] - degrees[b]);

  console.log("end", performance.now() - start)
  return { nodes, neighbors, degrees, indexMap };
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

const DP_THRESHOLD = 20;

// Dynamic programming solver for Hamiltonian path using bitmasks
// Returns an array with a single path (or empty if no path exists)
function solveDP(pixels, opts = {}) {
  const { nodes, neighbors, indexMap } = buildGraph(pixels);
  const n = nodes.length;
  if (n === 0) return [];

  const start = opts.start != null ? indexMap.get(opts.start) : null;
  const end = opts.end != null ? indexMap.get(opts.end) : null;

  if (opts.start != null && start === undefined) throw new Error('Start pixel missing');
  if (opts.end != null && end === undefined) throw new Error('End pixel missing');

  const size = 1 << n;
  const INF = 1e9;
  const dist = new Int32Array(size * n);
  dist.fill(INF);
  const prev = new Int16Array(size * n);
  prev.fill(-1);

  if (start != null) {
    dist[(1 << start) * n + start] = 0;
  } else {
    for (let i = 0; i < n; i++) dist[(1 << i) * n + i] = 0;
  }

  for (let mask = 0; mask < size; mask++) {
    for (let v = 0; v < n; v++) {
      const idx = mask * n + v;
      if (!(mask & (1 << v)) || dist[idx] === INF) continue;
      for (const nb of neighbors[v]) {
        const bit = 1 << nb;
        if (mask & bit) continue;
        const nextMask = mask | bit;
        const nextIdx = nextMask * n + nb;
        const nd = dist[idx] + 1;
        if (nd < dist[nextIdx]) {
          dist[nextIdx] = nd;
          prev[nextIdx] = v;
        }
      }
    }
  }

  const fullMask = size - 1;
  let endV = end;
  if (endV == null) {
    let best = INF;
    for (let v = 0; v < n; v++) {
      const d = dist[fullMask * n + v];
      if (d < best) {
        best = d;
        endV = v;
      }
    }
    if (best === INF) return [];
  } else if (dist[fullMask * n + endV] === INF) {
    return [];
  }

  const path = [];
  let mask = fullMask;
  let v = endV;
  while (v !== -1) {
    path.push(v);
    const pv = prev[mask * n + v];
    mask ^= 1 << v;
    v = pv;
  }
  path.reverse();
  return [path.map((i) => nodes[i])];
}

// Core solver using backtracking to find minimum path cover
function solve(pixels, opts = {}) {
  const { nodes, neighbors, degrees, indexMap } = buildGraph(pixels);
  const total = nodes.length;
  const remaining = new Uint8Array(total);
  remaining.fill(1);

  const start = opts.start != null ? indexMap.get(opts.start) : null;
  const end = opts.end != null ? indexMap.get(opts.end) : null;

  if (opts.start != null && start === undefined) throw new Error('Start pixel missing');
  if (opts.end != null && end === undefined) throw new Error('End pixel missing');

  const best = { paths: null };

  function remove(node) {
    remaining[node] = 0;
    for (const nb of neighbors[node]) if (remaining[nb]) degrees[nb]--;
  }

  function restore(node) {
    for (const nb of neighbors[node]) if (remaining[nb]) degrees[nb]++;
    remaining[node] = 1;
  }

  function chooseStart() {
    let bestIdx = -1;
    let min = Infinity;
    for (let i = 0; i < degrees.length; i++) {
      if (!remaining[i]) continue;
      const d = degrees[i];
      if (d < min) {
        min = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function search(activeCount, acc) {
    if (best.paths && acc.length >= best.paths.length) return;
    if (activeCount === 0) {
      best.paths = acc.map((p) => p.slice());
      return;
    }
    const isFirst = acc.length === 0;
    const startNode = isFirst && start != null ? start : chooseStart();
    remove(startNode);
    extend(startNode, [startNode], activeCount - 1, acc, isFirst);
    restore(startNode);
  }

  function extend(node, path, activeCount, acc, isFirst) {
    if (best.paths && acc.length + 1 >= best.paths.length) return;

    for (const nb of neighbors[node]) {
      if (!remaining[nb]) continue;
      remove(nb);
      path.push(nb);
      extend(nb, path, activeCount - 1, acc, isFirst);
      path.pop();
      restore(nb);
    }

    if (!isFirst || end == null || node === end) {
      acc.push(path.slice());
      search(activeCount, acc);
      acc.pop();
    }
  }

  search(total, []);
  return best.paths ? best.paths.map((p) => p.map((i) => nodes[i])) : [];
}

export const useHamiltonianService = () => {
  function traverseWithStart(pixels, start) {
    const { nodes, neighbors, indexMap } = buildGraph(pixels);
    const { components, compIndex } = getComponents(neighbors);
    const startIdx = indexMap.get(start);
    if (startIdx === undefined) throw new Error('Start pixel missing');

    const result = [];
    for (let i = 0; i < components.length; i++) {
      const compPixels = components[i].map((idx) => nodes[idx]);
      const solver = compPixels.length <= DP_THRESHOLD ? solveDP : solve;
      if (compIndex[startIdx] === i) {
        result.push(...solver(compPixels, { start }));
      } else {
        result.push(...solver(compPixels));
      }
    }
    return result;
  }

  function traverseWithStartEnd(pixels, start, end) {
    const { nodes, neighbors, indexMap } = buildGraph(pixels);
    const { components, compIndex } = getComponents(neighbors);
    const startIdx = indexMap.get(start);
    const endIdx = indexMap.get(end);
    if (startIdx === undefined) throw new Error('Start pixel missing');
    if (endIdx === undefined) throw new Error('End pixel missing');
    if (compIndex[startIdx] !== compIndex[endIdx])
      throw new Error('Start and end pixels are disconnected');

    const result = [];
    for (let i = 0; i < components.length; i++) {
      const compPixels = components[i].map((idx) => nodes[idx]);
      const solver = compPixels.length <= DP_THRESHOLD ? solveDP : solve;
      if (compIndex[startIdx] === i) {
        result.push(...solver(compPixels, { start, end }));
      } else {
        result.push(...solver(compPixels));
      }
    }
    return result;
  }

  function traverseFree(pixels) {
    const { nodes, neighbors } = buildGraph(pixels);
    const { components } = getComponents(neighbors);
    const result = [];
    for (const comp of components) {
      const compPixels = comp.map((idx) => nodes[idx]);
      const solver = compPixels.length <= DP_THRESHOLD ? solveDP : solve;
      result.push(...solver(compPixels));
    }
    return result;
  }

  return {
    traverseWithStart,
    traverseWithStartEnd,
    traverseFree,
  };
};
