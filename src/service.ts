import browser from 'webextension-polyfill';

browser.tabs.onActivated.addListener(async (activeInfo: browser.Tabs.OnActivatedActiveInfoType) => {
    const tab: browser.Tabs.Tab = await browser.tabs.get(activeInfo.tabId);
    const url: string | undefined = tab.url;
    if (url && new URL(url).hostname === 'chat.openai.com') {
        await browser.action.enable(activeInfo.tabId);
    } else {
        await browser.action.disable(activeInfo.tabId);
    }
});
