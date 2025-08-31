import { defineStore } from 'pinia';
import { coordToKey, keyToCoord, findPixelComponents } from '../utils';

function buildAdjacency(pixels) {
    const pixelSet = new Set(pixels.map(coordToKey));
    const adjacency = new Map();
    const dirs = [
        [-1,-1], [0,-1], [1,-1],
        [-1,0],           [1,0],
        [-1,1],  [0,1],  [1,1]
    ];
    for (const [x,y] of pixels) {
        const key = coordToKey([x,y]);
        const neighbors = [];
        for (const [dx,dy] of dirs) {
            const nk = coordToKey([x+dx, y+dy]);
            if (pixelSet.has(nk)) neighbors.push(nk);
        }
        adjacency.set(key, neighbors);
    }
    return adjacency;
}

function findHamiltonianPath(adjacency, startKey, endKey, total, limit = 10000) {
    const path = [startKey];
    const visited = new Set([startKey]);
    let steps = 0;
    const neighborsCache = new Map();
    const getNeighbors = (k) => {
        if (!neighborsCache.has(k)) {
            const n = adjacency.get(k) || [];
            neighborsCache.set(k, n.slice().sort((a,b)=> (adjacency.get(a)?.length||0)-(adjacency.get(b)?.length||0)));
        }
        return neighborsCache.get(k);
    };
    const dfs = (currentKey) => {
        if (++steps > limit) return false;
        if (path.length === total) {
            if (!endKey || currentKey === endKey) return true;
            return false;
        }
        const neighbors = getNeighbors(currentKey);
        for (const neighbor of neighbors) {
            if (visited.has(neighbor)) continue;
            if (endKey && path.length === total - 1 && neighbor !== endKey) continue;
            visited.add(neighbor);
            path.push(neighbor);
            if (dfs(neighbor)) return true;
            path.pop();
            visited.delete(neighbor);
        }
        return false;
    };
    if (dfs(startKey)) return path.map(keyToCoord);
    return null;
}

function greedyCover(adjacency, startKey, endKey) {
    const remaining = new Set(adjacency.keys());
    const paths = [];
    const pickStart = () => {
        if (startKey && remaining.has(startKey)) {
            remaining.delete(startKey);
            return startKey;
        }
        let chosen = null;
        let minDeg = Infinity;
        for (const k of remaining) {
            const deg = (adjacency.get(k)||[]).filter(n=>remaining.has(n)).length;
            if (deg < minDeg) {
                minDeg = deg;
                chosen = k;
            }
        }
        remaining.delete(chosen);
        return chosen;
    };
    while (remaining.size) {
        let current = pickStart();
        const path = [current];
        while (true) {
            const neighbors = (adjacency.get(current)||[]).filter(n => remaining.has(n));
            if (!neighbors.length) break;
            // prefer endKey if it's neighbor and remaining
            let next = null;
            if (endKey && remaining.has(endKey) && neighbors.includes(endKey)) {
                next = endKey;
            } else {
                neighbors.sort((a,b)=> (adjacency.get(a)?.length||0)-(adjacency.get(b)?.length||0));
                next = neighbors[0];
            }
            path.push(next);
            remaining.delete(next);
            current = next;
        }
        paths.push(path.map(keyToCoord));
    }
    // attempt to merge paths if endpoints touch
    const endpointKey = path => {
        const start = coordToKey(path[0]);
        const end = coordToKey(path[path.length-1]);
        return [start,end];
    };
    let merged = true;
    while (merged) {
        merged = false;
        outer: for (let i=0; i<paths.length; i++) {
            for (let j=i+1; j<paths.length; j++) {
                const a = paths[i];
                const b = paths[j];
                const [aStart,aEnd] = endpointKey(a);
                const [bStart,bEnd] = endpointKey(b);
                if (adjacency.get(aEnd)?.includes(bStart)) {
                    paths[i] = a.concat(b);
                    paths.splice(j,1);
                    merged = true; break outer;
                }
                if (adjacency.get(bEnd)?.includes(aStart)) {
                    paths[i] = b.concat(a);
                    paths.splice(j,1);
                    merged = true; break outer;
                }
                if (adjacency.get(aEnd)?.includes(bEnd)) {
                    paths[i] = a.concat(b.slice().reverse());
                    paths.splice(j,1);
                    merged = true; break outer;
                }
                if (adjacency.get(aStart)?.includes(bStart)) {
                    paths[i] = b.slice().reverse().concat(a);
                    paths.splice(j,1);
                    merged = true; break outer;
                }
            }
        }
    }
    return paths;
}

function traverseComponent(pixels, start, end) {
    const adjacency = buildAdjacency(pixels);
    const keys = pixels.map(coordToKey);
    const startKey = start ? coordToKey(start) : keys[0];
    const endKey = end ? coordToKey(end) : null;
    const path = findHamiltonianPath(adjacency, startKey, endKey, keys.length);
    if (path) return [path];
    return greedyCover(adjacency, start ? coordToKey(start) : null, end ? coordToKey(end) : null);
}

export const usePixelTraversalService = defineStore('pixelTraversalService', () => {
    function traverseWithStart(pixels, start) {
        const components = findPixelComponents(pixels);
        const result = [];
        for (const comp of components) {
            let s = null;
            if (start && comp.some(([x,y])=> x===start[0] && y===start[1])) s = start;
            const paths = traverseComponent(comp, s, null);
            result.push(...paths);
        }
        return result;
    }
    function traverseWithStartEnd(pixels, start, end) {
        const components = findPixelComponents(pixels);
        const result = [];
        for (const comp of components) {
            let s = null;
            let e = null;
            const hasStart = start && comp.some(([x,y])=> x===start[0] && y===start[1]);
            const hasEnd = end && comp.some(([x,y])=> x===end[0] && y===end[1]);
            if (hasStart) s = start;
            if (hasEnd) e = end;
            const paths = traverseComponent(comp, s, e);
            result.push(...paths);
        }
        return result;
    }
    function traverseFree(pixels) {
        const components = findPixelComponents(pixels);
        const result = [];
        for (const comp of components) {
            const paths = traverseComponent(comp, null, null);
            result.push(...paths);
        }
        return result;
    }
    return { traverseWithStart, traverseWithStartEnd, traverseFree };
});

