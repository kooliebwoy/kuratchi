export const emojiMap: Record<string, string> = {
    ':)': '🙂',
        ':D': '😃',
        ':d': '😃',
        ';)': '😉',
        ';-)': '😉',
        ':P': '😜',
        ':p': '😜',
        ':(': '☹️',
        ':|': '😐',
        ':O': '😮',
        ':o': '😮',
        ':/': '😕',
        ':\\': '😕',
        ':|)': '😐',
        ':*)': '😘',
        '<3': '❤️',
        ':*': '😘',
        ':^)': '😊',
        ':-)': '😊',
        ':-D': '😃',
        ':-P': '😜',
        ':-(': '☹️',
        ':-|': '😐',
        ':-O': '😮',
        ':-o': '😮',
        ':-/': '😕',
        ':-\\': '😕',
        'B-)': '😎',
        ':-B': '😎',
        '8-)': '😎',
        '8-(': '😒',
        ':|(': '😒',
        ':-*': '😘',
        ':-x': '😘',
        ':-X': '😘',
        ':x': '😘',
        ':X': '😘',
        ':#': '😳',
        ':$': '😳',
        ':S': '😳',
        ':s': '😳',
        ':|S': '😳',
        ':|s': '😳',
        ':&': '😠',
        ':*(': '😠',
        ':^(': '😠',
        ':-&': '😠',
        ':-*(': '😠',
        ':-*)': '😘',
        ':-^(': '😠',
        ':-^)': '😊'
};

function escapeRegExp(value: string): string { 
    return value.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); 
}

function replaceEmojis(text: string): string {
    const regex = new RegExp(Object.keys(emojiMap).map(escapeRegExp).join('|'), 'g');
    return text.replace(regex, (match) => emojiMap[match as keyof typeof emojiMap] ?? match);
}

export function handleEmojis(event: Event) {
    if (!(event.target instanceof HTMLElement)) return;
    const element = event.target;
    const caretPos = getCaretPosition(element);

    element.innerHTML = replaceEmojis(element.innerHTML);

    setCaretPosition(element, caretPos);
}

function getCaretPosition(element: HTMLElement): number {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return 0;
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
}

function setCaretPosition(element: Node, pos: number): number {
    for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            const textLength = node.textContent?.length ?? 0;
            if (textLength >= pos) {
                const range = document.createRange();
                const selection = window.getSelection();
                range.setStart(node, pos);
                range.collapse(true);
                if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
                return -1; // Break the loop
            }
            pos -= textLength;
        } else {
            pos = setCaretPosition(node, pos);
            if (pos === -1) {
                return -1; // Break the loop
            }
        }
    }
    return pos;
}
