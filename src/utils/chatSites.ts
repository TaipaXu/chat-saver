export const supportedChatSites = [
    {
        id: 'chatgpt',
        name: 'ChatGPT',
        hosts: ['chatgpt.com'],
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        hosts: ['chat.deepseek.com'],
    },
] as const;

export type SupportedChatSite = (typeof supportedChatSites)[number];
export type SupportedChatSiteId = SupportedChatSite['id'];

const supportedChatSiteHosts = new Map<string, SupportedChatSite>(
    supportedChatSites.flatMap((site) => site.hosts.map((host) => [host, site])),
);

export const getSupportedChatSiteByHost = (host: string): SupportedChatSite | undefined =>
    supportedChatSiteHosts.get(host);

export const getSupportedChatSiteByUrl = (
    url: string | undefined,
): SupportedChatSite | undefined => {
    if (!url) return undefined;

    try {
        return getSupportedChatSiteByHost(new URL(url).hostname);
    } catch {
        return undefined;
    }
};

export const supportedChatSiteNames = supportedChatSites.map(({ name }) => name);
