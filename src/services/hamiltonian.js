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

// -------- Dynamic programming solver ---------
// Uses row-wise DP with bitmask states. Each state bit marks whether the
// column has an open path from previous rows. Transitions are evaluated in a
// Viterbi-like manner and backpointers allow reconstruction of the optimal
// set of paths.
function dpSolveTile(pixels, bounds) {
  const { minX, minY, width, height } = bounds;
  const rowMasks = new Array(height).fill(0);
  for (const p of pixels) {
    const x = (p % MAX_DIMENSION) - minX;
    const y = Math.floor(p / MAX_DIMENSION) - minY;
    rowMasks[y] |= 1 << x;
  }

  const dp = Array(height + 1)
    .fill(0)
    .map(() => new Map());
  dp[0].set(0, { cost: 0, prev: null });

  const countRuns = (mask) => {
    let runs = 0;
    let inRun = false;
    for (let i = 0; i < width; i++) {
      const bit = (mask >> i) & 1;
      if (bit && !inRun) {
        runs++;
        inRun = true;
      } else if (!bit) {
        inRun = false;
      }
    }
    return runs;
  };

  for (let r = 0; r < height; r++) {
    const mask = rowMasks[r];
    for (const [state, info] of dp[r]) {
      const starts = countRuns(mask) - countRuns(mask & state);
      for (let next = 0; next < 1 << width; next++) {
        if ((next & ~mask) !== 0) continue;
        const cost = info.cost + starts;
        const cur = dp[r + 1].get(next);
        if (!cur || cost < cur.cost) {
          dp[r + 1].set(next, { cost, prev: state });
        }
      }
    }
  }

  if (!dp[height].has(0)) return [];

  const states = new Array(height + 1);
  states[height] = 0;
  for (let r = height; r > 0; r--) {
    const entry = dp[r].get(states[r]);
    states[r - 1] = entry.prev;
  }

  const paths = [];
  const open = new Array(width).fill(-1);
  for (let r = 0; r < height; r++) {
    const mask = rowMasks[r];
    const prev = states[r];
    const next = states[r + 1];
    for (let x = 0; x < width; x++) {
      if ((mask >> x) & 1) {
        let idx = open[x];
        if (((prev >> x) & 1) === 0 || idx === -1) {
          idx = paths.length;
          paths.push([]);
        }
        open[x] = idx;
        paths[idx].push(minX + x + MAX_DIMENSION * (minY + r));
      } else if ((prev >> x) & 1) {
        open[x] = -1;
      }
    }
    for (let x = 0; x < width; x++) {
      if ((next >> x) & 1) continue;
      open[x] = -1;
    }
  }
  return paths;
}

// Split the image into tiles and apply the DP solver to each tile.
function dpSolve(pixels, tileSize = 16) {
  if (pixels.length === 0) return [];

  const coords = pixels.map((p) => ({
    x: p % MAX_DIMENSION,
    y: Math.floor(p / MAX_DIMENSION),
    p,
  }));

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const { x, y } of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  if (width <= tileSize && height <= tileSize) {
    return dpSolveTile(pixels, { minX, minY, width, height });
  }

  const tiles = new Map();
  for (const { x, y, p } of coords) {
    const tx = Math.floor((x - minX) / tileSize);
    const ty = Math.floor((y - minY) / tileSize);
    const key = `${tx},${ty}`;
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(p);
  }

  const result = [];
  for (const [key, list] of tiles) {
    const [tx, ty] = key.split(',').map((n) => parseInt(n, 10));
    const offsetX = minX + tx * tileSize;
    const offsetY = minY + ty * tileSize;
    const bounds = {
      minX: offsetX,
      minY: offsetY,
      width: tileSize,
      height: tileSize,
    };
    result.push(...dpSolveTile(list, bounds));
  }
  return result;
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

  function lowerBound() {
    let remainingCount = 0;
    let oddCount = 0;
    let isolated = 0;
    for (let i = 0; i < degrees.length; i++) {
      if (!remaining[i]) continue;
      remainingCount++;
      const d = degrees[i];
      if (d === 0) isolated++;
      else if (d & 1) oddCount++;
    }
    let bound = isolated;
    const nonIsolated = remainingCount - isolated;
    if (nonIsolated > 0) {
      bound += Math.max(1, Math.ceil(oddCount / 2));
    }
    return bound;
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

  function search(activeCount, acc) {
    if (best.paths && acc.length + lowerBound() >= best.paths.length) return;
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

    const nbs = neighbors[node].slice().sort((a, b) => degrees[a] - degrees[b]);
    for (const nb of nbs) {
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
    if (pixels.length > 512) {
      return dpSolve(pixels);
    }
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
