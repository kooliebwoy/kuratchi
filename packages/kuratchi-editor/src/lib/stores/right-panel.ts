import { writable } from 'svelte/store';
import type { Snippet } from 'svelte';

export interface RightPanelState {
    open: boolean;
    title?: string;
    content?: Snippet | null;
}

const initialState: RightPanelState = {
    open: false,
    title: undefined,
    content: null
};

const createRightPanelStore = () => {
    const { subscribe, set, update } = writable<RightPanelState>(initialState);

    function openRightPanel(content: Snippet, title?: string) {
        set({ open: true, title, content });
    }

    function closeRightPanel() {
        set(initialState);
    }

    function toggleRightPanel(content?: Snippet, title?: string) {
        update((state) => {
            if (state.open) {
                return initialState;
            }

            if (!content) {
                return state;
            }

            return { open: true, title, content };
        });
    }

    return {
        subscribe,
        openRightPanel,
        closeRightPanel,
        toggleRightPanel
    };
};

export const rightPanel = createRightPanelStore();
export const openRightPanel = rightPanel.openRightPanel;
export const closeRightPanel = rightPanel.closeRightPanel;
export const toggleRightPanel = rightPanel.toggleRightPanel;
