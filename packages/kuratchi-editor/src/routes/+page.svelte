<script lang="ts">
    import "../app.css";
    import { onMount, onDestroy } from "svelte";
    import { page } from "$app/state";
    import { invalidateAll } from "$app/navigation";
    import type { ActionResult, SubmitFunction } from "@sveltejs/kit";
    import { applyAction, deserialize, enhance } from "$app/forms";
    import type { PageData, ActionData } from "./$types";

    import Editor from "$lib/Editor.svelte";
    import { blocks, layouts, headerBlocks, footerBlocks } from "$lib/registry";
    import { addComponentToEditor } from "$lib/utils/editor.svelte";
    import { imageConfig } from "$lib/stores/imageConfig";

    import { rightPanel, openRightPanel, closeRightPanel } from "$lib/stores/right-panel";
    import { headingStore, sideBarStore } from "$lib/stores/ui";

    import { Alert, Loading } from "@kuratchi/ui";
    import { MenuWidget } from "$lib/shell";
    import {
        ArrowLeft,
        Box,
        ChevronLeft,
        ChevronRight,
        Eye,
        LayoutGrid,
        Monitor,
        Navigation,
        Pencil,
        Settings,
        Smartphone,
        Tablet
    } from "@lucide/svelte";
    
    interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

    const formStatus = $derived(
        form?.status ??
        (form?.success ? "success" : form?.error ? "error" : form?.warning ? "warning" : undefined)
    );

    const formMessage = $derived(
        typeof form?.message === "string" && form.message.trim().length
            ? form.message
            : typeof form?.success === "string" && form.success.trim().length
                ? form.success
                : typeof form?.error === "string" && form.error.trim().length
                    ? form.error
                    : undefined
    );

    const formAlertType = $derived(
        formMessage
            ? (formStatus === "success" || formStatus === "warning" || formStatus === "error" ? formStatus : "info")
            : undefined
    );

    let formLoading: boolean = $state(false);

    const submitHandler: SubmitFunction = () => {
        formLoading = true;
    
        return async({ update }) => {
            formLoading = false;
            await update();
        }
    }

    let dialog: HTMLDialogElement;
    let editorData = $state(data.page?.data || []);
    let headerData = $state(data.metadata?.header || []);
    let footerData = $state(data.metadata?.footer || []);

    let currentPage = $state(data.page);
    let currentMetadata = $state(data.metadata);

    let pageTitleDialog: HTMLDialogElement;
    let seoDialog: HTMLDialogElement;

    // save page data
    const savePageData = async () => {
        // create form data to save
        const formData = new FormData();
        formData.append('id', currentPage?.id); // add page id to the form data

        // save the page editor data
        const blocks = editorData;
        formData.append('content', JSON.stringify(blocks));

        // save the page header data
        const headerBlock = headerData;
        formData.append('header', JSON.stringify(headerBlock));

        // save the page footer data
        const footerBlock = footerData;
        formData.append('footer', JSON.stringify(footerBlock));

        // we have access to the page title, seoTitle, seoDescription
        // add the page title, seoTitle, seoDescription to the form data
        formData.append('title', currentPage?.title as string);
        formData.append('seoTitle', currentPage?.seoTitle as string);
        formData.append('seoDescription', currentPage?.seoDescription as string);
        formData.append('slug', currentPage?.slug as string);

        // save the page data
        const response = await fetch(`?/updatePage`, {
            method: 'POST',
            body: formData
        });

        const result: ActionResult = deserialize(await response.text());

        if ( result.type === 'success' ) {
            invalidateAll();
            console.log('Page data saved successfully');
        }

        applyAction(result);
    }

    // get current site domain
    const site = $derived(data.site);

    let browserMockup: HTMLDivElement;
let activeSize = $state('desktop');
   
    const adjustBrowserSize = (size: string) => {
        activeSize = size;
        browserMockup.classList.remove('phone', 'tablet', 'desktop');

        if (size === 'phone') {
            browserMockup.classList.add('phone');
        } else if (size === 'tablet') {
            browserMockup.classList.add('tablet');
        } else {
            browserMockup.classList.add('desktop');
        }
    }

    let themePrimaryColor = $state(currentMetadata?.themeSettings?.themePrimaryColor || '#ffffff');
    let themeSecondaryColor = $state(currentMetadata?.themeSettings?.themeSecondaryColor || '#f3f4f4');
    let footerTemplate = $state(currentMetadata?.themeSettings?.footerTemplate);
    let headerTemplate = $state(currentMetadata?.themeSettings?.headerTemplate);
    let editor = $state(null);

    // Sidebar state
    let sidebarCollapsed = $state(false);
    let activeTab = $state('blocks'); // 'blocks' | 'navigation' | 'settings'

    $headingStore = data?.page?.title as string;

    onMount(() => {
        $sideBarStore = false;
    });

    onDestroy(() => {
        $sideBarStore = true;
    });
</script>

{#if !formLoading && formMessage}
	{#key form}
        <Alert type={formAlertType ?? "info"} dismissible>
            <p>{formMessage}</p>
        </Alert>
	{/key}
{/if}

{#if formLoading}
	<Loading />
{/if}

<!-- Full-width page builder layout -->
<div class="flex h-9/10 bg-base-100">
    <!-- Left Sidebar -->
    <div class="{sidebarCollapsed ? 'w-12' : 'w-84'} transition-all duration-300 bg-base-200 border-r border-base-300 flex flex-col">
        <!-- Sidebar Header -->
        <div class="flex items-center justify-between p-3 border-b border-base-300">
            {#if !sidebarCollapsed}
                <h2 class="text-sm font-medium text-base-content">Page Builder</h2>
            {/if}
            <button 
                class="p-1 hover:bg-base-300 rounded transition-colors"
                onclick={() => sidebarCollapsed = !sidebarCollapsed}
            >
                {#if sidebarCollapsed}
                    <ChevronRight class="w-4 h-4" />
                {:else}
                    <ChevronLeft class="w-4 h-4" />
                {/if}
            </button>
        </div>

        <!-- Tab Navigation -->
        {#if !sidebarCollapsed}
            <div class="flex border-b border-base-300 mb-2">
                <button 
                    class="flex-1 px-3 py-2 text-xs font-medium text-center border-b-2 transition-colors {activeTab === 'blocks' ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:text-base-content'}"
                    onclick={() => activeTab = 'blocks'}
                >
                    <Box class="w-4 h-4 mx-auto mb-1" />
                    Blocks
                </button>
                <button 
                    class="flex-1 px-3 py-2 text-xs font-medium text-center border-b-2 transition-colors {activeTab === 'layouts' ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:text-base-content'}"
                    onclick={() => activeTab = 'layouts'}
                >
                    <LayoutGrid class="w-4 h-4 mx-auto mb-1" />
                    Layouts
                </button>
                <button 
                    class="flex-1 px-3 py-2 text-xs font-medium text-center border-b-2 transition-colors {activeTab === 'navigation' ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:text-base-content'}"
                    onclick={() => activeTab = 'navigation'}
                >
                    <Navigation class="w-4 h-4 mx-auto mb-1" />
                    Nav
                </button>
                <button 
                    class="flex-1 px-3 py-2 text-xs font-medium text-center border-b-2 transition-colors {activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:text-base-content'}"
                    onclick={() => activeTab = 'settings'}
                >
                    <Settings class="w-4 h-4 mx-auto mb-1" />
                    Settings
                </button>
            </div>
        {/if}

        <!-- Sidebar Content -->
        <div class="flex-1 overflow-y-auto">
            {#if !sidebarCollapsed}
                {#if activeTab === 'blocks'}
                    <!-- Blocks Panel -->
                    {#if editor}
                        <div class="flex flex-col gap-1 p-2">
                            {#each blocks as block}
                                <button
                                    class="flex items-center gap-2 px-2 py-1 rounded hover:bg-base-300 transition"
                                    onclick={() => addComponentToEditor(editor, block.component)}
                                >
                                    <block.icon class="text-base text-base-content/70" />
                                    <span class="text-sm">{block.name}</span>
                                </button>
                            {/each}
                        </div>
                    {:else}
                        <div class="p-4 text-center text-base-content/60 text-sm">
                            Editor loading...
                        </div>
                    {/if}

                {:else if activeTab === 'layouts'}
                    <!-- Layouts Panel -->
                    {#if editor}
                        <div class="flex flex-wrap gap-2 p-2">
                            {#each layouts as block}
                                <button
                                    class="bg-base-100 rounded shadow hover:ring-2 hover:ring-primary transition"
                                    onclick={() => addComponentToEditor(editor, block.component)}
                                >
                                    <img src={block.image} alt={block.name} class="w-full aspect-video object-cover rounded-t" />
                                    <div class="text-xs text-center py-1">{block.name}</div>
                                </button>
                            {/each}
                        </div>
                    {:else}
                        <div class="p-4 text-center text-base-content/60 text-sm">
                            Editor loading...
                        </div>
                    {/if}
                {:else if activeTab === 'navigation'}
                    <!-- Navigation Section -->
                    <div class="p-3">
                        <div class="mb-4">
                            <div class="flex items-center gap-2 px-2 py-1 mb-2">
                                <Navigation class="w-4 h-4 text-base-content/60" />
                                <span class="text-xs font-medium text-base-content/60 uppercase tracking-wide">Navigation</span>
                            </div>
                            <div class="space-y-1">
                                <div class="p-2 bg-base-300 rounded text-sm text-base-content">Header Menu</div>
                                <div class="pl-4">
                                    <MenuWidget 
                                        menuItems={data?.metadata?.header?.menu || []}
                                        pages={data?.pages || []}
                                        reservedPages={data?.reservedPages || []}
                                        menuLocation="header"
                                    />
                                </div>
                            </div>
                        </div>

                        <div class="mb-4">
                            <div class="flex items-center gap-2 px-2 py-1 mb-2">
                                <LayoutGrid class="w-4 h-4 text-base-content/60" />
                                <span class="text-xs font-medium text-base-content/60 uppercase tracking-wide">Footer</span>
                            </div>
                            <div class="space-y-1">
                                <div class="p-2 bg-base-300 rounded text-sm text-base-content">Footer Menu</div>
                                <div class="pl-4">
                                    <MenuWidget 
                                        menuItems={data?.metadata?.footer?.menu || []}
                                        pages={data?.pages || []}
                                        reservedPages={data?.reservedPages || []}
                                        menuLocation="footer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                {:else if activeTab === 'settings'}
                    <!-- Settings Section -->
                    <div class="p-3">
                        <div class="text-sm text-base-content/60 text-center">
                            Page settings will appear here
                        </div>
                    </div>
                {/if}
            {:else}
                <!-- Collapsed sidebar icons -->
                <div class="space-y-2">
                    <button class="w-full p-2 hover:bg-base-300 rounded transition-colors" title="Blocks">
                        <Box class="w-4 h-4 mx-auto text-base-content" />
                    </button>
                    <button class="w-full p-2 hover:bg-base-300 rounded transition-colors" title="Navigation">
                        <Navigation class="w-4 h-4 mx-auto text-base-content" />
                    </button>
                    <button class="w-full p-2 hover:bg-base-300 rounded transition-colors" title="Settings">
                        <Settings class="w-4 h-4 mx-auto text-base-content" />
                    </button>
                </div>
            {/if}
        </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col min-w-0">
        <!-- Clean Header Toolbar -->
        <div class="border-b border-base-300 bg-base-100 text-base-content flex justify-between items-center px-4 py-2">
            <div class="flex gap-3 items-center">
                <!-- Back Button -->
                <a href={`../`} class="flex items-center gap-1 text-sm text-base-content/70 hover:text-base-content transition-colors">
                    <ArrowLeft class="text-lg" />
                    {currentPage?.title || 'Untitled Page'}
                </a>
                <span class="text-xs text-base-content/50">{site?.domain || 'untitledpage.com'}</span>
            </div>

            <!-- Device Size Toggle -->
            <div class="flex gap-1">
                <button 
                    class="px-2 py-1 rounded text-sm hover:bg-base-200 transition-colors {activeSize==='phone' ? 'bg-base-200' : ''}"
                    onclick={() => adjustBrowserSize('phone')}
                >
                    <Smartphone class="text-base" />
                </button>
                <button 
                    class="px-2 py-1 rounded text-sm hover:bg-base-200 transition-colors {activeSize==='tablet' ? 'bg-base-200' : ''}"
                    onclick={() => adjustBrowserSize('tablet')}
                >
                    <Tablet class="text-base" />
                </button>
                <button 
                    class="px-2 py-1 rounded text-sm hover:bg-base-200 transition-colors {activeSize==='desktop' ? 'bg-base-200' : ''}"
                    onclick={() => adjustBrowserSize('desktop')}
                >
                    <Monitor class="text-base" />
                </button>
                <span class="text-xs text-base-content/50 ml-2">1440 px / 100%</span>
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-2">
                <button class="px-3 py-1 bg-base-200 hover:bg-base-300 rounded text-sm transition-colors">
                    <Eye class="text-base" />
                </button>
                <button class="px-3 py-1 bg-primary hover:bg-primary-focus rounded text-sm text-primary-content transition-colors" onclick={() => savePageData()}>
                    Publish
                </button>
                <button class="p-1 hover:bg-base-200 rounded transition-colors" onclick={() => pageTitleDialog.showModal()}>
                    <Pencil class="text-lg" />
                </button>
                <button class="p-1 hover:bg-base-200 rounded transition-colors" onclick={() => seoDialog.showModal()}>
                    <Settings class="text-lg" />
                </button>
            </div>
        </div>

        <!-- Page Content (Editor) -->
        <div class="flex-1 bg-base-content text-base-100 overflow-auto" bind:this={browserMockup}>
            {#key currentPage}
                <Editor 
                    bind:editorData 
                    bind:editor
                    editable={true} 
                    isWebpage={true}
                    layoutsEnabled={true}
                    bind:backgroundColor={themeSecondaryColor}
                    bind:headerBlock={headerData}
                    bind:footerBlock={footerData}
                />
            {/key}
        </div>
    </div>

    <!-- Right Sidebar -->
    <div class="{$rightPanel.open ? 'w-84' : 'w-0'} transition-all duration-300 bg-base-200 border-l-2 border-primary/20 flex flex-col overflow-hidden shrink-0 shadow-lg">
        {#if $rightPanel.open}
            <!-- Sidebar Header with editing indicator -->
            <div class="flex items-center justify-between p-3 border-b border-base-300 bg-gradient-to-r from-primary/5 to-transparent">
                <div class="flex items-center gap-2">
                    <div class="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <h2 class="text-sm font-semibold text-base-content">{$rightPanel.title}</h2>
                </div>
                <button 
                    class="p-1.5 hover:bg-base-300 rounded-md transition-colors group"
                    onclick={closeRightPanel}
                    title="Close editor"
                >
                    <ChevronRight class="w-4 h-4 group-hover:text-primary transition-colors" />
                </button>
            </div>

            <!-- Sidebar Content -->
            <div class="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-base-100/50 to-base-200">
                {#if $rightPanel.content}
                    <div class="space-y-4">
                        {@render $rightPanel.content()}
                    </div>
                {/if}
            </div>

            <!-- Footer with save hint -->
            <div class="p-3 border-t border-base-300 bg-base-100/80">
                <div class="text-xs text-base-content/60 text-center">
                    Changes are saved automatically
                </div>
            </div>
        {/if}
    </div>
</div>



<!-- Page Title DIalog -->
<dialog bind:this={pageTitleDialog} class="modal modal-middle">
    <div class="modal-box">
        <form method="dialog" class="modal-backdrop">
            <button class="btn btn-sm btn-circle absolute right-2 top-2">✕</button>
        </form>

        <h3 class="font-bold text-lg">Page Title</h3>
        <p class="py-4">Set page title below</p>

        <form method="POST" action="?/editTitle" enctype="multipart/form-data" novalidate use:enhance={submitHandler}>

            <input type="hidden" name="id" value={currentPage?.id} />

            <!-- Page Title -->
            <label class="form-control w-full">
                <div class="label">
                    <span class="label-text">Page Title</span>
                </div>
                <input type="text" placeholder="Page title here.." name="title" class="input input-bordered w-full" value={currentPage?.title ?? ''} />
            </label>

            <div class="modal-action">
                <button class="btn btn-sm" onclick={() => pageTitleDialog.close()}>Cancel</button>
                
                <button type="submit" class="btn btn-primary btn-sm" onclick={() => pageTitleDialog.close()}>Confirm</button>
            </div>
        </form>
    </div>
</dialog>

<!-- Archive Modal -->
<dialog bind:this={dialog} class="modal modal-middle">
    <div class="modal-box">
        <form method="dialog" class="modal-backdrop">
            <button class="btn btn-sm btn-circle absolute right-2 top-2">✕</button>
        </form>

        <h3 class="font-bold text-lg">Archive Page</h3>
        <p class="py-4">Are you sure you want to archive this page?</p>

        <div class="modal-action">
            <button class="btn btn-sm" onclick={() => dialog.close()}>Cancel</button>
            <form method="POST" action="?/archivePage" enctype="multipart/form-data" novalidate use:enhance={submitHandler}>
                <input type="hidden" name="id" value={currentPage?.id} />
                <button type="submit" class="btn btn-primary btn-sm" onclick={() => dialog.close()}>Confirm</button>
            </form>
        </div>
    </div>
</dialog>

<!-- SEO Dialog -->
<dialog bind:this={seoDialog} class="modal modal-middle">
    <div class="modal-box">
        <form method="dialog" class="modal-backdrop">
            <button class="btn btn-sm btn-circle absolute right-2 top-2">✕</button>
        </form>

        <h3 class="font-bold text-lg">SEO</h3>
        <p class="py-4">Enter your SEO details below.</p>

        <form method="POST" action="?/editSEO" enctype="multipart/form-data" novalidate use:enhance={submitHandler}>

            <input type="hidden" name="id" value={currentPage?.id} />

            <div class="flex flex-wrap justify-between gap-6">
                <!-- Meta Title -->
                <label class="form-control w-full">
                    <div class="label">
                        <span class="label-text">Page Meta Title</span>
                    </div>
                    <input type="text" value={currentPage?.seoTitle} name="seoTitle" placeholder="Meta title here.." class="input input-bordered w-full" />
                </label>

                <!-- Meta Description -->
                <label class="form-control w-full">
                    <div class="label">
                    <span class="label-text">Page Meta Description</span>
                    </div>
                    <textarea class="textarea textarea-bordered" value={currentPage?.seoDescription} name="seoDescription" placeholder="Meta Description here..."></textarea>
                </label>

                <!-- Meta Description -->
                <label class="form-control w-full">
                    <div class="label">
                    <span class="label-text">Page Slug</span>
                    </div>
                    <input type="text" value={currentPage?.slug} name="slug" placeholder="Page slug here..." class="input input-bordered w-full" />
                </label>
            </div>
            
            <div class="modal-action">
                <button class="btn btn-sm" onclick={() => seoDialog.close()}>Cancel</button>
                <button type="submit" class="btn btn-primary btn-sm" onclick={() => seoDialog.close()}>Confirm</button>
            </div>
        </form>
    </div>
</dialog>
