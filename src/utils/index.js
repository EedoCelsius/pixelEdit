export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const coordsToKey = (x, y) => x + "," + y;
export const keyToCoords = (key) => key.split(",").map(n => +n);

export function getPixelUnionSet(layerStore, ids = []) {
    const pixelUnionSet = new Set();
    if (!layerStore || !ids) return pixelUnionSet;
    for (const id of ids) {
        const set = layerStore.pixels[id];
        if (!set) continue;
        for (const key of set) pixelUnionSet.add(key);
    }
    return pixelUnionSet;
}

export function calcMarquee(start, current, canvas) {
    if (!start || !current) return { visible: false, x: 0, y: 0, w: 0, h: 0 };
    const left = Math.min(start.x, current.x) - canvas.x;
    const top = Math.min(start.y, current.y) - canvas.y;
    const right = Math.max(start.x, current.x) - canvas.x;
    const bottom = Math.max(start.y, current.y) - canvas.y;
    const minX = Math.floor(left / canvas.scale),
        maxX = Math.floor((right - 1) / canvas.scale);
    const minY = Math.floor(top / canvas.scale),
        maxY = Math.floor((bottom - 1) / canvas.scale);
    const minx = clamp(minX, 0, canvas.width - 1),
        maxx = clamp(maxX, 0, canvas.width - 1);
    const miny = clamp(minY, 0, canvas.height - 1),
        maxy = clamp(maxY, 0, canvas.height - 1);
    return {
        visible: true,
        x: minx,
        y: miny,
        w: (maxx >= minx) ? (maxx - minx + 1) : 0,
        h: (maxy >= miny) ? (maxy - miny + 1) : 0,
    };
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

export function groupConnectedPixels(pixelSet) {
    if (!pixelSet || !pixelSet.size) return [];
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
        const componentKeys = [];
        const queue = [startPixelKey];
        seen.add(startPixelKey);
        while (queue.length) {
            const currentPixelKey = queue.pop();
            componentKeys.push(currentPixelKey);
            const [x, y] = keyToCoords(currentPixelKey);
            for (const [dx, dy] of neighbors) {
                const neighborKey = coordsToKey(x + dx, y + dy);
                if (pixelSet.has(neighborKey) && !seen.has(neighborKey)) {
                    seen.add(neighborKey);
                    queue.push(neighborKey);
                }
            }
        }
        components.push(componentKeys);
    }
    return components;
}

export function buildOutline(pixels) {
    const pixelSet = new Set(pixels);
    if (!pixelSet.size) return [];
    const paths = [];
    const components = groupConnectedPixels(pixelSet);
    for (const componentKeys of components) {
        const edges = [];
        for (const pixelKey of componentKeys) {
            const [x, y] = keyToCoords(pixelKey);
            if (!pixelSet.has(coordsToKey(x, y - 1))) edges.push([
                [x, y],
                [x + 1, y]
            ]);
            if (!pixelSet.has(coordsToKey(x + 1, y))) edges.push([
                [x + 1, y],
                [x + 1, y + 1]
            ]);
            if (!pixelSet.has(coordsToKey(x, y + 1))) edges.push([
                [x, y + 1],
                [x + 1, y + 1]
            ]);
            if (!pixelSet.has(coordsToKey(x - 1, y))) edges.push([
                [x, y],
                [x, y + 1]
            ]);
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
    if (!pixels || !pixels.size) return '';
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
    const pixelSet = new Set(pixels.map(p => typeof p === 'string' ? p : coordsToKey(p[0], p[1])));
    if (!pixelSet.size) return [];
    const components = groupConnectedPixels(pixelSet);
    return components.map(component => component.map(key => keyToCoords(key)));
}
