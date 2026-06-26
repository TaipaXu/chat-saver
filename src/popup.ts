import App from './popup.vue';
import '@/styles/index.scss';
import { createVaporApp } from 'vue';

const app = createVaporApp(App);
app.mount('#app');
