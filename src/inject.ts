import { toBlob } from 'html-to-image';
import {
    allDownloadFormats,
    normalizeDownloadFormats,
    type DownloadFormat,
} from '@/utils/downloadFormats';
import { getSupportedChatSiteByHost, type SupportedChatSiteId } from '@/utils/chatSites';
import { chatSaverDownloadSignature } from '@/utils/downloadRuntime';

type MessageRole = 'user' | 'assistant';

interface Message {
    role: MessageRole;
    text: string;
}

interface ElementMessage extends Message {
    element: HTMLElement;
}

interface ChatSiteAdapter {
    name: string;
    fetchTextMessages: () => Promise<Message[]>;
    findImageContainer?: () => HTMLElement | null;
}

type DownloadHandler = (adapter: ChatSiteAdapter, filename: string) => void | Promise<void>;

const transparentImagePlaceholder =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const readText = (element: HTMLElement): string =>
    (element.innerText || element.textContent || '')
        .replaceAll('\u00A0', ' ')
        .replaceAll(/[ \t]+\n/g, '\n')
        .replaceAll(/\n{3,}/g, '\n\n')
        .trim();

const isInsideAnotherElement = (element: HTMLElement, elements: HTMLElement[]): boolean =>
    elements.some((otherElement) => otherElement !== element && otherElement.contains(element));

const isWrappingAnotherElement = (element: HTMLElement, elements: HTMLElement[]): boolean =>
    elements.some((otherElement) => otherElement !== element && element.contains(otherElement));

const findCommonAncestor = (elements: HTMLElement[]): HTMLElement | null => {
    const [firstElement] = elements;
    if (!firstElement) return null;

    let ancestor = firstElement.parentElement;
    while (ancestor && !elements.every((element) => ancestor?.contains(element))) {
        ancestor = ancestor.parentElement;
    }

    return ancestor;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

const readStringProperty = (
    record: Record<string, unknown>,
    propertyName: string,
): string | undefined => {
    const value = record[propertyName];

    return typeof value === 'string' ? value : undefined;
};

const readBooleanProperty = (
    record: Record<string, unknown>,
    propertyName: string,
): boolean | undefined => {
    const value = record[propertyName];

    return typeof value === 'boolean' ? value : undefined;
};

const formatMessagesAsMarkdown = (messages: Message[]): string =>
    messages
        .map(({ role, text }) => `## ${role === 'user' ? 'Q' : 'A'}\n\n${text.trim()}`)
        .join('\n\n---\n\n');

const escapeRegExp = (value: string): string => value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isUnsafeFilenameCharacter = (character: string): boolean => {
    const codePoint = character.codePointAt(0);

    return (
        codePoint !== undefined &&
        (codePoint <= 0x1f || codePoint === 0x7f || '<>:"/\\|?*'.includes(character))
    );
};

const sanitizeFilenameSegment = (value: string): string => {
    const sanitizedValue = Array.from(value, (character) =>
        isUnsafeFilenameCharacter(character) ? '-' : character,
    )
        .join('')
        .replaceAll(/\s+/g, ' ')
        .replaceAll(/-+/g, '-')
        .trim()
        .replaceAll(/^[ .-]+|[ .-]+$/g, '');

    return sanitizedValue || 'chat';
};

const stripSiteNameFromTitle = (title: string, siteName: string): string => {
    const escapedSiteName = escapeRegExp(siteName);
    const separatorPattern = String.raw`\s*(?:-|\u2013|\u2014|\||:)\s*`;
    const strippedTitle = title
        .replace(new RegExp(`^${escapedSiteName}${separatorPattern}`, 'i'), '')
        .replace(new RegExp(`${separatorPattern}${escapedSiteName}$`, 'i'), '')
        .trim();

    return strippedTitle.toLowerCase() === siteName.toLowerCase() ? '' : strippedTitle;
};

const getConversationTitle = (siteName: string): string => {
    const title = stripSiteNameFromTitle(document.title.trim(), siteName);

    return sanitizeFilenameSegment(title);
};

const padDateSegment = (value: number): string => String(value).padStart(2, '0');

const formatLocalDate = (date = new Date()): string =>
    [date.getFullYear(), padDateSegment(date.getMonth() + 1), padDateSegment(date.getDate())].join(
        '-',
    );

const createDownloadBasename = (adapter: ChatSiteAdapter): string =>
    [
        sanitizeFilenameSegment(adapter.name),
        getConversationTitle(adapter.name),
        formatLocalDate(),
    ].join('-');

const getChatGptConversationId = (): string => {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const conversationIndex = pathParts.indexOf('c');
    const conversationId =
        conversationIndex >= 0 ? pathParts[conversationIndex + 1] : pathParts.at(-1);

    if (!conversationId || conversationId === 'c') {
        throw new Error('ChatGPT conversation id was not found in the current URL.');
    }

    return conversationId;
};

const fetchChatGptAccessToken = async (): Promise<string> => {
    const response = await fetch('/api/auth/session', {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`ChatGPT session API returned ${response.status}.`);
    }

    const session: unknown = await response.json();

    if (!isRecord(session)) {
        throw new Error('ChatGPT session API returned an unexpected response.');
    }

    const accessToken = readStringProperty(session, 'accessToken');

    if (!accessToken) {
        throw new Error('ChatGPT access token was not found. Please sign in and try again.');
    }

    return accessToken;
};

const getChatGptMessageRole = (value: unknown): MessageRole | undefined => {
    if (typeof value !== 'string') return undefined;

    const role = value.toLowerCase();

    return role === 'user' || role === 'assistant' ? role : undefined;
};

const readChatGptTextParts = (value: unknown): string[] => {
    if (typeof value === 'string') {
        return [value];
    }

    if (Array.isArray(value)) {
        return value.flatMap(readChatGptTextParts);
    }

    if (!isRecord(value)) {
        return [];
    }

    const text = readStringProperty(value, 'text');
    if (text) return [text];

    const content = value.content;
    if (content !== value) {
        return readChatGptTextParts(content);
    }

    return [];
};

const readChatGptMessageText = (message: Record<string, unknown>): string => {
    const content = message.content;
    if (!isRecord(content)) return '';

    const parts = content.parts;
    const text = readChatGptTextParts(parts).join('\n').trim();

    if (text) {
        return text;
    }

    return readStringProperty(content, 'text')?.trim() ?? '';
};

const isChatGptVisibleMessage = (message: Record<string, unknown>, role: MessageRole): boolean => {
    const channel = readStringProperty(message, 'channel');
    if (channel && channel !== 'final') return false;

    const recipient = readStringProperty(message, 'recipient');
    if (recipient && recipient !== 'all') return false;

    if (role === 'assistant' && message.end_turn === false) return false;

    const metadata = message.metadata;
    if (!isRecord(metadata)) return true;

    return (
        readBooleanProperty(metadata, 'is_visually_hidden_from_conversation') !== true &&
        readBooleanProperty(metadata, 'hidden') !== true
    );
};

const isChatGptInternalToolText = (text: string): boolean => {
    const trimmedText = text.trim();

    if (!trimmedText.startsWith('{') || !trimmedText.endsWith('}')) {
        return false;
    }

    try {
        const parsedText: unknown = JSON.parse(trimmedText);

        if (!isRecord(parsedText)) return false;

        return Object.keys(parsedText).some((key) => /^system\d*_/.test(key));
    } catch {
        return false;
    }
};

const readChatGptConversationMapping = (
    responseBody: unknown,
): Record<string, Record<string, unknown>> => {
    if (!isRecord(responseBody)) return {};

    const mapping = responseBody.mapping;
    if (!isRecord(mapping)) return {};

    return Object.fromEntries(
        Object.entries(mapping).filter((entry): entry is [string, Record<string, unknown>] =>
            isRecord(entry[1]),
        ),
    );
};

const getChatGptConversationNodeIds = (
    responseBody: unknown,
    mapping: Record<string, Record<string, unknown>>,
): string[] => {
    if (!isRecord(responseBody)) return Object.keys(mapping);

    const currentNode = readStringProperty(responseBody, 'current_node');

    if (!currentNode || !mapping[currentNode]) {
        return Object.keys(mapping);
    }

    const nodeIds: string[] = [];
    let nodeId: string | undefined = currentNode;
    const visitedNodeIds = new Set<string>();

    while (nodeId && !visitedNodeIds.has(nodeId)) {
        const node: Record<string, unknown> | undefined = mapping[nodeId];
        if (!node) break;

        visitedNodeIds.add(nodeId);
        nodeIds.push(nodeId);

        const parent: unknown = node.parent;
        nodeId = typeof parent === 'string' ? parent : undefined;
    }

    return nodeIds.reverse();
};

const parseChatGptApiMessages = (responseBody: unknown): Message[] => {
    const mapping = readChatGptConversationMapping(responseBody);

    return getChatGptConversationNodeIds(responseBody, mapping)
        .map((nodeId): Message | undefined => {
            const node = mapping[nodeId];
            if (!node) return undefined;

            const rawMessage = node.message;
            if (!isRecord(rawMessage)) return undefined;

            const author = rawMessage.author;
            if (!isRecord(author)) return undefined;

            const role = getChatGptMessageRole(author.role);
            const text = readChatGptMessageText(rawMessage);

            if (
                !role ||
                !text ||
                !isChatGptVisibleMessage(rawMessage, role) ||
                isChatGptInternalToolText(text)
            ) {
                return undefined;
            }

            return { role, text };
        })
        .filter((message): message is Message => message !== undefined);
};

const fetchChatGptTextMessages = async (): Promise<Message[]> => {
    const conversationId = getChatGptConversationId();
    const accessToken = await fetchChatGptAccessToken();
    const response = await fetch(
        `/backend-api/conversation/${encodeURIComponent(conversationId)}`,
        {
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        },
    );

    if (!response.ok) {
        throw new Error(`ChatGPT conversation API returned ${response.status}.`);
    }

    const messages = parseChatGptApiMessages(await response.json());

    if (messages.length === 0) {
        throw new Error('ChatGPT conversation API returned no downloadable messages.');
    }

    return messages;
};

const createChatGptAdapter = (): ChatSiteAdapter => {
    const legacyChatContainerSelector = 'main > div:not(.absolute) > div > div > div';
    const conversationTurnSelector =
        'article[data-testid*="conversation-turn"], [data-testid*="conversation-turn"]';
    const roleSelector = [
        '[data-message-author-role="user"]',
        '[data-message-author-role="assistant"]',
        '[data-role="user"]',
        '[data-role="assistant"]',
        '[data-testid="user-message"]',
        '[data-testid="assistant-message"]',
    ].join(',');

    const readRole = (element: HTMLElement): MessageRole | undefined => {
        const explicitRole =
            element.getAttribute('data-message-author-role') ?? element.getAttribute('data-role');

        if (explicitRole === 'user' || explicitRole === 'assistant') return explicitRole;

        const testId = element.getAttribute('data-testid')?.toLowerCase() ?? '';
        if (testId.includes('user-message')) return 'user';
        if (testId.includes('assistant-message')) return 'assistant';

        return undefined;
    };

    const getMessageTextElement = (element: HTMLElement, role: MessageRole): HTMLElement => {
        const roleElement = element.querySelector<HTMLElement>(
            `[data-message-author-role="${role}"], [data-role="${role}"], [data-testid="${role}-message"]`,
        );

        if (role === 'assistant') {
            return element.querySelector<HTMLElement>('.markdown') ?? roleElement ?? element;
        }

        return roleElement ?? element;
    };

    const findTurnMessages = (root: ParentNode): ElementMessage[] => {
        const turns = Array.from(
            root.querySelectorAll<HTMLElement>(conversationTurnSelector),
        ).filter((element, _index, elements) => !isInsideAnotherElement(element, elements));

        return turns
            .map((turn): ElementMessage | undefined => {
                const roleElement = turn.querySelector<HTMLElement>(roleSelector);
                const role = readRole(turn) ?? (roleElement ? readRole(roleElement) : undefined);
                if (!role) return undefined;

                const textElement = getMessageTextElement(turn, role);
                const text = readText(textElement);
                if (!text) return undefined;

                return { role, text, element: turn };
            })
            .filter((message): message is ElementMessage => message !== undefined);
    };

    const findRoleMessages = (root: ParentNode): ElementMessage[] => {
        const roleElements = Array.from(root.querySelectorAll<HTMLElement>(roleSelector)).filter(
            (element, _index, elements) => !isWrappingAnotherElement(element, elements),
        );

        return roleElements
            .map((element): ElementMessage | undefined => {
                const role = readRole(element);
                if (!role) return undefined;

                const text = readText(getMessageTextElement(element, role));
                if (!text) return undefined;

                return { role, text, element };
            })
            .filter((message): message is ElementMessage => message !== undefined);
    };

    const findMessages = (): ElementMessage[] => {
        const root = document.querySelector<HTMLElement>('main') ?? document.body;
        const turnMessages = findTurnMessages(root);

        return turnMessages.length > 0 ? turnMessages : findRoleMessages(root);
    };

    return {
        name: 'ChatGPT',
        fetchTextMessages: fetchChatGptTextMessages,
        findImageContainer: () => {
            const messages = findMessages();
            if (messages.length === 0) return null;

            const messageElements = messages.map(({ element }) => element);
            const legacyContainer = document.querySelector<HTMLElement>(
                legacyChatContainerSelector,
            );

            if (
                legacyContainer &&
                messageElements.every((element) => legacyContainer.contains(element))
            ) {
                return legacyContainer;
            }

            return (
                findCommonAncestor(messageElements) ??
                document.querySelector<HTMLElement>('main') ??
                document.body
            );
        },
    };
};

const getDeepSeekChatSessionId = (): string => {
    const sessionId = window.location.pathname.split('/').filter(Boolean).at(-1);

    if (!sessionId || sessionId.length < 16 || sessionId === 'chat') {
        throw new Error('DeepSeek chat session id was not found in the current URL.');
    }

    return sessionId;
};

const getDeepSeekAuthToken = (): string => {
    const storedToken = window.localStorage.getItem('userToken');

    if (!storedToken) {
        throw new Error('DeepSeek user token was not found. Please sign in and try again.');
    }

    try {
        const tokenData: unknown = JSON.parse(storedToken);

        if (!isRecord(tokenData)) {
            throw new Error('DeepSeek user token has an unexpected format.');
        }

        const token = readStringProperty(tokenData, 'value');

        if (!token) {
            throw new Error('DeepSeek user token has an unexpected format.');
        }

        return token;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }

        throw new Error('DeepSeek user token has an unexpected format.');
    }
};

const getDeepSeekMessageRole = (value: unknown): MessageRole | undefined => {
    if (typeof value !== 'string') return undefined;

    const role = value.toLowerCase();

    return role === 'user' || role === 'assistant' ? role : undefined;
};

const readDeepSeekApiMessages = (responseBody: unknown): unknown[] => {
    if (!isRecord(responseBody)) return [];

    const data = responseBody.data;
    if (!isRecord(data)) return [];

    const bizData = data.biz_data;
    if (!isRecord(bizData)) return [];

    const chatMessages = bizData.chat_messages;

    return Array.isArray(chatMessages) ? chatMessages : [];
};

const parseDeepSeekApiMessages = (responseBody: unknown): Message[] =>
    readDeepSeekApiMessages(responseBody)
        .map((message): Message | undefined => {
            if (!isRecord(message)) return undefined;

            const role = getDeepSeekMessageRole(message.role);
            const text = readStringProperty(message, 'content')?.trim();

            if (!role || !text) return undefined;

            return { role, text };
        })
        .filter((message): message is Message => message !== undefined);

const fetchDeepSeekTextMessages = async (): Promise<Message[]> => {
    const sessionId = getDeepSeekChatSessionId();
    const token = getDeepSeekAuthToken();
    const url = new URL('/api/v0/chat/history_messages', window.location.origin);

    url.searchParams.set('chat_session_id', sessionId);

    const response = await fetch(url, {
        credentials: 'include',
        headers: {
            Accept: '*/*',
            Authorization: `Bearer ${token}`,
            'x-client-locale': navigator.language?.toLowerCase().startsWith('zh')
                ? 'zh_CN'
                : 'en_US',
            'x-client-platform': 'web',
            'x-client-version': '1.2.0-sse-hint',
        },
    });

    if (!response.ok) {
        throw new Error(`DeepSeek history API returned ${response.status}.`);
    }

    const messages = parseDeepSeekApiMessages(await response.json());

    if (messages.length === 0) {
        throw new Error('DeepSeek history API returned no downloadable messages.');
    }

    return messages;
};

const chatSiteAdapters: Record<SupportedChatSiteId, ChatSiteAdapter> = {
    chatgpt: createChatGptAdapter(),
    deepseek: {
        name: 'DeepSeek',
        fetchTextMessages: fetchDeepSeekTextMessages,
    },
};

const getActiveChatSiteAdapter = (): ChatSiteAdapter | undefined => {
    const site = getSupportedChatSiteByHost(window.location.hostname);

    return site ? chatSiteAdapters[site.id] : undefined;
};

const downloadBlob = (blob: Blob, filename: string): void => {
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);

    link.download = filename;
    link.href = objectUrl;
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        link.remove();
    }, 60_000);
};

const downloadMarkdown = (messages: Message[], filename: string): void => {
    const content = formatMessagesAsMarkdown(messages);
    const textBlob = new Blob([content], { type: 'text/markdown' });

    downloadBlob(textBlob, filename);
};

const getImageExportDimensions = (element: HTMLElement): { width: number; height: number } => {
    const rect = element.getBoundingClientRect();
    const width = Math.ceil(
        Math.max(rect.width, element.scrollWidth, element.offsetWidth, element.clientWidth),
    );
    const height = Math.ceil(
        Math.max(rect.height, element.scrollHeight, element.offsetHeight, element.clientHeight),
    );

    return { width, height };
};

const readBackgroundColor = (element: HTMLElement): string => {
    const elementBackground = window.getComputedStyle(element).backgroundColor;

    if (elementBackground && elementBackground !== 'rgba(0, 0, 0, 0)') {
        return elementBackground;
    }

    return window.getComputedStyle(document.body).backgroundColor || '#ffffff';
};

const createImageBlob = async (element: HTMLElement): Promise<Blob | null> => {
    const { width, height } = getImageExportDimensions(element);

    if (width <= 0 || height <= 0) {
        return null;
    }

    try {
        return await toBlob(element, {
            backgroundColor: readBackgroundColor(element),
            height,
            imagePlaceholder: transparentImagePlaceholder,
            onImageErrorHandler: () => undefined,
            pixelRatio: 1,
            skipFonts: true,
            width,
        });
    } catch (error) {
        console.warn('Chat Saver: failed to export original image container.', error);
        return null;
    }
};

const downloadImage = async (chatContainer: HTMLElement, filename: string): Promise<void> => {
    const imageBlob = await createImageBlob(chatContainer);

    if (imageBlob === null) {
        throw new Error('Image export returned an empty file.');
    }

    downloadBlob(imageBlob, filename);
};

const downloadHandlers: Record<DownloadFormat, DownloadHandler> = {
    md: async (adapter, filename) => {
        const textMessages = await adapter.fetchTextMessages();

        if (textMessages.length === 0) {
            throw new Error('No messages were found for text export.');
        }

        downloadMarkdown(textMessages, filename);
    },
    png: async (adapter, filename) => {
        const chatContainer = adapter.findImageContainer?.();

        if (!chatContainer) {
            throw new Error(`Image export is not supported for ${adapter.name}.`);
        }

        await downloadImage(chatContainer, filename);
    },
};

if (globalThis.chatSaverDownloadSignature !== chatSaverDownloadSignature) {
    globalThis.chatSaverDownload = async (formats = allDownloadFormats) => {
        const adapter = getActiveChatSiteAdapter();

        if (!adapter) {
            return {
                success: false,
                errorMessage: 'This page is not supported by Chat Saver.',
            };
        }

        const downloadFormats = normalizeDownloadFormats(formats);

        if (downloadFormats.length === 0) {
            return {
                success: false,
                siteName: adapter.name,
                errorMessage: 'Select at least one download format.',
            };
        }

        const downloadBasename = createDownloadBasename(adapter);

        for (const format of downloadFormats) {
            try {
                await downloadHandlers[format](adapter, `${downloadBasename}.${format}`);
            } catch (error) {
                console.warn(`Chat Saver: failed to download ${format}.`, error);

                const errorDetail = error instanceof Error ? ` ${error.message}` : '';

                return {
                    success: false,
                    siteName: adapter.name,
                    errorMessage: `Failed to download ${format.toUpperCase()} from ${adapter.name}.${errorDetail}`,
                };
            }
        }

        return {
            success: true,
            siteName: adapter.name,
        };
    };
    globalThis.chatSaverDownloadSignature = chatSaverDownloadSignature;
}
