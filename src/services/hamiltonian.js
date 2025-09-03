const MAX_DIMENSION = 65536; // from utils
const TIME_LIMIT = 7500; // from constants/hamiltonian.js

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
  function dirOrder(dx, dy) {
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

  for (let i = 0; i < neighbors.length; i++) {
    const nbs = neighbors[i];
    nbs.sort((a, b) => {
      const da = degrees[a];
      const db = degrees[b];
      if (da !== db) return da - db;
      const orderA = dirOrder(xs[a] - xs[i], ys[a] - ys[i]);
      const orderB = dirOrder(xs[b] - xs[i], ys[b] - ys[i]);
      return orderA - orderB;
    });
  }

  return { nodes, neighbors, degrees, indexMap };
}

// Attempt to find a minimal set of degree-2 vertices whose removal
// disconnects the graph. Returns an array of vertex indices or null if
// no such cut set exists.
function findDegree2CutSet(neighbors, degrees) {
  const degree2 = [];
  for (let i = 0; i < degrees.length; i++) if (degrees[i] === 2) degree2.push(i);
  const total = neighbors.length;

  function isCut(rem) {
    const blocked = new Uint8Array(total);
    for (const r of rem) blocked[r] = 1;
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

  const k = degree2.length;
  const combo = [];
  function search(start, depth, target) {
    if (depth === target) return isCut(combo) ? combo.slice() : null;
    for (let i = start; i < k; i++) {
      combo[depth] = degree2[i];
      const res = search(i + 1, depth + 1, target);
      if (res) return res;
    }
    return null;
  }

  for (let r = 1; r <= k; r++) {
    const res = search(0, 0, r);
    if (res) return res;
  }
  return null;
}

// Partition graph around a cut set. Returns arrays of indices for each
// component, including the cut vertices adjacent to that component.
function partitionAtCut(neighbors, cutSet) {
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
    res.push([...comp, ...adjCuts]);
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

  const cutSet = findDegree2CutSet(neighbors, degrees);
  if (cutSet && cutSet.length) {
    const parts = partitionAtCut(neighbors, cutSet);
    const cutPixels = cutSet.map((i) => nodes[i]);
    const results = [];
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
      results.push(solve(partPixels, partOpts));
    }
    let combined = results.shift();
    for (const res of results) {
      let merged = false;
      for (const cp of cutPixels) {
        if (
          combined.some((p) => p.includes(cp)) &&
          res.some((p) => p.includes(cp))
        ) {
          combined = stitchPaths(combined, res, cp);
          merged = true;
          break;
        }
      }
      if (!merged) combined = combined.concat(res);
    }
    return combined;
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

export { buildGraph, findDegree2CutSet, solve };
