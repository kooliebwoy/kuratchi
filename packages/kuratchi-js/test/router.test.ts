import { describe, expect, test } from 'bun:test';

import { Router } from '../src/runtime/router.ts';

describe('runtime router', () => {
  test('prefers exact static routes over dynamic params', () => {
    const router = new Router();
    router.add('/posts/:slug', 0);
    router.add('/posts/new', 1);

    expect(router.match('/posts/new/')).toEqual({
      params: {},
      index: 1,
    });
  });

  test('matches dynamic params and catch-all routes', () => {
    const router = new Router();
    router.add('/blog/:slug', 0);
    router.add('/files/*path', 1);

    expect(router.match('/blog/hello-world')).toEqual({
      params: { slug: 'hello-world' },
      index: 0,
    });

    expect(router.match('/files/a/b/c')).toEqual({
      params: { path: 'a/b/c' },
      index: 1,
    });
  });
});
