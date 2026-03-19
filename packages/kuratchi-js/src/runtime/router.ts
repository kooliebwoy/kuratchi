/**
 * URL router — matches incoming requests to route modules.
 *
 * Supports:
 *   /todos          → static
 *   /blog/:slug     → named param
 *   /files/*rest    → catch-all
 *
 * Uses a radix tree for O(log n) dynamic route matching instead of O(n) linear scan.
 */

export interface MatchResult {
  params: Record<string, string>;
  index: number;
}

/** Node types in the radix tree */
const enum NodeType {
  Static = 0,
  Param = 1,
  CatchAll = 2,
}

interface RadixNode {
  /** Static path segment (e.g., "blog", "api") */
  segment: string;
  /** Node type: static, param, or catch-all */
  type: NodeType;
  /** Parameter name for param/catch-all nodes */
  paramName?: string;
  /** Route index if this node is a terminal */
  routeIndex?: number;
  /** Child nodes keyed by first character (for static) or special keys */
  children: Map<string, RadixNode>;
  /** Param child (only one allowed per level) */
  paramChild?: RadixNode;
  /** Catch-all child (only one allowed per level, must be terminal) */
  catchAllChild?: RadixNode;
}

function createNode(segment: string, type: NodeType, paramName?: string): RadixNode {
  return {
    segment,
    type,
    paramName,
    children: new Map(),
  };
}

export class Router {
  private staticRoutes = new Map<string, number>();
  private root: RadixNode = createNode('', NodeType.Static);

  /** Register a pattern (e.g. '/blog/:slug') and associate it with an index. */
  add(pattern: string, index: number): void {
    if (!pattern.includes(':') && !pattern.includes('*')) {
      this.staticRoutes.set(pattern, index);
      return;
    }

    // Parse pattern into segments
    const segments = pattern.split('/').filter(Boolean);
    let node = this.root;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      if (seg.startsWith('*')) {
        // Catch-all: *param
        const paramName = seg.slice(1);
        if (!node.catchAllChild) {
          node.catchAllChild = createNode('', NodeType.CatchAll, paramName);
        }
        node = node.catchAllChild;
        // Catch-all must be last segment
        break;
      } else if (seg.startsWith(':')) {
        // Param: :param
        const paramName = seg.slice(1);
        if (!node.paramChild) {
          node.paramChild = createNode('', NodeType.Param, paramName);
        }
        node = node.paramChild;
      } else {
        // Static segment
        const key = seg[0] || '';
        let child = node.children.get(key);
        if (!child) {
          child = createNode(seg, NodeType.Static);
          node.children.set(key, child);
        } else if (child.segment !== seg) {
          // Handle prefix splitting for true radix tree (simplified: exact match only)
          // For simplicity, we use segment-level matching which is sufficient for route patterns
          let found = false;
          for (const [, c] of node.children) {
            if (c.segment === seg) {
              child = c;
              found = true;
              break;
            }
          }
          if (!found) {
            child = createNode(seg, NodeType.Static);
            // Use full segment as key for collision handling
            node.children.set(seg, child);
          }
        }
        node = child;
      }
    }

    node.routeIndex = index;
  }

  /** Match a pathname against registered routes. Returns null if no match. */
  match(pathname: string): MatchResult | null {
    // Normalize: strip trailing slash (except root)
    const normalized = pathname === '/' ? '/' : pathname.replace(/\/$/, '');

    // Fast path: static routes (O(1))
    const staticIdx = this.staticRoutes.get(normalized);
    if (staticIdx !== undefined) {
      return { params: {}, index: staticIdx };
    }

    // Radix tree traversal for dynamic routes
    const segments = normalized.split('/').filter(Boolean);
    const params: Record<string, string> = {};

    const result = this.matchNode(this.root, segments, 0, params);
    if (result !== null) {
      return { params, index: result };
    }

    return null;
  }

  /** Recursive radix tree matching with backtracking */
  private matchNode(
    node: RadixNode,
    segments: string[],
    segIdx: number,
    params: Record<string, string>,
  ): number | null {
    // Base case: consumed all segments
    if (segIdx >= segments.length) {
      return node.routeIndex ?? null;
    }

    const seg = segments[segIdx];

    // 1. Try static children first (highest priority)
    // Check by first char, then by full segment
    const staticChild = node.children.get(seg[0]) ?? node.children.get(seg);
    if (staticChild && staticChild.segment === seg) {
      const result = this.matchNode(staticChild, segments, segIdx + 1, params);
      if (result !== null) return result;
    }
    // Also check full segment key for collision handling
    for (const [key, child] of node.children) {
      if (key !== seg[0] && child.segment === seg) {
        const result = this.matchNode(child, segments, segIdx + 1, params);
        if (result !== null) return result;
      }
    }

    // 2. Try param child (second priority)
    if (node.paramChild) {
      const paramName = node.paramChild.paramName!;
      const oldValue = params[paramName];
      params[paramName] = seg;

      const result = this.matchNode(node.paramChild, segments, segIdx + 1, params);
      if (result !== null) return result;

      // Backtrack
      if (oldValue !== undefined) {
        params[paramName] = oldValue;
      } else {
        delete params[paramName];
      }
    }

    // 3. Try catch-all child (lowest priority, consumes rest)
    if (node.catchAllChild) {
      const paramName = node.catchAllChild.paramName!;
      params[paramName] = segments.slice(segIdx).join('/');
      return node.catchAllChild.routeIndex ?? null;
    }

    return null;
  }
}

/**
 * Convert a file-system path to a route pattern.
 *
 * Examples:
 *   'index'        → '/'
 *   'about'        → '/about'
 *   'blog/[slug]'  → '/blog/:slug'
 *   'files/[...path]' → '/files/*path'
 */
export function filePathToPattern(filePath: string): string {
  if (filePath === 'index') return '/';

  let pattern = '/' + filePath
    // [...param] → *param (catch-all)
    .replace(/\[\.\.\.(\w+)\]/g, '*$1')
    // [param] → :param
    .replace(/\[(\w+)\]/g, ':$1');

  // Remove trailing /index
  pattern = pattern.replace(/\/index$/, '') || '/';

  return pattern;
}
