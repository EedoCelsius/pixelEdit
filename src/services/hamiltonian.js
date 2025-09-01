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

// Remove leaf nodes and collapse degree-2 chains while keeping
// mapping back to the original pixel indices.  Returns the reduced
// graph along with structures to reconstruct paths.
function reduceGraph(graph) {
  const { nodes, neighbors, degrees } = graph;
  const n = nodes.length;
  const active = new Uint8Array(n);
  active.fill(1);
  const deg = degrees.slice();

  // For each active node we keep the chains from removed leaves that end here.
  const chains = Array.from({ length: n }, () => []);
  const queue = [];
  for (let i = 0; i < n; i++) if (deg[i] === 1) queue.push(i);

  // Peel off degree-1 nodes, propagating chains toward the core graph.
  while (queue.length) {
    const u = queue.pop();
    if (!active[u] || deg[u] !== 1) continue;
    let v = -1;
    for (const nb of neighbors[u]) if (active[nb]) v = nb;
    if (v === -1) {
      active[u] = 0;
      continue;
    }

    let uChains = chains[u];
    if (uChains.length === 0) uChains = [[nodes[u]]];
    else uChains = uChains.map((c) => c.concat(nodes[u]));
    for (const c of uChains) chains[v].push(c.concat(nodes[v]));

    active[u] = 0;
    deg[u] = 0;
    neighbors[v] = neighbors[v].filter((nb) => nb !== u);
    deg[v]--;
    if (deg[v] === 1) queue.push(v);
  }

  // Build mapping for remaining nodes
  const mapOldToNew = new Map();
  const newNodes = [];
  for (let i = 0; i < n; i++) {
    if (active[i]) {
      mapOldToNew.set(i, newNodes.length);
      newNodes.push(nodes[i]);
    }
  }

  const newNeighbors = newNodes.map(() => []);
  const edgeMap = new Map();
  const edgeKey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  const visited = new Set();

  // Traverse remaining structure collapsing degree-2 chains.
  for (let i = 0; i < n; i++) {
    if (!active[i]) continue;
    const ni = mapOldToNew.get(i);
    for (const nb of neighbors[i]) {
      if (!active[nb]) continue;
      const key = edgeKey(i, nb);
      if (visited.has(key)) continue;
      visited.add(key);

      let path = [nodes[i]];
      let prev = i;
      let curr = nb;
      while (active[curr] && deg[curr] === 2 && curr !== i) {
        path.push(nodes[curr]);
        const [a, b] = neighbors[curr];
        const next = a === prev ? b : a;
        prev = curr;
        curr = next;
      }
      path.push(nodes[curr]);

      const nj = mapOldToNew.get(curr);
      if (nj === undefined) continue;

      newNeighbors[ni].push(nj);
      newNeighbors[nj].push(ni);
      edgeMap.set(`${nodes[i]},${nodes[curr]}`, path.slice());
      edgeMap.set(`${nodes[curr]},${nodes[i]}`, path.slice().reverse());
    }
  }

  const leafMap = new Map();
  for (let i = 0; i < n; i++) {
    if (!active[i]) continue;
    const ni = mapOldToNew.get(i);
    if (chains[i].length) leafMap.set(ni, chains[i]);
  }

  const indexMap = new Map(newNodes.map((p, i) => [p, i]));

  // Map any removed pixel to its root index for start/end lookups.
  for (const [ni, arr] of leafMap.entries()) {
    for (const chain of arr) {
      for (let k = 0; k < chain.length - 1; k++) indexMap.set(chain[k], ni);
    }
  }
  for (const path of edgeMap.values()) {
    const ni = indexMap.get(path[0]);
    for (let k = 1; k < path.length - 1; k++) indexMap.set(path[k], ni);
  }

  const degs = newNeighbors.map((nbs) => nbs.length);
  for (const nbs of newNeighbors) nbs.sort((a, b) => degs[a] - degs[b]);

  return { nodes: newNodes, neighbors: newNeighbors, degrees: degs, indexMap, edgeMap, leafMap };
}

// Expand paths on the reduced graph back to the original pixels.
function expandPaths(paths, nodes, edgeMap, leafMap) {
  const expanded = paths.map((p) => {
    const res = [nodes[p[0]]];
    for (let i = 1; i < p.length; i++) {
      const a = nodes[p[i - 1]];
      const b = nodes[p[i]];
      const edge = edgeMap.get(`${a},${b}`);
      if (edge) {
        for (let j = 1; j < edge.length; j++) res.push(edge[j]);
      } else {
        res.push(b);
      }
    }
    return res;
  });

  for (const [idx, chains] of leafMap.entries()) {
    const root = nodes[idx];
    let attached = false;
    for (const path of expanded) {
      if (path[0] === root) {
        for (const c of chains) path.unshift(...c.slice(0, -1).reverse());
        attached = true;
        break;
      } else if (path[path.length - 1] === root) {
        for (const c of chains) path.push(...c.slice(0, -1));
        attached = true;
        break;
      }
    }
    if (!attached) for (const c of chains) expanded.push(c);
  }
  return expanded;
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
  const reduced = reduceGraph(buildGraph(pixels));
  const { nodes, neighbors, degrees, indexMap, edgeMap, leafMap } = reduced;
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
  return best.paths ? expandPaths(best.paths, nodes, edgeMap, leafMap) : [];
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
