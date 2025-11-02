<script lang="ts">
    import { browser } from "$app/environment";
    import { SideActions } from "../shell/index.js";
    import { onMount } from "svelte";

    interface Props {
        id?: string;
        type?: string;
        metadata?: {
            listType: 'ul' | 'ol';
        };
    }

    let { 
        type = 'list', 
        metadata = { 
            listType: 'ul' 
        }, 
        id = crypto.randomUUID() 
    } : Props = $props();

    let component: HTMLElement;
    let componentEditor: HTMLElement;

    let listElement: HTMLElement;

    let listType = $state(metadata.listType);

    // extract body from the content and the card title
    let content = $derived({
        id,
        type: listType,
        metadata : {
            listType
        }
    })

    // delete element from the dom
    const deleteElement = async () => {
        if ( browser ) {
            const componentParent = component.parentElement;

            component.remove();
            componentEditor.remove();

            componentParent?.remove();
        }
    }

    const addNewListItem = (textContent: string = '') => {
        const list = listElement?.firstElementChild;
        if (!list) return;

        const element = document.createElement('li');
        element.textContent = textContent;
        element.setAttribute('contenteditable', 'true');
        list.appendChild(element);
        element.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
        try {
            const isEnter = event.key === 'Enter';
            const isBackspace = event.key === 'Backspace';

            if ( isEnter ) {
                event.preventDefault();
                addNewListItem();
            }

            if ( isBackspace ) {
                const listItem = event.target?.parentElement as HTMLElement;
                if (listItem && event?.target?.textContent?.trim() === '') {
                    const nearestSibling = listItem.previousElementSibling as HTMLElement || listItem.nextElementSibling as HTMLElement;
                    if (nearestSibling) {
                        listItem.remove();
                        const editable = nearestSibling.querySelector('[contenteditable]') as HTMLElement;
                        if (editable) {
                            editable.focus();
                        }
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }
    }

    const changeType = (newType: 'ul' | 'ol') => {
        listType = newType;
        const newListElement = document.createElement(newType);

        // Copy the children and re-apply the contenteditable attribute
        if (listElement.firstElementChild) {
            for (const child of listElement.firstElementChild.childNodes) {
                const newChild = child.cloneNode(true) as Element; // Deep clone to copy attributes
                newChild.setAttribute('contenteditable', 'true');
                newListElement.appendChild(newChild);
            }
        }

        // empty the existing list element
        listElement.innerHTML = '';

        // Replace the existing list element with the new one
        listElement.appendChild(newListElement);
    };

    let mounted = $state(false);
    onMount(() => {
        // add default list item
        const newListElement = document.createElement(type);
        listElement.appendChild(newListElement);
        addNewListItem('List Item');

        mounted = true;
    })
</script>

<div class="editor-item group relative" bind:this={component}>
    {#if mounted}
        <SideActions {component}>
            <small>Change List Type</small>
            <li>
                <button class="btn btn-sm btn-naked" onclick={() => changeType('ol')}>Ordered List</button>
            </li>
            <li>
                <button class="btn btn-sm btn-naked" onclick={() => changeType('ul')}>Unordered List</button>
            </li>
            <li>
                <button class="btn btn-sm btn-naked" onclick={() => changeType('dl')}>Detail List</button>
            </li>
        </SideActions>
    {/if}
    
    <div data-type={type} id={id} class="w-full min-w-full">
        <!-- JSON Data for this component -->
        <div class="hidden" id="metadata-{id}">
            {JSON.stringify(content)}
        </div>

        <div bind:this={listElement} onkeydown={handleKeyDown}></div>
    </div>
</div>