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

function stitch(a, pivot, b) {
  const res = [];
  res.push(...a);
  res.push([pivot]);
  res.push(...b);
  return res;
}

function filterOpts(pixels, opts) {
  const set = new Set(pixels);
  const sub = {};
  if (opts.start != null && set.has(opts.start)) sub.start = opts.start;
  if (opts.end != null && set.has(opts.end)) sub.end = opts.end;
  return sub;
}

// Core solver using backtracking to find minimum path cover
function coreSolve(pixels, opts = {}) {
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

// Wrapper solver that tiles complex regions before using the core solver
function solve(pixels, opts = {}) {
  const { nodes, neighbors, degrees } = buildGraph(pixels);

  // Split around a degree-2 vertex into two tiles and stitch results
  for (let i = 0; i < nodes.length; i++) {
    if (degrees[i] === 2) {
      const [na, nb] = neighbors[i];
      const visited = new Uint8Array(nodes.length);
      visited[i] = 1;

      function collect(startIdx, acc) {
        const stack = [startIdx];
        visited[startIdx] = 1;
        while (stack.length) {
          const v = stack.pop();
          acc.push(nodes[v]);
          for (const nb2 of neighbors[v]) {
            if (nb2 === i || visited[nb2]) continue;
            visited[nb2] = 1;
            stack.push(nb2);
          }
        }
      }

      const compA = [];
      const compB = [];
      collect(na, compA);
      collect(nb, compB);

      const pathsA = solve(compA, filterOpts(compA, opts));
      const pathsB = solve(compB, filterOpts(compB, opts));
      return stitch(pathsA, nodes[i], pathsB);
    }
  }

  // Group adjacent high-degree nodes (>=6) as tiles including neighbors with degree >=3
  const visited = new Uint8Array(nodes.length);
  const tilePaths = [];
  let hasTile = false;
  for (let i = 0; i < nodes.length; i++) {
    if (degrees[i] >= 6 && !visited[i]) {
      hasTile = true;
      const stack = [i];
      const tileIdxs = [];
      visited[i] = 1;
      while (stack.length) {
        const v = stack.pop();
        tileIdxs.push(v);
        for (const nb of neighbors[v]) {
          if (!visited[nb] && degrees[nb] >= 3) {
            visited[nb] = 1;
            stack.push(nb);
          }
        }
      }
      const tilePixels = tileIdxs.map((idx) => nodes[idx]);
      tilePaths.push(...solve(tilePixels, filterOpts(tilePixels, opts)));
    }
  }

  if (hasTile) {
    const remain = [];
    for (let i = 0; i < nodes.length; i++) if (!visited[i]) remain.push(nodes[i]);
    const mainPaths = remain.length ? coreSolve(remain, opts) : [];
    return [...mainPaths, ...tilePaths];
  }

  return coreSolve(pixels, opts);
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
