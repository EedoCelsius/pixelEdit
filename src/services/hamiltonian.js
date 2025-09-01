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
function backtrackingSolve(pixels, opts = {}) {
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

// DP based solver that processes the grid row by row using bitmask states.
// The algorithm keeps track of which cells in the current row have open paths
// that continue into the next row.  For large images the pixels are split into
// tiles so the state space remains manageable.  This is a simple Viterbi style
// solver that stores back pointers for reconstruction of the individual paths.

const TILE_SIZE = 32;

function dpSolveTile(pixels, offsetX, offsetY, width, height) {
  // Build grid for the tile
  const grid = Array.from({ length: height }, () => new Uint8Array(width));
  for (const p of pixels) {
    const x = (p % MAX_DIMENSION) - offsetX;
    const y = Math.floor(p / MAX_DIMENSION) - offsetY;
    if (x >= 0 && x < width && y >= 0 && y < height) grid[y][x] = 1;
  }

  // DP over rows with bitmask state of open paths
  let prev = new Map();
  prev.set(0, { cost: 0, prev: null });
  const back = []; // back pointers per row

  for (let y = 0; y < height; y++) {
    const row = grid[y];
    const next = new Map();
    const rowBack = new Map();
    for (const [state, info] of prev.entries()) {
      let newState = state;
      let cost = info.cost;
      for (let x = 0; x < width; x++) {
        const bit = 1 << x;
        const hasPixel = row[x] === 1;
        const open = (newState & bit) !== 0;
        if (hasPixel) {
          if (!open) {
            // start a new path
            cost++;
            newState |= bit;
          }
        } else if (open) {
          // close the path since pixel missing
          newState &= ~bit;
        }
      }
      const entry = next.get(newState);
      if (!entry || entry.cost > cost) {
        next.set(newState, { cost, prev: state });
        rowBack.set(newState, state);
      }
    }
    prev = next;
    back.push(rowBack);
  }

  // choose best final state (no additional cost for closing remaining paths)
  let bestState = 0;
  let bestCost = Infinity;
  for (const [state, info] of prev.entries()) {
    if (info.cost < bestCost) {
      bestCost = info.cost;
      bestState = state;
    }
  }

  // Reconstruct state per row
  const states = new Array(height);
  let currState = bestState;
  for (let y = height - 1; y >= 0; y--) {
    states[y] = currState;
    const prevState = back[y].get(currState);
    currState = prevState ?? 0;
  }

  // Build actual paths by following open columns
  const openIds = new Int32Array(width);
  openIds.fill(-1);
  const paths = [];

  for (let y = 0; y < height; y++) {
    const row = grid[y];
    const state = states[y];
    for (let x = 0; x < width; x++) {
      if (!row[x]) {
        if (openIds[x] !== -1) openIds[x] = -1;
        continue;
      }
      if (openIds[x] === -1) {
        openIds[x] = paths.length;
        paths.push([]);
      }
      const globalPixel = (y + offsetY) * MAX_DIMENSION + (x + offsetX);
      paths[openIds[x]].push(globalPixel);
      if (((state >> x) & 1) === 0) {
        openIds[x] = -1; // path ends here
      }
    }
  }

  return paths;
}

function dpSolve(pixels) {
  if (pixels.length === 0) return [];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pixels) {
    const x = p % MAX_DIMENSION;
    const y = Math.floor(p / MAX_DIMENSION);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  const allPaths = [];
  for (let ty = minY; ty <= maxY; ty += TILE_SIZE) {
    for (let tx = minX; tx <= maxX; tx += TILE_SIZE) {
      const tilePixels = [];
      for (const p of pixels) {
        const x = p % MAX_DIMENSION;
        const y = Math.floor(p / MAX_DIMENSION);
        if (x >= tx && x < tx + TILE_SIZE && y >= ty && y < ty + TILE_SIZE) {
          tilePixels.push(p);
        }
      }
      if (tilePixels.length === 0) continue;
      const tw = Math.min(TILE_SIZE, width - (tx - minX));
      const th = Math.min(TILE_SIZE, height - (ty - minY));
      allPaths.push(
        ...dpSolveTile(tilePixels, tx, ty, tw, th)
      );
    }
  }
  return allPaths;
}

function solve(pixels, opts = {}) {
  const LARGE_THRESHOLD = 256;
  if (opts.start == null && opts.end == null && pixels.length > LARGE_THRESHOLD) {
    return dpSolve(pixels);
  }
  return backtrackingSolve(pixels, opts);
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
