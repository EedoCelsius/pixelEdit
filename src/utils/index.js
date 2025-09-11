export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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

export const alphaU32 = (packedColor) => ((packedColor >>> 24) & 255) / 255;
