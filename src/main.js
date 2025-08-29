
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useKeyboardEventStore } from './stores';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
useKeyboardEventStore(pinia).listen();
app.mount('#app');
