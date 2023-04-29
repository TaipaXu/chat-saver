<template>
    <p class="tip">Click to download the current conversation</p>
    <button @click="download" class="download-button">Download</button>
</template>

<script setup lang="ts">
import browser from 'webextension-polyfill';

const download = async () => {
    const tabs: browser.Tabs.Tab[] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 1) {
        browser.runtime.onMessage.addListener((message: any) => {
            if (message.type === 'inject') {
                browser.scripting.executeScript({
                    target: { tabId: tabs[0].id as number },
                    files: ['inject.js'],
                });
            }
        });

        browser.scripting.executeScript({
            target: { tabId: tabs[0].id as number },
            func: () => {
                if (globalThis.chatSaverDownload === undefined) {
                    chrome.runtime.sendMessage({ type: 'inject' });
                } else {
                    globalThis.chatSaverDownload();
                }
            }
        });
    }
};
</script>

<style lang="scss">
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
        background-color: darken($color: $bg-color, $amount: 10);
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

    &+& {
        margin-left: 20px;
    }

    &__input {
        margin-left: 5px;
    }
}
</style>
