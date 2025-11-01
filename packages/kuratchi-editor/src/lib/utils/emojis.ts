    export const emojiMap = {
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

    function escapeRegExp(string) { 
        return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); 
    }

    function replaceEmojis(text) {
        const regex = new RegExp(Object.keys(emojiMap).map(escapeRegExp).join('|'), 'g');
        return text.replace(regex, match => emojiMap[match] || match);
    }

    export function handleEmojis(event) {
        const element = event.target;
        let caretPos = getCaretPosition(element);

        element.innerHTML = replaceEmojis(element.innerHTML);

        setCaretPosition(element, caretPos);
    }

    function getCaretPosition(element) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return 0;
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        return preCaretRange.toString().length;
    }

    function setCaretPosition(element, pos) {
        for (let node of element.childNodes) {
            if (node.nodeType === 3) { // Text node
                if (node.length >= pos) {
                    const range = document.createRange(),
                        sel = window.getSelection();
                    range.setStart(node, pos);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    return -1; // Break the loop
                } else {
                    pos -= node.length;
                }
            } else {
                pos = setCaretPosition(node, pos);
                if (pos === -1) {
                    return -1; // Break the loop
                }
            }
        }
        return pos;
    }
