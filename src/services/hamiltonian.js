const MAX_DIMENSION = 65536;
const TIME_LIMIT = 5000;

// Return a direction priority for a given offset.
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
    const nbs = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nPixel = x + dx + MAX_DIMENSION * (y + dy);
        if (set.has(nPixel)) {
          const idx = indexMap.get(nPixel);
          nbs.push({ idx, order: dirPriority(dx, dy) });
        }
      }
    }
    nbs.sort((a, b) => a.order - b.order);
    neighbors[i] = nbs.map((n) => n.idx);
  }

  const degrees = neighbors.map((nbs) => nbs.length);

  return { nodes, neighbors, degrees, indexMap };
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
// Returns { cutEdges, parts } where parts are subgraphs in the same format as buildGraph.
// There is no mathematical proof but this never returns more than 2 parts.
function partitionAtEdgeCut(nodes, neighbors) {
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
    for (let i = 0; i < total; i++) {
      if (visited[i]) continue;
      const stack = [i];
      visited[i] = 1;
      const comp = [];
      while (stack.length) {
        const node = stack.pop();
        comp.push(nodes[node]);
        for (const nb of neighbors[node]) {
          if (blocked.get(node)?.has(nb)) continue;
          if (visited[nb]) continue;
          visited[nb] = 1;
          stack.push(nb);
        }
      }
      parts.push(buildGraph(comp));
    }
    const singleCount = parts.reduce((acc, p) => acc + (p.nodes.length === 1), 0);
    if (edges.length > 1 && singleCount >= parts.length - 1) return null;
    return { cutEdges: edges, parts };
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

// Merge path covers across cut edges. `anchorPairs` is an array of [aPixel, bPixel].
function stitchPaths(paths, anchorPairs) {
  const combined = [...paths];
  for (const [aPixel, bPixel] of anchorPairs) {
    const ai = combined.findIndex(
      (p) => p[0] === aPixel || p[p.length - 1] === aPixel,
    );
    const bi = combined.findIndex(
      (p) => p[0] === bPixel || p[p.length - 1] === bPixel,
    );
    if (ai !== -1 && bi !== -1 && ai !== bi) {
      const aPath = combined.splice(ai, 1)[0];
      const bIndex = bi > ai ? bi - 1 : bi;
      const bPath = combined.splice(bIndex, 1)[0];
      if (aPath[aPath.length - 1] !== aPixel) aPath.reverse();
      if (bPath[0] !== bPixel) bPath.reverse();
      combined.push([...aPath, ...bPath]);
    }
  }
  return combined;
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
class PathCoverSolver {
  constructor(nodes, neighbors, degrees, indexMap, opts) {
    this.nodes = nodes;
    this.neighbors = neighbors;
    this.baseDegrees = degrees;
    this.indexMap = indexMap;
    this.opts = opts;

    this.anchors = (opts.anchors || []).map((a) => indexMap.get(a));
    for (const a of opts.anchors || []) {
      if (indexMap.get(a) === undefined) throw new Error('Anchor pixel missing');
    }

    this.isAscending = opts.degreeOrder !== 'descending';

    this.best = { paths: [], pathCount: Infinity, anchors: 0 };
    this.startTime = Date.now();
    this.timeExceeded = false;
    this.completed = false;
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
    if (isHamiltonianPath && (anchors === this.anchors.length || anchors === 2)) this.completed = true;
  }

  checkTimeout() {
    if (Date.now() - this.startTime > TIME_LIMIT) {
      this.timeExceeded = true;
    }
  }

  chooseStart(ctx) {
    let bestIdx = -1;
    let best = this.isAscending ? Infinity : -1;
    for (let i = 0; i < ctx.degrees.length; i++) {
      if (!ctx.active[i]) continue;
      const d = ctx.degrees[i];
      if (this.isAscending ? d < best : d > best) {
        best = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  checkForBetterRecord(ctx, acc) {
    const k = ctx.active.join('');
    const prev = ctx.record.get(k);
    if (prev != null && acc.length > prev) return true;
    ctx.record.set(k, acc.length);
    return false;
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

  async search(ctx, acc, initNode) {
    const stack = [{ type: 'search', node: initNode ?? this.chooseStart(ctx), acc }];

    while (stack.length && !this.timeExceeded && !this.completed) {
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
            if (!this.checkForBetterRecord(ctx, newAcc)) {
              for (let i = this.nodes.length - 1; i >= 0; i--) {
                if (!ctx.active[i]) continue;
                stack.push({ type: 'search', node: i, acc: newAcc });
              }
            }
          } else {
            ctx.attempts++;
            this.updateBest(newAcc);
            if (ctx.attempts % 1024 === 0) {
              this.checkTimeout();
              await new Promise((resolve) => setTimeout(resolve));
            }
          }
          continue;
        }
      }
    }
  }

  async run() {
    const anchors = this.anchors.length ? this.anchors : [null];
    const tasks = anchors.map((initial) => {
      const ctx = {
        attempts: 0,
        remaining: this.nodes.length,
        active: new Uint8Array(this.nodes.length).fill(1),
        degrees: Uint8Array.from(this.baseDegrees),
        record: new Map(),
      };
      return this.search(ctx, [], initial);
    });
    await Promise.race(tasks);
    return this.best.paths.map((p) => p.map((i) => this.nodes[i]));
  }
}

async function solve(input, opts = {}) {
  let nodes, neighbors, degrees, indexMap;
  if (input && input.nodes && input.neighbors && input.degrees) {
    ({ nodes, neighbors, degrees } = input);
    indexMap = new Map(nodes.map((p, i) => [p, i]));
  } else {
    ({ nodes, neighbors, degrees, indexMap } = buildGraph(input));
  }

  const partition = partitionAtEdgeCut(nodes, neighbors);
  if (partition) {
    // If multiple edges are cut, keep the largest/most-anchored part as base
    if (partition.cutEdges.length > 1) {
      // Determine base part
      let baseIndex = 0;
      let maxAnchors = -1;
      let maxSize = -1;
      const anchorList = opts.anchors || [];
      partition.parts.forEach((part, i) => {
        let count = 0;
        for (const a of anchorList) if (part.indexMap.has(a)) count++;
        if (count > maxAnchors || (count === maxAnchors && part.nodes.length > maxSize)) {
          maxAnchors = count;
          maxSize = part.nodes.length;
          baseIndex = i;
        }
      });

      const base = partition.parts[baseIndex];
      // Build placeholder info for non-base parts
      const placeholders = [];
      let phId = -1;
      partition.parts.forEach((part, i) => {
        if (i === baseIndex) return;
        const placeholder = phId--;
        const mapping = new Map(); // basePixel -> partPixel
        for (const [aIdx, bIdx] of partition.cutEdges) {
          const aPix = nodes[aIdx];
          const bPix = nodes[bIdx];
          if (base.indexMap.has(aPix) && part.indexMap.has(bPix)) {
            mapping.set(aPix, bPix);
          } else if (base.indexMap.has(bPix) && part.indexMap.has(aPix)) {
            mapping.set(bPix, aPix);
          }
        }
        placeholders.push({ placeholder, part, mapping });
      });

      // Compose new graph for base with placeholders
      const baseNodes = base.nodes.concat(placeholders.map((p) => p.placeholder));
      const baseNeighbors = base.neighbors.map((nbs) => nbs.slice());
      placeholders.forEach(() => baseNeighbors.push([]));
      const baseIndexMap = new Map(baseNodes.map((p, i) => [p, i]));
      for (const ph of placeholders) {
        const phIdx = baseIndexMap.get(ph.placeholder);
        for (const [bPixel] of ph.mapping) {
          const bi = baseIndexMap.get(bPixel);
          baseNeighbors[bi].push(phIdx);
          baseNeighbors[phIdx].push(bi);
        }
      }
      const baseDegrees = baseNeighbors.map((nbs) => nbs.length);
      const baseGraph = { nodes: baseNodes, neighbors: baseNeighbors, degrees: baseDegrees };
      const baseAnchors = anchorList.filter((a) => baseIndexMap.has(a));
      const basePaths = await solve(baseGraph, { ...opts, anchors: baseAnchors });

      // Expand placeholders
      for (const ph of placeholders) {
        const { placeholder, part, mapping } = ph;
        const pathIdx = basePaths.findIndex((p) => p.includes(placeholder));
        if (pathIdx === -1) continue;
        const path = basePaths[pathIdx];
        const pos = path.indexOf(placeholder);
        const prev = path[pos - 1];
        const next = path[pos + 1];
        const anchorPixels = [];
        if (prev !== undefined && mapping.has(prev)) anchorPixels.push(mapping.get(prev));
        if (next !== undefined && mapping.has(next) && !anchorPixels.includes(mapping.get(next))) {
          anchorPixels.push(mapping.get(next));
        }
        const subPaths = await solve(part, { ...opts, anchors: anchorPixels });
        const insert = subPaths[0] || [];
        path.splice(pos, 1, ...insert);
        // Append any additional paths from the part
        if (subPaths.length > 1) basePaths.push(...subPaths.slice(1));
      }
      return basePaths;
    }

    // Default behavior for single cut edge
    const results = [];
    for (const part of partition.parts) {
      const anchorSet = new Set();
      if (opts.anchors) {
        for (const a of opts.anchors) if (part.nodes.includes(a)) anchorSet.add(a);
      }
      for (const [aIdx, bIdx] of partition.cutEdges) {
        const aPixel = nodes[aIdx];
        const bPixel = nodes[bIdx];
        if (part.nodes.includes(aPixel)) anchorSet.add(aPixel);
        if (part.nodes.includes(bPixel)) anchorSet.add(bPixel);
      }
      const partOpts = { anchors: [...anchorSet] };
      if (opts.degreeOrder) partOpts.degreeOrder = opts.degreeOrder;
      results.push(solve(part, partOpts));
    }
    const paths = (await Promise.all(results)).flat();
    const anchorPairs = partition.cutEdges.map(([a, b]) => [nodes[a], nodes[b]]);
    return stitchPaths(paths, anchorPairs);
  }

  const solver = new PathCoverSolver(nodes, neighbors, degrees, indexMap, opts);
  return await solver.run();
}

class HamiltonianService {
  async traverseWithStart(pixels, start) {
    const { nodes, neighbors, indexMap } = buildGraph(pixels);
    const { components, compIndex } = getComponents(neighbors);
    const startIdx = indexMap.get(start);
    if (startIdx === undefined) throw new Error('Start pixel missing');

    const result = [];
    for (let i = 0; i < components.length; i++) {
      const compPixels = components[i].map((idx) => nodes[idx]);
      if (compIndex[startIdx] === i) {
        result.push(...await solve(compPixels, { anchors: [start] }));
      } else {
        result.push(...await solve(compPixels));
      }
    }
    return result;
  }

  async traverseWithStartEnd(pixels, start, end) {
    const { nodes, neighbors, indexMap } = buildGraph(pixels);
    const { components, compIndex } = getComponents(neighbors);
    const startIdx = indexMap.get(start);
    const endIdx = indexMap.get(end);
    if (startIdx === undefined) throw new Error('Start pixel missing');
    if (endIdx === undefined) throw new Error('End pixel missing');
    if (compIndex[startIdx] !== compIndex[endIdx]) throw new Error('Start and end pixels are disconnected');

    const result = [];
    for (let i = 0; i < components.length; i++) {
      const compPixels = components[i].map((idx) => nodes[idx]);
      if (compIndex[startIdx] === i) {
        result.push(...await solve(compPixels, { anchors: [start, end] }));
      } else {
        result.push(...await solve(compPixels));
      }
    }
    return result;
  }

  async traverseFree(pixels) {
    const { nodes, neighbors } = buildGraph(pixels);
    const { components } = getComponents(neighbors);
    const result = [];
    for (const comp of components) {
      const compPixels = comp.map((idx) => nodes[idx]);
      result.push(...await solve(compPixels));
    }
    return result;
  }
}

export const useHamiltonianService = () => new HamiltonianService();

export { buildGraph, partitionAtEdgeCut, solve };
