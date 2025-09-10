const MAX_DIMENSION = 128;
const TIME_LIMIT = 5000;

// Return a orientation priority for a given offset.
function dirPriority(dx, dy) {
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

// Build adjacency info for pixels with 8-way connectivity
// Returns adjacency list `neighbors` only
function buildGraphFromPixels(pixelMap) {
  const pixels = Array.from(pixelMap.keys());
  const indexMap = new Map();
  for (let i = 0; i < pixels.length; i++) indexMap.set(pixels[i], i);
  const neighbors = [];

  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i];
    const x = p % MAX_DIMENSION;
    const y = Math.floor(p / MAX_DIMENSION);
    const nbs = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nPixel = x + dx + MAX_DIMENSION * (y + dy);
        const idx = indexMap.get(nPixel);
        if (idx !== undefined) {
          nbs.push({ idx, order: dirPriority(dx, dy) });
        }
      }
    }
    nbs.sort((a, b) => a.order - b.order);
    neighbors.push(nbs.map((n) => n.idx));
  }

  return neighbors;
}

// Check if removing specific edges disconnects the graph
function isGraphDisconnectedByEdges(neighbors, total, edges) {
  const blocked = new Map();
  for (const [a, b] of edges) {
    if (!blocked.has(a)) blocked.set(a, new Set());
    if (!blocked.has(b)) blocked.set(b, new Set());
    blocked.get(a).add(b);
    blocked.get(b).add(a);
  }
  const visited = new Uint8Array(total);
  const stack = [0];
  visited[0] = 1;
  while (stack.length) {
    const node = stack.pop();
    for (const nb of neighbors[node]) {
      if (blocked.get(node)?.has(nb)) continue;
      if (visited[nb]) continue;
      visited[nb] = 1;
      stack.push(nb);
    }
  }
  for (let i = 0; i < total; i++) if (!visited[i]) return true;
  return false;
}

// Partition graph by cutting edges connecting adjacent pixels that share no common neighbor.
// Returns { edges, parts } where each part is { neighbors, components }
// There is no mathematical proof but this never returns more than 2 parts.
function partitionAtEdgeCut(neighbors) {
  const total = neighbors.length;
  const candidateEdges = [];
  for (let i = 0; i < neighbors.length; i++) {
    const setI = new Set(neighbors[i]);
    for (const nb of neighbors[i]) {
      if (i >= nb) continue;
      let hasCommon = false;
      for (const nb2 of neighbors[nb]) {
        if (nb2 !== i && setI.has(nb2)) {
          hasCommon = true;
          break;
        }
      }
      if (!hasCommon) candidateEdges.push([i, nb]);
    }
  }

  const tryEdges = (edges) => {
    if (!isGraphDisconnectedByEdges(neighbors, total, edges)) return null;
    const blocked = new Map();
    for (const [a, b] of edges) {
      if (!blocked.has(a)) blocked.set(a, new Set());
      if (!blocked.has(b)) blocked.set(b, new Set());
      blocked.get(a).add(b);
      blocked.get(b).add(a);
    }
    const visited = new Uint8Array(total);
    const parts = [];
    let valid = 0;
    for (let i = 0; i < total; i++) {
      if (visited[i]) continue;
      const stack = [i];
      visited[i] = 1;
      const comp = [];
      while (stack.length) {
        const node = stack.pop();
        comp.push(node);
        for (const nb of neighbors[node]) {
          if (blocked.get(node)?.has(nb)) continue;
          if (visited[nb]) continue;
          visited[nb] = 1;
          stack.push(nb);
        }
      }
      const subNeighbors = [];
      for (const n of comp) {
        const subNbs = [];
        for (const nb of neighbors[n]) {
          const subIdx = comp.indexOf(nb);
          if (subIdx !== -1) subNbs.push(subIdx);
        }
        subNeighbors.push(subNbs);
      }
      parts.push({ neighbors: subNeighbors, components: comp });
      if (1 < comp.length - edges.length) valid++;
    }
    return edges.length === 1 || 2 <= valid ? { edges, parts } : null;
  };

  for (let k = 1; k <= candidateEdges.length; k++) {
    const indices = Array.from(Array(k).keys());
    while (indices.length) {
      const combo = indices.map((i) => candidateEdges[i]);
      const res = tryEdges(combo);
      if (res) return res;

      let pos = k - 1;
      while (pos >= 0 && indices[pos] === pos + candidateEdges.length - k) pos--;
      if (pos < 0) break;
      indices[pos]++;
      for (let j = pos + 1; j < k; j++) {
        indices[j] = indices[j - 1] + 1;
      }
    }
  }
  return null;
}

// Merge path covers across cut edges. `anchorPairs` is an array of [a, b] indices.
function stitchPaths(paths, anchorPairs) {
  const combined = [...paths];
  for (const [aIdx, bIdx] of anchorPairs) {
    const ai = combined.findIndex((p) => p[0] === aIdx || p[p.length - 1] === aIdx);
    const bi = combined.findIndex((p) => p[0] === bIdx || p[p.length - 1] === bIdx);
    if (ai !== -1 && bi !== -1 && ai !== bi) {
      const aPath = combined.splice(ai, 1)[0];
      const bIndex = bi > ai ? bi - 1 : bi;
      const bPath = combined.splice(bIndex, 1)[0];
      if (aPath[aPath.length - 1] !== aIdx) aPath.reverse();
      if (bPath[0] !== bIdx) bPath.reverse();
      combined.push([...aPath, ...bPath]);
    }
  }
  return combined;
}

// Find connected components from an adjacency list
function groupConnected(neighbors) {
  const n = neighbors.length;
  const visited = new Uint8Array(n);
  const components = [];
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const stack = [i];
    visited[i] = 1;
    const comp = [];
    while (stack.length) {
      const node = stack.pop();
      comp.push(node);
      for (const nb of neighbors[node]) {
        if (!visited[nb]) {
          visited[nb] = 1;
          stack.push(nb);
        }
      }
    }
    const subNeighbors = comp.map((n) => neighbors[n].map((i) => comp.indexOf(i)));
    components.push({ neighbors: subNeighbors, components: comp });
  }
  return components;
}

// Core solver using backtracking to find minimum path cover
class PathCoverSolver {
  constructor(neighbors, opts) {
    this.neighbors = neighbors;
    this.anchors = opts.anchors || [];
    this.isAscending = opts.degreeOrder !== 'descending';

    this.baseDegrees = Uint8Array.from(neighbors.map((nbs) => nbs.length));
    this.n = neighbors.length;

    this.attempts = 0;
    this.best = { paths: [], pathCount: Infinity, anchors: 0 };
    this.records = new Map();
    this.startTime = Date.now();
    this.done = false;
  }

  updateBest(acc) {
    const pathCount = acc.length
    let anchors = 0;
    for (const a of this.anchors) {
      for (const p of acc) {
        if (p[0] === a || p[p.length - 1] === a) {
          anchors++;
          break;
        }
      }
    }

    const better = pathCount < this.best.pathCount || (pathCount === this.best.pathCount && anchors > this.best.anchors);
    if (better) this.best = { paths: acc.map((p) => p.slice()), pathCount, anchors };

    const isHamiltonianPath = acc.length === 1;
    if (isHamiltonianPath && (anchors === this.anchors.length || anchors === 2)) this.done = "fulfilled";
  }

  checkTimeout() {
    if (Date.now() - this.startTime > TIME_LIMIT) {
      this.done = "timeout";
    }
  }

  getBetterRecord(ctx, acc) {
    const key = ctx.active.join('');
    const record = this.records.get(key);
    let anchors = 0;
    for (const path of acc) {
      if (this.anchors.includes(path[0])) anchors++;
      if (path.length !== 1 && this.anchors.includes(path[path.length - 1])) anchors++;
    }
    if (record && record.length <= acc.length && anchors <= record.anchors) return record;
    this.records.set(key, { length: acc.length, anchors });
    return null;
  }

  sortedNeighbor(ctx, node) {
    const result = [];
    for (const nb of this.neighbors[node]) {
      const d = ctx.degrees[nb];
      let inserted = false;
      for (let i = 0; i < result.length; i++) {
        const cd = ctx.degrees[result[i]];
        if (this.isAscending ? d < cd : d > cd) {
          result.splice(i, 0, nb);
          inserted = true;
          break;
        }
      }
      if (!inserted) result.push(nb);
    }
    return result;
  }

  async search(ctx, acc, initial) {
    const stack = [{ type: 'search', node: initial, acc }];

    while (stack.length && !this.done) {
      const frame = stack.pop();
      switch (frame.type) {
        case 'search': {
          const path = [frame.node];
          const frames = [
            { type: 'remove', node: frame.node },
            {
              type: 'extend',
              node: frame.node,
              path,
              acc: frame.acc,
              nbs: null,
            },
            { type: 'restore', node: frame.node, path },
          ];
          for (let i = frames.length - 1; i >= 0; i--) stack.push(frames[i]);
          continue;
        }
        case 'extend': {
          if (!frame.nbs) {
            frame.nbs = this.sortedNeighbor(ctx, frame.node);
          }
          const frames = [];
          for (const nb of frame.nbs) {
            if (!ctx.active[nb]) continue;
            const newPath = frame.path.concat(nb);
            frames.push(
              { type: 'remove', node: nb },
              {
                type: 'extend',
                node: nb,
                path: newPath,
                acc: frame.acc,
                nbs: null,
              },
              { type: 'restore', node: nb, path: newPath },
            );
          }
          frames.push({ type: 'finalize', path: frame.path, acc: frame.acc });
          for (let i = frames.length - 1; i >= 0; i--) stack.push(frames[i]);
          continue;
        }
        case 'remove': {
          ctx.active[frame.node] = 0;
          ctx.remaining--;
          for (const nb of this.neighbors[frame.node])
            if (ctx.active[nb]) ctx.degrees[nb]--;
          continue;
        }
        case 'restore': {
          for (const nb of this.neighbors[frame.node])
            if (ctx.active[nb]) ctx.degrees[nb]++;
          ctx.remaining++;
          ctx.active[frame.node] = 1;
          frame.path.pop();
          continue;
        }
        case 'finalize': {
          const newAcc = [...frame.acc, frame.path.slice()];
          if (ctx.remaining) {
            if (!this.getBetterRecord(ctx, newAcc)) {
              for (let i = 0; i < this.n; i++) {
                if (ctx.active[i]) stack.push({ type: 'search', node: i, acc: newAcc });
              }
            }
          }
          else {
            this.attempts++;
            this.updateBest(newAcc);
            if (this.attempts % 1024 === 0) {
              this.checkTimeout();
              await new Promise((resolve) => setTimeout(resolve));
            }
          }
          continue;
        }
      }
    }

    if (!this.done) this.done = "exhausted";
  }

  chooseInitials() {
    let bestIdxs = [];
    let best = this.isAscending ? Infinity : -1;
    for (let i = 0; i < this.baseDegrees.length; i++) {
      const d = this.baseDegrees[i];
      if (d === best) {
        bestIdxs.push(i);
      }
      else if (this.isAscending ? d < best : d > best) {
        best = d;
        bestIdxs = [i];
      }
    }
    return bestIdxs;
  }
  
  async run() {
    const initials = this.anchors.length ? this.anchors : this.chooseInitials();
    const tasks = initials.map((initial) => {
      const ctx = {
        remaining: this.n,
        active: new Uint8Array(this.n).fill(1),
        degrees: Uint8Array.from(this.baseDegrees)
      };
      return this.search(ctx, [], initial);
    });
    await Promise.race(tasks);
    return this.best.paths;
  }
}

async function solve(neighbors, opts = {}) {
  const connected = groupConnected(neighbors);
  if (connected.length > 1) {
    const results = [];
    for (const { neighbors, components } of connected) {
      const subAnchors = [];
      for (const anchor of opts.anchors || []) subAnchors.push(components.indexOf(anchor));
      results.push(
        solve(neighbors, { ...opts, anchors: subAnchors.filter((a) => a !== -1) })
        .then((paths) => paths.map((p) => p.map((i) => components[i])))
      );
    }
    return (await Promise.all(results)).flat();
  }

  const partition = partitionAtEdgeCut(neighbors);
  if (partition) {
    const results = [];
    for (const { neighbors, components } of partition.parts) {
      const subAnchors = [];
      for (const anchor of opts.anchors || []) subAnchors.push(components.indexOf(anchor));
      for (const [aIdx, bIdx] of partition.edges) subAnchors.push(components.indexOf(aIdx), components.indexOf(bIdx));
      results.push(
        solve(neighbors, { ...opts, anchors: subAnchors.filter((a) => a !== -1) })
        .then((paths) => paths.map((p) => p.map((i) => components[i])))
      );
    }
    const paths = (await Promise.all(results)).flat();
    return stitchPaths(paths, partition.edges);
  }

  const solver = new PathCoverSolver(neighbors, opts);
  return await solver.run();
}

async function solveFromPixels(pixelMap, opts = {}) {
  const nodes = Array.from(pixelMap.keys());
  const neighbors = buildGraphFromPixels(pixelMap);
  const anchors = (opts.anchors || []).map((anchor) => {
    const idx = nodes.indexOf(anchor);
    if (idx === -1) throw new Error('Anchor pixel missing');
    return idx;
  });
  const paths = await solve(neighbors, { ...opts, anchors });
  return paths.map((p) => p.map((i) => nodes[i]));
}

class HamiltonianService {
  async traverseWithStart(pixelMap, start) {
    return await solveFromPixels(pixelMap, { anchors: [start] });
  }

  async traverseWithStartEnd(pixelMap, start, end) {
    return await solveFromPixels(pixelMap, { anchors: [start, end] });
  }

  async traverseFree(pixelMap) {
    return await solveFromPixels(pixelMap);
  }
}

export const useHamiltonianService = () => new HamiltonianService();

export { buildGraphFromPixels, partitionAtEdgeCut, solve, solveFromPixels };
