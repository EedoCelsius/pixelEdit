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

// Split pixels into two sets if removing a degree-2 vertex disconnects the graph
function splitByDegreeTwo(pixels, opts = {}) {
  const { nodes, neighbors, degrees } = buildGraph(pixels);
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    if (degrees[i] !== 2) continue;
    const [a, b] = neighbors[i];
    const visited = new Uint8Array(n);
    visited[i] = 1;
    const stack = [a];
    visited[a] = 1;
    while (stack.length) {
      const v = stack.pop();
      for (const nb of neighbors[v]) {
        if (nb === i || visited[nb]) continue;
        visited[nb] = 1;
        stack.push(nb);
      }
    }
    if (!visited[b]) {
      const left = [];
      const right = [];
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        if (visited[j]) left.push(nodes[j]);
        else right.push(nodes[j]);
      }
      const mid = nodes[i];
      const leftOpts = {};
      const rightOpts = {};
      if (opts.start != null) {
        if (left.includes(opts.start)) leftOpts.start = opts.start;
        else if (opts.start === mid) rightOpts.start = mid;
        else rightOpts.start = opts.start;
      }
      if (opts.end != null) {
        if (left.includes(opts.end)) leftOpts.end = opts.end;
        else if (opts.end === mid) leftOpts.end = mid;
        else rightOpts.end = opts.end;
      }
      const leftPaths = solve(left, leftOpts);
      const rightPaths = solve(right, rightOpts);
      if (leftPaths.length) {
        leftPaths[leftPaths.length - 1].push(mid);
      } else {
        leftPaths.push([mid]);
      }
      if (rightPaths.length) {
        leftPaths[leftPaths.length - 1].push(...rightPaths[0]);
        for (let k = 1; k < rightPaths.length; k++) leftPaths.push(rightPaths[k]);
      }
      return leftPaths;
    }
  }
  return null;
}

// Extract tiles made of high degree pixels
function extractHighDegreeTiles(pixels) {
  const { nodes, neighbors, degrees } = buildGraph(pixels);
  const n = nodes.length;
  const visited = new Uint8Array(n);
  const baseSet = new Set(nodes);
  const tiles = [];

  for (let i = 0; i < n; i++) {
    if (visited[i] || degrees[i] < 6) continue;
    const stack = [i];
    const tileIdxs = new Set();
    visited[i] = 1;
    while (stack.length) {
      const v = stack.pop();
      tileIdxs.add(v);
      baseSet.delete(nodes[v]);
      for (const nb of neighbors[v]) {
        if (degrees[nb] >= 3 && !visited[nb]) {
          visited[nb] = 1;
          stack.push(nb);
        }
      }
    }

    let attachInside = null;
    let attachOutside = null;
    for (const v of tileIdxs) {
      for (const nb of neighbors[v]) {
        if (!tileIdxs.has(nb)) {
          attachInside = nodes[v];
          attachOutside = nodes[nb];
          break;
        }
      }
      if (attachInside != null) break;
    }

    tiles.push({
      pixels: Array.from(tileIdxs).map((idx) => nodes[idx]),
      attachInside,
      attachOutside,
    });
  }

  return { basePixels: Array.from(baseSet), tiles };
}

function insertTilePaths(paths, tilePaths, outside, inside) {
  if (!outside) {
    paths.push(...tilePaths);
    return paths;
  }
  for (let i = 0; i < paths.length; i++) {
    const seg = paths[i];
    const idx = seg.indexOf(outside);
    if (idx !== -1) {
      const insertSeg = seg.slice(0, idx + 1);
      if (tilePaths.length) {
        if (tilePaths[0][0] !== inside) {
          tilePaths[0] = tilePaths[0].slice().reverse();
        }
        insertSeg.push(...tilePaths[0]);
        if (tilePaths.length > 1) paths.splice(i + 1, 0, ...tilePaths.slice(1));
      }
      insertSeg.push(...seg.slice(idx + 1));
      paths[i] = insertSeg;
      return paths;
    }
  }
  paths.push(...tilePaths);
  return paths;
}

// Core solver using backtracking to find minimum path cover
function solveBasic(pixels, opts = {}) {
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

// High level solver applying preprocessing steps
function solve(pixels, opts = {}) {
  const split = splitByDegreeTwo(pixels, opts);
  if (split) return split;

  const { basePixels, tiles } = extractHighDegreeTiles(pixels);
  if (tiles.length) {
    let paths = solve(basePixels, opts);
    for (const tile of tiles) {
      const tilePaths = solve(tile.pixels, { start: tile.attachInside });
      paths = insertTilePaths(paths, tilePaths, tile.attachOutside, tile.attachInside);
    }
    return paths;
  }

  return solveBasic(pixels, opts);
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
