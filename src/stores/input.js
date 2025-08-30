import { defineStore } from 'pinia';
import { useStore } from '.';
import { useLayerPanelService } from '../services/layerPanel';
import { packRGBA, averageColorU32 } from '../utils';

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
        async loadFile(file) {
            if (!file) return;
            const reader = new FileReader();
            const dataUrl = await new Promise((res, rej) => {
                reader.onload = () => res(reader.result);
                reader.onerror = rej;
                reader.readAsDataURL(file);
            });
            await this.load(dataUrl);
        },
        async loadFromQuery() {
            await this.load(new URL(location.href).searchParams.get('pixel'));
        },
        initialize() {
            const { viewport: viewportStore, nodeTree, nodes, pixels: pixelStore } = useStore();
            const layerPanel = useLayerPanelService();
            viewportStore.setSize(this.width, this.height);
            viewportStore.setImage(this.src || '', this.width, this.height);
            const autoSegments = this.segment(40);
            if (autoSegments.length) {
                const ids = [];
                for (let i = 0; i < autoSegments.length; i++) {
                    const segment = autoSegments[i];
                    const id = nodes.createLayer({
                        name: `Auto ${i + 1}`,
                        color: segment.colorU32,
                        visibility: true
                    });
                    if (segment.pixels?.length) pixelStore.set(id, segment.pixels);
                    ids.push(id);
                }
                nodeTree.insert(ids);
            } else {
                const ids = [nodes.createLayer({}), nodes.createLayer({})];
                nodeTree.insert(ids);
            }
            layerPanel.setScrollRule({ type: 'follow', target: nodeTree.layerOrder[nodeTree.layerOrder.length - 1] });
        },
        isWithin([x, y]) {
            return x >= 0 && y >= 0 && x < this._width && y < this._height;
        },
        _offset([x, y]) {
            return ((y * this._width) + x) * 4;
        },
        readPixel(coord) {
            const [x, y] = coord;
            if (!this.isLoaded || !this.isWithin(coord)) return {
                r: 0,
                g: 0,
                b: 0,
                a: 0
            };
            const data = this._buffer;
            const i = this._offset(coord);
            return {
                r: data[i],
                g: data[i + 1],
                b: data[i + 2],
                a: data[i + 3]
            };
        },
        writePixel(coord, { r = 0, g = 0, b = 0, a = 255 } = {}) {
            if (!this.isLoaded || !this.isWithin(coord)) return;
            const i = this._offset(coord);
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
            const width = this.width,
                height = this.height,
                data = this.buffer;
            const visited = new Uint8Array(width * height);
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
                    const pixelIndex = this._offset([x, y]);
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
                    const colors = [];
                    while (queue.length) {
                        const [cx, cy] = queue.pop();
                        const currentIndex = this._offset([cx, cy]);
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
                        colors.push(packRGBA({ r: currentR, g: currentG, b: currentB, a: currentA }));
                        for (const [dx, dy] of directions) {
                            const nextX = cx + dx,
                                nextY = cy + dy;
                            if (!this.isWithin([nextX, nextY])) continue;
                            const nextFlatIndex = nextY * width + nextX;
                            if (visited[nextFlatIndex]) continue;
                            const nextIndex = this._offset([nextX, nextY]);
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
                        segments.push({
                            pixels,
                            colorU32: averageColorU32(colors)
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
