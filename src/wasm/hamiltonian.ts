// AssemblyScript implementation of Hamiltonian path solver
// Mirrors logic of src/services/hamiltonian.js but compiled to WebAssembly

const MAX_DIMENSION:i32 = 65536;
const DP_THRESHOLD:i32 = 20;

// Export ArrayBufferView ID for Int32Array so JS can allocate typed arrays
export const Int32Array_ID = idof<Int32Array>();

class Graph {
  nodes:Int32Array;
  neighbors:Array<Array<i32>>;
  degrees:Array<i32>;
  indexMap:Map<i32,i32>;
  constructor(nodes:Int32Array, neighbors:Array<Array<i32>>, degrees:Array<i32>, indexMap:Map<i32,i32>) {
    this.nodes = nodes;
    this.neighbors = neighbors;
    this.degrees = degrees;
    this.indexMap = indexMap;
  }
}

function buildGraph(pixels:Int32Array):Graph {
  const set = new Set<i32>();
  for (let i=0; i<pixels.length; i++) set.add(pixels[i]);
  const nodesArr = new Array<i32>();
  const vals = set.values();
  for (let i=0; i<vals.length; i++) nodesArr.push(vals[i]);
  const nodes = new Int32Array(nodesArr.length);
  for (let i=0; i<nodesArr.length; i++) nodes[i] = nodesArr[i];
  const indexMap = new Map<i32,i32>();
  for (let i=0; i<nodes.length; i++) indexMap.set(nodes[i], i);
  const neighbors = new Array<Array<i32>>(nodes.length);
  for (let i=0; i<nodes.length; i++) neighbors[i] = new Array<i32>();

  const xs = new Int32Array(nodes.length);
  const ys = new Int32Array(nodes.length);
  for (let i=0; i<nodes.length; i++) {
    const p = nodes[i];
    xs[i] = p % MAX_DIMENSION;
    ys[i] = p / MAX_DIMENSION;
  }

  for (let i=0; i<nodes.length; i++) {
    const x = xs[i];
    const y = ys[i];
    for (let dx=-1; dx<=1; dx++) {
      for (let dy=-1; dy<=1; dy++) {
        if (dx==0 && dy==0) continue;
        const nPixel = x + dx + MAX_DIMENSION * (y + dy);
        if (set.has(nPixel)) {
          const idx = indexMap.get(nPixel);
          neighbors[i].push(idx);
        }
      }
    }
  }

  const degrees = new Array<i32>(neighbors.length);
  for (let i=0; i<neighbors.length; i++) degrees[i] = neighbors[i].length;
  for (let i=0; i<neighbors.length; i++) {
    const arr = neighbors[i];
    for (let a=0; a<arr.length - 1; a++) {
      for (let b=a+1; b<arr.length; b++) {
        if (degrees[arr[a]] > degrees[arr[b]]) {
          const tmp = arr[a];
          arr[a] = arr[b];
          arr[b] = tmp;
        }
      }
    }
  }

  return new Graph(nodes, neighbors, degrees, indexMap);
}

class ComponentsResult {
  components:Array<Array<i32>>;
  compIndex:Int32Array;
  constructor(components:Array<Array<i32>>, compIndex:Int32Array) {
    this.components = components;
    this.compIndex = compIndex;
  }
}

function getComponents(neighbors:Array<Array<i32>>):ComponentsResult {
  const n = neighbors.length;
  const compIndex = new Int32Array(n);
  for (let i=0; i<n; i++) compIndex[i] = -1;
  const components = new Array<Array<i32>>();
  let cid = 0;
  for (let i=0; i<n; i++) {
    if (compIndex[i] != -1) continue;
    const stack = new Array<i32>();
    stack.push(i);
    compIndex[i] = cid;
    const comp = new Array<i32>();
    while (stack.length) {
      const node = stack.pop();
      comp.push(node);
      const nbs = neighbors[node];
      for (let j=0; j<nbs.length; j++) {
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
  return new ComponentsResult(components, compIndex);
}

// Dynamic programming solver for Hamiltonian path using bitmasks
function solveDP(pixels:Int32Array, start:i32=-1, end:i32=-1):Array<Int32Array> {
  const g = buildGraph(pixels);
  const nodes = g.nodes;
  const neighbors = g.neighbors;
  const indexMap = g.indexMap;
  const n = nodes.length;
  if (n==0) return new Array<Int32Array>();

  let s = start!=-1 ? (indexMap.has(start) ? indexMap.get(start) : -2) : -1;
  let e = end!=-1 ? (indexMap.has(end) ? indexMap.get(end) : -2) : -1;
  if (start!=-1 && s==-2) abort();
  if (end!=-1 && e==-2) abort();

  const size = 1 << n;
  const INF = 1000000000;
  const dist = new Int32Array(size * n);
  for (let i=0; i<dist.length; i++) dist[i] = INF;
  const prev = new Int16Array(size * n);
  for (let i=0; i<prev.length; i++) prev[i] = -1;

  if (s!=-1) {
    dist[(1<<s)*n + s] = 0;
  } else {
    for (let i=0; i<n; i++) dist[(1<<i)*n + i] = 0;
  }

  for (let mask=0; mask<size; mask++) {
    for (let v=0; v<n; v++) {
      const idx = mask * n + v;
      if (!(mask & (1<<v)) || dist[idx]==INF) continue;
      const nbs = neighbors[v];
      for (let j=0; j<nbs.length; j++) {
        const nb = nbs[j];
        const bit = 1<<nb;
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
  let endV = e;
  if (endV==-1) {
    let best = INF;
    for (let v=0; v<n; v++) {
      const d = dist[fullMask*n + v];
      if (d < best) { best = d; endV = v; }
    }
    if (best==INF) return new Array<Int32Array>();
  } else if (dist[fullMask*n + endV] == INF) {
    return new Array<Int32Array>();
  }

  const path = new Array<i32>();
  let mask = fullMask;
  let v = endV;
  while (v != -1) {
    path.push(v);
    const pv = prev[mask*n + v];
    mask ^= 1 << v;
    v = pv;
  }
  path.reverse();
  const out = new Int32Array(path.length);
  for (let i=0; i<path.length; i++) out[i] = nodes[path[i]];
  const res = new Array<Int32Array>();
  res.push(out);
  return res;
}

// helper functions to avoid closures
function removeNode(neighbors:Array<Array<i32>>, remaining:Uint8Array, degrees:Array<i32>, node:i32):void {
  remaining[node] = 0;
  const nbs = neighbors[node];
  for (let j=0; j<nbs.length; j++) {
    const nb = nbs[j];
    if (remaining[nb]) degrees[nb]--;
  }
}

function restoreNode(neighbors:Array<Array<i32>>, remaining:Uint8Array, degrees:Array<i32>, node:i32):void {
  const nbs = neighbors[node];
  for (let j=0; j<nbs.length; j++) {
    const nb = nbs[j];
    if (remaining[nb]) degrees[nb]++;
  }
  remaining[node] = 1;
}

function chooseStartNode(remaining:Uint8Array, degrees:Array<i32>):i32 {
  let bestIdx = -1;
  let min = i32.MAX_VALUE;
  for (let i=0; i<degrees.length; i++) {
    if (!remaining[i]) continue;
    const d = degrees[i];
    if (d < min) { min = d; bestIdx = i; }
  }
  return bestIdx;
}

function extendNode(neighbors:Array<Array<i32>>, degrees:Array<i32>, remaining:Uint8Array, node:i32, path:Array<i32>, activeCount:i32, acc:Array<Array<i32>>, isFirst:bool, end:i32, bestPaths:Array<Array<i32>>, start:i32):void {
  if (bestPaths.length && acc.length + 1 >= bestPaths.length) return;
  const nbs = neighbors[node];
  for (let j=0; j<nbs.length; j++) {
    const nb = nbs[j];
    if (!remaining[nb]) continue;
    removeNode(neighbors, remaining, degrees, nb);
    path.push(nb);
    extendNode(neighbors, degrees, remaining, nb, path, activeCount-1, acc, isFirst, end, bestPaths, start);
    path.pop();
    restoreNode(neighbors, remaining, degrees, nb);
  }
  if (!isFirst || end==-1 || node==end) {
    const copy = new Array<i32>();
    for (let i=0; i<path.length; i++) copy.push(path[i]);
    acc.push(copy);
    searchPaths(neighbors, degrees, remaining, activeCount, acc, start, end, bestPaths);
    acc.pop();
  }
}

function searchPaths(neighbors:Array<Array<i32>>, degrees:Array<i32>, remaining:Uint8Array, activeCount:i32, acc:Array<Array<i32>>, start:i32, end:i32, bestPaths:Array<Array<i32>>):void {
  if (bestPaths.length && acc.length >= bestPaths.length) return;
  if (activeCount==0) {
    bestPaths.length = 0;
    for (let idx=0; idx<acc.length; idx++) {
      const p = acc[idx];
      const cp = new Array<i32>();
      for (let i=0; i<p.length; i++) cp.push(p[i]);
      bestPaths.push(cp);
    }
    return;
  }
  const isFirst = acc.length==0;
  const startNode = isFirst && start!=-1 ? start : chooseStartNode(remaining, degrees);
  removeNode(neighbors, remaining, degrees, startNode);
  const startPath = new Array<i32>();
  startPath.push(startNode);
  extendNode(neighbors, degrees, remaining, startNode, startPath, activeCount-1, acc, isFirst, end, bestPaths, start);
  restoreNode(neighbors, remaining, degrees, startNode);
}

// Core solver using backtracking to find minimum path cover
function solve(pixels:Int32Array, start:i32=-1, end:i32=-1):Array<Int32Array> {
  const g = buildGraph(pixels);
  const nodes = g.nodes;
  const neighbors = g.neighbors;
  const degrees = g.degrees;
  const indexMap = g.indexMap;
  const total = nodes.length;
  const remaining = new Uint8Array(total);
  for (let i=0; i<total; i++) remaining[i] = 1;

  let s = start!=-1 ? (indexMap.has(start) ? indexMap.get(start) : -2) : -1;
  let e = end!=-1 ? (indexMap.has(end) ? indexMap.get(end) : -2) : -1;
  if (start!=-1 && s==-2) abort();
  if (end!=-1 && e==-2) abort();

  const bestPaths = new Array<Array<i32>>();
  searchPaths(neighbors, degrees, remaining, total, new Array<Array<i32>>(), s, e, bestPaths);

  const result = new Array<Int32Array>();
  for (let bp=0; bp<bestPaths.length; bp++) {
    const p = bestPaths[bp];
    const arr = new Int32Array(p.length);
    for (let i=0; i<p.length; i++) arr[i] = nodes[p[i]];
    result.push(arr);
  }
  return result;
}

export function traverseWithStart(pixels:Int32Array, start:i32):Array<Int32Array> {
  const g = buildGraph(pixels);
  const comps = getComponents(g.neighbors);
  const indexMap = g.indexMap;
  const nodes = g.nodes;
  const startIdx = indexMap.has(start) ? indexMap.get(start) : -1;
  if (startIdx==-1) abort();
  const result = new Array<Int32Array>();
  for (let i=0; i<comps.components.length; i++) {
    const comp = comps.components[i];
    const compPixels = new Int32Array(comp.length);
    for (let j=0; j<comp.length; j++) compPixels[j] = nodes[comp[j]];
    const solver = compPixels.length <= DP_THRESHOLD ? solveDP : solve;
    if (comps.compIndex[startIdx]==i) {
      const paths = solver(compPixels, start, -1);
      for (let pi=0; pi<paths.length; pi++) result.push(paths[pi]);
    } else {
      const paths = solver(compPixels, -1, -1);
      for (let pi=0; pi<paths.length; pi++) result.push(paths[pi]);
    }
  }
  return result;
}

export function traverseWithStartEnd(pixels:Int32Array, start:i32, end:i32):Array<Int32Array> {
  const g = buildGraph(pixels);
  const comps = getComponents(g.neighbors);
  const indexMap = g.indexMap;
  const nodes = g.nodes;
  const startIdx = indexMap.has(start) ? indexMap.get(start) : -1;
  const endIdx = indexMap.has(end) ? indexMap.get(end) : -1;
  if (startIdx==-1) abort();
  if (endIdx==-1) abort();
  if (comps.compIndex[startIdx] != comps.compIndex[endIdx]) abort();
  const result = new Array<Int32Array>();
  for (let i=0; i<comps.components.length; i++) {
    const comp = comps.components[i];
    const compPixels = new Int32Array(comp.length);
    for (let j=0; j<comp.length; j++) compPixels[j] = nodes[comp[j]];
    const solver = compPixels.length <= DP_THRESHOLD ? solveDP : solve;
    if (comps.compIndex[startIdx]==i) {
      const paths = solver(compPixels, start, end);
      for (let pi=0; pi<paths.length; pi++) result.push(paths[pi]);
    } else {
      const paths = solver(compPixels, -1, -1);
      for (let pi=0; pi<paths.length; pi++) result.push(paths[pi]);
    }
  }
  return result;
}

export function traverseFree(pixels:Int32Array):Array<Int32Array> {
  const g = buildGraph(pixels);
  const comps = getComponents(g.neighbors);
  const nodes = g.nodes;
  const result = new Array<Int32Array>();
  for (let c=0; c<comps.components.length; c++) {
    const comp = comps.components[c];
    const compPixels = new Int32Array(comp.length);
    for (let j=0; j<comp.length; j++) compPixels[j] = nodes[comp[j]];
    const solver = compPixels.length <= DP_THRESHOLD ? solveDP : solve;
    const paths = solver(compPixels, -1, -1);
    for (let pi=0; pi<paths.length; pi++) result.push(paths[pi]);
  }
  return result;
}

