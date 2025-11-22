import { browser } from "$app/environment";
import { mount, onMount } from "svelte";
import type { SiteRegionState } from "../types.js";

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

export const addComponentToEditor = (editor: HTMLElement, component: any, props?: Record<string, unknown>) => {
    // add component to the editor div
    if (browser) {
        mount(component, {
            target: editor,
            props
        });
    }
}

// configure blocks
const collectSerializedBlocks = (root: HTMLElement | null | undefined, selector: string) => {
    if (!root) return [];
    const results: Array<Record<string, unknown>> = [];
    const elements = root.querySelectorAll(selector);
    for (const element of elements) {
        const jsonDataElement = element.querySelector('[id^="metadata-"]');
        if (!jsonDataElement?.textContent) continue;
        try {
            const dataToSaveToDB = JSON.parse(jsonDataElement.textContent);
            results.push(dataToSaveToDB);
        } catch (error) {
            console.error('Error parsing JSON data:', error);
        }
    }
    return results;
};

export const saveEditorBlocks = async (editor: HTMLElement) => {
    return collectSerializedBlocks(editor, '.editor-item');
};

export const saveEditorHeaderBlocks = async (editorHeader: HTMLElement) => {
    return collectSerializedBlocks(editorHeader, '.editor-header-item');
};

export const saveEditorFooterBlocks = async (editorFooter: HTMLElement) => {
    return collectSerializedBlocks(editorFooter, '.editor-footer-item');
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

/**
 * Generates a unique key for a block in the editor
 * @param block The block data object
 * @param index The index of the block in the array
 * @returns A unique string key for the block
 */
export const generateBlockKey = (block: Record<string, unknown>, index: number): string => {
    if (typeof block.id === 'string' && block.id.length > 0) return block.id;
    if (typeof block.type === 'string' && block.type.length > 0) return `${block.type}-${index}`;
    return `block-${index}`;
};

/**
 * Configuration options for region data updates
 */
export interface RegionUpdateOptions {
    /** The HTML element containing the region */
    element: HTMLElement | undefined;
    /** Function to save blocks from the element */
    saveFunction: (el: HTMLElement) => Promise<Array<Record<string, unknown>>>;
    /** Current state of the region */
    currentState: SiteRegionState | null;
    /** Callback fired when region data changes */
    onChange: (state: SiteRegionState) => void;
}

/**
 * Updates region data (header/footer) by comparing current state with saved blocks
 * @param options Configuration options for the update
 */
export const updateRegionData = async (options: RegionUpdateOptions): Promise<void> => {
    const { element, saveFunction, currentState, onChange } = options;
    
    if (!element) return;
    const blocks = await saveFunction(element);
    if (!blocks) return;
    
    if (JSON.stringify(blocks) !== JSON.stringify(currentState?.blocks)) {
        const next: SiteRegionState = { blocks: blocks as any };
        onChange(next);
    }
};

/**
 * Configuration options for MutationObserver setup
 */
export interface EditorObserverOptions {
    /** The element to observe for changes */
    element: HTMLElement | undefined | null;
    /** Callback fired when mutations are detected */
    onUpdate: () => void;
    /** Debounce delay in milliseconds (default: 1500) */
    debounceMs?: number;
    /** Whether to observe attribute changes (default: false) */
    observeAttributes?: boolean;
}

/**
 * Sets up a MutationObserver with debounced updates
 * @param options Configuration options
 * @returns Cleanup function to disconnect the observer
 */
export const setupEditorObserver = (options: EditorObserverOptions): (() => void) => {
    const { element, onUpdate, debounceMs = 1500, observeAttributes = false } = options;
    
    if (!element) return () => {};
    
    let updateTimeout: ReturnType<typeof setTimeout>;
    
    const observer = new MutationObserver(() => {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(onUpdate, debounceMs);
    });
    
    const observerConfig: MutationObserverInit = {
        childList: true,
        subtree: true,
        characterData: true
    };
    
    if (observeAttributes) {
        observerConfig.attributes = true;
    }
    
    observer.observe(element, observerConfig);
    
    return () => {
        clearTimeout(updateTimeout);
        observer.disconnect();
    };
};

/**
 * Determines the element after which a dragged element should be inserted
 * @param container The container element holding draggable blocks
 * @param clientY The Y coordinate of the drag event
 * @returns The element after which to insert, or null to append to end
 */
export const getDragAfterElement = (container: HTMLElement, clientY: number): HTMLElement | null => {
    const draggableElements = Array.from(
        container.querySelectorAll<HTMLElement>('.editor-block:not(.dragging)')
    );

    const result = draggableElements.reduce(
        (closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = clientY - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            }

            return closest;
        },
        { offset: Number.NEGATIVE_INFINITY, element: null as HTMLElement | null }
    );

    return result.element;
};

/**
 * Configuration options for drag and drop setup
 */
export interface DragAndDropOptions {
    /** The editor container element */
    editor: HTMLElement;
    /** Callback fired when blocks are reordered */
    onReorder?: () => void;
}

/**
 * Sets up drag and drop functionality for editor blocks
 * @param options Configuration options
 * @returns Cleanup function to remove event listeners
 */
export const setupEditorDragAndDrop = (options: DragAndDropOptions): (() => void) => {
    const { editor, onReorder } = options;

    if (!browser || !(editor instanceof HTMLElement)) {
        return () => {};
    }

    let draggedElement: HTMLElement | null = null;
    const dropIndicator = document.createElement('div');
    dropIndicator.className = 'editor-drop-indicator';
    dropIndicator.setAttribute('aria-hidden', 'true');

    const resetDragging = () => {
        draggedElement?.classList.remove('dragging');
        draggedElement = null;
        dropIndicator.remove();
        editor.classList.remove('is-reordering');
    };

    const handleDragStart = (event: DragEvent) => {
        const target = event.target as HTMLElement | null;
        const handle = target?.closest('.drag-handle, .handle');
        if (!handle) return;
        const block = handle.closest<HTMLElement>('.editor-block');
        if (!block) return;

        draggedElement = block;
        block.classList.add('dragging');
        editor.classList.add('is-reordering');
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            const dragOffsetX = block.clientWidth / 2;
            const dragOffsetY = Math.min(event.offsetY ?? block.clientHeight / 2, block.clientHeight / 2);
            event.dataTransfer.setDragImage(block, dragOffsetX, dragOffsetY);
            event.dataTransfer.setData('text/plain', block.id ?? 'block');
        }
    };

    const handleDragOver = (event: DragEvent) => {
        if (!draggedElement) return;
        event.preventDefault();
        const afterElement = getDragAfterElement(editor, event.clientY);
        if (!afterElement) {
            editor.appendChild(dropIndicator);
            editor.appendChild(draggedElement);
            return;
        }

        editor.insertBefore(dropIndicator, afterElement);
        if (afterElement !== draggedElement) {
            editor.insertBefore(draggedElement, afterElement);
        }
    };

    const handleDrop = (event: DragEvent) => {
        if (!draggedElement) return;
        event.preventDefault();
        resetDragging();
        onReorder?.();
    };

    const handleDragEnd = () => resetDragging();

    editor.addEventListener('dragstart', handleDragStart);
    editor.addEventListener('dragover', handleDragOver);
    editor.addEventListener('drop', handleDrop);
    editor.addEventListener('dragend', handleDragEnd);

    return () => {
        editor.removeEventListener('dragstart', handleDragStart);
        editor.removeEventListener('dragover', handleDragOver);
        editor.removeEventListener('drop', handleDrop);
        editor.removeEventListener('dragend', handleDragEnd);
        dropIndicator.remove();
    };
}
