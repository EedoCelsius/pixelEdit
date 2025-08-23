import { defineStore } from 'pinia';

export const useStageStore = defineStore('stage', {
    state: () => ({
        canvas: {
            x: 0,
            y: 0,
            width: 16,
            height: 16,
            scale: 16,
            minScale: 1,
        },
        display: 'result', // 'result' | 'original'
        imageSrc: '',
        pixelInfo: '-',
    }),
    getters: {
        // Canvas dimensions
        pixelWidth: (state) => state.canvas.width * state.canvas.scale,
        pixelHeight: (state) => state.canvas.height * state.canvas.scale,
        viewBox: (state) => `0 0 ${state.canvas.width} ${state.canvas.height}`,
        // UI labels
        toggleLabel: (state) => state.display === 'original' ? '결과' : '원본',
    },
    actions: {
        setCanvasPosition(x, y) {
            this.canvas.x = x;
            this.canvas.y = y;
        },
        setSize(newWidth, newHeight) {
            this.canvas.width = Math.max(1, newWidth | 0);
            this.canvas.height = Math.max(1, newHeight | 0);
        },
        setImage(src) {
            this.imageSrc = src || '';
        },
        setScale(newScale) {
            this.canvas.scale = Math.max(this.canvas.minScale, newScale | 0);
        },
        setMinScale(newMin) {
            this.canvas.minScale = Math.max(1, newMin | 0);
            if (this.canvas.scale < this.canvas.minScale) {
                this.canvas.scale = this.canvas.minScale;
            }
        },
        toggleView() {
            this.display = (this.display === 'original') ? 'result' : 'original';
        },
        updatePixelInfo(text) {
            this.pixelInfo = text;
        },
    }
});
