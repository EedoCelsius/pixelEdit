import { SVG_NAMESPACE, CHECKERBOARD_CONFIG } from '@/constants';

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const coordToKey = ([x, y]) => x + ',' + y;
export const keyToCoord = (key) => key.split(',').map(n => +n);

export function getPixelUnion(props = []) {
    const set = new Set();
    const layers = Array.isArray(props) ? props : [props];
    for (const layer of layers)
        for (const coord of layer.pixels)
            set.add(coordToKey(coord));
    return [...set].map(keyToCoord);
}

export function ensureCheckerboardPattern(target = document.body) {
    const { PATTERN_ID, COLOR_A, COLOR_B, REPEAT } = CHECKERBOARD_CONFIG;
    const id = PATTERN_ID;
    if (document.getElementById(id)) return id;
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
    return id;
}

export function ensurePathPattern(kind, target = document.body) {
    const id = `pixel-kind-${kind}`;
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

    const cornerSize = 0.1;
    const cornerPos = {
        tl: [0, 0],
        tr: [1 - cornerSize, 0],
        bl: [0, 1 - cornerSize],
        br: [1 - cornerSize, 1 - cornerSize]
    };
    const opposite = { tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' };
    const directions = {
        tltr: 'right',
        tlbl: 'down',
        trtl: 'left',
        trbr: 'down',
        bltl: 'up',
        blbr: 'right',
        brtr: 'up',
        brbl: 'left'
    };
    const arrowPath = {
        right: 'M.6.7.8.5.6.3M.8.5H.2',
        left: 'M.4.3.2.5.4.7M.2.5H.8',
        down: 'M.3.6.5.8.7.6M.5.8V.2',
        up: 'M.7.4.5.2.3.4M.5.2V.8'
    };

    const start = cornerPos[kind.slice(0, 2)];
    const end = cornerPos[opposite[kind.slice(0, 2)]];
    const direction = directions[kind];

    const s = document.createElementNS(SVG_NAMESPACE, 'rect');
    s.setAttribute('x', String(start[0]));
    s.setAttribute('y', String(start[1]));
    s.setAttribute('width', String(cornerSize));
    s.setAttribute('height', String(cornerSize));
    s.setAttribute('fill', '#00ff00');
    s.setAttribute('stroke-width', String(cornerSize / 15));
    s.setAttribute('stroke', '#000000');

    const e = document.createElementNS(SVG_NAMESPACE, 'rect');
    e.setAttribute('x', String(end[0]));
    e.setAttribute('y', String(end[1]));
    e.setAttribute('width', String(cornerSize));
    e.setAttribute('height', String(cornerSize));
    e.setAttribute('fill', '#ff0000');
    e.setAttribute('stroke-width', String(cornerSize / 15));
    e.setAttribute('stroke', '#000000');

    const ba = document.createElementNS(SVG_NAMESPACE, 'path');
    ba.setAttribute('d', arrowPath[direction]);
    ba.setAttribute('stroke-width', String(cornerSize / 1.5));
    ba.setAttribute('fill', 'none');
    ba.setAttribute('stroke', '#000000');

    const a = document.createElementNS(SVG_NAMESPACE, 'path');
    a.setAttribute('d', arrowPath[direction]);
    a.setAttribute('stroke-width', String(cornerSize / 2));
    a.setAttribute('fill', 'none');
    a.setAttribute('stroke', '#ffffff');

    pattern.appendChild(s);
    pattern.appendChild(e);
    pattern.appendChild(ba);
    pattern.appendChild(a);
    defs.appendChild(pattern);
    svg.appendChild(defs);
    target.appendChild(svg);
    return id;
}

// --- color helpers (32-bit unsigned RGBA packed as 0xAABBGGRR) ---
export const packRGBA = (color) => {
    const r = clamp((+color.r || 0), 0, 255),
        g = clamp((+color.g || 0), 0, 255),
        b = clamp((+color.b || 0), 0, 255);
    const alphaRaw = (color.a == null ? 255 : +color.a);
    const a = alphaRaw <= 1 ? Math.round(alphaRaw * 255) : Math.round(alphaRaw);
    return ((r & 255) | ((g & 255) << 8) | ((b & 255) << 16) | ((a & 255) << 24)) >>> 0;
};
export const unpackRGBA = (packedColor) => ({
    r: (packedColor >>> 0) & 255,
    g: (packedColor >>> 8) & 255,
    b: (packedColor >>> 16) & 255,
    a: (packedColor >>> 24) & 255
});
export const rgbaCssU32 = (packedColor) => {
    const {
        r,
        g,
        b,
        a
    } = unpackRGBA(packedColor);
    return `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`;
};
export const rgbaCssObj = (color) => `rgba(${color.r},${color.g},${color.b},${(color.a / 255).toFixed(2)})`;
export const randColorU32 = () => packRGBA({
    r: Math.floor(150 + Math.random() * 105),
    g: Math.floor(50 + Math.random() * 180),
    b: Math.floor(50 + Math.random() * 180),
    a: 255
});

export function averageColorU32(colors = []) {
    if (!colors.length) return 0;
    let r = 0, g = 0, b = 0, a = 0;
    for (const c of colors) {
        r += (c >>> 0) & 255;
        g += (c >>> 8) & 255;
        b += (c >>> 16) & 255;
        a += (c >>> 24) & 255;
    }
    const count = colors.length;
    return packRGBA({
        r: Math.round(r / count),
        g: Math.round(g / count),
        b: Math.round(b / count),
        a: Math.round(a / count)
    });
}

// simplified hex helpers
export function hexToRgbaU32(hexString) {
    if (!hexString) return packRGBA({
        r: 0,
        g: 0,
        b: 0,
        a: 255
    });
    const hex = String(hexString).trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(hex)) {
        const fullHex = hex.split('').map(c => c + c).join('');
        const r = parseInt(fullHex.slice(0, 2), 16),
            g = parseInt(fullHex.slice(2, 4), 16),
            b = parseInt(fullHex.slice(4, 6), 16);
        return packRGBA({
            r,
            g,
            b,
            a: 255
        });
    }
    if (/^[0-9a-f]{4}$/i.test(hex)) {
        const fullHex = hex.split('').map(c => c + c).join('');
        const r = parseInt(fullHex.slice(0, 2), 16),
            g = parseInt(fullHex.slice(2, 4), 16),
            b = parseInt(fullHex.slice(4, 6), 16),
            a = parseInt(fullHex.slice(6, 8), 16);
        return packRGBA({
            r,
            g,
            b,
            a
        });
    }
    if (/^[0-9a-f]{6}$/i.test(hex)) {
        const r = parseInt(hex.slice(0, 2), 16),
            g = parseInt(hex.slice(2, 4), 16),
            b = parseInt(hex.slice(4, 6), 16);
        return packRGBA({
            r,
            g,
            b,
            a: 255
        });
    }
    if (/^[0-9a-f]{8}$/i.test(hex)) {
        const r = parseInt(hex.slice(0, 2), 16),
            g = parseInt(hex.slice(2, 4), 16),
            b = parseInt(hex.slice(4, 6), 16),
            a = parseInt(hex.slice(6, 8), 16);
        return packRGBA({
            r,
            g,
            b,
            a
        });
    }
    return packRGBA({
        r: 0,
        g: 0,
        b: 0,
        a: 255
    });
}

export function rgbaToHexU32(packedColor) {
    const {
        r,
        g,
        b
    } = unpackRGBA(packedColor);
    return '#' + [r, g, b].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function groupConnectedPixels(pixels) {
    if (!pixels || !pixels.length) return [];
    const pixelSet = new Set(pixels.map(coordToKey));
    const neighbors = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ];
    const seen = new Set();
    const components = [];
    for (const startPixelKey of pixelSet) {
        if (seen.has(startPixelKey)) continue;
        const component = [];
        const queue = [startPixelKey];
        seen.add(startPixelKey);
        while (queue.length) {
            const currentPixelKey = queue.pop();
            component.push(keyToCoord(currentPixelKey));
            const [x, y] = keyToCoord(currentPixelKey);
            for (const [dx, dy] of neighbors) {
                const neighborKey = coordToKey([x + dx, y + dy]);
                if (pixelSet.has(neighborKey) && !seen.has(neighborKey)) {
                    seen.add(neighborKey);
                    queue.push(neighborKey);
                }
            }
        }
        components.push(component);
    }
    return components;
}

export function buildOutline(pixels) {
    const pixelSet = new Set(pixels.map(coordToKey));
    if (!pixelSet.size) return [];
    const paths = [];
    const components = groupConnectedPixels(pixels);
    for (const component of components) {
        const edges = [];
        for (const [x, y] of component) {
            if (!pixelSet.has(coordToKey([x, y - 1]))) edges.push([[x, y], [x + 1, y]]);
            if (!pixelSet.has(coordToKey([x + 1, y]))) edges.push([[x + 1, y], [x + 1, y + 1]]);
            if (!pixelSet.has(coordToKey([x, y + 1]))) edges.push([[x, y + 1], [x + 1, y + 1]]);
            if (!pixelSet.has(coordToKey([x - 1, y]))) edges.push([[x, y], [x, y + 1]]);
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
    if (!pixels || !pixels.length) return '';
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

export function findPixelComponents(pixels) {
    return groupConnectedPixels(pixels);
}
