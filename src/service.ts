import browser from 'webextension-polyfill';

const chatHosts = new Set(['chatgpt.com']);

browser.tabs.onActivated.addListener(async (activeInfo: browser.Tabs.OnActivatedActiveInfoType) => {
    const tab: browser.Tabs.Tab = await browser.tabs.get(activeInfo.tabId);
    const url: string | undefined = tab.url;
    if (url && chatHosts.has(new URL(url).hostname)) {
        await browser.action.enable(activeInfo.tabId);
    } else {
        await browser.action.disable(activeInfo.tabId);
    }
});
