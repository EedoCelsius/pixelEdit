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
        client: { left: 0, top: 0, width: 0, height: 0 },
        padding: { left: 0, right: 0, top: 0, bottom: 0 },
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
        refreshElementCache() {
            if (!this.element) return;
            const rect = this.element.getBoundingClientRect();
            this.client.left = rect.left;
            this.client.top = rect.top;
            const style = getComputedStyle(this.element);
            this.padding.left = parseFloat(style.paddingLeft) || 0;
            this.padding.right = parseFloat(style.paddingRight) || 0;
            this.padding.top = parseFloat(style.paddingTop) || 0;
            this.padding.bottom = parseFloat(style.paddingBottom) || 0;
            this.client.width = (this.element.clientWidth || 0) - this.padding.left - this.padding.right;
            this.client.height = (this.element.clientHeight || 0) - this.padding.top - this.padding.bottom;
        },
        recalcScales() {
            const width = this.client.width;
            const height = this.client.height;
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
            const left = this.client.left + this.padding.left + this.stage.offset.x;
            const top = this.client.top + this.padding.top + this.stage.offset.y;
            const x = Math.floor((event.clientX - left) / this.stage.scale);
            const y = Math.floor((event.clientY - top) / this.stage.scale);
            if (x < 0 || y < 0 || x >= this.stage.width || y >= this.stage.height) return null;
            return [x, y];
        },
    }
});
