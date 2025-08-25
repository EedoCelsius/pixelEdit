import { defineStore } from 'pinia';
import { packRGBA } from '../utils';

export const useInputStore = defineStore('input', {
    state: () => ({
        _src: '',
        _width: 0,
        _height: 0,
        _buffer: null /* Uint8ClampedArray */
    }),
    getters: {
        isLoaded: (state) => !!state._buffer && state._width > 0 && state._height > 0,
        width: (state) => state._width,
        height: (state) => state._height,
        src: (state) => state._src,
        buffer: (state) => state._buffer,
    },
    actions: {
        createImage({ src = '', width = 0, height = 0, buffer = null } = {}) {
            this._src = src;
            this._width = width;
            this._height = height;
            this._buffer = buffer;
        },
        async load(src) {
            if (!src) return;
            const img = new Image();
            if (/^(https?:)?\/\//.test(src) && !/^blob:|^data:/.test(src)) img.crossOrigin = 'anonymous';
            await new Promise((res, rej) => {
                img.onload = res;
                img.onerror = rej;
                img.src = src;
            });
            const w = img.naturalWidth,
                h = img.naturalHeight;
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const context = canvas.getContext('2d', {
                willReadFrequently: true
            });
            context.imageSmoothingEnabled = false;
            context.drawImage(img, 0, 0);
            const data = context.getImageData(0, 0, w, h).data;
            this.createImage({ src, width: w, height: h, buffer: data });
        },
        async loadFromQuery() {
            await this.load(new URL(location.href).searchParams.get('pixel'));
        },
        isWithin(x, y) {
            return x >= 0 && y >= 0 && x < this._width && y < this._height;
        },
        _offset(x, y) {
            return ((y * this._width) + x) * 4;
        },
        readPixel(x, y) {
            if (!this.isLoaded || !this.isWithin(x, y)) return {
                r: 0,
                g: 0,
                b: 0,
                a: 0
            };
            const data = this._buffer;
            const i = this._offset(x, y);
            return {
                r: data[i],
                g: data[i + 1],
                b: data[i + 2],
                a: data[i + 3]
            };
        },
        writePixel(x, y, { r = 0, g = 0, b = 0, a = 255 } = {}) {
            if (!this.isLoaded || !this.isWithin(x, y)) return;
            const i = this._offset(x, y);
            this._buffer[i] = r;
            this._buffer[i + 1] = g;
            this._buffer[i + 2] = b;
            this._buffer[i + 3] = a;
        },
        clear() {
            this.createImage();
        },
        segment(tolerance = 32) {
            if (!this.isLoaded) return [];
            const width = this._width,
                height = this._height,
                data = this._buffer;
            const visited = new Uint8Array(width * height);
            const getIndex = (x, y) => (y * width + x) * 4;
            const directions = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ];
            const colorDistance = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) + Math.abs(a.a - b.a);
            const segments = [],
                queue = [];
            for (let y = 0; y < height; y++)
                for (let x = 0; x < width; x++) {
                    const flatIndex = y * width + x;
                    if (visited[flatIndex]) continue;
                    const pixelIndex = getIndex(x, y);
                    const seedColor = {
                        r: data[pixelIndex],
                        g: data[pixelIndex + 1],
                        b: data[pixelIndex + 2],
                        a: data[pixelIndex + 3]
                    };
                    visited[flatIndex] = 1;
                    if (seedColor.a === 0) continue;
                    queue.length = 0;
                    queue.push([x, y]);
                    const pixels = [];
                    let sumR = 0,
                        sumG = 0,
                        sumB = 0,
                        sumA = 0;
                    while (queue.length) {
                        const [cx, cy] = queue.pop();
                        const currentIndex = getIndex(cx, cy);
                        const currentR = data[currentIndex],
                            currentG = data[currentIndex + 1],
                            currentB = data[currentIndex + 2],
                            currentA = data[currentIndex + 3];
                        if (colorDistance({
                                r: currentR,
                                g: currentG,
                                b: currentB,
                                a: currentA
                            }, seedColor) > tolerance) continue;
                        pixels.push([cx, cy]);
                        sumR += currentR;
                        sumG += currentG;
                        sumB += currentB;
                        sumA += currentA;
                        for (const [dx, dy] of directions) {
                            const nextX = cx + dx,
                                nextY = cy + dy;
                            if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
                            const nextFlatIndex = nextY * width + nextX;
                            if (visited[nextFlatIndex]) continue;
                            const nextIndex = getIndex(nextX, nextY);
                            const nextAlpha = data[nextIndex + 3];
                            if (nextAlpha > 0 && colorDistance({
                                    r: data[nextIndex],
                                    g: data[nextIndex + 1],
                                    b: data[nextIndex + 2],
                                    a: nextAlpha
                                }, seedColor) <= tolerance) {
                                visited[nextFlatIndex] = 1;
                                queue.push([nextX, nextY]);
                            } else if (nextAlpha === 0) {
                                visited[nextFlatIndex] = 1;
                            }
                        }
                    }
                    if (pixels.length) {
                        const averageColor = {
                            r: Math.round(sumR / pixels.length),
                            g: Math.round(sumG / pixels.length),
                            b: Math.round(sumB / pixels.length),
                            a: 255
                        };
                        segments.push({
                            pixels: pixels,
                            colorU32: packRGBA(averageColor)
                        });
                    }
                }
            const quantize = u => {
                const r = (u >>> 0) & 255,
                    g = (u >>> 8) & 255,
                    b = (u >>> 16) & 255;
                return ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
            };
            const groupSum = new Map();
            for (const s of segments) {
                const k = quantize(s.colorU32);
                groupSum.set(k, (groupSum.get(k) || 0) + s.pixels.length);
            }
            segments.sort((a, b) => {
                const ga = groupSum.get(quantize(a.colorU32)),
                    gb = groupSum.get(quantize(b.colorU32));
                if (gb !== ga) return gb - ga;
                if (b.pixels.length !== a.pixels.length) return b.pixels.length - a.pixels.length;
                return 0;
            });
            return segments;
        }
    }
});
