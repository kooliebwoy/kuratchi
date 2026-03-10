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
}

export function kuratchiUiConfig(config: kuratchiUiAdapterConfig = {}): kuratchiUiAdapterConfig {
  return {
    theme: 'dark',
    radius: 'default',
    ...config,
  };
}


