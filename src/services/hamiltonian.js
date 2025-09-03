import { MAX_DIMENSION } from '../utils';
import { TIME_LIMIT } from '../constants';

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

// Attempt to find a degree-2 articulation vertex.
// Returns the index of the cut vertex or null if none found.
function findDegree2Cut(neighbors, degrees) {
  for (let i = 0; i < neighbors.length; i++) {
    if (degrees[i] !== 2) continue;
    const [a, b] = neighbors[i];
    const visited = new Uint8Array(neighbors.length);
    const stack = [a];
    visited[a] = 1;
    while (stack.length) {
      const node = stack.pop();
      for (const nb of neighbors[node]) {
        if (nb === i || visited[nb]) continue;
        visited[nb] = 1;
        stack.push(nb);
      }
    }
    if (!visited[b]) return i;
  }
  return null;
}

// Partition graph around a cut vertex into two sets of indices
function partitionAtCut(neighbors, cut) {
  const res = [];
  for (const nb of neighbors[cut]) {
    const comp = [cut];
    const stack = [nb];
    const visited = new Set([cut]);
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
function solve(pixels, opts = {}) {
  const { nodes, neighbors, degrees, indexMap } = buildGraph(pixels);

  const cut = findDegree2Cut(neighbors, degrees);
  if (cut != null) {
    const parts = partitionAtCut(neighbors, cut);
    const cutPixel = nodes[cut];
    const [leftIdxs, rightIdxs] = parts;
    const leftPixels = leftIdxs.map((i) => nodes[i]);
    const rightPixels = rightIdxs.map((i) => nodes[i]);
    const leftOpts = {};
    const rightOpts = {};
    if (opts.start != null) {
      const idx = indexMap.get(opts.start);
      if (leftIdxs.includes(idx)) leftOpts.start = opts.start;
      if (rightIdxs.includes(idx)) rightOpts.start = opts.start;
    }
    if (opts.end != null) {
      const idx = indexMap.get(opts.end);
      if (leftIdxs.includes(idx)) leftOpts.end = opts.end;
      if (rightIdxs.includes(idx)) rightOpts.end = opts.end;
    }
    const left = solve(leftPixels, leftOpts);
    const right = solve(rightPixels, rightOpts);
    return stitchPaths(left, right, cutPixel);
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
