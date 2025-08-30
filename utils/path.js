// Utility functions to compute one-stroke paths across a set of pixels.
// Each pixel is represented as an [x, y] coordinate pair.
// Movement is allowed horizontally, vertically and diagonally.
// The algorithm attempts to visit all pixels without revisiting any pixel.
// When a single stroke is not possible, multiple strokes are returned.
// The number of resulting strokes is minimised heuristically.

const directions = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
];

function key([x, y]) {
  return `${x},${y}`;
}

function buildGraph(pixels) {
  const map = new Map();
  for (const p of pixels) map.set(key(p), p);
  const adj = new Map();
  for (const p of pixels) {
    const k = key(p);
    const neighbors = [];
    for (const [dx, dy] of directions) {
      const nk = key([p[0] + dx, p[1] + dy]);
      if (map.has(nk)) neighbors.push(nk);
    }
    adj.set(k, neighbors);
  }
  return { map, adj };
}

function connectedComponents(adj) {
  const unvisited = new Set(adj.keys());
  const components = [];
  while (unvisited.size) {
    const start = unvisited.values().next().value;
    const stack = [start];
    const comp = [];
    unvisited.delete(start);
    while (stack.length) {
      const v = stack.pop();
      comp.push(v);
      for (const nb of adj.get(v)) {
        if (unvisited.has(nb)) {
          unvisited.delete(nb);
          stack.push(nb);
        }
      }
    }
    components.push(comp);
  }
  return components;
}

function searchHamiltonian(component, adj, start, end) {
  const visited = new Set();
  const path = [];
  const total = component.length;

  function dfs(v) {
    path.push(v);
    visited.add(v);
    if (path.length === total) {
      if (!end || v === end) return true;
    } else {
      const candidates = adj.get(v)
        .filter(n => !visited.has(n))
        .sort((a, b) => adj.get(a).length - adj.get(b).length);
      for (const nb of candidates) {
        if (dfs(nb)) return true;
      }
    }
    visited.delete(v);
    path.pop();
    return false;
  }

  if (!start) {
    for (const v of component) {
      if (dfs(v)) return path.slice();
    }
  } else if (component.includes(start)) {
    if (dfs(start)) return path.slice();
  }
  return null;
}

function greedyCover(component, adj, start) {
  const unvisited = new Set(component);
  const paths = [];
  while (unvisited.size) {
    let current = start && unvisited.has(start) ? start : unvisited.values().next().value;
    const path = [current];
    unvisited.delete(current);
    while (true) {
      const nextCandidates = adj.get(current).filter(n => unvisited.has(n));
      if (!nextCandidates.length) break;
      nextCandidates.sort((a, b) => adj.get(a).filter(n => unvisited.has(n)).length - adj.get(b).filter(n => unvisited.has(n)).length);
      current = nextCandidates[0];
      path.push(current);
      unvisited.delete(current);
    }
    paths.push(path);
    start = null; // only apply start to first path
  }
  return paths;
}

function generatePaths(pixels, { start, end } = {}) {
  const { map, adj } = buildGraph(pixels);
  const components = connectedComponents(adj);
  const paths = [];

  const startKey = start ? key(start) : null;
  const endKey = end ? key(end) : null;

  for (const comp of components) {
    const compStart = comp.includes(startKey) ? startKey : null;
    const compEnd = comp.includes(endKey) ? endKey : null;
    const hamilton = searchHamiltonian(comp, adj, compStart, compEnd);
    if (hamilton) {
      paths.push(hamilton.map(k => map.get(k)));
    } else {
      const cover = greedyCover(comp, adj, compStart);
      for (const path of cover) paths.push(path.map(k => map.get(k)));
    }
  }

  if (startKey) {
    const idx = paths.findIndex(p => key(p[0]) === startKey);
    if (idx > 0) {
      const [p] = paths.splice(idx, 1);
      paths.unshift(p);
    }
  }
  if (endKey) {
    const idx = paths.findIndex(p => key(p[p.length - 1]) === endKey);
    if (idx >= 0 && idx !== paths.length - 1) {
      const [p] = paths.splice(idx, 1);
      paths.push(p);
    }
  }
  return paths;
}

export function pathsFromStart(pixels, start) {
  return generatePaths(pixels, { start });
}

export function pathsFromStartToEnd(pixels, start, end) {
  return generatePaths(pixels, { start, end });
}

export function pathsAny(pixels) {
  return generatePaths(pixels, {});
}

export default {
  pathsAny,
  pathsFromStart,
  pathsFromStartToEnd
};
