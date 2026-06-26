import { toBlob } from 'html-to-image';

type MessageRole = 'user' | 'assistant';

interface Message {
    role: MessageRole;
    text: string;
    element: HTMLElement;
}

const transparentImagePlaceholder =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
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

const readText = (element: HTMLElement): string =>
    (element.innerText || element.textContent || '')
        .replaceAll('\u00A0', ' ')
        .replaceAll(/[ \t]+\n/g, '\n')
        .replaceAll(/\n{3,}/g, '\n\n')
        .trim();

const getMessageTextElement = (element: HTMLElement, role: MessageRole): HTMLElement => {
    const roleElement = element.querySelector<HTMLElement>(
        `[data-message-author-role="${role}"], [data-role="${role}"], [data-testid="${role}-message"]`,
    );

    if (role === 'assistant') {
        return element.querySelector<HTMLElement>('.markdown') ?? roleElement ?? element;
    }

    return roleElement ?? element;
};

const isInsideAnotherElement = (element: HTMLElement, elements: HTMLElement[]): boolean =>
    elements.some((otherElement) => otherElement !== element && otherElement.contains(element));

const isWrappingAnotherElement = (element: HTMLElement, elements: HTMLElement[]): boolean =>
    elements.some((otherElement) => otherElement !== element && element.contains(otherElement));

const findTurnMessages = (root: ParentNode): Message[] => {
    const turns = Array.from(root.querySelectorAll<HTMLElement>(conversationTurnSelector)).filter(
        (element, _index, elements) => !isInsideAnotherElement(element, elements),
    );

    return turns
        .map((turn): Message | undefined => {
            const roleElement = turn.querySelector<HTMLElement>(roleSelector);
            const role = readRole(turn) ?? (roleElement ? readRole(roleElement) : undefined);
            if (!role) return undefined;

            const textElement = getMessageTextElement(turn, role);
            const text = readText(textElement);
            if (!text) return undefined;

            return { role, text, element: turn };
        })
        .filter((message): message is Message => message !== undefined);
};

const findRoleMessages = (root: ParentNode): Message[] => {
    const roleElements = Array.from(root.querySelectorAll<HTMLElement>(roleSelector)).filter(
        (element, _index, elements) => !isWrappingAnotherElement(element, elements),
    );

    return roleElements
        .map((element): Message | undefined => {
            const role = readRole(element);
            if (!role) return undefined;

            const text = readText(getMessageTextElement(element, role));
            if (!text) return undefined;

            return { role, text, element };
        })
        .filter((message): message is Message => message !== undefined);
};

const findMessages = (): Message[] => {
    const root = document.querySelector<HTMLElement>('main') ?? document.body;
    const turnMessages = findTurnMessages(root);

    return turnMessages.length > 0 ? turnMessages : findRoleMessages(root);
};

const findCommonAncestor = (elements: HTMLElement[]): HTMLElement | null => {
    const [firstElement] = elements;
    if (!firstElement) return null;

    let ancestor = firstElement.parentElement;
    while (ancestor && !elements.every((element) => ancestor?.contains(element))) {
        ancestor = ancestor.parentElement;
    }

    return ancestor;
};

const findChatContainer = (messages: Message[]): HTMLElement | null => {
    const messageElements = messages.map(({ element }) => element);
    const legacyContainer = document.querySelector<HTMLElement>(legacyChatContainerSelector);

    if (legacyContainer && messageElements.every((element) => legacyContainer.contains(element))) {
        return legacyContainer;
    }

    return (
        findCommonAncestor(messageElements) ??
        document.querySelector<HTMLElement>('main') ??
        document.body
    );
};

const formatMessages = (messages: Message[]): string =>
    messages
        .map(
            ({ role, text }) =>
                `${role === 'user' ? 'Q' : 'A'}:\n${text}\n------------------------\n`,
        )
        .join('\n');

const downloadBlob = (blob: Blob, filename: string): void => {
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);

    link.download = filename;
    link.href = objectUrl;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

const downloadText = (messages: Message[]): void => {
    const content = formatMessages(messages);
    const textBlob = new Blob([content], { type: 'text/plain' });

    downloadBlob(textBlob, 'chat.txt');
};

const downloadImage = async (chatContainer: HTMLElement): Promise<void> => {
    try {
        const imageBlob = await toBlob(chatContainer, {
            imagePlaceholder: transparentImagePlaceholder,
            onImageErrorHandler: () => undefined,
        });

        if (imageBlob !== null) {
            downloadBlob(imageBlob, 'chat.png');
        }
    } catch (error) {
        console.warn('Chat Saver: failed to export conversation image.', error);
    }
};

if (globalThis.chatSaverDownload === undefined) {
    globalThis.chatSaverDownload = async () => {
        const messages = findMessages();

        if (messages.length === 0) {
            console.warn('Chat Saver: no ChatGPT messages found.');
            return;
        }

        downloadText(messages);

        const chatContainer = findChatContainer(messages);

        if (chatContainer) {
            await downloadImage(chatContainer);
        }
    };
}

void globalThis.chatSaverDownload();
