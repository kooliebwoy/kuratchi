<script lang="ts">
    import { BlockActions } from "../shell/index.js";
    import { tick } from "svelte";

    type ListKind = 'ul' | 'ol';

    interface Props {
        id?: string;
        type?: string;
        metadata?: {
            listType?: ListKind;
            items?: string[];
        };
        editable?: boolean;
    }

    let {
        type = 'list',
        metadata = {
            listType: 'ul',
            items: ['List item']
        },
        id = crypto.randomUUID(),
        editable = true
    }: Props = $props();

    let component = $state<HTMLElement>();
    let listContainer = $state<HTMLElement>();

    let listType = $state((metadata.listType ?? 'ul') as ListKind);
    let items = $state(Array.isArray(metadata.items) && metadata.items.length ? metadata.items : ['List item']);

    const content = $derived({
        id,
        type,
        metadata: {
            listType,
            items
        }
    });

    const ensureItem = () => {
        if (!items.length) {
            items = [''];
        }
    };

    const changeType = (newType: ListKind) => {
        listType = newType;
    };

    const addItemAfter = async (index: number) => {
        items = [...items.slice(0, index + 1), '', ...items.slice(index + 1)];
        await focusItem(index + 1);
    };

    const removeItem = async (index: number) => {
        if (items.length === 1) {
            items = [''];
            await focusItem(0);
            return;
        }

        items = [...items.slice(0, index), ...items.slice(index + 1)];
        await focusItem(Math.max(index - 1, 0));
    };

    const handleInput = (index: number, event: Event) => {
        const target = event.currentTarget as HTMLElement | null;
        if (!target) return;
        items = items.map((item, i) => (i === index ? target.textContent ?? '' : item));
    };

    const handleKeyDown = async (index: number, event: KeyboardEvent) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await addItemAfter(index);
            return;
        }

        if (event.key === 'Backspace') {
            const target = event.currentTarget as HTMLElement | null;
            const value = target?.textContent?.trim() ?? '';
            if (!value) {
                event.preventDefault();
                await removeItem(index);
            }
        }
    };

    const focusItem = async (index: number) => {
        await tick();
        const elements = listContainer?.querySelectorAll<HTMLElement>('[data-list-item]');
        const element = elements?.[index];
        element?.focus();
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.select();
        }
    };

    ensureItem();
</script>

{#if editable}
    <div class="editor-item group relative" bind:this={component}>
        <BlockActions {component}>
            <small>Change List Type</small>
            <li>
                <button class="btn btn-sm btn-naked" onclick={() => changeType('ol')}>Ordered List</button>
            </li>
            <li>
                <button class="btn btn-sm btn-naked" onclick={() => changeType('ul')}>Unordered List</button>
            </li>
        </BlockActions>

        <div data-type={type} id={id} class="w-full min-w-full">
            <div class="hidden" id="metadata-{id}">
                {JSON.stringify(content)}
            </div>

            <svelte:element this={listType} class="space-y-2 prose-ul:list-disc prose-ol:list-decimal" bind:this={listContainer}>
                {#each items as item, index}
                    <li
                        class="outline-none"
                        contenteditable
                        data-list-item
                        oninput={(event) => handleInput(index, event)}
                        onkeydown={(event) => handleKeyDown(index, event)}
                    >
                        {item}
                    </li>
                {/each}
            </svelte:element>
        </div>
    </div>
{:else}
    <div data-type={type} id={id} class="w-full min-w-full">
        <svelte:element this={listType} class="list-inside">
            {#each items as item}
                <li>{item}</li>
            {/each}
        </svelte:element>
    </div>
{/if}