import { defineStore } from 'pinia';
import { MIN_SCALE_RATIO } from '@/constants';

export const useViewportStore = defineStore('viewport', {
    state: () => ({
        stage: {
            width: 16,
            height: 16,
            scale: 16,
            minScale: 1,
            containScale: 1,
            offset: { x: 0, y: 0 },
        },
        display: 'result', // 'result' | 'original'
        imageSrc: '',
        element: null,
    }),
    getters: {
        // Canvas dimensions
        viewBox: (state) => `0 0 ${state.stage.width} ${state.stage.height}`,
        // UI labels
        toggleLabel: (state) => state.display === 'original' ? '결과' : '원본',
    },
    actions: {
        setElement(el) {
            this.element = el;
        },
        setOffset(x, y) {
            this.stage.offset.x = x;
            this.stage.offset.y = y;
        },
        setSize(newWidth, newHeight) {
            this.stage.width = Math.max(1, newWidth | 0);
            this.stage.height = Math.max(1, newHeight | 0);
        },
        setImage(src) {
            this.imageSrc = src || '';
        },
        setScale(newScale) {
            this.stage.scale = Math.max(this.stage.minScale, newScale);
        },
        toggleView() {
            this.display = (this.display === 'original') ? 'result' : 'original';
        },
        recalcScales() {
            const style = getComputedStyle(this.element);
            const paddingLeft = parseFloat(style.paddingLeft) || 0;
            const paddingRight = parseFloat(style.paddingRight) || 0;
            const paddingTop = parseFloat(style.paddingTop) || 0;
            const paddingBottom = parseFloat(style.paddingBottom) || 0;
            const width = (this.element.clientWidth || 0) - paddingLeft - paddingRight;
            const height = (this.element.clientHeight || 0) - paddingTop - paddingBottom;
            const containScale = Math.min(
                width / Math.max(1, this.stage.width),
                height / Math.max(1, this.stage.height)
            );
            this.stage.containScale = Math.max(1, containScale);
            const minScale = Math.max(1, containScale * MIN_SCALE_RATIO);
            this.stage.minScale = Math.max(1, minScale);
            if (this.stage.scale < this.stage.minScale) {
                this.stage.scale = this.stage.minScale;
            }
        },
        clientToCoord(event) {
            const rect = this.element.getBoundingClientRect();
            const style = getComputedStyle(this.element);
            const left = rect.left + parseFloat(style.paddingLeft) + this.stage.offset.x;
            const top = rect.top + parseFloat(style.paddingTop) + this.stage.offset.y;
            const x = Math.floor((event.clientX - left) / this.stage.scale);
            const y = Math.floor((event.clientY - top) / this.stage.scale);
            if (x < 0 || y < 0 || x >= this.stage.width || y >= this.stage.height) return null;
            return [x, y];
        },
    }
});
