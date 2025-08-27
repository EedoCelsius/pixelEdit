import { defineStore } from 'pinia';
import { readonly } from 'vue';
import { MIN_SCALE_RATIO } from '@/constants';

export const useViewportStore = defineStore('viewport', {
    state: () => ({
        _stage: {
            width: 16,
            height: 16,
            scale: 16,
            offset: { x: 0, y: 0 },
        },
        _display: 'result', // 'result' | 'original'
        _imageSrc: '',
        _element: null,
    }),
    getters: {
        stage(state) {
            const content = this.content;
            const cw = content.width;
            const ch = content.height;
            const containScale = Math.max(1, Math.min(
                cw / Math.max(1, state._stage.width),
                ch / Math.max(1, state._stage.height)
            ));
            const minScale = Math.max(1, containScale * MIN_SCALE_RATIO);
            const scale = Math.max(state._stage.scale, minScale);
            return readonly({
                width: state._stage.width,
                height: state._stage.height,
                scale,
                offset: { x: state._stage.offset.x, y: state._stage.offset.y },
                minScale,
                containScale,
            });
        },
        display: (state) => state._display,
        imageSrc: (state) => state._imageSrc,
        element: (state) => state._element,
        content() {
            const el = this.element;
            if (!el)
                return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 };
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            const padTop = parseFloat(style.paddingTop) || 0;
            const padRight = parseFloat(style.paddingRight) || 0;
            const padBottom = parseFloat(style.paddingBottom) || 0;
            const padLeft = parseFloat(style.paddingLeft) || 0;
            const top = rect.top + padTop;
            const left = rect.left + padLeft;
            const right = rect.right - padRight;
            const bottom = rect.bottom - padBottom;
            return {
                top,
                right,
                bottom,
                left,
                width: right - left,
                height: bottom - top,
            };
        },
        // Canvas dimensions
        viewBox: (state) => `0 0 ${state._stage.width} ${state._stage.height}`,
        // UI labels
        toggleLabel: (state) => state._display === 'original' ? '결과' : '원본',
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
            this._stage.scale = Math.max(this.stage.minScale, newScale);
        },
        toggleView() {
            this._display = (this._display === 'original') ? 'result' : 'original';
        },
        clientToCoord(event) {
            const left = this.content.left + this.stage.offset.x;
            const top = this.content.top + this.stage.offset.y;
            const x = Math.floor((event.clientX - left) / this.stage.scale);
            const y = Math.floor((event.clientY - top) / this.stage.scale);
            if (x < 0 || y < 0 || x >= this.stage.width || y >= this.stage.height) return null;
            return [x, y];
        },
    }
});

