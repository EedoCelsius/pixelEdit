const MAX_DIMENSION = 65536; // from utils
const TIME_LIMIT = 7500; // from constants/hamiltonian.js

// Build adjacency info for pixels with 8-way connectivity
// Returns { nodes, neighbors, degrees, indexMap }
function buildGraph(pixels) {
  const set = new Set(pixels);
  const nodes = Array.from(set);
  const indexMap = new Map(nodes.map((p, i) => [p, i]));
  const neighbors = nodes.map(() => []);

  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    const x = p % MAX_DIMENSION;
    const y = Math.floor(p / MAX_DIMENSION);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nPixel = x + dx + MAX_DIMENSION * (y + dy);
        if (set.has(nPixel)) neighbors[i].push(indexMap.get(nPixel));
      }
    }
  }

  const degrees = neighbors.map((nbs) => nbs.length);

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
function partitionAtCut(nodes, neighbors, cutSet) {
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
    const partIndices = [...comp, ...adjCuts];
    const indexMap = new Map(partIndices.map((idx, j) => [idx, j]));
    const partNeighbors = partIndices.map((origIdx) => {
      const list = [];
      for (const nb of neighbors[origIdx]) {
        const mapped = indexMap.get(nb);
        if (mapped != null) list.push(mapped);
      }
      return list;
    });
    const partDegrees = partNeighbors.map((nbs) => nbs.length);
    const partNodes = partIndices.map((idx) => nodes[idx]);
    res.push({ nodes: partNodes, neighbors: partNeighbors, degrees: partDegrees });
  }
  return res;
}

// Merge two path covers using the shared cut pixel
function stitchPaths(left, right, cutPixel) {
  function extract(paths, needEnd) {
    const idx = paths.findIndex((p) => p.includes(cutPixel));
    const path = paths.splice(idx, 1)[0];
    const pos = path.indexOf(cutPixel);
    if (needEnd) {
      if (pos === path.length - 1) return path;
      if (pos === 0) return path.reverse();
      const before = path.slice(0, pos + 1); // ends with cutPixel
      const after = path.slice(pos); // starts with cutPixel
      paths.push(after);
      return before;
    }
    // need cutPixel at start
    if (pos === 0) return path;
    if (pos === path.length - 1) return path.reverse();
    const before = path.slice(0, pos + 1); // ends with cutPixel
    const after = path.slice(pos); // starts with cutPixel
    paths.push(before);
    return after;
  }

  const lPath = extract(left, true); // ends with cutPixel
  const rPath = extract(right, false); // starts with cutPixel
  const joined = lPath.concat(rPath.slice(1));
  return [...left, ...right, joined];
}

// Merge all paths sharing any cut pixel until none remain duplicated
function mergeCutPaths(paths, cutPixels) {
  let res = paths.slice();
  let changed = true;
  while (changed) {
    changed = false;
    for (const cp of cutPixels) {
      const group = res.filter((p) => p.includes(cp));
      if (group.length > 1) {
        let merged = [group.shift()];
        for (const p of group) {
          merged = stitchPaths(merged, [p], cp);
        }
        res = res.filter((p) => !p.includes(cp));
        res.push(...merged);
        changed = true;
      }
    }
  }
  for (const p of res) {
    if (p.length > 1 && p[0] === p[p.length - 1]) p.pop();
  }
  return res;
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
function solveSequential(input, opts = {}) {
  let nodes, neighbors, degrees, indexMap;
  if (input && input.nodes && input.neighbors && input.degrees) {
    ({ nodes, neighbors, degrees } = input);
    indexMap = new Map(nodes.map((p, i) => [p, i]));
  } else {
    ({ nodes, neighbors, degrees, indexMap } = buildGraph(input));
  }

  const cutSet = findDegree2CutSet(neighbors, degrees);
  if (cutSet && cutSet.length) {
    const parts = partitionAtCut(nodes, neighbors, cutSet);
    const cutPixels = cutSet.map((i) => nodes[i]);
    const results = [];
    for (const part of parts) {
      const partOpts = {};
      if (opts.start != null && part.nodes.includes(opts.start))
        partOpts.start = opts.start;
      if (opts.end != null && part.nodes.includes(opts.end))
        partOpts.end = opts.end;
      if (opts.degreeOrder) partOpts.degreeOrder = opts.degreeOrder;
      const partCuts = cutPixels.filter((cp) => part.nodes.includes(cp));
      for (const cp of partCuts) {
        if (partOpts.start == null && cp !== partOpts.end) partOpts.start = cp;
        else if (partOpts.end == null && cp !== partOpts.start)
          partOpts.end = cp;
      }
      results.push(solveSequential(part, partOpts));
    }

    return mergeCutPaths(results.flat(), cutPixels);
  }

  const xs = new Int32Array(nodes.length);
  const ys = new Int32Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    xs[i] = p % MAX_DIMENSION;
    ys[i] = Math.floor(p / MAX_DIMENSION);
  }

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

  const total = nodes.length;
  const remaining = new Uint8Array(total);
  remaining.fill(1);

  const start = opts.start != null ? indexMap.get(opts.start) : null;
  const end = opts.end != null ? indexMap.get(opts.end) : null;
  const isAscending = opts.degreeOrder !== 'descending';

  if (opts.start != null && start === undefined) throw new Error('Start pixel missing');
  if (opts.end != null && end === undefined) throw new Error('End pixel missing');

  const best = { paths: null };
  const memo = new Map();
  const startTime = Date.now();
  let timeExceeded = false;

  function checkTime(acc, partial) {
    if (Date.now() - startTime > TIME_LIMIT) {
      let candidate = acc.map((p) => p.slice());
      if (partial && partial.length) candidate = candidate.concat([partial.slice()]);
      if (!best.paths || candidate.length < best.paths.length) best.paths = candidate;
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
    let best = isAscending ? Infinity : -1;
    for (let i = 0; i < degrees.length; i++) {
      if (!remaining[i]) continue;
      const d = degrees[i];
      if (isAscending ? d < best : d > best) {
        best = d;
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
    if (checkTime(acc, path)) return;
    if (best.paths && acc.length + 1 >= best.paths.length) return;
    const nbs = neighbors[node];
    nbs.sort((a, b) => {
      const da = degrees[a];
      const db = degrees[b];
      if (da !== db) return isAscending ? da - db : db - da;
      const orderA = dirOrder(xs[a] - xs[node], ys[a] - ys[node]);
      const orderB = dirOrder(xs[b] - xs[node], ys[b] - ys[node]);
      return orderA - orderB;
    });
    for (const nb of nbs) {
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

async function runWorker(input, opts) {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return Promise.resolve(solveSequential(input, opts));
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./hamiltonianWorker.js', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e) => resolve(e.data);
    worker.onerror = reject;
    worker.postMessage({ input, opts });
  });
}

async function solveCore(input, opts = {}) {
  let nodes, neighbors, degrees;
  if (input && input.nodes && input.neighbors && input.degrees) {
    ({ nodes, neighbors, degrees } = input);
  } else {
    ({ nodes, neighbors, degrees } = buildGraph(input));
  }

  const cutSet = findDegree2CutSet(neighbors, degrees);
  let paths;
  if (cutSet && cutSet.length) {
    const parts = partitionAtCut(nodes, neighbors, cutSet);
    const cutPixels = cutSet.map((i) => nodes[i]);
    if (
      typeof window !== 'undefined' &&
      typeof Worker !== 'undefined' &&
      !opts.worker
    ) {
      const promises = parts.map((part) => {
        const partOpts = {};
        if (opts.start != null && part.nodes.includes(opts.start))
          partOpts.start = opts.start;
        if (opts.end != null && part.nodes.includes(opts.end))
          partOpts.end = opts.end;
        if (opts.degreeOrder) partOpts.degreeOrder = opts.degreeOrder;
        const partCuts = cutPixels.filter((cp) => part.nodes.includes(cp));
        for (const cp of partCuts) {
          if (partOpts.start == null && cp !== partOpts.end) partOpts.start = cp;
          else if (partOpts.end == null && cp !== partOpts.start)
            partOpts.end = cp;
        }
        return runWorker(part, partOpts);
      });
      const results = await Promise.all(promises);
      paths = mergeCutPaths(results.flat(), cutPixels);
    } else {
      const results = [];
      const batch = opts.yieldEvery || 1;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const partOpts = {};
        if (opts.start != null && part.nodes.includes(opts.start))
          partOpts.start = opts.start;
        if (opts.end != null && part.nodes.includes(opts.end))
          partOpts.end = opts.end;
        if (opts.degreeOrder) partOpts.degreeOrder = opts.degreeOrder;
        const partCuts = cutPixels.filter((cp) => part.nodes.includes(cp));
        for (const cp of partCuts) {
          if (partOpts.start == null && cp !== partOpts.end) partOpts.start = cp;
          else if (partOpts.end == null && cp !== partOpts.start)
            partOpts.end = cp;
        }
        results.push(solveSequential(part, partOpts));
        if ((i + 1) % batch === 0) await new Promise((r) => setTimeout(r));
      }
      paths = mergeCutPaths(results.flat(), cutPixels);
    }
  } else {
    paths = solveSequential(input, opts);
  }

  return paths;
}

export async function solve(input, opts = {}) {
  if (opts.start != null && opts.end != null) {
    const base = {
      degreeOrder: opts.degreeOrder,
      worker: opts.worker,
      yieldEvery: opts.yieldEvery,
    };
    let graph = input;
    if (!(graph && graph.nodes && graph.neighbors && graph.degrees)) {
      graph = buildGraph(input);
    }
    const startOnly = await solveCore(
      { ...graph, degrees: graph.degrees.slice() },
      { ...base, start: opts.start }
    );
    const startPath = startOnly.find((p) => p[0] === opts.start);
    if (
      startOnly.length === 1 &&
      startPath &&
      startPath[startPath.length - 1] === opts.end
    ) {
      return startOnly;
    }

    const startEnd = await solveCore(
      { ...graph, degrees: graph.degrees.slice() },
      { ...base, start: opts.start, end: opts.end }
    );
    const sePath = startEnd.find(
      (p) => p[0] === opts.start && p[p.length - 1] === opts.end
    );
    if (startEnd.length === 1 && sePath) {
      return startEnd;
    }

    const endOnly = await solveCore(
      { ...graph, degrees: graph.degrees.slice() },
      { ...base, start: opts.end }
    );
    return startOnly.length <= endOnly.length ? startOnly : endOnly;
  }

  return solveCore(input, opts);
}

export const useHamiltonianService = () => {
  async function traverseWithStart(pixels, start) {
    const { nodes, neighbors, indexMap } = buildGraph(pixels);
    const { components, compIndex } = getComponents(neighbors);
    const startIdx = indexMap.get(start);
    if (startIdx === undefined) throw new Error('Start pixel missing');

    const result = [];
    for (let i = 0; i < components.length; i++) {
      const compPixels = components[i].map((idx) => nodes[idx]);
      if (compIndex[startIdx] === i) {
        const paths = await solve(compPixels, { start });
        result.push(...paths);
      } else {
        const paths = await solve(compPixels);
        result.push(...paths);
      }
    }
    return result;
  }

  async function traverseWithStartEnd(pixels, start, end) {
    const { nodes, neighbors, indexMap } = buildGraph(pixels);
    const { components, compIndex } = getComponents(neighbors);
    const startIdx = indexMap.get(start);
    const endIdx = indexMap.get(end);
    if (startIdx === undefined) throw new Error('Start pixel missing');
    if (endIdx === undefined) throw new Error('End pixel missing');

    const result = [];
    for (let i = 0; i < components.length; i++) {
      const compPixels = components[i].map((idx) => nodes[idx]);
      if (compIndex[startIdx] === i && compIndex[endIdx] === i) {
        const paths = await solve(compPixels, { start, end });
        result.push(...paths);
      } else if (compIndex[startIdx] === i) {
        const paths = await solve(compPixels, { start });
        result.push(...paths);
      } else if (compIndex[endIdx] === i) {
        const paths = await solve(compPixels, { start: end });
        result.push(...paths);
      } else {
        const paths = await solve(compPixels);
        result.push(...paths);
      }
    }
    return result;
  }

  async function traverseFree(pixels) {
    const { nodes, neighbors } = buildGraph(pixels);
    const { components } = getComponents(neighbors);
    const result = [];
    for (const comp of components) {
      const compPixels = comp.map((idx) => nodes[idx]);
      const paths = await solve(compPixels);
      result.push(...paths);
    }
    return result;
  }

  return {
    traverseWithStart,
    traverseWithStartEnd,
    traverseFree,
  };
};

export { buildGraph, findDegree2CutSet, stitchPaths, mergeCutPaths };
