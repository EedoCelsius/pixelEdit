// Utility to encode/decode coordinates
function key(p) {
  return `${p.x},${p.y}`;
}

function parse(k) {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
}

// Build adjacency map for pixels with 8-way connectivity
function buildGraph(pixels) {
  const set = new Set(pixels.map(key));
  const graph = new Map();
  for (const p of pixels) {
    const k = key(p);
    const neighbors = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nKey = `${p.x + dx},${p.y + dy}`;
        if (set.has(nKey)) neighbors.push(nKey);
      }
    }
    graph.set(k, neighbors);
  }
  return graph;
}

// Split graph into connected components using DFS
function getComponents(graph) {
  const visited = new Set();
  const comps = [];
  for (const v of graph.keys()) {
    if (visited.has(v)) continue;
    const stack = [v];
    const comp = [];
    visited.add(v);
    while (stack.length) {
      const node = stack.pop();
      comp.push(node);
      for (const nb of graph.get(node)) {
        if (!visited.has(nb)) {
          visited.add(nb);
          stack.push(nb);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
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
function solve(pixels, opts = {}) {
  const graph = buildGraph(pixels);
  const startKey = opts.start ? key(opts.start) : null;
  const endKey = opts.end ? key(opts.end) : null;

  const components = getComponents(graph);
  const nodeToComp = new Map();
  for (const comp of components) {
    for (const node of comp) nodeToComp.set(node, comp);
  }

  if (startKey && !nodeToComp.has(startKey)) throw new Error('Start pixel missing');
  if (endKey && !nodeToComp.has(endKey)) throw new Error('End pixel missing');

  components.sort((a, b) => a.length - b.length);
  const result = [];

  function solveComponent(nodes, start, end) {
    const remaining = new Set(nodes);
    const fixed = [];

    // leaf preprocessing
    let updated = true;
    while (updated) {
      updated = false;
      for (const node of Array.from(remaining)) {
        if (node === start || node === end) continue;
        const neighbors = graph.get(node).filter((n) => remaining.has(n));
        if (neighbors.length === 0) {
          fixed.push([node]);
          remaining.delete(node);
          updated = true;
        } else if (neighbors.length === 1) {
          const nb = neighbors[0];
          if (nb === start || nb === end) continue;
          fixed.push([node, nb]);
          remaining.delete(node);
          remaining.delete(nb);
          updated = true;
        }
      }
    }

    if (remaining.size === 0) return fixed;

    const best = { paths: null };
    const cache = new Map();

    function search(rem, acc) {
      if (best.paths && fixed.length + acc.length >= best.paths.length) return;
      if (rem.size === 0) {
        best.paths = [...fixed, ...acc.map((p) => p.slice())];
        return;
      }
      const isFirst = acc.length === 0;
      const startNode = isFirst && start ? start : chooseStart(rem, graph);
      rem.delete(startNode);
      extend(startNode, [startNode], rem, acc, isFirst);
      rem.add(startNode);
    }

    function extend(node, path, rem, acc, isFirst) {
      const stateKey = `${node}|${[...rem].sort().join(',')}`;
      if (cache.has(stateKey)) return;
      cache.set(stateKey, true);

      if (best.paths && fixed.length + acc.length + 1 >= best.paths.length) return;
      const neighbors = graph
        .get(node)
        .filter((n) => rem.has(n))
        .sort(
          (a, b) =>
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

      if (!isFirst || !end || node === end) {
        acc.push(path.slice());
        search(rem, acc);
        acc.pop();
      }
    }

    search(remaining, []);
    return best.paths || fixed;
  }

  for (const comp of components) {
    const cStart = startKey && nodeToComp.get(startKey) === comp ? startKey : null;
    const cEnd = endKey && nodeToComp.get(endKey) === comp ? endKey : null;
    const paths = solveComponent(comp, cStart, cEnd);
    for (const p of paths) result.push(p);
  }

  return result.map((p) => p.map(parse));
}

export const useHamiltonianService = () => {
  function traverseWithStart(pixels, start) {
    return solve(pixels, { start });
  }

  function traverseWithStartEnd(pixels, start, end) {
    return solve(pixels, { start, end });
  }

  function traverseFree(pixels) {
    return solve(pixels);
  }

  return {
    traverseWithStart,
    traverseWithStartEnd,
    traverseFree,
  };
};

