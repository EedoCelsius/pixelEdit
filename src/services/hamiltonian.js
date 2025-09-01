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
// This function works on a single connected set of pixels and does not
// perform any tiling optimisation.  It is intentionally kept isolated so
// that higher level routines can compose the results from multiple tiles.
function baseSolve(pixels, opts = {}) {
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

// -------------------- Tiling helpers --------------------

// Split the graph into two components around a degree-2 vertex.  The
// function returns two arrays of node indices representing the two sides.
function splitAroundDegreeTwo(idx, neighbors) {
  if (neighbors[idx].length !== 2) return null;
  const [a, b] = neighbors[idx];

  const gather = (start, blocked) => {
    const stack = [start];
    const visited = new Set([idx, blocked]);
    const comp = [];
    while (stack.length) {
      const node = stack.pop();
      comp.push(node);
      for (const nb of neighbors[node]) {
        if (!visited.has(nb)) {
          visited.add(nb);
          stack.push(nb);
        }
      }
    }
    return comp;
  };

  return [gather(a, b), gather(b, a)];
}

// Combine two sets of paths with the splitting vertex in-between.
function stitchPaths(pivotPixel, pathsA, pathsB) {
  const result = [...pathsA, ...pathsB];
  if (pathsA.length && pathsB.length) {
    const lastA = result[pathsA.length - 1];
    const firstB = result[pathsA.length];
    const combined = [...lastA, pivotPixel, ...firstB];
    result.splice(pathsA.length - 1, 2, combined);
  } else if (pathsA.length) {
    result[pathsA.length - 1].push(pivotPixel);
  } else if (pathsB.length) {
    result[0].unshift(pivotPixel);
  } else {
    result.push([pivotPixel]);
  }
  return result;
}

// Extract clusters of high degree nodes (>=6).  Each cluster is returned as
// a Set of node indices containing only vertices of degree >=3.
function getHighDegreeTiles(neighbors, degrees) {
  const visited = new Uint8Array(degrees.length);
  const tiles = [];
  for (let i = 0; i < degrees.length; i++) {
    if (visited[i] || degrees[i] < 6) continue;
    const stack = [i];
    const tile = new Set();
    while (stack.length) {
      const node = stack.pop();
      if (visited[node]) continue;
      visited[node] = 1;
      if (degrees[node] >= 3) tile.add(node);
      for (const nb of neighbors[node]) {
        if (degrees[nb] >= 3 && !visited[nb]) stack.push(nb);
      }
    }
    if (tile.size) tiles.push(tile);
  }
  return tiles;
}

// Insert tile paths into the main paths after a boundary vertex.  The tile is
// given as a Set of node indices.  Both mainPaths and tilePaths contain pixel
// identifiers (not indices).
function insertTilePaths(mainPaths, tilePaths, tile, nodes, neighbors) {
  let boundaryInside = null;
  let boundaryOutside = null;
  for (const idx of tile) {
    for (const nb of neighbors[idx]) {
      if (!tile.has(nb)) {
        boundaryInside = nodes[idx];
        boundaryOutside = nodes[nb];
        break;
      }
    }
    if (boundaryInside) break;
  }

  if (boundaryOutside != null) {
    for (const path of mainPaths) {
      const pos = path.indexOf(boundaryOutside);
      if (pos !== -1) {
        // Merge first tile path directly into the main path
        if (tilePaths.length) {
          const first = tilePaths[0];
          path.splice(pos + 1, 0, ...first);
          for (let i = 1; i < tilePaths.length; i++) {
            mainPaths.push(tilePaths[i]);
          }
        }
        return mainPaths;
      }
    }
  }

  // No boundary match, simply append
  return mainPaths.concat(tilePaths);
}

// High level solver that performs tiling optimisations before delegating to
// the core backtracking solver.
function solve(pixels, opts = {}) {
  const { nodes, neighbors, degrees } = buildGraph(pixels);

  // Step 1: split on a degree-2 vertex if possible
  const splitIdx = degrees.findIndex((d) => d === 2);
  if (splitIdx !== -1) {
    const parts = splitAroundDegreeTwo(splitIdx, neighbors);
    if (parts) {
      const pivotPixel = nodes[splitIdx];
      const leftPixels = parts[0].map((i) => nodes[i]);
      const rightPixels = parts[1].map((i) => nodes[i]);
      const leftPaths = solve(leftPixels, opts);
      const rightPaths = solve(rightPixels, opts);
      return stitchPaths(pivotPixel, leftPaths, rightPaths);
    }
  }

  // Step 2: group high degree tiles
  const tiles = getHighDegreeTiles(neighbors, degrees);
  if (tiles.length) {
    const used = new Uint8Array(nodes.length);
    for (const tile of tiles) {
      for (const idx of tile) used[idx] = 1;
    }
    const mainPixels = nodes.filter((_, idx) => !used[idx]);
    let result = baseSolve(mainPixels, opts);
    for (const tile of tiles) {
      const tilePixels = Array.from(tile, (i) => nodes[i]);
      const tilePaths = baseSolve(tilePixels, opts);
      result = insertTilePaths(result, tilePaths, tile, nodes, neighbors);
    }
    return result;
  }

  // Fallback to base solver
  return baseSolve(pixels, opts);
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
