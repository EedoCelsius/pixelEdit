import { MAX_DIMENSION } from '../utils';
import { TIME_LIMIT } from '../constants';

// Cache solved subgraphs keyed by pixel set and optional start/end
const solvedCache = new Map();
// Build adjacency info for pixels with 8-way connectivity
// Returns { nodes, neighbors, degrees, indexMap }
function buildGraph(pixels) {
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

  return { nodes, neighbors, degrees, indexMap };
}

// Contract chains of degree-2 vertices into single edges for cut detection
function buildSkeletonGraph(neighbors) {
  const n = neighbors.length;
  const degrees = neighbors.map((nbs) => nbs.length);
  const hubs = [];
  const origToSk = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (degrees[i] !== 2) {
      origToSk[i] = hubs.length;
      hubs.push(i);
    }
  }

  const skNeighbors = hubs.map(() => []);
  const seen = hubs.map(() => new Set());
  for (const hi of hubs) {
    const skI = origToSk[hi];
    for (const nb of neighbors[hi]) {
      let prev = hi;
      let cur = nb;
      while (degrees[cur] === 2) {
        const [a, b] = neighbors[cur];
        const next = a === prev ? b : a;
        prev = cur;
        cur = next;
      }
      if (cur === hi) continue;
      const skJ = origToSk[cur];
      if (skJ === -1) continue;
      if (!seen[skI].has(skJ)) {
        skNeighbors[skI].push(skJ);
        skNeighbors[skJ].push(skI);
        seen[skI].add(skJ);
        seen[skJ].add(skI);
      }
    }
  }
  return { skNeighbors, hubs };
}

// Find an articulation vertex using Tarjan's algorithm on the skeleton graph.
// Returns the index of the original cut vertex or null if none found.
function findArticulationCut(neighbors) {
  const { skNeighbors, hubs } = buildSkeletonGraph(neighbors);
  const n = skNeighbors.length;
  const disc = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  let time = 0;
  let cut = null;

  function dfs(u, parent) {
    disc[u] = low[u] = time++;
    let childCount = 0;
    for (const v of skNeighbors[u]) {
      if (cut != null) return;
      if (disc[v] === -1) {
        childCount++;
        dfs(v, u);
        low[u] = Math.min(low[u], low[v]);
        if (parent !== -1 && low[v] >= disc[u]) {
          cut = u;
          return;
        }
      } else if (v !== parent) {
        low[u] = Math.min(low[u], disc[v]);
      }
    }
    if (parent === -1 && childCount > 1) cut = u;
  }

  for (let i = 0; i < n && cut == null; i++) {
    if (disc[i] === -1) dfs(i, -1);
  }
  return cut == null ? null : hubs[cut];
}

// Partition graph around a cut vertex into unique components
// Each returned component contains the cut index followed by all nodes in that component
function partitionAtCut(neighbors, cut) {
  const visited = new Set([cut]);
  const res = [];
  for (const nb of neighbors[cut]) {
    if (visited.has(nb)) continue;
    const comp = [cut];
    const stack = [nb];
    visited.add(nb);
    while (stack.length) {
      const node = stack.pop();
      comp.push(node);
      for (const n of neighbors[node]) {
        if (visited.has(n)) continue;
        visited.add(n);
        stack.push(n);
      }
    }
    res.push(comp);
  }
  return res;
}

// Merge path covers from multiple components around the shared cut pixel
function stitchPaths(parts, cutPixel) {
  const nonCut = [];
  const cutPaths = [];
  for (const paths of parts) {
    const idx = paths.findIndex((p) => p.includes(cutPixel));
    const cutPath = paths.splice(idx, 1)[0];
    cutPaths.push(cutPath);
    nonCut.push(...paths);
  }

  if (cutPaths.length === 0) return nonCut;

  // Orient paths so they start with the cut pixel for consistent ordering
  const oriented = cutPaths.map((p) => {
    if (p[0] === cutPixel) return p.slice();
    if (p[p.length - 1] === cutPixel) return p.slice().reverse();
    return p.slice();
  });

  // Order by the neighbor following the cut for determinism
  oriented.sort((a, b) => (a[1] ?? Infinity) - (b[1] ?? Infinity));

  let base = oriented.shift();
  if (base[base.length - 1] !== cutPixel) base.reverse();

  if (oriented.length) {
    let next = oriented.shift();
    if (next[0] !== cutPixel) next.reverse();
    base = base.concat(next.slice(1));
    for (const p of oriented) {
      if (p[0] === cutPixel) nonCut.push(p.slice(1));
      else if (p[p.length - 1] === cutPixel) nonCut.push(p.slice(0, -1));
      else nonCut.push(p.slice());
    }
  }

  nonCut.push(base);
  return nonCut;
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
function solve(pixels, opts = {}) {
  const keyBase = pixels.slice().sort((a, b) => a - b).join(',');
  const cacheKey = `${keyBase}|${opts.start ?? ''}|${opts.end ?? ''}`;
  if (solvedCache.has(cacheKey)) {
    const cached = solvedCache.get(cacheKey);
    return cached.map((p) => p.slice());
  }
  const { nodes, neighbors, degrees, indexMap } = buildGraph(pixels);

  const cut = findArticulationCut(neighbors);
  if (cut != null) {
    const parts = partitionAtCut(neighbors, cut);
    const cutPixel = nodes[cut];
    const subResults = [];
    for (const idxs of parts) {
      const partPixels = idxs.map((i) => nodes[i]);
      const partOpts = {};
      if (opts.start != null) {
        const idx = indexMap.get(opts.start);
        if (idxs.includes(idx)) partOpts.start = opts.start;
      }
      if (opts.end != null) {
        const idx = indexMap.get(opts.end);
        if (idxs.includes(idx)) partOpts.end = opts.end;
      }
      subResults.push(solve(partPixels, partOpts));
    }
    return stitchPaths(subResults, cutPixel);
  }
  const total = nodes.length;
  const remaining = new Uint8Array(total);
  remaining.fill(1);

  const start = opts.start != null ? indexMap.get(opts.start) : null;
  const end = opts.end != null ? indexMap.get(opts.end) : null;

  if (opts.start != null && start === undefined) throw new Error('Start pixel missing');
  if (opts.end != null && end === undefined) throw new Error('End pixel missing');

  const best = { paths: null };
  const memo = new Map();
  const startTime = Date.now();
  let timeExceeded = false;

  function checkTime(acc) {
    if (Date.now() - startTime > TIME_LIMIT) {
      if (!best.paths || acc.length < best.paths.length)
        best.paths = acc.map((p) => p.slice());
      timeExceeded = true;
      return true;
    }
    return false;
  }

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

  function key() {
    return remaining.join('');
  }

  function search(activeCount, acc) {
    if (timeExceeded) return;
    if (checkTime(acc)) return;
    const k = key();
    const prev = memo.get(k);
    if (prev != null && acc.length >= prev) return;
    memo.set(k, acc.length);
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
    if (timeExceeded) return;
    if (checkTime(acc)) return;
    if (best.paths && acc.length + 1 >= best.paths.length) return;

    for (const nb of neighbors[node]) {
      if (!remaining[nb]) continue;
      remove(nb);
      path.push(nb);
      extend(nb, path, activeCount - 1, acc, isFirst);
      path.pop();
      restore(nb);
      if (timeExceeded) return;
    }

    if (!isFirst || end == null || node === end) {
      acc.push(path.slice());
      search(activeCount, acc);
      acc.pop();
    }
  }

  search(total, []);
  let paths = [];
  if (best.paths) {
    paths = best.paths.map((p) => p.map((i) => nodes[i]));
  }
  const covered = new Set(paths.flat());
  for (const node of nodes) {
    if (!covered.has(node)) paths.push([node]);
  }
  solvedCache.set(cacheKey, paths.map((p) => p.slice()));
  return paths;
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
      if (compIndex[startIdx] === i) {
        result.push(...solve(compPixels, { start }));
      } else {
        result.push(...solve(compPixels));
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
      if (compIndex[startIdx] === i) {
        result.push(...solve(compPixels, { start, end }));
      } else {
        result.push(...solve(compPixels));
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
      result.push(...solve(compPixels));
    }
    return result;
  }

  return {
    traverseWithStart,
    traverseWithStartEnd,
    traverseFree,
  };
};
