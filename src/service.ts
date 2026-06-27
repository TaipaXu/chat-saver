import browser from 'webextension-polyfill';
import { getSupportedChatSiteByUrl } from '@/utils/chatSites';

const updateActionState = async (tabId: number, url: string | undefined): Promise<void> => {
    if (getSupportedChatSiteByUrl(url)) {
        await browser.action.enable(tabId);
    } else {
        await browser.action.disable(tabId);
    }
};

browser.tabs.onActivated.addListener(async ({ tabId }: browser.Tabs.OnActivatedActiveInfoType) => {
    const tab: browser.Tabs.Tab = await browser.tabs.get(tabId);

    await updateActionState(tabId, tab.url);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || tab.url) {
        void updateActionState(tabId, changeInfo.url ?? tab.url);
    }
});
