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
    const cutMap = new Map(); // cutPixel -> neighbor pixel inside this component
    while (stack.length) {
      const node = stack.pop();
      comp.push(node);
      for (const nb of neighbors[node]) {
        if (cutLookup.has(nb)) {
          // record which pixel inside this component touches the cut pixel
          cutMap.set(nodes[nb], nodes[node]);
          continue;
        }
        if (visited[nb]) continue;
        visited[nb] = 1;
        stack.push(nb);
      }
    }
    const indexMap = new Map(comp.map((idx, j) => [idx, j]));
    const partNeighbors = comp.map((origIdx) => {
      const list = [];
      for (const nb of neighbors[origIdx]) {
        if (cutLookup.has(nb)) continue;
        const mapped = indexMap.get(nb);
        if (mapped != null) list.push(mapped);
      }
      return list;
    });
    const partDegrees = partNeighbors.map((nbs) => nbs.length);
    const partNodes = comp.map((idx) => nodes[idx]);
    const cutNeighbors = {};
    for (const [cp, nbPixel] of cutMap.entries()) cutNeighbors[cp] = nbPixel;
    res.push({
      nodes: partNodes,
      neighbors: partNeighbors,
      degrees: partDegrees,
      cutNeighbors,
    });
  }
  return res;
}

// Merge two path covers using the shared cut pixel
function stitchPaths(left, right, cutPixel) {
  function extract(paths, needEnd) {
    const idx = paths.findIndex((p) => p.includes(cutPixel));
    if (idx === -1) {
      const path = paths.shift();
      return needEnd ? path.concat(cutPixel) : [cutPixel, ...path];
    }
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
  for (const cp of cutPixels) {
    const withCp = res.filter((p) => p.includes(cp));
    const withoutCp = res.filter((p) => !p.includes(cp));
    if (withCp.length === 2) {
      const merged = stitchPaths([withCp[0]], [withCp[1]], cp);
      res = withoutCp.concat(merged);
    } else {
      res = withoutCp.concat(withCp);
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

// Prepare options for a partition, swapping any cut anchor with its
// unique neighbor inside the partition and ensuring each cut has an anchor
// to connect against during merging.
function preparePartOpts(part, opts) {
  const partOpts = {};
  if (opts.start != null) {
    if (part.cutNeighbors && part.cutNeighbors[opts.start] != null)
      partOpts.start = part.cutNeighbors[opts.start];
    else if (part.nodes.includes(opts.start)) partOpts.start = opts.start;
  }
  if (opts.end != null) {
    if (part.cutNeighbors && part.cutNeighbors[opts.end] != null)
      partOpts.end = part.cutNeighbors[opts.end];
    else if (part.nodes.includes(opts.end)) partOpts.end = opts.end;
  }
  if (opts.degreeOrder) partOpts.degreeOrder = opts.degreeOrder;
  if (part.cutNeighbors) {
    const cpList = Object.entries(part.cutNeighbors)
      .map(([cp, nb]) => [Number(cp), nb])
      .sort((a, b) => a[0] - b[0]);
    for (const [, nb] of cpList) {
      if (partOpts.start == null) partOpts.start = nb;
      else if (partOpts.end == null && nb !== partOpts.start) partOpts.end = nb;
    }
  }
  return partOpts;
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
      const partRes = solveSequential(part, preparePartOpts(part, opts));
      const cpList = Object.entries(part.cutNeighbors)
        .map(([cp, nb]) => [Number(cp), nb])
        .sort((a, b) => a[0] - b[0]);
      for (const path of partRes) {
        if (cpList[0]) path.unshift(cpList[0][0]);
        if (cpList[1]) path.push(cpList[1][0]);
      }
      results.push(partRes);
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
  if (typeof Worker === 'undefined') {
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
    if (typeof Worker !== 'undefined') {
      const promises = parts.map((part) => {
        const cpList = Object.entries(part.cutNeighbors)
          .map(([cp, nb]) => [Number(cp), nb])
          .sort((a, b) => a[0] - b[0]);
        return runWorker(part, preparePartOpts(part, opts)).then((res) => {
          const segs = res || [];
          for (const path of segs) {
            if (cpList[0]) path.unshift(cpList[0][0]);
            if (cpList[1]) path.push(cpList[1][0]);
          }
          return segs;
        });
      });
      const results = await Promise.all(promises);
      paths = mergeCutPaths(results.flat(), cutPixels);
    } else {
      const results = [];
      const batch = opts.yieldEvery || 1;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const cpList = Object.entries(part.cutNeighbors)
          .map(([cp, nb]) => [Number(cp), nb])
          .sort((a, b) => a[0] - b[0]);
        const partOpts = preparePartOpts(part, opts);
        const partRes = solveSequential(part, partOpts);
        for (const path of partRes) {
          if (cpList[0]) path.unshift(cpList[0][0]);
          if (cpList[1]) path.push(cpList[1][0]);
        }
        results.push(partRes);
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
  const canUseWorker = typeof Worker !== 'undefined' && !opts.worker;
  if (opts.start != null && opts.end != null) {
    const base = {
      degreeOrder: opts.degreeOrder,
      yieldEvery: opts.yieldEvery,
    };
    let graph = input;
    if (!(graph && graph.nodes && graph.neighbors && graph.degrees)) {
      graph = buildGraph(input);
    }
    const copyGraph = () => ({ ...graph, degrees: graph.degrees.slice() });

    const best = { paths: null, priority: Infinity, anchors: 0 };

    function evalCandidate(paths) {
      const full = paths.length === 1;
      let startHit = false,
        endHit = false;
      for (const p of paths) {
        if (p[0] === opts.start || p[p.length - 1] === opts.start) startHit = true;
        if (p[0] === opts.end || p[p.length - 1] === opts.end) endHit = true;
      }
      const anchors = (startHit ? 1 : 0) + (endHit ? 1 : 0);
      let priority;
      if (full && startHit && endHit) priority = 1;
      else if (full && anchors > 0) priority = 2;
      else if (anchors > 0) priority = 3;
      else priority = 4;
      return { priority, anchors };
    }

    function update(paths) {
      const { priority, anchors } = evalCandidate(paths);
      if (priority === 4 && best.paths) return priority;
      if (
        !best.paths ||
        priority < best.priority ||
        (priority === best.priority &&
          (paths.length < best.paths.length ||
            (paths.length === best.paths.length && anchors > best.anchors)))
      ) {
        best.paths = paths;
        best.priority = priority;
        best.anchors = anchors;
      }
      return priority;
    }

    const runAnchor = (anchor) => {
      const anchorOpts = { ...base, start: anchor };
      return canUseWorker
        ? runWorker(copyGraph(), anchorOpts)
        : solveCore(copyGraph(), anchorOpts);
    };

    return await new Promise((resolve) => {
      let finished = 0;
      const handle = (paths) => {
        const priority = update(paths);
        finished++;
        if (priority === 1 || finished === 2) {
          resolve(best.paths);
        }
      };
      runAnchor(opts.start).then(handle);
      runAnchor(opts.end).then(handle);
    });
  }

  if (canUseWorker) {
    return runWorker(input, opts);
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

export {
  buildGraph,
  findDegree2CutSet,
  stitchPaths,
  mergeCutPaths,
  partitionAtCut,
};
