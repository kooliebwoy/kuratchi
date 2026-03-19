import * as fs from 'node:fs';
import * as path from 'node:path';

export interface RouteFile {
  file: string;
  name: string;
  layouts: string[];
  type: 'page' | 'api';
}

export function discoverRoutes(routesDir: string): RouteFile[] {
  const results: RouteFile[] = [];
  const registered = new Set<string>();

  function getLayoutsForPrefix(prefix: string): string[] {
    const layouts: string[] = [];
    if (fs.existsSync(path.join(routesDir, 'layout.html'))) layouts.push('layout.html');
    if (!prefix) return layouts;

    const parts = prefix.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const rel = `${current}/layout.html`;
      if (fs.existsSync(path.join(routesDir, rel))) layouts.push(rel);
    }
    return layouts;
  }

  function walk(dir: string, prefix: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
        const pageFile = path.join(dir, entry.name, 'page.html');
        if (fs.existsSync(pageFile)) {
          const routeFile = `${childPrefix}/page.html`;
          if (!registered.has(routeFile)) {
            registered.add(routeFile);
            results.push({ file: routeFile, name: childPrefix, layouts: getLayoutsForPrefix(childPrefix), type: 'page' });
          }
        }

        const apiFile = ['index.ts', 'index.js'].find((fileName) =>
          fs.existsSync(path.join(dir, entry.name, fileName)),
        );
        if (apiFile && !fs.existsSync(pageFile)) {
          const routeFile = `${childPrefix}/${apiFile}`;
          if (!registered.has(routeFile)) {
            registered.add(routeFile);
            results.push({ file: routeFile, name: childPrefix, layouts: [], type: 'api' });
          }
        }

        walk(path.join(dir, entry.name), childPrefix);
        continue;
      }

      if (entry.name === 'layout.html' || entry.name === '404.html' || entry.name === '500.html') {
        continue;
      }

      if (entry.name === 'index.ts' || entry.name === 'index.js') {
        const routeFile = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (!registered.has(routeFile)) {
          registered.add(routeFile);
          results.push({ file: routeFile, name: prefix || 'index', layouts: [], type: 'api' });
        }
        continue;
      }

      if (entry.name === 'page.html') {
        const routeFile = prefix ? `${prefix}/page.html` : 'page.html';
        if (!registered.has(routeFile)) {
          registered.add(routeFile);
          results.push({ file: routeFile, name: prefix || 'index', layouts: getLayoutsForPrefix(prefix), type: 'page' });
        }
        continue;
      }

      if (entry.name.endsWith('.html') && entry.name !== 'page.html') {
        const name = prefix
          ? `${prefix}/${entry.name.replace('.html', '')}`
          : entry.name.replace('.html', '');
        results.push({
          file: prefix ? `${prefix}/${entry.name}` : entry.name,
          name,
          layouts: getLayoutsForPrefix(prefix),
          type: 'page',
        });
      }
    }
  }

  walk(routesDir, '');

  results.sort((a, b) => {
    const aScore = a.name.includes('[...') ? 2 : a.name.includes('[') ? 1 : 0;
    const bScore = b.name.includes('[...') ? 2 : b.name.includes('[') ? 1 : 0;
    return aScore - bScore || a.name.localeCompare(b.name);
  });

  return results;
}
