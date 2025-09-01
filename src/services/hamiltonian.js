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

// helper to create a stable key for edge maps
function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// Reduce graph by pruning leaves and collapsing chains of degree-2 nodes.
// Returns reduced graph along with mapping to recover original nodes.
function reduceGraph(graph) {
  const { nodes, neighbors, degrees } = graph;
  const n = nodes.length;
  const adj = neighbors.map((nbs) => nbs.slice());
  const deg = degrees.slice();
  const removed = new Uint8Array(n);
  const attachments = Array.from({ length: n }, () => new Map());
  const isolated = [];

  const queue = [];
  for (let i = 0; i < n; i++) if (deg[i] === 1) queue.push(i);

  while (queue.length) {
    const v = queue.pop();
    if (removed[v]) continue;
    if (deg[v] === 0) {
      const paths = Array.from(attachments[v].values());
      if (paths.length === 0) {
        isolated.push([nodes[v]]);
      } else if (paths.length === 1) {
        isolated.push([...paths[0].slice().reverse(), nodes[v]]);
      } else {
        const [p1, p2, ...rest] = paths;
        isolated.push([...p1.slice().reverse(), nodes[v], ...p2]);
        for (const r of rest) isolated.push([...r.slice().reverse(), nodes[v]]);
      }
      removed[v] = 1;
      continue;
    }
    const nb = adj[v][0];
    const attv = Array.from(attachments[v].values());
    let path = [nodes[v]];
    if (attv.length === 1) path = [nodes[v], ...attv[0]];
    else if (attv.length > 1) {
      const [p1, p2, ...rest] = attv;
      isolated.push([...p1.slice().reverse(), nodes[v], ...p2]);
      for (const r of rest) isolated.push([...r.slice().reverse(), nodes[v]]);
      removed[v] = 1;
      adj[nb] = adj[nb].filter((x) => x !== v);
      deg[nb]--;
      if (deg[nb] === 1) queue.push(nb);
      continue;
    }
    attachments[nb].set(v, path);
    adj[nb] = adj[nb].filter((x) => x !== v);
    deg[nb]--;
    removed[v] = 1;
    if (deg[nb] === 1) queue.push(nb);
  }

  // prepare edge path map for remaining nodes
  const edgePaths = new Map();
  for (let i = 0; i < n; i++) {
    if (removed[i]) continue;
    for (const nb of adj[i]) {
      if (removed[nb] || nb < i) continue;
      edgePaths.set(edgeKey(nodes[i], nodes[nb]), []);
    }
  }

  // collapse chains of degree-2 nodes with no attachments
  const q2 = [];
  for (let i = 0; i < n; i++)
    if (!removed[i] && adj[i].length === 2 && attachments[i].size === 0) q2.push(i);

  while (q2.length) {
    const v = q2.pop();
    if (removed[v] || adj[v].length !== 2 || attachments[v].size !== 0) continue;
    const [a, b] = adj[v];
    const keyAV = edgeKey(nodes[a], nodes[v]);
    const keyVB = edgeKey(nodes[v], nodes[b]);
    const segA = edgePaths.get(keyAV) || [];
    const segB = edgePaths.get(keyVB) || [];
    const keyAB = edgeKey(nodes[a], nodes[b]);
    const existing = edgePaths.get(keyAB) || [];
    edgePaths.set(keyAB, [...segA, nodes[v], ...segB, ...existing]);
    edgePaths.delete(keyAV);
    edgePaths.delete(keyVB);
    adj[a] = adj[a].filter((x) => x !== v);
    adj[b] = adj[b].filter((x) => x !== v);
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
    deg[a] = adj[a].length;
    deg[b] = adj[b].length;
    removed[v] = 1;
    if (deg[a] === 2 && attachments[a].size === 0) q2.push(a);
    if (deg[b] === 2 && attachments[b].size === 0) q2.push(b);
  }

  // build reduced graph structures
  const newNodes = [];
  const indexMap = new Map();
  const mapOld = new Map();
  for (let i = 0; i < n; i++) {
    if (removed[i]) continue;
    mapOld.set(i, newNodes.length);
    indexMap.set(nodes[i], newNodes.length);
    newNodes.push(nodes[i]);
  }
  const newNeighbors = newNodes.map(() => []);
  const newDegrees = new Int32Array(newNodes.length);
  const endpointMap = new Map();
  for (let i = 0; i < n; i++) {
    if (removed[i]) continue;
    const ni = mapOld.get(i);
    for (const nb of adj[i]) {
      if (removed[nb]) continue;
      const nj = mapOld.get(nb);
      newNeighbors[ni].push(nj);
    }
    newDegrees[ni] = newNeighbors[ni].length;
    if (attachments[i].size > 0) {
      endpointMap.set(newNodes[ni], Array.from(attachments[i].values()));
    }
  }
  for (const nbs of newNeighbors)
    nbs.sort((a, b) => newDegrees[a] - newDegrees[b]);

  return {
    nodes: newNodes,
    neighbors: newNeighbors,
    degrees: Array.from(newDegrees),
    indexMap,
    edgePaths,
    endpoints: endpointMap,
    isolated,
  };
}

// Core solver using backtracking to find minimum path cover
function solve(pixels, opts = {}) {
  const {
    nodes,
    neighbors,
    degrees,
    indexMap,
    edgePaths,
    endpoints,
    isolated,
  } = reduceGraph(buildGraph(pixels));
  const total = nodes.length;
  const remaining = new Uint8Array(total);
  remaining.fill(1);

  const start = opts.start != null ? indexMap.get(opts.start) : null;
  const end = opts.end != null ? indexMap.get(opts.end) : null;

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
  const corePaths = best.paths ? best.paths.map((p) => p.map((i) => nodes[i])) : [];
  const expanded = [];
  for (const path of corePaths) {
    if (path.length === 0) continue;
    const out = [];
    const first = path[0];
    const startExtra = endpoints.get(first);
    if (startExtra && startExtra.length)
      out.push(...startExtra[0].slice().reverse());
    for (let i = 0; i < path.length; i++) {
      out.push(path[i]);
      if (i + 1 < path.length) {
        const a = path[i];
        const b = path[i + 1];
        const seg = edgePaths.get(edgeKey(a, b));
        if (seg && seg.length) out.push(...seg);
      }
    }
    const last = path[path.length - 1];
    const endExtra = endpoints.get(last);
    if (endExtra && endExtra.length) out.push(...endExtra[0]);
    expanded.push(out);
  }
  return [...isolated, ...expanded];
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
