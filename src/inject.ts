import { toBlob } from 'html-to-image';

interface Item {
    question: string;
    answer: string;
};

if (globalThis.chatSaverDownload === undefined) {
    globalThis.chatSaverDownload = async () => {
        const $chats: HTMLElement | null = document.querySelector('main > div:first-child > div > div > div');
        const imageBlob: Blob | null = await toBlob($chats!)
        if (imageBlob !== null) {
            const imageLink: HTMLAnchorElement = document.createElement('a');
            imageLink.download = 'chat.png';
            imageLink.href = URL.createObjectURL(imageBlob);
            imageLink.click();
        }

        const chats: Item[] = [];
        if ($chats) {
            for (let i = 0; i < $chats.children.length; i += 2) {
                if (i !== $chats.children.length - 1) {
                    const $chat: Element = $chats.children[i];
                    const $chatNext: Element = $chats.children[i + 1];
                    const chat: Item = {
                        question: $chat.textContent!,
                        answer: $chatNext.textContent!,
                    };
                    chats.push(chat);
                }
            }
        }

        let content: string = '';
        for (let i = 0; i < chats.length; i++) {
            const item = chats[i];
            content += 'Q:\n' + item.question + '\n\n';
            content += 'A:\n' + item.answer + '\n';
            content += '------------------------\n';

            if (i !== chats.length - 1) {
                content += '\n';
            }
        }

        const textBlob: Blob = new Blob([content], { type: 'text/plain' });
        const textLink: HTMLAnchorElement = document.createElement('a');
        textLink.download = 'chat.txt';
        textLink.href = URL.createObjectURL(textBlob);
        textLink.click();
    };
}

globalThis.chatSaverDownload();
