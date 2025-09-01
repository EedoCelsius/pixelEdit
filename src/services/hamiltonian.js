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

// Attempt to split graph at a degree-2 vertex. If removing the vertex
// disconnects the graph into two components we treat each component as a tile
// and later stitch the solutions together.
function splitByDegreeTwo(pixels) {
  const { nodes, neighbors, degrees } = buildGraph(pixels);
  for (let i = 0; i < nodes.length; i++) {
    if (degrees[i] !== 2) continue;
    // create a copy of neighbors without vertex i
    const cloned = neighbors.map((nbs) => nbs.filter((n) => n !== i));
    cloned[i] = [];
    const { components } = getComponents(cloned);
    if (components.length === 2) {
      const tiles = components.map((comp) => comp.map((idx) => nodes[idx]));
      return { pivot: nodes[i], tiles };
    }
  }
  return null;
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

// Wrapper around the core solver that introduces two heuristics for large
// graphs:
// 1. Split the graph at degree-2 vertices and stitch the solutions.
// 2. Handle clusters of high degree (>=6) pixels separately and insert their
//    paths back into the base solution.
function solveTiled(pixels, opts = {}) {
  const split = splitByDegreeTwo(pixels);
  if (split) {
    const left = solve([...split.tiles[0], split.pivot], { end: split.pivot });
    const right = solve([...split.tiles[1], split.pivot], { start: split.pivot });
    if (left.length && right.length) {
      const stitched = [left[0].concat(right[0].slice(1))];
      stitched.push(...left.slice(1));
      stitched.push(...right.slice(1));
      return stitched;
    }
  }

  const { nodes, neighbors, degrees } = buildGraph(pixels);
  const high = new Set();
  for (let i = 0; i < nodes.length; i++) if (degrees[i] >= 6) high.add(i);
  if (high.size) {
    const visited = new Set();
    const tilePixels = [];
    const tileIndexSet = new Set();
    for (const i of high) {
      if (visited.has(i)) continue;
      const stack = [i];
      visited.add(i);
      const comp = [];
      while (stack.length) {
        const v = stack.pop();
        comp.push(v);
        for (const nb of neighbors[v]) {
          if (high.has(nb) && !visited.has(nb)) {
            visited.add(nb);
            stack.push(nb);
          }
        }
      }
      const filtered = comp.filter((idx) => degrees[idx] >= 3);
      if (filtered.length) {
        filtered.forEach((idx) => tileIndexSet.add(idx));
        tilePixels.push(filtered.map((idx) => nodes[idx]));
      }
    }

    const basePixels = nodes.filter((_, idx) => !tileIndexSet.has(idx));
    let result = solve(basePixels, opts);
    for (const t of tilePixels) {
      const tPaths = solve(t);
      result.splice(1, 0, ...tPaths);
    }
    return result;
  }

  return solve(pixels, opts);
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
        result.push(...solveTiled(compPixels, { start }));
      } else {
        result.push(...solveTiled(compPixels));
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
        result.push(...solveTiled(compPixels, { start, end }));
      } else {
        result.push(...solveTiled(compPixels));
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
      result.push(...solveTiled(compPixels));
    }
    return result;
  }

  return {
    traverseWithStart,
    traverseWithStartEnd,
    traverseFree,
  };
};
