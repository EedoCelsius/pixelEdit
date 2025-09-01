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
// Core backtracking solver. This is kept isolated so that
// higher level helpers can pre-process the pixel set before
// delegating to the expensive search.
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

// Attempt to split the graph at a degree-2 vertex. Each side
// is solved independently and then stitched back together.
function splitOnDegreeTwo(nodes, neighbors, degrees, opts) {
  for (let i = 0; i < nodes.length; i++) {
    if (degrees[i] !== 2) continue;
    const [a, b] = neighbors[i];

    // Explore each side while ignoring the split vertex
    const visit = (start, forbidden) => {
      const stack = [start];
      const seen = new Set([start]);
      while (stack.length) {
        const n = stack.pop();
        for (const nb of neighbors[n]) {
          if (nb === forbidden || seen.has(nb)) continue;
          seen.add(nb);
          stack.push(nb);
        }
      }
      return seen;
    };

    const left = visit(a, i);
    const right = visit(b, i);
    if (left.has(b) || right.has(a)) continue;
    if (left.size + right.size + 1 !== nodes.length) continue; // not a clean split

    const pixelsLeft = Array.from(left, (idx) => nodes[idx]).concat(nodes[i]);
    const pixelsRight = Array.from(right, (idx) => nodes[idx]).concat(nodes[i]);

    const resLeft = baseSolve(pixelsLeft, { end: nodes[i] });
    const resRight = baseSolve(pixelsRight, { start: nodes[i] });
    if (!resLeft.length || !resRight.length) continue;

    const stitched = [...resLeft[0], ...resRight[0].slice(1)];
    return [stitched, ...resLeft.slice(1), ...resRight.slice(1)];
  }
  return null;
}

// Group clusters of high-degree (>=6) pixels. Only pixels with
// degree >=3 are kept inside the tile. We first solve the rest of
// the pixels and afterwards expand each tile's solution inside the
// main path.
function solveWithHighDegreeTiles(pixels) {
  const { nodes, neighbors, degrees } = buildGraph(pixels);

  const tileIndex = new Int32Array(nodes.length).fill(-1);
  const tiles = [];
  let tid = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (degrees[i] < 6 || tileIndex[i] !== -1) continue;
    const stack = [i];
    tileIndex[i] = tid;
    const cluster = [];
    while (stack.length) {
      const n = stack.pop();
      cluster.push(n);
      for (const nb of neighbors[n]) {
        if (tileIndex[nb] !== -1) continue;
        if (degrees[nb] >= 3) {
          tileIndex[nb] = tid;
          stack.push(nb);
        }
      }
    }
    tiles.push(cluster);
    tid++;
  }

  if (!tiles.length) return null;

  // Build the pixel set excluding tiles but keeping one anchor from each tile
  const baseSet = new Set(nodes);
  const anchors = [];
  for (const tile of tiles) {
    const anchor = nodes[tile[0]];
    anchors.push(anchor);
    for (const idx of tile) baseSet.delete(nodes[idx]);
    baseSet.add(anchor); // ensure anchor remains
  }

  const baseRes = baseSolve(Array.from(baseSet));
  if (!baseRes.length) return null;

  let mainPath = baseRes[0];
  const extraPaths = baseRes.slice(1);

  tiles.forEach((tile, idx) => {
    const tilePixels = tile.map((i) => nodes[i]);
    const tRes = baseSolve(tilePixels);
    if (!tRes.length) return; // skip if unsolved
    const anchor = anchors[idx];
    const pos = mainPath.indexOf(anchor);
    if (pos !== -1) {
      mainPath = [
        ...mainPath.slice(0, pos),
        ...tRes[0],
        ...mainPath.slice(pos + 1),
      ];
    }
    extraPaths.push(...tRes.slice(1));
  });

  return [mainPath, ...extraPaths];
}

// High level solver that tries to partition the graph for better
// performance before falling back to the full backtracking search.
function solve(pixels, opts = {}) {
  // Do not attempt optimisations when explicit start/end are given
  if (opts.start == null && opts.end == null) {
    const { nodes, neighbors, degrees } = buildGraph(pixels);
    const splitRes = splitOnDegreeTwo(nodes, neighbors, degrees, opts);
    if (splitRes) return splitRes;
    const tileRes = solveWithHighDegreeTiles(pixels);
    if (tileRes) return tileRes;
  }
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
