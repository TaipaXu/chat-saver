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
                            Download the current conversation from {{ supportedSiteLabel }}.
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
                    <div class="popup__formats-list">
                        <v-checkbox-btn
                        v-for="format in downloadFormatOptions"
                        :key="format.value"
                        v-model="formatSelection[format.value]"
                        class="popup__format"
                        color="primary"
                        density="compact"
                        :disabled="isDownloadFormatDisabled(format.value)"
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

                <v-alert
                v-if="successMessage"
                class="popup__alert"
                density="compact"
                type="success"
                variant="tonal">
                    {{ successMessage }}
                </v-alert>
            </section>
        </v-main>
    </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, type Ref } from 'vue';
import browser from 'webextension-polyfill';
import {
    downloadFormatOptions,
    normalizeDownloadFormatSelection,
    type DownloadFormat,
    type DownloadFormatSelection,
} from '@/utils/downloadFormats';
import {
    getSupportedChatSiteByUrl,
    supportedChatSiteNames,
    type SupportedChatSite,
} from '@/utils/chatSites';
import { chatSaverDownloadSignature } from '@/utils/downloadRuntime';

const formatSelectionStorageKey = 'chatSaverDownloadFormatSelection';

const loading: Ref<boolean> = ref(false);
const errorMessage: Ref<string> = ref('');
const successMessage: Ref<string> = ref('');
const activeChatSite: Ref<SupportedChatSite | undefined> = ref(undefined);
const supportedSiteLabel = supportedChatSiteNames.join(' or ');
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
const isDownloadFormatDisabled = (
    format: DownloadFormat,
    site: SupportedChatSite | undefined = activeChatSite.value,
): boolean => site?.id === 'deepseek' && format === 'png';
const getSelectedFormats = (site: SupportedChatSite | undefined): DownloadFormat[] =>
    downloadFormatOptions
        .filter(({ value }) => formatSelection.value[value] && !isDownloadFormatDisabled(value, site))
        .map(({ value }) => value);
const selectedFormats = computed<DownloadFormat[]>(() => getSelectedFormats(activeChatSite.value));

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

const updateActiveChatSite = async (): Promise<void> => {
    try {
        const tabs: browser.Tabs.Tab[] = await browser.tabs.query({ active: true, currentWindow: true });
        const [activeTab] = tabs;

        activeChatSite.value =
            tabs.length === 1 ? getSupportedChatSiteByUrl(activeTab?.url) : undefined;
    } catch (error) {
        console.warn('Failed to read active chat site.', error);
        activeChatSite.value = undefined;
    }
};

onMounted(() => {
    void updateActiveChatSite();
});

const injectDownloadScript = async (tabId: number) => {
    await browser.scripting.executeScript({
        target: { tabId },
        files: ['inject.js'],
    });
};

interface DownloadExecutionResult {
    scriptAvailable: boolean;
    downloadResult?: ChatSaverDownloadResult;
}

const isChatSaverDownloadResult = (value: unknown): value is ChatSaverDownloadResult => {
    if (value === null || typeof value !== 'object') return false;

    const result = value as Record<string, unknown>;

    return typeof result.success === 'boolean';
};

const executeDownloadScript = async (
    tabId: number,
    formats: DownloadFormat[],
): Promise<DownloadExecutionResult> => {
    const [result] = await browser.scripting.executeScript({
        target: { tabId },
        args: [formats, chatSaverDownloadSignature],
        func: async (
            downloadFormats: DownloadFormat[],
            expectedDownloadSignature: string,
        ) => {
            if (
                globalThis.chatSaverDownload === undefined ||
                globalThis.chatSaverDownloadSignature !== expectedDownloadSignature
            ) {
                return false;
            }

            return globalThis.chatSaverDownload(downloadFormats);
        },
    });
    const scriptResult = result?.result;

    return scriptResult === false || !isChatSaverDownloadResult(scriptResult)
        ? { scriptAvailable: false }
        : { scriptAvailable: true, downloadResult: scriptResult };
};

const download = async () => {
    if (loading.value) return;

    errorMessage.value = '';
    successMessage.value = '';

    loading.value = true;

    try {
        const tabs: browser.Tabs.Tab[] = await browser.tabs.query({ active: true, currentWindow: true });
        const [activeTab] = tabs;

        if (tabs.length !== 1 || typeof activeTab?.id !== 'number') {
            errorMessage.value = 'No active tab was found.';
            return;
        }

        const activeSite = getSupportedChatSiteByUrl(activeTab.url);

        if (!activeSite) {
            errorMessage.value = `Open a supported chat page (${supportedSiteLabel}) and try again.`;
            return;
        }

        activeChatSite.value = activeSite;

        const downloadFormats = getSelectedFormats(activeSite);

        if (downloadFormats.length === 0) {
            errorMessage.value = 'Select at least one enabled download format.';
            return;
        }

        const tabId = activeTab.id;
        let executionResult = await executeDownloadScript(tabId, downloadFormats);

        if (!executionResult.scriptAvailable) {
            await injectDownloadScript(tabId);

            executionResult = await executeDownloadScript(tabId, downloadFormats);

            if (!executionResult.scriptAvailable) {
                errorMessage.value =
                    'Download script was not available. Please refresh the chat tab and try again.';
                return;
            }
        }

        if (executionResult.downloadResult?.success === false) {
            errorMessage.value =
                executionResult.downloadResult.errorMessage ??
                'No messages were found on the current chat page.';
            return;
        }

        successMessage.value = `Download started from ${activeSite.name}.`;
    } catch (error) {
        console.error('Failed to download chat', error);
        errorMessage.value = 'Download failed. Please refresh the chat tab and try again.';
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

    &__header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
    }

    &__icon {
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

        img {
            display: block;
            width: 28px;
            height: 28px;
        }
    }

    &__copy {
        min-width: 0;
        padding-top: 1px;
    }

    &__title {
        margin: 0;
        color: rgb(var(--v-theme-on-surface));
        font-size: 18px;
        font-weight: 650;
        letter-spacing: 0;
        line-height: 1.2;
    }

    &__description {
        margin-top: 7px;
        color: rgba(var(--v-theme-on-surface), 0.66);
        font-size: 12.5px;
        letter-spacing: 0;
        line-height: 1.45;
    }

    &__download {
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

    &__formats {
        display: grid;
        gap: 8px;
    }

    &__formats-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
    }

    &__format {
        grid-area: auto;
        min-width: 0;
        padding: 5px 6px;
        border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
        border-radius: 8px;
        background: rgba(var(--v-theme-surface), 0.66);

        .v-label {
            min-width: 0;
            color: rgba(var(--v-theme-on-surface), 0.84);
            font-size: 11px;
            letter-spacing: 0;
            line-height: 1.2;
            white-space: nowrap;
        }

        .v-selection-control__wrapper {
            margin-inline-end: 4px;
        }
    }

    &__alert {
        margin-top: 8px;
        border: 1px solid rgba(var(--v-theme-error), 0.16);
        font-size: 12px;
        letter-spacing: 0;
        line-height: 1.45;
    }
}

@media (prefers-color-scheme: dark) {
    .popup {
        &__icon {
            background: rgba(var(--v-theme-surface), 0.72);
            box-shadow: 0 12px 26px rgba(0, 0, 0, 0.28);
        }

        &__download {
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.26);
        }
    }
}
</style>
