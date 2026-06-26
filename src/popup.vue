<template>
    <v-app>
        <v-main>
            <section class="popup">
                <div class="popup__header">
                    <span class="popup__icon" aria-hidden="true">
                        <img src="./assets/icon.png" alt="" />
                    </span>

                    <div class="popup__copy">
                        <h1 class="popup__title">Chat Saver</h1>
                        <p class="popup__description">
                            Download the current ChatGPT conversation to your device.
                        </p>
                    </div>
                </div>

                <v-btn
                block
                class="popup__download"
                color="primary"
                :disabled="loading || selectedFormats.length === 0"
                :loading="loading"
                prepend-icon="$downloadOutline"
                size="small"
                variant="flat"
                @click="download">
                    Download
                </v-btn>

                <div class="popup__formats">
                    <div class="popup__formats-title">Download formats</div>

                    <div class="popup__formats-list">
                        <v-checkbox-btn
                        v-for="format in downloadFormatOptions"
                        :key="format.value"
                        v-model="formatSelection[format.value]"
                        class="popup__format"
                        color="primary"
                        density="compact"
                        :label="format.label" />
                    </div>
                </div>

                <v-alert
                v-if="errorMessage"
                class="popup__alert"
                density="compact"
                type="error"
                variant="tonal">
                    {{ errorMessage }}
                </v-alert>
            </section>
        </v-main>
    </v-app>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Ref } from 'vue';
import browser from 'webextension-polyfill';
import {
    allDownloadFormats,
    downloadFormatOptions,
    normalizeDownloadFormatSelection,
    type DownloadFormat,
    type DownloadFormatSelection,
} from '@/utils/downloadFormats';

const formatSelectionStorageKey = 'chatSaverDownloadFormatSelection';
const downloadFormatSignature = allDownloadFormats.join(',');

const loading: Ref<boolean> = ref(false);
const errorMessage: Ref<string> = ref('');
const readFormatSelection = (): DownloadFormatSelection => {
    try {
        const storedSelection = localStorage.getItem(formatSelectionStorageKey);
        return normalizeDownloadFormatSelection(
            storedSelection === null ? undefined : JSON.parse(storedSelection),
        );
    } catch (error) {
        console.warn('Failed to read download format selection.', error);
        return normalizeDownloadFormatSelection(undefined);
    }
};

const formatSelection: Ref<DownloadFormatSelection> = ref(readFormatSelection());
const selectedFormats = computed<DownloadFormat[]>(() =>
    downloadFormatOptions
        .filter(({ value }) => formatSelection.value[value])
        .map(({ value }) => value),
);

watch(
    formatSelection,
    (selection) => {
        try {
            localStorage.setItem(formatSelectionStorageKey, JSON.stringify(selection));
        } catch (error) {
            console.warn('Failed to save download format selection.', error);
        }
    },
    { deep: true },
);

const injectDownloadScript = async (tabId: number) => {
    await browser.scripting.executeScript({
        target: { tabId },
        files: ['inject.js'],
    });
};

const executeDownloadScript = async (
    tabId: number,
    formats: DownloadFormat[],
): Promise<boolean> => {
    const [result] = await browser.scripting.executeScript({
        target: { tabId },
        args: [formats, downloadFormatSignature],
        func: async (
            downloadFormats: DownloadFormat[],
            expectedDownloadFormatSignature: string,
        ) => {
            if (
                globalThis.chatSaverDownload === undefined ||
                globalThis.chatSaverDownloadFormatSignature !== expectedDownloadFormatSignature
            ) {
                return false;
            }

            await globalThis.chatSaverDownload(downloadFormats);
            return true;
        },
    });

    return result?.result === true;
};

const download = async () => {
    if (loading.value) return;

    const downloadFormats = [...selectedFormats.value];

    if (downloadFormats.length === 0) {
        errorMessage.value = 'Select at least one download format.';
        return;
    }

    loading.value = true;
    errorMessage.value = '';

    try {
        const tabs: browser.Tabs.Tab[] = await browser.tabs.query({ active: true, currentWindow: true });
        const [activeTab] = tabs;

        if (tabs.length !== 1 || typeof activeTab?.id !== 'number') {
            errorMessage.value = 'No active tab was found.';
            return;
        }

        const tabId = activeTab.id;
        const downloaded = await executeDownloadScript(tabId, downloadFormats);

        if (!downloaded) {
            await injectDownloadScript(tabId);

            if (!(await executeDownloadScript(tabId, downloadFormats))) {
                errorMessage.value =
                    'Download script was not available. Please refresh the ChatGPT tab and try again.';
            }
        }
    } catch (error) {
        console.error('Failed to download chat', error);
        errorMessage.value = 'Download failed. Please refresh the ChatGPT tab and try again.';
    } finally {
        loading.value = false;
    }
};
</script>

<style lang="scss">
#app {
    width: 328px;
}

.popup {
    display: grid;
    gap: 18px;
    padding: 20px;
    border-top: 3px solid rgba(var(--v-theme-primary), 0.88);
    background:
        linear-gradient(
            180deg,
            rgba(var(--v-theme-secondary), 0.72) 0%,
            rgba(var(--v-theme-surface), 1) 42%
        );
}

.popup__header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.popup__icon {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
    border-radius: 8px;
    background: rgba(var(--v-theme-surface), 0.9);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.1);
}

.popup__icon img {
    display: block;
    width: 28px;
    height: 28px;
}

.popup__copy {
    min-width: 0;
    padding-top: 1px;
}

.popup__title {
    margin: 0;
    color: rgb(var(--v-theme-on-surface));
    font-size: 18px;
    font-weight: 650;
    letter-spacing: 0;
    line-height: 1.2;
}

.popup__description {
    margin-top: 7px;
    color: rgba(var(--v-theme-on-surface), 0.66);
    font-size: 12.5px;
    letter-spacing: 0;
    line-height: 1.45;
}

.popup__download {
    background-color: rgb(var(--v-theme-primary));
    box-shadow: 0 10px 20px rgba(var(--v-theme-primary), 0.22);
    color: rgb(var(--v-theme-on-primary));
    font-weight: 650;
    letter-spacing: 0;
    text-transform: none;

    &:not(.v-btn--disabled):hover {
        transform: translateY(-1px);
    }

    .v-btn__prepend {
        margin-inline-end: 8px;
    }
}

.popup__formats {
    display: grid;
    gap: 8px;
}

.popup__formats-title {
    color: rgba(var(--v-theme-on-surface), 0.72);
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0;
    line-height: 1.2;
}

.popup__formats-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
}

.popup__format {
    grid-area: auto;
    min-width: 0;
    padding: 6px 8px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
    border-radius: 8px;
    background: rgba(var(--v-theme-surface), 0.66);

    .v-label {
        min-width: 0;
        color: rgba(var(--v-theme-on-surface), 0.84);
        font-size: 12px;
        letter-spacing: 0;
        line-height: 1.2;
        white-space: normal;
    }

    .v-selection-control__wrapper {
        margin-inline-end: 6px;
    }
}

.popup__alert {
    margin-top: 8px;
    border: 1px solid rgba(var(--v-theme-error), 0.16);
    font-size: 12px;
    letter-spacing: 0;
    line-height: 1.45;
}

@media (prefers-color-scheme: dark) {
    .popup__icon {
        background: rgba(var(--v-theme-surface), 0.72);
        box-shadow: 0 12px 26px rgba(0, 0, 0, 0.28);
    }

    .popup__download {
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.26);
    }
}
</style>
