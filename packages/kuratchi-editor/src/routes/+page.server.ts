import type { Actions } from './$types';

export const actions = {
    updatePage: async ({ request }) => {
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const title = formData.get('title') as string;
        const seoTitle = formData.get('seoTitle') as string;
        const seoDescription = formData.get('seoDescription') as string;
        const slug = formData.get('slug') as string;
        const content = JSON.parse(formData.get('content') as string);
        const header = JSON.parse(formData.get('header') as string);
        const footer = JSON.parse(formData.get('footer') as string);

        // TODO: Save to your database
        console.log('Saving page data:', {
            id,
            title,
            seoTitle,
            seoDescription,
            slug,
            content,
            header,
            footer
        });

        return {
            success: true,
            message: 'Page updated successfully'
        };
    }
} satisfies Actions;
