
import './style.css';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useKeyboardEventStore, useOutputStore } from './stores';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
useKeyboardEventStore(pinia).listen();
useOutputStore(pinia).listen();
app.mount('#app');
