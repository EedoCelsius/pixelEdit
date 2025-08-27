import { defineStore } from 'pinia';
import { readonly } from 'vue';
import { MIN_SCALE_RATIO } from '@/constants';

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
        _imageSrc: '',
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
        imageSrc: (state) => state._imageSrc,
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
        setImage(src) {
            this._imageSrc = src || '';
        },
        setScale(newScale) {
            this._stage.scale = Math.max(this._stage.minScale, newScale);
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
        clientToCoord(event) {
            const left = this._content.left + this._stage.offset.x;
            const top = this._content.top + this._stage.offset.y;
            const x = Math.floor((event.clientX - left) / this._stage.scale);
            const y = Math.floor((event.clientY - top) / this._stage.scale);
            if (x < 0 || y < 0 || x >= this._stage.width || y >= this._stage.height) return null;
            return [x, y];
        },
    }
});
