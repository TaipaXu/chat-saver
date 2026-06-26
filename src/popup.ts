import App from './popup.vue';
import { createApp } from 'vue';
import { mdiDownloadOutline } from '@mdi/js';
import { createExtensionVuetify } from '@/utils/extensionVuetify';

const vuetify = createExtensionVuetify({
    downloadOutline: mdiDownloadOutline,
});

const app = createApp(App);
app.use(vuetify);
app.mount('#app');
