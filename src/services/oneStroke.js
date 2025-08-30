import { defineStore } from 'pinia';
import { coordToKey, keyToCoord } from '../utils';

export const useOneStrokeService = defineStore('oneStrokeService', () => {
    function buildGraph(pixels) {
        const set = new Set(pixels.map(coordToKey));
        const graph = new Map();
        for (const [x, y] of pixels) {
            const key = coordToKey([x, y]);
            const neighbors = [];
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const neighborKey = coordToKey([x + dx, y + dy]);
                    if (set.has(neighborKey)) neighbors.push(neighborKey);
                }
            }
            graph.set(key, neighbors);
        }
        return { graph, set };
    }

    function hamiltonian(graph, startKey, endKey, totalCount) {
        const visited = new Set([startKey]);
        const path = [keyToCoord(startKey)];
        function dfs(currentKey) {
            if (path.length === totalCount) {
                if (!endKey || currentKey === endKey) return path.slice();
                return null;
            }
            const neighbors = (graph.get(currentKey) || []).filter(n => !visited.has(n));
            neighbors.sort((a, b) => (graph.get(a).length - graph.get(b).length));
            for (const nextKey of neighbors) {
                if (endKey && path.length === totalCount - 1 && nextKey !== endKey) continue;
                visited.add(nextKey);
                path.push(keyToCoord(nextKey));
                const result = dfs(nextKey);
                if (result) return result;
                path.pop();
                visited.delete(nextKey);
            }
            return null;
        }
        return dfs(startKey);
    }

    function greedyPathFrom(graph, startKey, unvisited, endKey = null) {
        const path = [];
        let current = startKey;
        while (current) {
            path.push(keyToCoord(current));
            unvisited.delete(current);
            if (endKey && current === endKey) break;
            const neighbors = (graph.get(current) || []).filter(n => unvisited.has(n));
            if (!neighbors.length) break;
            neighbors.sort((a, b) => (
                graph.get(a).filter(m => unvisited.has(m)).length -
                graph.get(b).filter(m => unvisited.has(m)).length
            ));
            current = neighbors[0];
        }
        return path;
    }

    function greedyCover(graph, set, startKey = null, endKey = null) {
        const unvisited = new Set(set);
        const paths = [];
        if (startKey && unvisited.has(startKey)) {
            paths.push(greedyPathFrom(graph, startKey, unvisited, endKey));
        }
        while (unvisited.size) {
            const key = unvisited.values().next().value;
            paths.push(greedyPathFrom(graph, key, unvisited));
        }
        return paths;
    }

    function findPaths(pixels, start = null, end = null) {
        if (!pixels || !pixels.length) return [];
        const { graph, set } = buildGraph(pixels);
        const total = set.size;
        const startKey = start ? coordToKey(start) : null;
        const endKey = end ? coordToKey(end) : null;
        if (startKey && !set.has(startKey)) throw new Error('start is not in pixels');
        if (endKey && !set.has(endKey)) throw new Error('end is not in pixels');
        if (startKey) {
            const path = hamiltonian(graph, startKey, endKey, total);
            if (path) return [path];
        } else {
            for (const key of set) {
                const path = hamiltonian(graph, key, endKey, total);
                if (path) return [path];
            }
        }
        return greedyCover(graph, set, startKey, endKey);
    }

    function withStart(pixels, start) {
        return findPaths(pixels, start, null);
    }

    function withStartEnd(pixels, start, end) {
        return findPaths(pixels, start, end);
    }

    function withoutEndpoints(pixels) {
        return findPaths(pixels, null, null);
    }

    return { withStart, withStartEnd, withoutEndpoints };
});

