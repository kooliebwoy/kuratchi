/**
 * Public and internal types for the Kuratchi Vite plugin.
 *
 * `KuratchiViteOptions` is the user-facing config surface (kept minimal
 * on purpose during the spike — we add knobs only when a gate demands one).
 * `ResolvedKuratchiOptions` is the normalized form passed around internally.
 */

export interface KuratchiViteOptions {
	/** Relative path from the project root to the routes directory. Defaults to `src/routes`. */
	routesDir?: string;
	/** Relative path from the project root to server-only modules. Defaults to `src/server`. */
	serverDir?: string;
	/** Relative path from the project root to browser helpers. Defaults to `src/lib`. */
	libDir?: string;
}

export interface ResolvedKuratchiOptions {
	routesDir: string;
	serverDir: string;
	libDir: string;
}

/**
 * Intermediate representation of a discovered `.html` route file.
 * The `routesPlugin` produces these; downstream code uses them to generate
 * the virtual `kuratchi:routes` module and the per-route client entries.
 */
export interface DiscoveredRoute {
	/** Absolute path to the `.html` source file. */
	absPath: string;
	/** URL pathname pattern derived from the file path (e.g. `/sandboxes/:name`). */
	urlPattern: string;
	/** Stable id used for virtual module naming and client entry keys. */
	id: string;
}
