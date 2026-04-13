import { describe, expect, test } from 'bun:test';
import { redirect } from '../src/runtime/navigation.ts';
import { RedirectError, __setRequestContext } from '../src/runtime/context.ts';

describe('runtime navigation', () => {
  test('redirect throws RedirectError', () => {
    __setRequestContext({} as ExecutionContext, new Request('https://example.com/'), {});

    expect(() => redirect('/login')).toThrow(RedirectError);
  });

  test('redirect includes path in error', () => {
    __setRequestContext({} as ExecutionContext, new Request('https://example.com/'), {});

    try {
      redirect('/dashboard');
    } catch (err) {
      expect(err).toBeInstanceOf(RedirectError);
      expect((err as RedirectError).location).toBe('/dashboard');
    }
  });

  test('redirect defaults to 303 status', () => {
    __setRequestContext({} as ExecutionContext, new Request('https://example.com/'), {});

    try {
      redirect('/home');
    } catch (err) {
      expect((err as RedirectError).status).toBe(303);
    }
  });

  test('redirect accepts custom status', () => {
    __setRequestContext({} as ExecutionContext, new Request('https://example.com/'), {});

    try {
      redirect('/moved', 301);
    } catch (err) {
      expect((err as RedirectError).status).toBe(301);
    }
  });

  test('redirect supports 302 temporary redirect', () => {
    __setRequestContext({} as ExecutionContext, new Request('https://example.com/'), {});

    try {
      redirect('/temp', 302);
    } catch (err) {
      expect((err as RedirectError).status).toBe(302);
    }
  });
});
