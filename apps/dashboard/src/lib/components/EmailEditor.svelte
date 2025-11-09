<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import { StarterKit } from '@tiptap/starter-kit';
  import Link from '@tiptap/extension-link';
  import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Heading2,
    Link as LinkIcon,
    Code,
    Undo2,
    Redo2
  } from 'lucide-svelte';

  interface Props {
    content?: string;
    onChange?: (html: string) => void;
  }

  let { content = '', onChange }: Props = $props();

  let element: HTMLDivElement | undefined = $state();
  let editor: Editor | undefined = $state();
  let editorState = $state({ editor: undefined as Editor | undefined });

  onMount(() => {
    if (!element) return;

    editor = new Editor({
      element: element,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3]
          }
        }),
        Link.configure({
          openOnClick: false,
          autolink: true
        })
      ],
      content: content || '<p>Start typing your email content...</p>',
      onTransaction: ({ editor: ed }) => {
        editorState = { editor: ed };
        onChange?.(ed.getHTML());
      }
    });

    editorState = { editor };
  });

  onDestroy(() => {
    editor?.destroy();
  });

  function toggleBold() {
    editor?.chain().focus().toggleBold().run();
  }

  function toggleItalic() {
    editor?.chain().focus().toggleItalic().run();
  }

  function toggleCode() {
    editor?.chain().focus().toggleCode().run();
  }

  function toggleBulletList() {
    editor?.chain().focus().toggleBulletList().run();
  }

  function toggleOrderedList() {
    editor?.chain().focus().toggleOrderedList().run();
  }

  function toggleHeading2() {
    editor?.chain().focus().toggleHeading({ level: 2 }).run();
  }

  function toggleLink() {
    const url = prompt('Enter URL:');
    if (url) {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }

  function undo() {
    editor?.chain().focus().undo().run();
  }

  function redo() {
    editor?.chain().focus().redo().run();
  }

  function isActive(name: string, attrs?: any) {
    return editorState.editor?.isActive(name, attrs) ?? false;
  }
</script>

<div class="border border-base-200 rounded-lg overflow-hidden bg-base-100">
  <!-- Toolbar -->
  {#if editorState.editor}
    <div class="bg-base-200/50 border-b border-base-200 p-2 flex flex-wrap gap-1">
      <button
        type="button"
        class="btn btn-ghost btn-xs {isActive('bold') ? 'btn-active' : ''}"
        onclick={toggleBold}
        title="Bold (Ctrl+B)"
      >
        <Bold class="h-4 w-4" />
      </button>

      <button
        type="button"
        class="btn btn-ghost btn-xs {isActive('italic') ? 'btn-active' : ''}"
        onclick={toggleItalic}
        title="Italic (Ctrl+I)"
      >
        <Italic class="h-4 w-4" />
      </button>

      <button
        type="button"
        class="btn btn-ghost btn-xs {isActive('code') ? 'btn-active' : ''}"
        onclick={toggleCode}
        title="Code"
      >
        <Code class="h-4 w-4" />
      </button>

      <div class="divider divider-horizontal my-0 mx-1 h-6"></div>

      <button
        type="button"
        class="btn btn-ghost btn-xs {isActive('heading', { level: 2 }) ? 'btn-active' : ''}"
        onclick={toggleHeading2}
        title="Heading 2"
      >
        <Heading2 class="h-4 w-4" />
      </button>

      <button
        type="button"
        class="btn btn-ghost btn-xs {isActive('bulletList') ? 'btn-active' : ''}"
        onclick={toggleBulletList}
        title="Bullet List"
      >
        <List class="h-4 w-4" />
      </button>

      <button
        type="button"
        class="btn btn-ghost btn-xs {isActive('orderedList') ? 'btn-active' : ''}"
        onclick={toggleOrderedList}
        title="Ordered List"
      >
        <ListOrdered class="h-4 w-4" />
      </button>

      <button
        type="button"
        class="btn btn-ghost btn-xs {isActive('link') ? 'btn-active' : ''}"
        onclick={toggleLink}
        title="Add Link"
      >
        <LinkIcon class="h-4 w-4" />
      </button>

      <div class="divider divider-horizontal my-0 mx-1 h-6"></div>

      <button
        type="button"
        class="btn btn-ghost btn-xs"
        onclick={undo}
        title="Undo"
      >
        <Undo2 class="h-4 w-4" />
      </button>

      <button
        type="button"
        class="btn btn-ghost btn-xs"
        onclick={redo}
        title="Redo"
      >
        <Redo2 class="h-4 w-4" />
      </button>
    </div>
  {/if}

  <!-- Editor -->
  <div class="prose prose-sm max-w-none p-4 min-h-48 focus:outline-none" bind:this={element}></div>
</div>

<style>
  :global(.ProseMirror) {
    outline: none;
    min-height: 200px;
  }

  :global(.ProseMirror p.is-editor-empty:first-child::before) {
    color: #adb5bd;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  :global(.ProseMirror h2) {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0.75rem 0;
  }

  :global(.ProseMirror ul) {
    list-style-type: disc;
    padding-left: 1.5rem;
  }

  :global(.ProseMirror ol) {
    list-style-type: decimal;
    padding-left: 1.5rem;
  }

  :global(.ProseMirror code) {
    background-color: #f3f4f6;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: monospace;
  }

  :global(.ProseMirror pre) {
    background-color: #1f2937;
    color: #f3f4f6;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
  }

  :global(.ProseMirror a) {
    color: #3b82f6;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
