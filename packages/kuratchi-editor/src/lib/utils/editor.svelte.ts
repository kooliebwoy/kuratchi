import { browser } from "$app/environment";
import { mount, onMount } from "svelte";

const wrapSelection = (tag: string, attributes: Record<string, string> = {}) => {
    if (!browser) return;
    
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });

    try {
        range.surroundContents(element);
        // Dispatch input event to trigger Svelte bindings
        const event = new Event('input', { bubbles: true });
        element.dispatchEvent(event);
    } catch (e) {
        console.error(`Error wrapping with ${tag}:`, e);
    }
};

const unwrapTag = (node: Node, tagName: string) => {
    let parent = node.parentNode;
    while (parent) {
        if (parent.nodeName === tagName.toUpperCase()) {
            const textContent = parent.textContent;
            const textNode = document.createTextNode(textContent);
            parent.parentNode.replaceChild(textNode, parent);
            // Dispatch input event to trigger Svelte bindings
            const event = new Event('input', { bubbles: true });
            textNode.parentElement?.dispatchEvent(event);
            break;
        }
        parent = parent.parentNode;
    }
};

const isWrappedWith = (node: Node, tagName: string): boolean => {
    let parent = node.parentNode;
    while (parent) {
        if (parent.nodeName === tagName.toUpperCase()) return true;
        parent = parent.parentNode;
    }
    return false;
};

export const makeBold = (component: HTMLElement, selectedText: string) => {
    if (!browser || !selectedText) return;
    
    const content = component.querySelector('[contenteditable]');
    if (!content) return;

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (isWrappedWith(range.startContainer, 'B')) {
        unwrapTag(range.startContainer, 'B');
    } else {
        wrapSelection('b');
    }
};

export const makeItalic = (component: HTMLElement, selectedText: string) => {
    if (!browser || !selectedText) return;
    
    const content = component.querySelector('[contenteditable]');
    if (!content) return;

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (isWrappedWith(range.startContainer, 'I')) {
        unwrapTag(range.startContainer, 'I');
    } else {
        wrapSelection('i');
    }
};

export const makeUnderline = (component: HTMLElement, selectedText: string) => {
    if (!browser || !selectedText) return;
    
    const content = component.querySelector('[contenteditable]');
    if (!content) return;

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (isWrappedWith(range.startContainer, 'U')) {
        unwrapTag(range.startContainer, 'U');
    } else {
        wrapSelection('u');
    }
};

export const makeColor = (component: HTMLElement, selectedText: string) => {
    if (!browser || !selectedText) return;
    
    const content = component.querySelector('[contenteditable]');
    if (!content) return;

    const color = window.prompt('Enter color (e.g. #ff0000 or red):', '#000000');
    if (!color) return;

    wrapSelection('span', { style: `color: ${color}` });
};

export const makeLink = (component: HTMLElement, selectedText: string) => {
    if (!browser || !selectedText) return;
    
    const content = component.querySelector('[contenteditable]');
    if (!content) return;

    const url = window.prompt('Enter URL:', 'https://');
    if (!url) return;

    wrapSelection('a', { 
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
        style: 'color: #0077cc; text-decoration: underline; cursor: pointer;'
    });
};

export const makeCode = (component: HTMLElement, selectedText: string) => {
    if (!browser || !selectedText) return;
    
    const content = component.querySelector('[contenteditable]');
    if (!content) return;

    wrapSelection('code');
};

export const codeBlock = (component: HTMLElement, selectedText: string) => {
    if (!browser || !selectedText) return;
    
    const content = component.querySelector('[contenteditable]');
    if (!content) return;

    wrapSelection('pre');
};

export const makeHighlight = (component: HTMLElement, selectedText: string) => {
    if (!browser || !selectedText) return;
    
    const content = component.querySelector('[contenteditable]');
    if (!content) return;

    wrapSelection('mark');
};

export const makeStrikethrough = (component: HTMLElement, selectedText: string) => {
    if (!browser || !selectedText) return;
    
    const content = component.querySelector('[contenteditable]');
    if (!content) return;

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (isWrappedWith(range.startContainer, 'S')) {
        unwrapTag(range.startContainer, 'S');
    } else {
        wrapSelection('s');
    }
};

export const deleteElement = (component: HTMLElement) => {
    component?.remove();
};

// delete all elements from the editor
export const clearEditor = (editor: HTMLElement) => {
    editor.innerHTML = '';
}

export const addComponentToEditor = (editor: HTMLElement, component: any) => {
    // add component to the editor div
    if (browser) {
        mount(component, {
            target: editor
        });
    }
}

// configure blocks
export const saveEditorBlocks = async (editor: HTMLElement) => {
    // update approach to get all elements and then configure them to be saved
    let blocks = [];

    const elements = editor.querySelectorAll('.editor-item');

    // Loop through all elements and get the JSON data
    for (const element of elements) {
        const jsonDataElement = element.querySelector('[id^="metadata-"]');

        if (jsonDataElement) {
            try {
                console.log(jsonDataElement.textContent);
                const dataToSaveToDB = jsonDataElement.textContent ? JSON.parse(jsonDataElement.textContent) : null;
                blocks.push(dataToSaveToDB);
            } catch (error) {
                console.error('Error parsing JSON data:', error);
            }
        }
    }

    return blocks;
}

export const saveEditorHeaderBlocks = async (editorHeader: HTMLElement) => {
    if (!editorHeader) return [];

    // Get the header component instance
    const headerComponent = editorHeader.querySelector('.editor-header-item');
    if (!headerComponent) return [];

    const jsonDataElement = headerComponent.querySelector('[id^="metadata-"]');

    if (jsonDataElement) {
        try {
            const dataToSaveToDB = jsonDataElement.textContent ? JSON.parse(jsonDataElement.textContent) : null;
            return dataToSaveToDB;
        } catch (error) {
            console.error('Error parsing JSON data:', error);
        }
    }
};

export const saveEditorFooterBlocks = async (editorFooter: HTMLElement) => {
    if (!editorFooter) return [];

    // Get the footer component instance
    const footerComponent = editorFooter.querySelector('.editor-footer-item');
    if (!footerComponent) return [];

    const jsonDataElement = footerComponent.querySelector('[id^="metadata-"]');

    if (jsonDataElement) {
        try {
            const dataToSaveToDB = jsonDataElement.textContent ? JSON.parse(jsonDataElement.textContent) : null;
            return dataToSaveToDB;
        } catch (error) {
            console.error('Error parsing JSON data:', error);
        }
    }
};

// Form Validation Classes
export const validation = "peer invalid:[:not(:focus)]:border-red-500"; // used for form validation
export const validationMessage = "mt-2 hidden text-xs text-red-500 peer-[:not(:focus):invalid]:block";
export const validateFormBeforeSubmit = "group-invalid:pointer-events-none group-invalid:opacity-30";

export interface SelectionState {
    showToolbar: boolean;
    position: { x: number; y: number };
}

// Keep track of active listeners to prevent duplicates
const activeListeners = new WeakMap<HTMLElement, () => void>();

export function setupSelectionListener(component: HTMLElement | undefined, state: SelectionState) {
    if (!component) return () => {};

    // Remove existing listener if there is one
    const existingListener = activeListeners.get(component);
    if (existingListener) {
        document.removeEventListener('selectionchange', existingListener);
        activeListeners.delete(component);
    }

    const listener = () => handleSelectionChange(component, state);
    document.addEventListener('selectionchange', listener);
    activeListeners.set(component, listener);

    return () => {
        document.removeEventListener('selectionchange', listener);
        activeListeners.delete(component);
    };
}

export function handleSelectionChange(component: HTMLElement | undefined, state: SelectionState) {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !component) {
        state.showToolbar = false;
        return;
    }

    // Check if the selection is within this component
    let node = selection.anchorNode;
    let isWithinComponent = false;
    while (node) {
        if (node === component) {
            isWithinComponent = true;
            break;
        }
        node = node.parentNode;
    }

    if (!isWithinComponent) {
        state.showToolbar = false;
        return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
        state.showToolbar = false;
        return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Use viewport coordinates for fixed positioning
    state.position = {
        x: rect.left + (rect.width / 2),
        y: rect.top
    };
    
    state.showToolbar = true;
}

/**
 * Sanitizes HTML content from contenteditable to prevent XSS and ensure consistent formatting
 * @param content The HTML content to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeContent(content: string): string {
    onMount(() => {
        // Create a temporary div to parse HTML
        const div = document.createElement('div');
        div.innerHTML = content;

        // List of allowed tags and their allowed attributes
        const allowedTags = {
            'p': ['style'],
            'b': [],
            'strong': [],
            'i': [],
            'em': [],
            'u': [],
            'a': ['href', 'target'],
            'span': ['style'],
            'br': []
        };

        // Recursive function to clean nodes
        function cleanNode(node: Node): Node | null {
            if (node.nodeType === Node.TEXT_NODE) {
                return node;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                const tagName = element.tagName.toLowerCase();

                // If tag is not allowed, just keep its text content
                if (!allowedTags[tagName]) {
                    return document.createTextNode(element.textContent || '');
                }

                // Create new element of allowed type
                const newElement = document.createElement(tagName);

                // Copy allowed attributes
                const allowedAttrs = allowedTags[tagName];
                for (const attr of allowedAttrs) {
                    const value = element.getAttribute(attr);
                    if (value) {
                        // For style attributes, only allow color and text-decoration
                        if (attr === 'style') {
                            const cleanStyle = value
                                .split(';')
                                .filter(style => {
                                    const prop = style.split(':')[0]?.trim().toLowerCase();
                                    return prop === 'color' || prop === 'text-decoration';
                                })
                                .join(';');
                            if (cleanStyle) {
                                newElement.setAttribute(attr, cleanStyle);
                            }
                        } else {
                            newElement.setAttribute(attr, value);
                        }
                    }
                }

                // Clean all child nodes
                for (const child of Array.from(element.childNodes)) {
                    const cleanedChild = cleanNode(child);
                    if (cleanedChild) {
                        newElement.appendChild(cleanedChild);
                    }
                }

                return newElement;
            }

            return null;
        }

        // Clean the entire tree
        const cleanedNodes = Array.from(div.childNodes).map(node => cleanNode(node));
        div.innerHTML = '';
        cleanedNodes.forEach(node => {
            if (node) div.appendChild(node);
        });

        // Normalize whitespace and return
        return div.innerHTML.replace(/\s+/g, ' ').trim();
    });
}