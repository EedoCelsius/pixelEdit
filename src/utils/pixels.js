import { SVG_NAMESPACE } from '../constants/svg.js';
import { CHECKERBOARD_CONFIG } from '../constants/stage.js';

export const MAX_DIMENSION = 128;
export const coordToIndex = (x, y) => x + MAX_DIMENSION * y;
export const indexToCoord = (index) => [index % MAX_DIMENSION, Math.floor(index / MAX_DIMENSION)];

export function getPixelUnion(pixelsList = []) {
    const union = new Set();
    for (const pixels of pixelsList) {
        const pixelIdxs = pixels instanceof Map ? pixels.keys() : pixels
        for (const i of pixelIdxs) union.add(i);
    }
    return union;
}

export function checkerboardPatternUrl(target = document.body) {
    const { PATTERN_ID, COLOR_A, COLOR_B, REPEAT } = CHECKERBOARD_CONFIG;
    const id = PATTERN_ID;
    if (document.getElementById(id)) return `url(#${id})`;
    const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.style.left = '-9999px';
    const defs = document.createElementNS(SVG_NAMESPACE, 'defs');
    const pattern = document.createElementNS(SVG_NAMESPACE, 'pattern');
    pattern.setAttribute('id', id);
    const repeatSize = REPEAT;
    pattern.setAttribute('width', String(repeatSize));
    pattern.setAttribute('height', String(repeatSize));
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    const r00 = document.createElementNS(SVG_NAMESPACE, 'rect');
    r00.setAttribute('x', '0');
    r00.setAttribute('y', '0');
    r00.setAttribute('width', String(repeatSize / 2));
    r00.setAttribute('height', String(repeatSize / 2));
    r00.setAttribute('fill', COLOR_A);
    const r11 = document.createElementNS(SVG_NAMESPACE, 'rect');
    r11.setAttribute('x', String(repeatSize / 2));
    r11.setAttribute('y', String(repeatSize / 2));
    r11.setAttribute('width', String(repeatSize / 2));
    r11.setAttribute('height', String(repeatSize / 2));
    r11.setAttribute('fill', COLOR_A);
    const r10 = document.createElementNS(SVG_NAMESPACE, 'rect');
    r10.setAttribute('x', String(repeatSize / 2));
    r10.setAttribute('y', '0');
    r10.setAttribute('width', String(repeatSize / 2));
    r10.setAttribute('height', String(repeatSize / 2));
    r10.setAttribute('fill', COLOR_B);
    const r01 = document.createElementNS(SVG_NAMESPACE, 'rect');
    r01.setAttribute('x', '0');
    r01.setAttribute('y', String(repeatSize / 2));
    r01.setAttribute('width', String(repeatSize / 2));
    r01.setAttribute('height', String(repeatSize / 2));
    r01.setAttribute('fill', COLOR_B);
    pattern.appendChild(r00);
    pattern.appendChild(r11);
    pattern.appendChild(r10);
    pattern.appendChild(r01);
    defs.appendChild(pattern);
    svg.appendChild(defs);
    target.appendChild(svg);
    return `url(#${id})`;
}

export function ensureOrientationPattern(orientation, target = document.body) {
    const id = `pixel-orientation-${orientation}`;
    if (document.getElementById(id)) return id;
    const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.style.left = '-9999px';
    const defs = document.createElementNS(SVG_NAMESPACE, 'defs');
    const pattern = document.createElementNS(SVG_NAMESPACE, 'pattern');
    pattern.setAttribute('id', id);
    pattern.setAttribute('width', '1');
    pattern.setAttribute('height', '1');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    if (orientation === 'vertical' || orientation === 'horizontal' || orientation === 'downSlope' || orientation === 'upSlope') {
        const border = document.createElementNS(SVG_NAMESPACE, 'line');
        const line = document.createElementNS(SVG_NAMESPACE, 'line');
        if (orientation === 'vertical') {
            border.setAttribute('x1', '.5');
            border.setAttribute('y1', '0');
            border.setAttribute('x2', '.5');
            border.setAttribute('y2', '1');
            line.setAttribute('x1', '.5');
            line.setAttribute('y1', '0');
            line.setAttribute('x2', '.5');
            line.setAttribute('y2', '1');
        }
        else if (orientation === 'horizontal') {
            border.setAttribute('x1', '0');
            border.setAttribute('y1', '.5');
            border.setAttribute('x2', '1');
            border.setAttribute('y2', '.5');
            line.setAttribute('x1', '0');
            line.setAttribute('y1', '.5');
            line.setAttribute('x2', '1');
            line.setAttribute('y2', '.5');
        }
        else if (orientation === 'downSlope') {
            border.setAttribute('x1', '0');
            border.setAttribute('y1', '0');
            border.setAttribute('x2', '1');
            border.setAttribute('y2', '1');
            line.setAttribute('x1', '0');
            line.setAttribute('y1', '0');
            line.setAttribute('x2', '1');
            line.setAttribute('y2', '1');
        }
        else { // upSlope
            border.setAttribute('x1', '0');
            border.setAttribute('y1', '1');
            border.setAttribute('x2', '1');
            border.setAttribute('y2', '0');
            line.setAttribute('x1', '0');
            line.setAttribute('y1', '1');
            line.setAttribute('x2', '1');
            line.setAttribute('y2', '0');
        }
        border.setAttribute('stroke', '#000000');
        border.setAttribute('stroke-width', '.1');
        pattern.appendChild(border);
        line.setAttribute('stroke', '#FFFFFF');
        line.setAttribute('stroke-width', '.08');
        pattern.appendChild(line);
    }
    defs.appendChild(pattern);
    svg.appendChild(defs);
    target.appendChild(svg);
    return id;
  }

export function groupConnectedPixels(pixels) {
    const visited = new Set();
    const components = [];
    const neighbors = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ];
    const pixelIdxs = pixels instanceof Map ? pixels.keys() : pixels
    for (const i of pixelIdxs) {
        if (visited.has(i)) continue;
        const component = new Set();
        const stack = [i];
        visited.add(i);
        while (stack.length) {
            const idx = stack.pop();
            component.add(idx);
            const [x, y] = indexToCoord(idx);
            for (const [dx, dy] of neighbors) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= MAX_DIMENSION || ny >= MAX_DIMENSION) continue;
                const ni = coordToIndex(nx, ny);
                if (pixels.has(ni) && !visited.has(ni)) {
                    visited.add(ni);
                    stack.push(ni);
                }
            }
        }
        components.push(component);
    }
    return components;
}

export function buildOutline(pixels) {
    const paths = [];
    const components = groupConnectedPixels(pixels);
    for (const component of components) {
        const edges = [];
        for (const pixel of component) {
            const [x, y] = indexToCoord(pixel);
            if (y === 0 || !pixels.has(coordToIndex(x, y - 1))) edges.push([[x, y], [x + 1, y]]);
            if (x === MAX_DIMENSION - 1 || !pixels.has(coordToIndex(x + 1, y))) edges.push([[x + 1, y], [x + 1, y + 1]]);
            if (y === MAX_DIMENSION - 1 || !pixels.has(coordToIndex(x, y + 1))) edges.push([[x, y + 1], [x + 1, y + 1]]);
            if (x === 0 || !pixels.has(coordToIndex(x - 1, y))) edges.push([[x, y], [x, y + 1]]);
        }
        paths.push(edges);
    }
    return paths;
}

export function edgesToLoops(edges) {
    const adjacencyMap = new Map();
    const addEdge = (p1, p2) => {
        const pointKey = p1.join(',');
        const arr = adjacencyMap.get(pointKey) || (adjacencyMap.set(pointKey, []), adjacencyMap.get(pointKey));
        arr.push(p2);
    };
    for (const [
            [x0, y0],
            [x1, y1]
        ] of edges) {
        addEdge([x0, y0], [x1, y1]);
        addEdge([x1, y1], [x0, y0]);
    }
    const edgeKey = (p1, p2) => {
        const keyA = p1.join(',');
        const keyB = p2.join(',');
        return (keyA < keyB) ? (keyA + '|' + keyB) : (keyB + '|' + keyA);
    };
    const unused = new Set(edges.map(([p1, p2]) => edgeKey(p1, p2)));
    const nextFrom = (current, previous) => {
        const pointKey = current.join(',');
        const neighbors = adjacencyMap.get(pointKey) || [];
        for (const n of neighbors) {
            if (previous && n[0] === previous[0] && n[1] === previous[1]) continue;
            if (unused.has(edgeKey(current, n))) return n;
        }
        for (const n of neighbors) {
            if (unused.has(edgeKey(current, n))) return n;
        }
        return null;
    };
    const loops = [];
    while (unused.size) {
        const first = unused.values().next().value;
        const [pA, pB] = first.split('|').map(s => s.split(',').map(Number));
        const start = [pA[0], pA[1]];
        let current = pA;
        let previous = null;
        let next = pB;
        const points = [
            [start[0], start[1]]
        ];
        while (true) {
            if (!next) break;
            unused.delete(edgeKey(current, next));
            points.push([next[0], next[1]]);
            if (next[0] === start[0] && next[1] === start[1]) break;
            const nextNext = nextFrom(next, current);
            previous = current;
            current = next;
            next = nextNext;
        }
        if (points.length > 2) loops.push(points);
    }
    return loops;
}

export function pixelsToUnionPath(pixels) {
    if (!pixels) return '';
    const groups = buildOutline(pixels);
    const parts = [];
    for (const segments of groups) {
        const loops = edgesToLoops(segments);
        for (const loop of loops) {
            const [x0, y0] = loop[0];
            const pathData = ['M', x0, y0];
            for (let i = 1; i < loop.length; i++) {
                const [x, y] = loop[i];
                pathData.push('L', x, y);
            }
            pathData.push('Z');
            parts.push(pathData.join(' '));
        }
    }
    return parts.join(' ');
}
