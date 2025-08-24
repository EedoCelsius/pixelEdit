import { effectScope, reactive, computed } from 'vue';
import { coordsToKey, keyToCoords, pixelsToUnionPath, randColorU32, groupConnectedPixels } from '../utils';

export class Layer {
    constructor({
        name,
        colorU32,
        visible,
        locked,
        pixels
    } = {}) {
        this.name = name || 'Layer';
        this.visible = visible ?? true;
        this.locked = locked ?? false;
        this._color = (colorU32 >>> 0) || randColorU32();

        const keyedPixels = pixels ? pixels.map(p => coordsToKey(p[0], p[1])) : [];
        // reactive pixels + scoped computed cache
        this._scope = effectScope(true);
        this._pixels = reactive(new Set(keyedPixels)); // Set<string>
        this._pathData = this._scope.run(() => computed(() => pixelsToUnionPath(this._pixels)));
        this._disconnected = this._scope.run(() => computed(() => groupConnectedPixels(this._pixels).length));
    }
    // Color API (u32)
    getColorU32() {
        return this._color >>> 0;
    }
    setColorU32(u) {
        this._color = (u >>> 0);
    }
    // Path (cached computed)
    get d() {
        return this._pathData;
    }
    // Pixel API
    has(x, y) {
        return this._pixels.has(coordsToKey(x, y));
    }
    get pixelCount() {
        return this._pixels.size;
    }
    get disconnectedCount() {
        return this._disconnected;
    }
    forEachPixel(fn) {
        for (const pixelKey of this._pixels) {
            const [x, y] = keyToCoords(pixelKey);
            fn(x, y);
        }
    }
    snapshotPixels() {
        const arr = [];
        this.forEachPixel((x, y) => arr.push([x, y]));
        return arr;
    }
    addPixels(pixels) {
        for (const [x, y] of pixels) this._pixels.add(coordsToKey(x, y));
    }
    removePixels(pixels) {
        for (const [x, y] of pixels) this._pixels.delete(coordsToKey(x, y));
    }
    togglePixel(x, y) {
        const pixelKey = coordsToKey(x, y);
        this._pixels.has(pixelKey) ? this._pixels.delete(pixelKey) : this._pixels.add(pixelKey);
    }
    // Lifecycle
    dispose() {
        try {
            this._scope.stop();
        } catch {}
    }
    // (De)Serialization (without id)
    toJSON() {
        return {
            name: this.name,
            visible: this.visible,
            locked: this.locked,
            color: this._color >>> 0,
            pixels: [...this._pixels].map(s => keyToCoords(s))
        };
    }
    static fromJSON(data) {
        return new Layer({
            name: data.name,
            colorU32: data.color >>> 0,
            visible: !!data.visible,
            locked: !!data.locked,
            pixels: data.pixels
        });
    }
}
