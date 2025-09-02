import { defineStore } from 'pinia';
import { readonly } from 'vue';
import { clamp, coordToIndex, indexToCoord } from '../utils';
import { MIN_SCALE_RATIO } from '@/constants';
import { useNodeTreeStore } from './nodeTree';
import { usePixelStore } from './pixels';

export const useViewportStore = defineStore('viewport', {
    state: () => ({
        _stage: {
            width: 16,
            height: 16,
            scale: 16,
            minScale: 1,
            containScale: 1,
            offset: { x: 0, y: 0 },
        },
        _display: 'result', // 'result' | 'original'
        _image: { src: '', x: 0, y: 0, width: 0, height: 0 },
        _element: null,
        _content: { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 },
    }),
    getters: {
        // Canvas dimensions
        viewBox: (state) => `0 0 ${state._stage.width} ${state._stage.height}`,
        // UI labels
        toggleLabel: (state) => state._display === 'original' ? '결과' : '원본',
        stage: (state) => readonly(state._stage),
        display: (state) => state._display,
        imageSrc: (state) => state._image.src,
        imageRect: (state) => readonly(state._image),
        element: (state) => state._element,
        content: (state) => readonly(state._content),
    },
    actions: {
        setElement(el) {
            this._element = el;
        },
        setOffset(x, y) {
            this._stage.offset.x = x;
            this._stage.offset.y = y;
        },
        setSize(newWidth, newHeight) {
            this._stage.width = Math.max(1, newWidth | 0);
            this._stage.height = Math.max(1, newHeight | 0);
        },
        setImage(src, width, height) {
            this._image.src = src || '';
            if (width != null) this._image.width = width;
            if (height != null) this._image.height = height;
            this._image.x = 0;
            this._image.y = 0;
        },
        setImageSize(width, height) {
            if (width != null) this._image.width = width;
            if (height != null) this._image.height = height;
        },
        setImagePosition(x, y) {
            if (x != null) this._image.x = x;
            if (y != null) this._image.y = y;
        },
        setScale(newScale) {
            this._stage.scale = Math.max(this._stage.minScale, newScale);
        },
        resizeByEdges({ top = 0, bottom = 0, left = 0, right = 0 } = {}) {
            top |= 0; bottom |= 0; left |= 0; right |= 0;
            const tree = useNodeTreeStore();
            const pixelStore = usePixelStore();
            if (left !== 0 || top !== 0) pixelStore.translateAll(left, top);
            const newWidth = Math.max(1, this._stage.width + left + right);
            const newHeight = Math.max(1, this._stage.height + top + bottom);
            for (const id of tree.layerIdsBottomToTop) {
                const pixels = pixelStore.get(id);
                const toRemove = [];
                for (const pixel of pixels) {
                    const [x, y] = indexToCoord(pixel);
                    if (x < 0 || y < 0 || x >= newWidth || y >= newHeight) {
                        toRemove.push(pixel);
                    }
                }
                if (toRemove.length) pixelStore.removePixels(id, toRemove);
            }
            this._stage.width = newWidth;
            this._stage.height = newHeight;
            this._image.x += left;
            this._image.y += top;
        },
        toggleView() {
            this._display = (this._display === 'original') ? 'result' : 'original';
        },
        recalcContentSize() {
            if (!this._element) return;
            const rect = this._element.getBoundingClientRect();
            const style = getComputedStyle(this._element);
            const paddingLeft = parseFloat(style.paddingLeft) || 0;
            const paddingRight = parseFloat(style.paddingRight) || 0;
            const paddingTop = parseFloat(style.paddingTop) || 0;
            const paddingBottom = parseFloat(style.paddingBottom) || 0;
            const left = rect.left + paddingLeft;
            const top = rect.top + paddingTop;
            const right = rect.right - paddingRight;
            const bottom = rect.bottom - paddingBottom;
            const width = (this._element.clientWidth || 0) - paddingLeft - paddingRight;
            const height = (this._element.clientHeight || 0) - paddingTop - paddingBottom;
            this._content = { top, right, bottom, left, width, height };
            const containScale = Math.min(
                width / Math.max(1, this._stage.width),
                height / Math.max(1, this._stage.height)
            );
            this._stage.containScale = Math.max(1, containScale);
            const minScale = Math.max(1, containScale * MIN_SCALE_RATIO);
            this._stage.minScale = Math.max(1, minScale);
            if (this._stage.scale < this._stage.minScale) {
                this._stage.scale = this._stage.minScale;
            }
        },
        clientToIndex(event, { allowViewport } = {}) {
            const left = this._content.left + this._stage.offset.x;
            const top = this._content.top + this._stage.offset.y;
            let x = Math.floor((event.clientX - left) / this._stage.scale);
            let y = Math.floor((event.clientY - top) / this._stage.scale);
            if (!allowViewport && (x < 0 || y < 0 || x >= this._stage.width || y >= this._stage.height)) return null;
            return coordToIndex(x, y);
        },
        serialize() {
            return {
                stage: {
                    width: this._stage.width,
                    height: this._stage.height,
                    scale: this._stage.scale,
                    offset: { ...this._stage.offset },
                },
                image: { ...this._image }
            };
        },
        applySerialized(payload) {
            const stage = payload?.stage || {};
            const image = payload?.image || {};
            if (stage.width != null) this._stage.width = stage.width;
            if (stage.height != null) this._stage.height = stage.height;
            this.recalcContentSize();
            if (stage.scale != null) this._stage.scale = stage.scale;
            if (stage.offset) {
                if (stage.offset.x != null) this._stage.offset.x = stage.offset.x;
                if (stage.offset.y != null) this._stage.offset.y = stage.offset.y;
            }
            if (image.src != null) this._image.src = image.src;
            if (image.x != null) this._image.x = image.x;
            if (image.y != null) this._image.y = image.y;
            if (image.width != null) this._image.width = image.width;
            if (image.height != null) this._image.height = image.height;
        },
    }
});
