import { coordToKey, keyToCoord, findPixelComponents } from '../utils';

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1]
];

const getNeighbors = ([x, y]) => {
  return DIRECTIONS.map(([dx, dy]) => [x + dx, y + dy]);
};

function buildAdjacency(pixels) {
  const set = new Set(pixels.map(coordToKey));
  const map = new Map();
  for (const p of pixels) {
    const key = coordToKey(p);
    const ns = [];
    for (const n of getNeighbors(p)) {
      if (set.has(coordToKey(n))) ns.push(n);
    }
    map.set(key, ns);
  }
  return map;
}

function search(adjacency, total, currentKey, endKey, visited, path) {
  if (path.length === total) {
    if (!endKey || currentKey === endKey) return [...path];
    return null;
  }
  const neighbors = adjacency.get(currentKey) || [];
  neighbors.sort((a, b) => adjacency.get(coordToKey(a)).length - adjacency.get(coordToKey(b)).length);
  for (const n of neighbors) {
    const key = coordToKey(n);
    if (visited.has(key)) continue;
    visited.add(key);
    path.push(n);
    const res = search(adjacency, total, key, endKey, visited, path);
    if (res) return res;
    path.pop();
    visited.delete(key);
  }
  return null;
}

function findHamiltonian(component, start, end) {
  const adjacency = buildAdjacency(component);
  const total = component.length;
  const endKey = end ? coordToKey(end) : null;
  if (start) {
    const startKey = coordToKey(start);
    const visited = new Set([startKey]);
    const path = [start];
    return search(adjacency, total, startKey, endKey, visited, path);
  }
  for (const p of component) {
    const startKey = coordToKey(p);
    const visited = new Set([startKey]);
    const path = [p];
    const res = search(adjacency, total, startKey, endKey, visited, path);
    if (res) return res;
  }
  return null;
}

function greedyPaths(component, start, end) {
  const remaining = new Set(component.map(coordToKey));
  const paths = [];
  let first = true;
  while (remaining.size) {
    let current = first && start ? start : keyToCoord(remaining.values().next().value);
    first = false;
    const endKey = paths.length === 0 && end ? coordToKey(end) : null;
    const path = [];
    while (remaining.has(coordToKey(current))) {
      path.push(current);
      remaining.delete(coordToKey(current));
      if (endKey && coordToKey(current) === endKey) break;
      const ns = getNeighbors(current).filter(n => remaining.has(coordToKey(n)));
      if (!ns.length) break;
      ns.sort((a, b) => {
        const ac = getNeighbors(a).filter(nn => remaining.has(coordToKey(nn))).length;
        const bc = getNeighbors(b).filter(nn => remaining.has(coordToKey(nn))).length;
        return ac - bc;
      });
      current = ns[0];
    }
    paths.push(path);
  }
  return paths;
}

export const usePixelPathService = () => {
  function pathsFromStart(pixels, start) {
    const components = findPixelComponents(pixels);
    const startKey = coordToKey(start);
    for (const comp of components) {
      if (comp.some(p => coordToKey(p) === startKey)) {
        const h = findHamiltonian(comp, start, null);
        if (h) return [h];
        return greedyPaths(comp, start, null);
      }
    }
    return [];
  }

  function pathsFromStartEnd(pixels, start, end) {
    const components = findPixelComponents(pixels);
    const startKey = coordToKey(start);
    const endKey = coordToKey(end);
    for (const comp of components) {
      const set = new Set(comp.map(coordToKey));
      if (set.has(startKey) && set.has(endKey)) {
        const h = findHamiltonian(comp, start, end);
        if (h) return [h];
        return greedyPaths(comp, start, end);
      }
    }
    return [];
  }

  function pathsAny(pixels) {
    const components = findPixelComponents(pixels);
    const paths = [];
    for (const comp of components) {
      const h = findHamiltonian(comp, null, null);
      if (h) paths.push(h);
      else paths.push(...greedyPaths(comp, null, null));
    }
    return paths;
  }

  return { pathsFromStart, pathsFromStartEnd, pathsAny };
};

