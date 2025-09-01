export const MAX_DIMENSION: i32 = 65536;
const DP_THRESHOLD: i32 = 20;

class Graph {
  constructor(
    public nodes: Int32Array,
    public neighbors: Array<Array<i32>>,
    public degrees: Int32Array,
    public indexMap: Map<i32, i32>
  ) {}
}

function buildGraph(pixels: Int32Array): Graph {
  const indexMap = new Map<i32, i32>();
  const nodesArr = new Array<i32>();
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i];
    if (!indexMap.has(p)) {
      indexMap.set(p, nodesArr.length);
      nodesArr.push(p);
    }
  }

  const nodes = new Int32Array(nodesArr.length);
  for (let i = 0; i < nodesArr.length; i++) nodes[i] = nodesArr[i];

  const neighbors = new Array<Array<i32>>(nodes.length);
  for (let i = 0; i < nodes.length; i++) neighbors[i] = new Array<i32>();

  const xs = new Int32Array(nodes.length);
  const ys = new Int32Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    xs[i] = p % MAX_DIMENSION;
    ys[i] = p / MAX_DIMENSION;
  }

  for (let i = 0; i < nodes.length; i++) {
    const x = xs[i];
    const y = ys[i];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx == 0 && dy == 0) continue;
        const nPixel = x + dx + MAX_DIMENSION * (y + dy);
        if (indexMap.has(nPixel)) neighbors[i].push(indexMap.get(nPixel));
      }
    }
  }

  const degrees = new Int32Array(nodes.length);
  for (let i = 0; i < neighbors.length; i++) {
    degrees[i] = neighbors[i].length;
  }
  for (let i = 0; i < neighbors.length; i++) {
    const arr = neighbors[i];
    for (let j = 1; j < arr.length; j++) {
      const val = arr[j];
      let k = j - 1;
      while (k >= 0 && degrees[arr[k]] > degrees[val]) {
        arr[k + 1] = arr[k];
        k--;
      }
      arr[k + 1] = val;
    }
  }

  return new Graph(nodes, neighbors, degrees, indexMap);
}

class ComponentsInfo {
  constructor(
    public components: Array<Array<i32>>,
    public compIndex: Int32Array
  ) {}
}

function getComponents(neighbors: Array<Array<i32>>): ComponentsInfo {
  const n = neighbors.length;
  const compIndex = new Int32Array(n);
  for (let i = 0; i < n; i++) compIndex[i] = -1;

  const components = new Array<Array<i32>>();
  let cid = 0;

  for (let i = 0; i < n; i++) {
    if (compIndex[i] != -1) continue;
    const stack = new Array<i32>();
    stack.push(i);
    compIndex[i] = cid;
    const comp = new Array<i32>();
    while (stack.length > 0) {
      const node = stack.pop();
      comp.push(node);
      const nbs = neighbors[node];
      for (let j = 0; j < nbs.length; j++) {
        const nb = nbs[j];
        if (compIndex[nb] == -1) {
          compIndex[nb] = cid;
          stack.push(nb);
        }
      }
    }
    components.push(comp);
    cid++;
  }

  return new ComponentsInfo(components, compIndex);
}

function solveDP(pixels: Int32Array, start: i32 = -1, end: i32 = -1): Array<Int32Array> {
  const g = buildGraph(pixels);
  const nodes = g.nodes;
  const neighbors = g.neighbors;
  const indexMap = g.indexMap;
  const n = nodes.length;
  if (n == 0) return new Array<Int32Array>();

  const startIdx = start != -1 && indexMap.has(start) ? indexMap.get(start) : -1;
  const endIdx = end != -1 && indexMap.has(end) ? indexMap.get(end) : -1;

  if (start != -1 && startIdx == -1) return new Array<Int32Array>();
  if (end != -1 && endIdx == -1) return new Array<Int32Array>();

  const size = 1 << n;
  const INF = 1000000000;
  const dist = new Int32Array(size * n);
  for (let i = 0; i < dist.length; i++) dist[i] = INF;
  const prev = new Int16Array(size * n);
  for (let i = 0; i < prev.length; i++) prev[i] = -1;

  if (startIdx != -1) {
    dist[(1 << startIdx) * n + startIdx] = 0;
  } else {
    for (let i = 0; i < n; i++) dist[(1 << i) * n + i] = 0;
  }

  for (let mask = 0; mask < size; mask++) {
    for (let v = 0; v < n; v++) {
      const idx = mask * n + v;
      if ((mask & (1 << v)) == 0 || dist[idx] == INF) continue;
      const nbs = neighbors[v];
      for (let j = 0; j < nbs.length; j++) {
        const nb = nbs[j];
        const bit = 1 << nb;
        if (mask & bit) continue;
        const nextMask = mask | bit;
        const nextIdx = nextMask * n + nb;
        const nd = dist[idx] + 1;
        if (nd < dist[nextIdx]) {
          dist[nextIdx] = nd;
          prev[nextIdx] = v as i16;
        }
      }
    }
  }

  const fullMask = size - 1;
  let endV = endIdx;
  if (endV == -1) {
    let best = INF;
    for (let v = 0; v < n; v++) {
      const d = dist[fullMask * n + v];
      if (d < best) {
        best = d;
        endV = v;
      }
    }
    if (best == INF) return new Array<Int32Array>();
  } else {
    if (dist[fullMask * n + endV] == INF) return new Array<Int32Array>();
  }

  const path = new Array<i32>();
  let mask = fullMask;
  let v = endV;
  while (v != -1) {
    path.push(nodes[v]);
    const pv = prev[mask * n + v];
    mask ^= 1 << v;
    v = pv;
  }
  path.reverse();
  const arr = new Int32Array(path.length);
  for (let i = 0; i < path.length; i++) arr[i] = path[i];
  const result = new Array<Int32Array>();
  result.push(arr);
  return result;
}

class BacktrackSolver {
  nodes: Int32Array;
  neighbors: Array<Array<i32>>;
  degrees: Int32Array;
  remaining: Uint8Array;
  startIdx: i32;
  endIdx: i32;
  best: Array<Array<i32>> | null = null;

  constructor(g: Graph, startIdx: i32, endIdx: i32) {
    this.nodes = g.nodes;
    this.neighbors = g.neighbors;
    this.degrees = g.degrees;
    this.remaining = new Uint8Array(g.nodes.length);
    for (let i = 0; i < g.nodes.length; i++) this.remaining[i] = 1;
    this.startIdx = startIdx;
    this.endIdx = endIdx;
  }

  remove(node: i32): void {
    this.remaining[node] = 0;
    const nbs = this.neighbors[node];
    for (let i = 0; i < nbs.length; i++) {
      const nb = nbs[i];
      if (this.remaining[nb]) this.degrees[nb]--;
    }
  }

  restore(node: i32): void {
    const nbs = this.neighbors[node];
    for (let i = 0; i < nbs.length; i++) {
      const nb = nbs[i];
      if (this.remaining[nb]) this.degrees[nb]++;
    }
    this.remaining[node] = 1;
  }

  chooseStart(): i32 {
    let bestIdx = -1;
    let min = i32.MAX_VALUE;
    for (let i = 0; i < this.degrees.length; i++) {
      if (!this.remaining[i]) continue;
      const d = this.degrees[i];
      if (d < min) {
        min = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  search(activeCount: i32, acc: Array<Array<i32>>): void {
    if (this.best !== null && acc.length >= this.best!.length) return;
    if (activeCount == 0) {
      this.best = acc.slice();
      return;
    }
    const isFirst = acc.length == 0;
    const startNode = isFirst && this.startIdx != -1 ? this.startIdx : this.chooseStart();
    this.remove(startNode);
    const path = new Array<i32>();
    path.push(startNode);
    this.extend(startNode, path, activeCount - 1, acc, isFirst);
    this.restore(startNode);
  }

  extend(node: i32, path: Array<i32>, activeCount: i32, acc: Array<Array<i32>>, isFirst: bool): void {
    if (this.best !== null && acc.length + 1 >= this.best!.length) return;

    const nbs = this.neighbors[node];
    for (let i = 0; i < nbs.length; i++) {
      const nb = nbs[i];
      if (!this.remaining[nb]) continue;
      this.remove(nb);
      path.push(nb);
      this.extend(nb, path, activeCount - 1, acc, isFirst);
      path.pop();
      this.restore(nb);
    }

    if (!isFirst || this.endIdx == -1 || node == this.endIdx) {
      acc.push(path.slice());
      this.search(activeCount, acc);
      acc.pop();
    }
  }
}

function solve(pixels: Int32Array, start: i32 = -1, end: i32 = -1): Array<Int32Array> {
  const g = buildGraph(pixels);
  const indexMap = g.indexMap;
  const startIdx = start != -1 && indexMap.has(start) ? indexMap.get(start) : -1;
  const endIdx = end != -1 && indexMap.has(end) ? indexMap.get(end) : -1;
  if (start != -1 && startIdx == -1) return new Array<Int32Array>();
  if (end != -1 && endIdx == -1) return new Array<Int32Array>();

  const solver = new BacktrackSolver(g, startIdx, endIdx);
  solver.search(g.nodes.length, new Array<Array<i32>>());

  const result = new Array<Int32Array>();
  const best = solver.best;
  if (best !== null) {
    for (let i = 0; i < best.length; i++) {
      const p = best[i];
      const arr = new Int32Array(p.length);
      for (let j = 0; j < p.length; j++) arr[j] = solver.nodes[p[j]];
      result.push(arr);
    }
  }
  return result;
}

function flattenPaths(paths: Array<Int32Array>): Int32Array {
  let total = 1;
  for (let i = 0; i < paths.length; i++) total += 1 + paths[i].length;
  const out = new Int32Array(total);
  out[0] = paths.length;
  let idx = 1;
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    out[idx++] = p.length;
    for (let j = 0; j < p.length; j++) out[idx++] = p[j];
  }
  return out;
}

export function traverseWithStart(pixels: Int32Array, start: i32): Int32Array {
  const g = buildGraph(pixels);
  const comps = getComponents(g.neighbors);
  const nodes = g.nodes;
  const indexMap = g.indexMap;
  const startIdx = indexMap.has(start) ? indexMap.get(start) : -1;
  if (startIdx == -1) return new Int32Array(0);
  const result = new Array<Int32Array>();
  for (let i = 0; i < comps.components.length; i++) {
    const comp = comps.components[i];
    const compPixels = new Int32Array(comp.length);
    for (let j = 0; j < comp.length; j++) compPixels[j] = nodes[comp[j]];
    const solver = compPixels.length <= DP_THRESHOLD ? solveDP : solve;
    if (comps.compIndex[startIdx] == i) {
      const paths = solver(compPixels, start, -1);
      for (let k = 0; k < paths.length; k++) result.push(paths[k]);
    } else {
      const paths = solver(compPixels);
      for (let k = 0; k < paths.length; k++) result.push(paths[k]);
    }
  }
  return flattenPaths(result);
}

export function traverseWithStartEnd(pixels: Int32Array, start: i32, end: i32): Int32Array {
  const g = buildGraph(pixels);
  const comps = getComponents(g.neighbors);
  const nodes = g.nodes;
  const indexMap = g.indexMap;
  const startIdx = indexMap.has(start) ? indexMap.get(start) : -1;
  const endIdx = indexMap.has(end) ? indexMap.get(end) : -1;
  if (startIdx == -1 || endIdx == -1) return new Int32Array(0);
  if (comps.compIndex[startIdx] != comps.compIndex[endIdx]) return new Int32Array(0);

  const result = new Array<Int32Array>();
  for (let i = 0; i < comps.components.length; i++) {
    const comp = comps.components[i];
    const compPixels = new Int32Array(comp.length);
    for (let j = 0; j < comp.length; j++) compPixels[j] = nodes[comp[j]];
    const solver = compPixels.length <= DP_THRESHOLD ? solveDP : solve;
    if (comps.compIndex[startIdx] == i) {
      const paths = solver(compPixels, start, end);
      for (let k = 0; k < paths.length; k++) result.push(paths[k]);
    } else {
      const paths = solver(compPixels);
      for (let k = 0; k < paths.length; k++) result.push(paths[k]);
    }
  }
  return flattenPaths(result);
}

export function traverseFree(pixels: Int32Array): Int32Array {
  const g = buildGraph(pixels);
  const comps = getComponents(g.neighbors);
  const nodes = g.nodes;
  const result = new Array<Int32Array>();
  for (let i = 0; i < comps.components.length; i++) {
    const comp = comps.components[i];
    const compPixels = new Int32Array(comp.length);
    for (let j = 0; j < comp.length; j++) compPixels[j] = nodes[comp[j]];
    const solver = compPixels.length <= DP_THRESHOLD ? solveDP : solve;
    const paths = solver(compPixels);
    for (let k = 0; k < paths.length; k++) result.push(paths[k]);
  }
  return flattenPaths(result);
}

export const I32ARRAY_ID = idof<Int32Array>();
