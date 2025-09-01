import { MAX_DIMENSION } from '../utils';

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
// This low-level solver assumes the pixel set is small enough to handle
// directly without any of the tiling heuristics.
function solveRaw(pixels, opts = {}) {
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

// Split the problem around a degree-2 vertex if possible. The two sides are
// solved separately and then stitched through the degree-2 vertex. This helps
// reduce the search space for snake-like regions.
function splitAtDegreeTwo(pixels, opts) {
  const { nodes, neighbors, degrees } = buildGraph(pixels);

  // Find a vertex with degree exactly 2.
  const idx = degrees.findIndex((d) => d === 2);
  if (idx === -1) return null;

  const centerPixel = nodes[idx];

  // If the start/end is on the splitting vertex, fall back to the raw solver
  // to preserve semantics.
  if (opts.start === centerPixel || opts.end === centerPixel) {
    return solveRaw(pixels, opts);
  }

  const [na, nb] = neighbors[idx];
  const visited = new Set([idx]);

  function collect(seed) {
    const stack = [seed];
    const part = [];
    while (stack.length) {
      const v = stack.pop();
      if (visited.has(v)) continue;
      visited.add(v);
      part.push(nodes[v]);
      for (const n of neighbors[v]) {
        if (!visited.has(n)) stack.push(n);
      }
    }
    return part;
  }

  const partA = collect(na);
  const partB = collect(nb);

  const optsA = {};
  const optsB = {};
  if (partA.includes(opts.start)) optsA.start = opts.start;
  if (partA.includes(opts.end)) optsA.end = opts.end;
  if (partB.includes(opts.start)) optsB.start = opts.start;
  if (partB.includes(opts.end)) optsB.end = opts.end;

  const resA = solve(partA, optsA);
  const resB = solve(partB, optsB);

  // Stitch the first path from both sides through the center pixel.
  const path = resA.shift().concat([centerPixel], resB.shift());
  return [path, ...resA, ...resB];
}

// Group adjacent pixels whose degrees are 7 or 8. These dense clusters are
// solved as independent tiles to avoid exploring them repeatedly.
function getHighDegreeTiles(nodes, neighbors, degrees) {
  const visited = new Uint8Array(nodes.length);
  const tiles = [];

  for (let i = 0; i < nodes.length; i++) {
    if (visited[i] || degrees[i] < 7) continue;
    visited[i] = 1;
    const stack = [i];
    const tile = [nodes[i]];
    while (stack.length) {
      const v = stack.pop();
      for (const nb of neighbors[v]) {
        if (!visited[nb] && degrees[nb] >= 7) {
          visited[nb] = 1;
          stack.push(nb);
          tile.push(nodes[nb]);
        }
      }
    }
    tiles.push(tile);
  }
  return tiles;
}

// High-level solver applying tiling heuristics before falling back to the
// exhaustive search.
function solve(pixels, opts = {}) {
  // Attempt to split at a degree-2 vertex. If successful the recursion handles
  // any further splits inside the partitions.
  const split = splitAtDegreeTwo(pixels, opts);
  if (split) return split;

  // Group high-degree clusters and solve them individually.
  const { nodes, neighbors, degrees } = buildGraph(pixels);
  const tiles = getHighDegreeTiles(nodes, neighbors, degrees);

  if (tiles.length && tiles.reduce((a, t) => a + t.length, 0) < nodes.length) {
    const covered = new Set();
    const result = [];
    for (const tile of tiles) {
      tile.forEach((p) => covered.add(p));
      const tOpts = {};
      if (tile.includes(opts.start)) tOpts.start = opts.start;
      if (tile.includes(opts.end)) tOpts.end = opts.end;
      result.push(...solve(tile, tOpts));
    }

    const remaining = nodes.filter((p) => !covered.has(p));
    if (remaining.length) {
      const remOpts = {};
      if (remaining.includes(opts.start)) remOpts.start = opts.start;
      if (remaining.includes(opts.end)) remOpts.end = opts.end;
      result.push(...solve(remaining, remOpts));
    }
    return result;
  }

  // No tiling heuristics applicable, fall back to the raw solver.
  return solveRaw(pixels, opts);
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
