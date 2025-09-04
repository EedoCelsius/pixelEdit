export const IntArray_ID = idof<Array<i32>>();
export const IntArrayArray_ID = idof<Array<Array<i32>>>();
export const Uint8Array_ID = idof<Uint8Array>();
export { memory };

class Context {
  remaining!: Uint8Array;
  degrees!: Uint8Array;
  memo!: Map<u32, i32>;
  hash: u32 = 0;
  start: i32 = -1;
}

class PathCoverSolver {
  nodes: Array<i32>;
  neighbors: Array<Array<i32>>;
  baseDegrees: Uint8Array;
  anchors: Array<i32>;
  isAscending: bool;
  total: i32;
  requiredAnchors: i32;
  bestPaths: Array<Array<i32>>;
  bestPathCount: i32;
  bestAnchors: i32;
  bestLevel: i32;
  nodeHashes!: Uint32Array;
  initialHash: u32;
  timeExceeded: bool;
  completed: bool;

  constructor(
    nodes: Array<i32>,
    neighbors: Array<Array<i32>>,
    degrees: Uint8Array,
    anchors: Array<i32>,
    isAscending: bool,
  ) {
    this.nodes = nodes;
    this.neighbors = neighbors;
    this.baseDegrees = degrees;
    this.anchors = anchors;
    this.isAscending = isAscending;
    this.total = nodes.length;
    this.requiredAnchors = anchors.length;
    this.bestPaths = new Array<Array<i32>>();
    this.bestPathCount = i32.MAX_VALUE;
    this.bestAnchors = 0;
    this.bestLevel = -1;
    this.nodeHashes = new Uint32Array(this.total as i32);
    let initHash: u32 = 0;
    for (let i = 0; i < this.total; i++) {
      const h: u32 = <u32>(Math.random() * 0xffffffff);
      this.nodeHashes[i] = h;
      initHash ^= h;
    }
    this.initialHash = initHash;
    this.timeExceeded = false;
    this.completed = false;
  }

  updateBest(acc: Array<Array<i32>>, activeCount: i32, currentPath: Array<i32> | null = null): void {
    const candidatePaths = currentPath ? acc.concat([currentPath]) : acc;
    const pathCount = candidatePaths.length + activeCount;
    let anchors = 0;
    for (let i = 0; i < this.anchors.length; i++) {
      const a = this.anchors[i];
      for (let j = 0; j < candidatePaths.length; j++) {
        const p = candidatePaths[j];
        if (p[0] == a || p[p.length - 1] == a) {
          anchors++;
          break;
        }
      }
    }
    const isFull = activeCount == 0;
    const isFullPath = isFull && candidatePaths.length == 1;
    let level = 0;
    if (isFullPath) {
      if (anchors == this.requiredAnchors) level = 3;
      else if (anchors > 0) level = 2;
      else level = 1;
    } else if (anchors > 0) {
      level = 1;
    }

    const better =
      this.bestPaths.length == 0 ||
      level > this.bestLevel ||
      (level == this.bestLevel &&
        (pathCount < this.bestPathCount ||
          (pathCount == this.bestPathCount && anchors > this.bestAnchors)));

    if (better) {
      this.bestPaths = new Array<Array<i32>>();
      for (let j = 0; j < candidatePaths.length; j++) {
        const p = candidatePaths[j];
        const copy = new Array<i32>(p.length);
        for (let k = 0; k < p.length; k++) copy[k] = p[k];
        this.bestPaths.push(copy);
      }
      this.bestPathCount = pathCount;
      this.bestLevel = level;
      this.bestAnchors = anchors;
      if (level == 3 || (level == 2 && this.requiredAnchors == 1)) {
        this.completed = true;
      }
    }
  }

  remove(ctx: Context, node: i32): void {
    ctx.hash ^= this.nodeHashes[node];
    ctx.remaining[node] = 0;
    const nbs = this.neighbors[node];
    for (let i = 0; i < nbs.length; i++) {
      const nb = nbs[i];
      if (ctx.remaining[nb]) ctx.degrees[nb]--;
    }
  }

  restore(ctx: Context, node: i32): void {
    const nbs = this.neighbors[node];
    for (let i = 0; i < nbs.length; i++) {
      const nb = nbs[i];
      if (ctx.remaining[nb]) ctx.degrees[nb]++;
    }
    ctx.remaining[node] = 1;
    ctx.hash ^= this.nodeHashes[node];
  }

  chooseStart(ctx: Context): i32 {
    let bestIdx = -1;
    let best = this.isAscending ? i32.MAX_VALUE : -1;
    for (let i = 0; i < ctx.degrees.length; i++) {
      if (!ctx.remaining[i]) continue;
      const d = <i32>ctx.degrees[i];
      if (this.isAscending ? d < best : d > best) {
        best = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  checkForBetterMemo(ctx: Context, acc: Array<Array<i32>>): bool {
    const k = ctx.hash;
    if (ctx.memo.has(k)) {
      const prev = ctx.memo.get(k);
      if (prev !== null && acc.length >= <i32>prev) return true;
    }
    ctx.memo.set(k, acc.length);
    return false;
  }

  sortedNeighbor(ctx: Context, node: i32): Array<i32> {
    const result = new Array<i32>();
    const nbs = this.neighbors[node];
    for (let i = 0; i < nbs.length; i++) {
      const nb = nbs[i];
      const d = <i32>ctx.degrees[nb];
      let inserted = false;
      for (let j = 0; j < result.length; j++) {
        const cd = <i32>ctx.degrees[result[j]];
        if (this.isAscending ? d < cd : d > cd) {
          result.splice(j, 0);
          result[j] = nb;
          inserted = true;
          break;
        }
      }
      if (!inserted) result.push(nb);
    }
    return result;
  }

  search(ctx: Context, activeCount: i32, acc: Array<Array<i32>>): void {
    this.updateBest(acc, activeCount);
    if (this.checkForBetterMemo(ctx, acc)) return;
    if (activeCount == 0) return;
    const isFirst = acc.length == 0;
    const startNode = isFirst && ctx.start != -1 ? ctx.start : this.chooseStart(ctx);
    this.remove(ctx, startNode);
    const path = new Array<i32>();
    path.push(startNode);
    this.extend(ctx, startNode, path, activeCount - 1, acc, isFirst);
    this.restore(ctx, startNode);
  }

  extend(
    ctx: Context,
    node: i32,
    path: Array<i32>,
    activeCount: i32,
    acc: Array<Array<i32>>,
    isFirst: bool,
  ): void {
    this.updateBest(acc, activeCount, path);
    const nbs = this.sortedNeighbor(ctx, node);
    for (let i = 0; i < nbs.length; i++) {
      const nb = nbs[i];
      if (!ctx.remaining[nb]) continue;
      this.remove(ctx, nb);
      path.push(nb);
      this.extend(ctx, nb, path, activeCount - 1, acc, isFirst);
      if (this.timeExceeded || this.completed) return;
      path.pop();
      this.restore(ctx, nb);
    }
    if (this.timeExceeded || this.completed) return;
    acc.push(path.slice());
    this.search(ctx, activeCount, acc);
    acc.pop();
  }
}

export function solve(
  nodes: Array<i32>,
  neighbors: Array<Array<i32>>,
  degrees: Uint8Array,
  anchors: Array<i32>,
  start: i32,
  isAscending: i32,
): Array<Array<i32>> {
  const solver = new PathCoverSolver(nodes, neighbors, degrees, anchors, isAscending != 0);
  const ctx = new Context();
  ctx.remaining = new Uint8Array(solver.total as i32);
  for (let i = 0; i < solver.total; i++) ctx.remaining[i] = 1;
  ctx.degrees = new Uint8Array(degrees.length as i32);
  for (let i = 0; i < degrees.length; i++) ctx.degrees[i] = degrees[i];
  ctx.memo = new Map<u32, i32>();
  ctx.hash = solver.initialHash;
  ctx.start = start;
  solver.search(ctx, solver.total, new Array<Array<i32>>());
  const result = new Array<Array<i32>>();
  for (let i = 0; i < solver.bestPaths.length; i++) {
    const p = solver.bestPaths[i];
    const pathPixels = new Array<i32>(p.length);
    for (let j = 0; j < p.length; j++) {
      const idx = p[j];
      pathPixels[j] = solver.nodes[idx];
    }
    result.push(pathPixels);
  }
  return result;
}
