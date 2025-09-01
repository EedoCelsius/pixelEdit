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

// Try to split graph at a degree-2 articulation point.
// Returns { node, left, right } where left/right are arrays of indices
// belonging to each side of the split. If no such split exists, returns null.
function findDegree2Split(neighbors) {
  const n = neighbors.length;
  for (let v = 0; v < n; v++) {
    if (neighbors[v].length !== 2) continue;
    const [a, b] = neighbors[v];
    const visited = new Set([v]);

    // explore from first neighbor without crossing v
    const left = [];
    const stack = [a];
    visited.add(a);
    while (stack.length) {
      const node = stack.pop();
      left.push(node);
      for (const nb of neighbors[node]) {
        if (nb === v || visited.has(nb)) continue;
        visited.add(nb);
        stack.push(nb);
      }
    }
    // if second neighbor reached, not a valid split
    if (visited.has(b)) continue;

    // explore from second neighbor
    const right = [];
    stack.push(b);
    visited.add(b);
    while (stack.length) {
      const node = stack.pop();
      right.push(node);
      for (const nb of neighbors[node]) {
        if (nb === v || visited.has(nb)) continue;
        visited.add(nb);
        stack.push(nb);
      }
    }

    // ensure all nodes accounted for
    if (visited.size === n) {
      return { node: v, left, right };
    }
  }
  return null;
}

// Extract clusters of high degree nodes to solve separately.
// threshold: minimum degree to consider a node part of a cluster
// keep: only nodes with degree >= keep are included in clusters
function extractHighDegreeClusters(neighbors, degrees, threshold = 6, keep = 3) {
  const n = neighbors.length;
  const visited = new Uint8Array(n);
  const clusters = [];
  for (let i = 0; i < n; i++) {
    if (visited[i] || degrees[i] < threshold) continue;
    const stack = [i];
    const cluster = [];
    visited[i] = 1;
    while (stack.length) {
      const node = stack.pop();
      if (degrees[node] >= keep) cluster.push(node);
      for (const nb of neighbors[node]) {
        if (visited[nb] || degrees[nb] < threshold) continue;
        visited[nb] = 1;
        stack.push(nb);
      }
    }
    if (cluster.length) clusters.push(cluster);
  }
  return clusters;
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

  // Pre-processing: split at degree-2 articulation points when no start/end specified
  if (!opts.skipDegree2 && opts.start == null && opts.end == null) {
    const split = findDegree2Split(neighbors);
    if (split) {
      const nodePixel = nodes[split.node];
      const leftPixels = split.left.map((i) => nodes[i]).concat(nodePixel);
      const rightPixels = split.right.map((i) => nodes[i]).concat(nodePixel);
      const leftPaths = solve(leftPixels, { skipClusters: opts.skipClusters });
      const rightPaths = solve(rightPixels, { skipClusters: opts.skipClusters });
      let l = leftPaths.shift() || [nodePixel];
      if (l[0] !== nodePixel) l = l.slice().reverse();
      let r = rightPaths.shift() || [nodePixel];
      if (r[0] !== nodePixel) r = r.slice().reverse();
      const stitched = l.concat(r.slice(1));
      return [stitched, ...leftPaths, ...rightPaths];
    }
  }

  // Pre-processing: extract clusters of high degree nodes
  if (!opts.skipClusters && opts.start == null && opts.end == null) {
    const clusters = extractHighDegreeClusters(neighbors, degrees);
    if (clusters.length) {
      const clusterSet = new Set();
      for (const c of clusters) for (const v of c) clusterSet.add(v);
      const mainPixels = [];
      for (let i = 0; i < nodes.length; i++) if (!clusterSet.has(i)) mainPixels.push(nodes[i]);
      let mainPaths = mainPixels.length ? solve(mainPixels, opts) : [];

      clusters.forEach((cluster) => {
        const clusterPixels = cluster.map((i) => nodes[i]);
        const clusterPaths = solve(clusterPixels, { ...opts, skipClusters: true });
        if (!clusterPaths.length) return;
        const clusterIndexSet = new Set(cluster);
        let inserted = false;
        for (const ci of cluster) {
          for (const nb of neighbors[ci]) {
            if (clusterIndexSet.has(nb)) continue;
            const outsidePixel = nodes[nb];
            let idx = clusterPaths.findIndex((p) => p.includes(nodes[ci]));
            let primary = idx !== -1 ? clusterPaths.splice(idx, 1)[0] : clusterPaths.shift();
            if (primary[0] !== nodes[ci]) {
              if (primary[primary.length - 1] === nodes[ci]) primary = primary.slice().reverse();
              else primary.unshift(nodes[ci]);
            }
            for (const path of mainPaths) {
              const pos = path.indexOf(outsidePixel);
              if (pos !== -1) {
                path.splice(pos + 1, 0, ...primary);
                inserted = true;
                break;
              }
            }
            if (!inserted) {
              mainPaths.push(primary);
            }
            inserted = true;
            break;
          }
          if (inserted) break;
        }
        if (!inserted) mainPaths.push(...clusterPaths);
        else if (clusterPaths.length) mainPaths.push(...clusterPaths);
      });
      return mainPaths;
    }
  }

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
