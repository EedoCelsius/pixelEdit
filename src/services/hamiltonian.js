import { indexToCoord, coordToIndex } from '../utils';

// Build adjacency map for pixels with 8-way connectivity using indexes
function buildGraph(indexes) {
  const set = new Set(indexes);
  const graph = new Map();
  for (const index of indexes) {
    const [x, y] = indexToCoord(index);
    const neighbors = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nIndex = coordToIndex(x + dx, y + dy);
        if (set.has(nIndex)) neighbors.push(nIndex);
      }
    }
    graph.set(index, neighbors);
  }
  return graph;
}

// Choose a vertex from remaining set with minimum degree
function chooseStart(remaining, graph) {
  let best = null;
  let min = Infinity;
  for (const v of remaining) {
    const deg = graph.get(v).filter((n) => remaining.has(n)).length;
    if (deg < min) {
      min = deg;
      best = v;
    }
  }
  return best;
}

// Core solver using backtracking to find minimum path cover
function solve(indexes, opts = {}) {
  const graph = buildGraph(indexes);
  const remaining = new Set(graph.keys());
  const start = opts.start ?? null;
  const end = opts.end ?? null;

  if (start != null && !remaining.has(start)) throw new Error('Start pixel missing');
  if (end != null && !remaining.has(end)) throw new Error('End pixel missing');

  const best = { paths: null };

  function search(rem, acc) {
    if (best.paths && acc.length >= best.paths.length) return;
    if (rem.size === 0) {
      best.paths = acc.map((p) => p.slice());
      return;
    }
    const isFirst = acc.length === 0;
    const startNode = isFirst && start != null ? start : chooseStart(rem, graph);
    rem.delete(startNode);
    extend(startNode, [startNode], rem, acc, isFirst);
    rem.add(startNode);
  }

  function extend(node, path, rem, acc, isFirst) {
    if (best.paths && acc.length + 1 >= best.paths.length) return;
    const neighbors = graph
      .get(node)
      .filter((n) => rem.has(n))
      .sort((a, b) =>
        graph.get(a).filter((m) => rem.has(m)).length -
        graph.get(b).filter((m) => rem.has(m)).length
      );

    for (const nb of neighbors) {
      rem.delete(nb);
      path.push(nb);
      extend(nb, path, rem, acc, isFirst);
      path.pop();
      rem.add(nb);
    }

    if (!isFirst || end == null || node === end) {
      acc.push(path.slice());
      search(rem, acc);
      acc.pop();
    }
  }

  search(remaining, []);
  return best.paths ? best.paths.map((p) => p.slice()) : [];
}

export const useHamiltonianService = () => {
  function traverseWithStart(indexes, start) {
    return solve(indexes, { start });
  }

  function traverseWithStartEnd(indexes, start, end) {
    return solve(indexes, { start, end });
  }

  function traverseFree(indexes) {
    return solve(indexes);
  }

  return {
    traverseWithStart,
    traverseWithStartEnd,
    traverseFree,
  };
};
