<script lang="ts">
    import "../app.css";
    import { invalidateAll } from "$app/navigation";
    import type { ActionResult, SubmitFunction } from "@sveltejs/kit";
    import { applyAction, deserialize, enhance } from "$app/forms";
    import type { PageData, ActionData } from "./$types";

    import Editor from "$lib/Editor.svelte";
    import type { PageData as EditorPageData } from "$lib/types";
    import { Alert, Loading } from "@kuratchi/ui";
    
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

    // Build pageData from server data
    const pageData = $state<EditorPageData>({
        id: data.page?.id,
        title: data.page?.title || 'Untitled Page',
        seoTitle: data.page?.seoTitle || '',
        seoDescription: data.page?.seoDescription || '',
        slug: data.page?.slug || '',
        domain: data.site?.domain || 'example.com',
        content: data.page?.data || [],
        header: data.metadata?.header || null,
        footer: data.metadata?.footer || null,
        metadata: {
            backgroundColor: data.metadata?.themeSettings?.themeSecondaryColor || '#f3f4f4'
        }
    });

    // Single update handler - saves everything
    const handleUpdate = async (updatedPageData: EditorPageData) => {
        const formData = new FormData();
        formData.append('id', updatedPageData.id || '');
        formData.append('title', updatedPageData.title);
        formData.append('seoTitle', updatedPageData.seoTitle);
        formData.append('seoDescription', updatedPageData.seoDescription);
        formData.append('slug', updatedPageData.slug);
        formData.append('content', JSON.stringify(updatedPageData.content));
        formData.append('header', JSON.stringify(updatedPageData.header));
        formData.append('footer', JSON.stringify(updatedPageData.footer));

        const response = await fetch(`?/updatePage`, {
            method: 'POST',
            body: formData
        });

        const result: ActionResult = deserialize(await response.text());

        if (result.type === 'success') {
            invalidateAll();
        }

        applyAction(result);
    }
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

<Editor 
    {pageData}
    editable={true} 
    isWebpage={true}
    layoutsEnabled={true}
    showUI={true}
    initialDeviceSize="desktop"
    pages={data?.pages || []}
    reservedPages={data?.reservedPages || []}
    onUpdate={handleUpdate}
    autoSaveDelay={1000}
/>

