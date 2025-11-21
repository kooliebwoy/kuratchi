import { renderDoc } from '$lib/docs';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
  const doc = renderDoc('overview');
  if (!doc) {
    throw error(404, 'Doc not found');
  }

  return { doc };
};
