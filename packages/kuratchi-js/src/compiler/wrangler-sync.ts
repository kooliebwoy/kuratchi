import * as fs from 'node:fs';
import * as path from 'node:path';

export interface WranglerSyncEntry {
  binding: string;
  className: string;
}

export interface WranglerSyncConfig {
  workflows: WranglerSyncEntry[];
  containers: WranglerSyncEntry[];
  durableObjects: WranglerSyncEntry[];
  /** Relative path to the public assets directory (e.g. '.kuratchi/public/'). When set, the
   * `assets.directory` and `assets.binding` keys in wrangler.jsonc are kept in sync automatically. */
  assetsDirectory?: string;
}

function nextMigrationTag(existing: any[]): string {
  const used = new Set(
    existing
      .map((entry) => (entry && typeof entry.tag === 'string' ? entry.tag : null))
      .filter(Boolean),
  );

  let maxNumeric = 0;
  for (const tag of used) {
    const match = /^v(\d+)$/i.exec(String(tag));
    if (match) {
      maxNumeric = Math.max(maxNumeric, Number(match[1]));
    }
  }

  let candidate = `v${maxNumeric > 0 ? maxNumeric + 1 : 1}`;
  if (!used.has(candidate)) return candidate;

  let index = maxNumeric + 1;
  while (used.has(candidate)) {
    index += 1;
    candidate = `v${index}`;
  }
  return candidate;
}

function stripJsonComments(content: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';

  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];

    if (inString) {
      result += ch;
      if (ch === '\\' && i + 1 < content.length) {
        result += next;
        i += 2;
        continue;
      }
      if (ch === stringChar) {
        inString = false;
      }
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      result += ch;
      i++;
      continue;
    }

    if (ch === '/' && next === '/') {
      while (i < content.length && content[i] !== '\n') i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < content.length - 1 && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

export function syncWranglerConfig(opts: {
  projectDir: string;
  config: WranglerSyncConfig;
  writeFile: (filePath: string, content: string) => void;
}): void {
  const jsoncPath = path.join(opts.projectDir, 'wrangler.jsonc');
  const jsonPath = path.join(opts.projectDir, 'wrangler.json');
  const tomlPath = path.join(opts.projectDir, 'wrangler.toml');

  let configPath: string;
  let isJsonc = false;

  if (fs.existsSync(jsoncPath)) {
    configPath = jsoncPath;
    isJsonc = true;
  } else if (fs.existsSync(jsonPath)) {
    configPath = jsonPath;
  } else if (fs.existsSync(tomlPath)) {
    console.log('[kuratchi] wrangler.toml detected. Auto-sync requires wrangler.jsonc. Skipping wrangler sync.');
    return;
  } else {
    console.log('[kuratchi] Creating wrangler.jsonc with workflow config...');
    configPath = jsoncPath;
    isJsonc = true;
  }

  let rawContent = '';
  let wranglerConfig: Record<string, any> = {};

  if (fs.existsSync(configPath)) {
    rawContent = fs.readFileSync(configPath, 'utf-8');
    try {
      const jsonContent = stripJsonComments(rawContent);
      wranglerConfig = JSON.parse(jsonContent);
    } catch (err: any) {
      console.error(`[kuratchi] Failed to parse ${path.basename(configPath)}: ${err.message}`);
      console.error('[kuratchi] Skipping wrangler sync. Please fix the JSON syntax.');
      return;
    }
  }

  let changed = false;

  if (opts.config.workflows.length > 0) {
    const existingWorkflows: any[] = wranglerConfig.workflows || [];
    const existingByBinding = new Map(existingWorkflows.map((workflow) => [workflow.binding, workflow]));

    for (const workflow of opts.config.workflows) {
      const name = workflow.binding.toLowerCase().replace(/_/g, '-');
      const entry = {
        name,
        binding: workflow.binding,
        class_name: workflow.className,
      };

      const existing = existingByBinding.get(workflow.binding);
      if (!existing) {
        existingWorkflows.push(entry);
        changed = true;
        console.log(`[kuratchi] Added workflow "${workflow.binding}" to wrangler config`);
      } else if (existing.class_name !== workflow.className) {
        existing.class_name = workflow.className;
        changed = true;
        console.log(`[kuratchi] Updated workflow "${workflow.binding}" class_name to "${workflow.className}"`);
      }
    }

    const configBindings = new Set(opts.config.workflows.map((workflow) => workflow.binding));
    const filtered = existingWorkflows.filter((workflow) => {
      if (!configBindings.has(workflow.binding)) {
        const expectedName = workflow.binding.toLowerCase().replace(/_/g, '-');
        if (workflow.name === expectedName) {
          console.log(`[kuratchi] Removed workflow "${workflow.binding}" from wrangler config`);
          changed = true;
          return false;
        }
      }
      return true;
    });

    if (filtered.length !== existingWorkflows.length) {
      wranglerConfig.workflows = filtered;
    } else {
      wranglerConfig.workflows = existingWorkflows;
    }

    if (wranglerConfig.workflows.length === 0) {
      delete wranglerConfig.workflows;
    }
  }

  if (opts.config.containers.length > 0) {
    const existingContainers: any[] = wranglerConfig.containers || [];
    const existingByClassName = new Map(existingContainers.map((container) => [container.class_name, container]));

    for (const container of opts.config.containers) {
      const name = container.binding.toLowerCase().replace(/_/g, '-');
      const entry = {
        name,
        class_name: container.className,
      };

      const existing = existingByClassName.get(container.className);
      if (!existing) {
        existingContainers.push(entry);
        changed = true;
        console.log(`[kuratchi] Added container "${container.className}" to wrangler config`);
      } else if (existing.name !== name) {
        existing.name = name;
        changed = true;
        console.log(`[kuratchi] Updated container "${container.className}" name to "${name}"`);
      }
    }

    wranglerConfig.containers = existingContainers;
    if (wranglerConfig.containers.length === 0) {
      delete wranglerConfig.containers;
    }
  }

  if (opts.config.durableObjects.length > 0) {
    if (!wranglerConfig.durable_objects) {
      wranglerConfig.durable_objects = { bindings: [] };
    }

    const existingBindings: any[] = wranglerConfig.durable_objects.bindings || [];
    const existingByName = new Map(existingBindings.map((binding) => [binding.name, binding]));

    for (const durableObject of opts.config.durableObjects) {
      const entry = {
        name: durableObject.binding,
        class_name: durableObject.className,
      };

      const existing = existingByName.get(durableObject.binding);
      if (!existing) {
        existingBindings.push(entry);
        changed = true;
        console.log(`[kuratchi] Added durable_object "${durableObject.binding}" to wrangler config`);
      } else if (existing.class_name !== durableObject.className) {
        existing.class_name = durableObject.className;
        changed = true;
        console.log(`[kuratchi] Updated durable_object "${durableObject.binding}" class_name to "${durableObject.className}"`);
      }
    }

    wranglerConfig.durable_objects.bindings = existingBindings;

    const existingMigrations: any[] = Array.isArray(wranglerConfig.migrations) ? wranglerConfig.migrations : [];
    const knownClasses = new Set<string>();
    for (const migration of existingMigrations) {
      const newClasses = Array.isArray(migration?.new_sqlite_classes) ? migration.new_sqlite_classes : [];
      for (const className of newClasses) {
        if (typeof className === 'string' && className) knownClasses.add(className);
      }
    }

    const missingClasses = opts.config.durableObjects
      .map((entry) => entry.className)
      .filter((className) => !knownClasses.has(className));

    if (missingClasses.length > 0) {
      existingMigrations.push({
        tag: nextMigrationTag(existingMigrations),
        new_sqlite_classes: missingClasses,
      });
      wranglerConfig.migrations = existingMigrations;
      changed = true;
      console.log(`[kuratchi] Added durable object migration for ${missingClasses.join(', ')}`);
    }
  }

  if (opts.config.assetsDirectory !== undefined) {
    const existing = wranglerConfig.assets as Record<string, string> | undefined;
    if (!existing) {
      wranglerConfig.assets = { directory: opts.config.assetsDirectory, binding: 'ASSETS' };
      changed = true;
      console.log(`[kuratchi] Added static assets directory "${opts.config.assetsDirectory}" to wrangler config`);
    } else {
      if (existing.directory !== opts.config.assetsDirectory) {
        existing.directory = opts.config.assetsDirectory;
        changed = true;
        console.log(`[kuratchi] Updated static assets directory to "${opts.config.assetsDirectory}" in wrangler config`);
      }
      if (!existing.binding) {
        existing.binding = 'ASSETS';
        changed = true;
        console.log(`[kuratchi] Added ASSETS binding to static assets config in wrangler config`);
      }
    }
  }

  if (!changed) return;

  const newContent = JSON.stringify(wranglerConfig, null, isJsonc ? '\t' : '\t');
  opts.writeFile(configPath, newContent + '\n');
}
