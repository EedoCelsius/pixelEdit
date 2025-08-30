// Utilities for building one-stroke style paths over a set of pixels.
// Movement is allowed horizontally, vertically and diagonally (8-neighbour).
// Each path is an array of coordinates and a pixel may not appear twice
// within the same path. When a single stroke is not possible the algorithm
// falls back to multiple paths while trying to minimise their count.

const coordToKey = ([x, y]) => x + ',' + y;
const keyToCoord = (key) => key.split(',').map(Number);
const NEIGHBORS = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],          [1, 0],
    [-1, 1],  [0, 1], [1, 1]
];

function getUnvisitedNeighbors([x, y], remaining) {
    const out = [];
    for (const [dx, dy] of NEIGHBORS) {
        const key = coordToKey([x + dx, y + dy]);
        if (remaining.has(key)) out.push([x + dx, y + dy]);
    }
    return out;
}

function buildSinglePath(remaining, start, end = null) {
    const startKey = coordToKey(start);
    if (!remaining.has(startKey)) return [];
    const path = [start];
    remaining.delete(startKey);
    let current = start;
    while (true) {
        let options = getUnvisitedNeighbors(current, remaining);
        if (!options.length) break;
        options.sort((a, b) =>
            getUnvisitedNeighbors(a, remaining).length -
            getUnvisitedNeighbors(b, remaining).length
        );
        if (end) {
            const endKey = coordToKey(end);
            const filtered = options.filter(o => coordToKey(o) !== endKey || remaining.size === 1);
            if (filtered.length) options = filtered;
        }
        const next = options[0];
        path.push(next);
        remaining.delete(coordToKey(next));
        current = next;
        if (end && current[0] === end[0] && current[1] === end[1]) break;
    }
    return path;
}

export function pathWithStart(pixels, start) {
    const remaining = new Set(pixels.map(coordToKey));
    const paths = [];
    let s = start;
    while (remaining.size) {
        if (!s) {
            const key = remaining.values().next().value;
            s = keyToCoord(key);
        }
        const p = buildSinglePath(remaining, s);
        if (!p.length) break;
        paths.push(p);
        s = null;
    }
    return paths;
}

export function pathWithStartEnd(pixels, start, end) {
    const remaining = new Set(pixels.map(coordToKey));
    const paths = [];
    let s = start;
    let e = end;
    while (remaining.size) {
        if (!s) {
            if (e && remaining.has(coordToKey(e))) s = e;
            else {
                const key = remaining.values().next().value;
                s = keyToCoord(key);
            }
        }
        const p = buildSinglePath(remaining, s, e);
        if (!p.length) break;
        paths.push(p);
        s = null;
        if (e && !remaining.has(coordToKey(e))) e = null;
    }
    return paths;
}

export function pathAny(pixels) {
    const remaining = new Set(pixels.map(coordToKey));
    const paths = [];
    while (remaining.size) {
        const key = remaining.values().next().value;
        const start = keyToCoord(key);
        const p = buildSinglePath(remaining, start);
        if (!p.length) break;
        paths.push(p);
    }
    return paths;
}

export default {
    pathWithStart,
    pathWithStartEnd,
    pathAny
};
