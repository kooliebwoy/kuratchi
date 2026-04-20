import { describe, expect, test } from 'bun:test';
import {
  VIRTUAL_MODULE_MAP,
  VIRTUAL_MODULE_NAMES,
  VIRTUAL_MODULE_TYPE_DECLARATIONS,
  buildVirtualModuleTypeDeclarations,
  isKuratchiVirtualModule,
  resolveKuratchiVirtualModule,
  getKuratchiModuleName,
} from '../src/compiler/virtual-modules.ts';

describe('virtual-modules', () => {
  describe('VIRTUAL_MODULE_MAP', () => {
    test('maps environment to runtime path', () => {
      expect(VIRTUAL_MODULE_MAP.environment).toBe('@kuratchi/js/runtime/environment.js');
    });

    test('maps request to runtime path', () => {
      expect(VIRTUAL_MODULE_MAP.request).toBe('@kuratchi/js/runtime/request.js');
    });

    test('maps navigation to runtime path', () => {
      expect(VIRTUAL_MODULE_MAP.navigation).toBe('@kuratchi/js/runtime/navigation.js');
    });

    test('all paths use consistent ./runtime/*.js pattern', () => {
      for (const [name, path] of Object.entries(VIRTUAL_MODULE_MAP)) {
        expect(path).toMatch(/^@kuratchi\/js\/runtime\/\w+\.js$/);
      }
    });
  });

  describe('VIRTUAL_MODULE_NAMES', () => {
    test('includes all module names', () => {
      expect(VIRTUAL_MODULE_NAMES).toContain('environment');
      expect(VIRTUAL_MODULE_NAMES).toContain('request');
      expect(VIRTUAL_MODULE_NAMES).toContain('navigation');
    });
  });

  describe('isKuratchiVirtualModule', () => {
    test('returns true for kuratchi: prefixed modules', () => {
      expect(isKuratchiVirtualModule('kuratchi:environment')).toBe(true);
      expect(isKuratchiVirtualModule('kuratchi:request')).toBe(true);
      expect(isKuratchiVirtualModule('kuratchi:navigation')).toBe(true);
      expect(isKuratchiVirtualModule('kuratchi:unknown')).toBe(true);
    });

    test('returns false for non-kuratchi modules', () => {
      expect(isKuratchiVirtualModule('cloudflare:workers')).toBe(false);
      expect(isKuratchiVirtualModule('@kuratchi/js')).toBe(false);
      expect(isKuratchiVirtualModule('./local-module')).toBe(false);
      expect(isKuratchiVirtualModule('lodash')).toBe(false);
    });
  });

  describe('resolveKuratchiVirtualModule', () => {
    test('resolves known kuratchi:* modules to runtime paths', () => {
      expect(resolveKuratchiVirtualModule('kuratchi:environment')).toBe('@kuratchi/js/runtime/environment.js');
      expect(resolveKuratchiVirtualModule('kuratchi:request')).toBe('@kuratchi/js/runtime/request.js');
      expect(resolveKuratchiVirtualModule('kuratchi:navigation')).toBe('@kuratchi/js/runtime/navigation.js');
    });

    test('returns original specifier for unknown kuratchi:* modules', () => {
      expect(resolveKuratchiVirtualModule('kuratchi:unknown')).toBe('kuratchi:unknown');
    });

    test('returns original specifier for non-kuratchi modules', () => {
      expect(resolveKuratchiVirtualModule('cloudflare:workers')).toBe('cloudflare:workers');
      expect(resolveKuratchiVirtualModule('lodash')).toBe('lodash');
    });
  });

  describe('getKuratchiModuleName', () => {
    test('extracts module name from kuratchi: specifier', () => {
      expect(getKuratchiModuleName('kuratchi:environment')).toBe('environment');
      expect(getKuratchiModuleName('kuratchi:request')).toBe('request');
      expect(getKuratchiModuleName('kuratchi:navigation')).toBe('navigation');
    });

    test('returns null for non-kuratchi specifiers', () => {
      expect(getKuratchiModuleName('cloudflare:workers')).toBe(null);
      expect(getKuratchiModuleName('@kuratchi/js')).toBe(null);
    });
  });

  describe('VIRTUAL_MODULE_TYPE_DECLARATIONS', () => {
    test('declares kuratchi:environment module', () => {
      expect(VIRTUAL_MODULE_TYPE_DECLARATIONS).toContain("declare module 'kuratchi:environment'");
      expect(VIRTUAL_MODULE_TYPE_DECLARATIONS).toContain('export const dev: boolean');
    });

    test('declares kuratchi:request module', () => {
      expect(VIRTUAL_MODULE_TYPE_DECLARATIONS).toContain("declare module 'kuratchi:request'");
      expect(VIRTUAL_MODULE_TYPE_DECLARATIONS).toContain('export const url: URL');
      expect(VIRTUAL_MODULE_TYPE_DECLARATIONS).toContain('export const pathname: string');
      expect(VIRTUAL_MODULE_TYPE_DECLARATIONS).toContain('export const params: Record<string, string>');
      expect(VIRTUAL_MODULE_TYPE_DECLARATIONS).toContain('export const locals: App.Locals');
    });

    test('declares kuratchi:navigation module', () => {
      expect(VIRTUAL_MODULE_TYPE_DECLARATIONS).toContain("declare module 'kuratchi:navigation'");
      expect(VIRTUAL_MODULE_TYPE_DECLARATIONS).toContain('export function redirect');
    });

    test('declares kuratchi:workflow module', () => {
      expect(VIRTUAL_MODULE_TYPE_DECLARATIONS).toContain("declare module 'kuratchi:workflow'");
      expect(VIRTUAL_MODULE_TYPE_DECLARATIONS).toContain('export function workflowStatus');
    });
  });

  describe('kuratchi:workflow', () => {
    test('virtual module is registered in the map', () => {
      expect(VIRTUAL_MODULE_MAP.workflow).toBe('@kuratchi/js/runtime/workflow.js');
      expect(VIRTUAL_MODULE_NAMES).toContain('workflow');
    });

    test('resolves kuratchi:workflow to runtime path', () => {
      expect(resolveKuratchiVirtualModule('kuratchi:workflow')).toBe('@kuratchi/js/runtime/workflow.js');
    });
  });

  describe('buildVirtualModuleTypeDeclarations', () => {
    test('emits never as WorkflowName union when no workflows are discovered', () => {
      const decls = buildVirtualModuleTypeDeclarations([]);
      expect(decls).toContain("declare module 'kuratchi:workflow'");
      expect(decls).toContain('export type WorkflowName = never;');
    });

    test('emits a literal string union of discovered workflow names', () => {
      const decls = buildVirtualModuleTypeDeclarations(['container', 'migration', 'host-backup']);
      expect(decls).toContain("export type WorkflowName = 'container' | 'migration' | 'host-backup';");
    });

    test('declares WorkflowStatusOptions shape', () => {
      const decls = buildVirtualModuleTypeDeclarations(['container']);
      expect(decls).toContain('poll?: string | number;');
      expect(decls).toContain('until?: (value: T) => boolean;');
    });

    test('workflowStatus signature binds name to WorkflowName', () => {
      const decls = buildVirtualModuleTypeDeclarations(['container']);
      // Collapse whitespace so the assertion is not sensitive to formatting.
      const flat = decls.replace(/\s+/g, ' ');
      expect(flat).toContain('name: WorkflowName, instanceId: string, options?: WorkflowStatusOptions<T>, ): Promise<WorkflowAsyncValue<T>>');
    });
  });
});
