import { toBlob } from 'html-to-image';

interface Item {
    question: string;
    answer: string;
}

if (globalThis.chatSaverDownload === undefined) {
    globalThis.chatSaverDownload = async () => {
        const chatContainer = document.querySelector<HTMLElement>(
            'main > div:not(.absolute) > div > div > div',
        );

        if (!chatContainer) return;

        const imageBlob = await toBlob(chatContainer);
        if (imageBlob !== null) {
            const imageLink = document.createElement('a');
            imageLink.download = 'chat.png';
            imageLink.href = URL.createObjectURL(imageBlob);
            imageLink.click();
        }

        const chats: Item[] = [];
        for (let i = 0; i < chatContainer.children.length - 1; i += 2) {
            const chat = chatContainer.children.item(i);
            const chatNext = chatContainer.children.item(i + 1);
            if (!chat || !chatNext) continue;

            chats.push({
                question: chat.textContent ?? '',
                answer: chatNext.textContent ?? '',
            });
        }

        const content = chats
            .map((item) => `Q:\n${item.question}\n\nA:\n${item.answer}\n------------------------\n`)
            .join('\n');
        const textBlob = new Blob([content], { type: 'text/plain' });
        const textLink = document.createElement('a');
        textLink.download = 'chat.txt';
        textLink.href = URL.createObjectURL(textBlob);
        textLink.click();
    };
}

void globalThis.chatSaverDownload();
