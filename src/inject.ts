interface Item {
    question: string;
    answer: string;
};

if (globalThis.chatSaverDownload === undefined) {
    globalThis.chatSaverDownload = async () => {
        const chats: Item[] = [];
        const $chats: Element | null = document.querySelector('main > div:first-child > div > div > div');
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

        const fileHandle = await window.showSaveFilePicker({
            types: [
                {
                    description: 'ChatGPT',
                    accept: {
                        'text/plain': ['.txt']
                    }
                }
            ]
        });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    };
}

globalThis.chatSaverDownload();
