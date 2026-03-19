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
    const existingByBinding = new Map(existingContainers.map((container) => [container.binding, container]));

    for (const container of opts.config.containers) {
      const name = container.binding.toLowerCase().replace(/_/g, '-');
      const entry = {
        name,
        binding: container.binding,
        class_name: container.className,
      };

      const existing = existingByBinding.get(container.binding);
      if (!existing) {
        existingContainers.push(entry);
        changed = true;
        console.log(`[kuratchi] Added container "${container.binding}" to wrangler config`);
      } else if (existing.class_name !== container.className) {
        existing.class_name = container.className;
        changed = true;
        console.log(`[kuratchi] Updated container "${container.binding}" class_name to "${container.className}"`);
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
  }

  if (!changed) return;

  const newContent = JSON.stringify(wranglerConfig, null, isJsonc ? '\t' : '\t');
  opts.writeFile(configPath, newContent + '\n');
}
