export interface kuratchiUiAdapterConfig {
  /**
   * Initial color scheme applied to `<html>`.
   * - `'dark'`   — dark background, light text (default)
   * - `'light'`  — white background, dark text
   * - `'system'` — follows OS preference via `prefers-color-scheme`
   *
   * Set `class="dark"` (or omit it) on `<html>` in your layout to match.
   * Users can override at runtime with the `<ThemeToggle>` component, which
   * persists the choice to `localStorage` under the key `"kui-theme"`.
   */
  theme?: 'dark' | 'light' | 'system';

  /**
   * Corner-radius style applied via `data-radius` on `<html>`.
   * - `'default'` — standard rounded corners (default)
   * - `'none'`    — square corners (all radii set to 0)
   * - `'full'`    — pill / fully-rounded corners
   */
  radius?: 'default' | 'none' | 'full';

  /**
   * Optional first-party UI library integration.
   */
  library?: 'tailwindcss';

  /**
   * Optional Tailwind plugins to enable when `library: 'tailwindcss'`.
   * Common examples: `daisyui`, `forms`, `@tailwindcss/forms`.
   */
  plugins?: string[];
}

export function kuratchiUiConfig(config: kuratchiUiAdapterConfig = {}): kuratchiUiAdapterConfig {
  return {
    theme: 'dark',
    radius: 'default',
    plugins: [],
    ...config,
  };
}


