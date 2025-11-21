import { error } from '@sveltejs/kit';
import { isDocSlug, renderDoc } from '$lib/docs';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
  if (!isDocSlug(params.slug)) {
    throw error(404, 'Doc not found');
  }

  const doc = renderDoc(params.slug);

  if (!doc) {
    throw error(404, 'Doc not found');
  }

  return { doc };
};
