<template>
    <p class="tip">Click to download the current conversation</p>
    <button class="download-button" @click="download">Download</button>
</template>

<script setup vapor lang="ts">
import browser from 'webextension-polyfill';

type RuntimeMessage = {
    type: 'inject';
};

const isRuntimeMessage = (message: unknown, type: RuntimeMessage['type']): message is RuntimeMessage =>
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === type;

const download = async () => {
    const tabs: browser.Tabs.Tab[] = await browser.tabs.query({ active: true, currentWindow: true });
    const [activeTab] = tabs;
    if (tabs.length === 1 && typeof activeTab?.id === 'number') {
        const tabId = activeTab.id;

        browser.runtime.onMessage.addListener((message: unknown) => {
            if (!isRuntimeMessage(message, 'inject')) return;

            void browser.scripting.executeScript({
                target: { tabId },
                files: ['inject.js'],
            });
        });

        await browser.scripting.executeScript({
            target: { tabId },
            func: () => {
                if (globalThis.chatSaverDownload === undefined) {
                    const extensionRuntime = (
                        globalThis as typeof globalThis & {
                            chrome?: {
                                runtime?: {
                                    sendMessage: (message: unknown) => void;
                                };
                            };
                        }
                    ).chrome?.runtime;

                    extensionRuntime?.sendMessage({ type: 'inject' });
                } else {
                    void globalThis.chatSaverDownload();
                }
            },
        });
    }
};
</script>

<style lang="scss">
@use 'sass:color';

#app {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 300px;
    padding: 20px 0;
}

.tip {
    font-size: 12px;
    color: #858585;
}

.download-button {
    $bg-color: #02ab62 !default;

    width: 180px;
    height: 40px;
    margin-top: 20px;
    color: #fff;
    background-color: $bg-color;
    border-radius: 4px;
    cursor: pointer;

    &:active {
        background-color: color.adjust($bg-color, $lightness: -10%);
    }
}

.option {
    &s {
        display: flex;
        flex-direction: row;
    }

    display: flex;
    flex-direction: row;
    align-items: center;

    & + & {
        margin-left: 20px;
    }

    &__input {
        margin-left: 5px;
    }
}
</style>
