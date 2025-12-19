<script lang="ts">
	/**
	 * Navigation Settings Plugin
	 * 
	 * Controls navigation styling and behavior settings.
	 * Menu items are managed via Dashboard CRUD (/menus), not here.
	 * This plugin only controls HOW the navigation looks/behaves.
	 */
	import type { PluginContext } from '../context';
	import {
		PanelTop,
		PanelBottom,
		Menu,
		MousePointer,
		MousePointerClick,
		AlignLeft,
		AlignCenter,
		AlignRight,
		ChevronLeft,
		ChevronRight,
		Smartphone,
		Monitor,
		PanelLeftClose,
		PanelRightClose,
		Maximize,
		ExternalLink,
		RotateCcw
	} from '@lucide/svelte';

	let { ctx }: { ctx: PluginContext } = $props();

	// Navigation settings types
	type DropdownTrigger = 'hover' | 'click';
	type DropdownAlign = 'start' | 'center' | 'end';
	type SubmenuDirection = 'left' | 'right';
	type MobileNavStyle = 'drawer' | 'fullscreen';
	type DrawerPosition = 'left' | 'right';

	interface NavigationSettings {
		header: {
			visible: boolean;
			dropdownTrigger: DropdownTrigger;
			dropdownAlign: DropdownAlign;
			submenuDirection: SubmenuDirection;
			hoverBgColor: string;
			hoverTextColor: string;
			dropdownBgColor: string;
			dropdownTextColor: string;
			dropdownHoverBgColor: string;
			dropdownHoverTextColor: string;
			mobileNavStyle: MobileNavStyle;
			mobileDrawerPosition: DrawerPosition;
		};
		footer: {
			visible: boolean;
		};
	}

	const DEFAULT_SETTINGS: NavigationSettings = {
		header: {
			visible: true,
			dropdownTrigger: 'hover',
			dropdownAlign: 'start',
			submenuDirection: 'right',
			hoverBgColor: 'rgba(255, 255, 255, 0.1)',
			hoverTextColor: '',
			dropdownBgColor: '#ffffff',
			dropdownTextColor: '#1f2937',
			dropdownHoverBgColor: '#f3f4f6',
			dropdownHoverTextColor: '',
			mobileNavStyle: 'drawer',
			mobileDrawerPosition: 'right'
		},
		footer: {
			visible: true
		}
	};

	// Load settings from siteMetadata or use defaults
	const loadSettings = (): NavigationSettings => {
		const saved = (ctx.siteMetadata as any)?.navigationSettings;
		if (saved) {
			return {
				header: { ...DEFAULT_SETTINGS.header, ...saved.header },
				footer: { ...DEFAULT_SETTINGS.footer, ...saved.footer }
			};
		}
		return { ...DEFAULT_SETTINGS };
	};

	let settings = $state<NavigationSettings>(loadSettings());
	let activeTab: 'header' | 'footer' = $state('header');

	// Save settings to siteMetadata
	async function saveSettings() {
		await ctx.updateSiteMetadata({ navigationSettings: settings });
	}

	// Update a header setting
	function updateHeaderSetting<K extends keyof NavigationSettings['header']>(
		key: K,
		value: NavigationSettings['header'][K]
	) {
		settings.header[key] = value;
		saveSettings();
	}

	// Update a footer setting
	function updateFooterSetting<K extends keyof NavigationSettings['footer']>(
		key: K,
		value: NavigationSettings['footer'][K]
	) {
		settings.footer[key] = value;
		saveSettings();
	}

	// Reset to defaults
	function resetSettings() {
		settings = { ...DEFAULT_SETTINGS };
		saveSettings();
	}

	// Menu item count from navigation state (read-only display)
	const headerItemCount = $derived((ctx.siteMetadata as any)?.navigation?.header?.items?.length ?? 0);
	const footerItemCount = $derived((ctx.siteMetadata as any)?.navigation?.footer?.items?.length ?? 0);
</script>

<div class="nav-plugin-sidebar">
	<!-- Region Tabs -->
	<div class="region-tabs">
		<button
			type="button"
			class="region-tab"
			class:active={activeTab === 'header'}
			onclick={() => (activeTab = 'header')}
		>
			<PanelTop size={14} />
			Header
		</button>
		<button
			type="button"
			class="region-tab"
			class:active={activeTab === 'footer'}
			onclick={() => (activeTab = 'footer')}
		>
			<PanelBottom size={14} />
			Footer
		</button>
	</div>

	<div class="settings-container">
		{#if activeTab === 'header'}
			<!-- Header Settings -->
			<div class="settings-section">
				<div class="info-card">
					<Menu size={16} />
					<div class="info-content">
						<span class="info-label">Menu Items</span>
						<span class="info-value">{headerItemCount} items</span>
					</div>
					<a href="/menus" class="info-link" title="Manage menus in Dashboard">
						<ExternalLink size={14} />
					</a>
				</div>
			</div>

			<!-- Visibility -->
			<div class="settings-section">
				<label class="toggle-row">
					<span class="toggle-label">Show Navigation</span>
					<input 
						type="checkbox" 
						checked={settings.header.visible}
						onchange={(e) => updateHeaderSetting('visible', (e.target as HTMLInputElement).checked)}
					/>
				</label>
			</div>

			{#if settings.header.visible}
				<!-- Desktop Dropdown Settings -->
				<div class="settings-section">
					<h4 class="section-title">Desktop Dropdown</h4>
					
					<div class="form-group">
						<label class="form-label">Trigger</label>
						<div class="toggle-group">
							<button
								type="button"
								class="toggle-btn"
								class:active={settings.header.dropdownTrigger === 'hover'}
								onclick={() => updateHeaderSetting('dropdownTrigger', 'hover')}
							>
								<MousePointer size={14} />
								Hover
							</button>
							<button
								type="button"
								class="toggle-btn"
								class:active={settings.header.dropdownTrigger === 'click'}
								onclick={() => updateHeaderSetting('dropdownTrigger', 'click')}
							>
								<MousePointerClick size={14} />
								Click
							</button>
						</div>
					</div>

					<div class="form-group">
						<label class="form-label">Alignment</label>
						<div class="toggle-group">
							<button
								type="button"
								class="toggle-btn"
								class:active={settings.header.dropdownAlign === 'start'}
								onclick={() => updateHeaderSetting('dropdownAlign', 'start')}
							>
								<AlignLeft size={14} />
							</button>
							<button
								type="button"
								class="toggle-btn"
								class:active={settings.header.dropdownAlign === 'center'}
								onclick={() => updateHeaderSetting('dropdownAlign', 'center')}
							>
								<AlignCenter size={14} />
							</button>
							<button
								type="button"
								class="toggle-btn"
								class:active={settings.header.dropdownAlign === 'end'}
								onclick={() => updateHeaderSetting('dropdownAlign', 'end')}
							>
								<AlignRight size={14} />
							</button>
						</div>
					</div>

					<div class="form-group">
						<label class="form-label">Submenu Direction</label>
						<div class="toggle-group">
							<button
								type="button"
								class="toggle-btn"
								class:active={settings.header.submenuDirection === 'left'}
								onclick={() => updateHeaderSetting('submenuDirection', 'left')}
							>
								<ChevronLeft size={14} />
								Left
							</button>
							<button
								type="button"
								class="toggle-btn"
								class:active={settings.header.submenuDirection === 'right'}
								onclick={() => updateHeaderSetting('submenuDirection', 'right')}
							>
								<ChevronRight size={14} />
								Right
							</button>
						</div>
					</div>
				</div>

				<!-- Parent Item Colors -->
				<div class="settings-section">
					<h4 class="section-title">Parent Item Hover</h4>
					
					<div class="form-group">
						<label class="form-label" for="hover-bg">Background</label>
						<div class="color-input-row">
							<input
								type="color"
								id="hover-bg-picker"
								value={settings.header.hoverBgColor || '#ffffff'}
								onchange={(e) => updateHeaderSetting('hoverBgColor', (e.target as HTMLInputElement).value)}
							/>
							<input
								type="text"
								id="hover-bg"
								class="form-input"
								value={settings.header.hoverBgColor}
								placeholder="rgba(255,255,255,0.1)"
								onchange={(e) => updateHeaderSetting('hoverBgColor', (e.target as HTMLInputElement).value)}
							/>
						</div>
					</div>

					<div class="form-group">
						<label class="form-label" for="hover-text">Text Color</label>
						<div class="color-input-row">
							<input
								type="color"
								id="hover-text-picker"
								value={settings.header.hoverTextColor || '#ffffff'}
								onchange={(e) => updateHeaderSetting('hoverTextColor', (e.target as HTMLInputElement).value)}
							/>
							<input
								type="text"
								id="hover-text"
								class="form-input"
								value={settings.header.hoverTextColor}
								placeholder="Inherit"
								onchange={(e) => updateHeaderSetting('hoverTextColor', (e.target as HTMLInputElement).value)}
							/>
						</div>
					</div>
				</div>

				<!-- Dropdown Colors -->
				<div class="settings-section">
					<h4 class="section-title">Dropdown Colors</h4>
					
					<div class="form-group">
						<label class="form-label" for="dropdown-bg">Background</label>
						<div class="color-input-row">
							<input
								type="color"
								id="dropdown-bg-picker"
								value={settings.header.dropdownBgColor || '#ffffff'}
								onchange={(e) => updateHeaderSetting('dropdownBgColor', (e.target as HTMLInputElement).value)}
							/>
							<input
								type="text"
								id="dropdown-bg"
								class="form-input"
								value={settings.header.dropdownBgColor}
								placeholder="#ffffff"
								onchange={(e) => updateHeaderSetting('dropdownBgColor', (e.target as HTMLInputElement).value)}
							/>
						</div>
					</div>

					<div class="form-group">
						<label class="form-label" for="dropdown-text">Text Color</label>
						<div class="color-input-row">
							<input
								type="color"
								id="dropdown-text-picker"
								value={settings.header.dropdownTextColor || '#1f2937'}
								onchange={(e) => updateHeaderSetting('dropdownTextColor', (e.target as HTMLInputElement).value)}
							/>
							<input
								type="text"
								id="dropdown-text"
								class="form-input"
								value={settings.header.dropdownTextColor}
								placeholder="#1f2937"
								onchange={(e) => updateHeaderSetting('dropdownTextColor', (e.target as HTMLInputElement).value)}
							/>
						</div>
					</div>

					<div class="form-group">
						<label class="form-label" for="dropdown-hover-bg">Hover Background</label>
						<div class="color-input-row">
							<input
								type="color"
								id="dropdown-hover-bg-picker"
								value={settings.header.dropdownHoverBgColor || '#f3f4f6'}
								onchange={(e) => updateHeaderSetting('dropdownHoverBgColor', (e.target as HTMLInputElement).value)}
							/>
							<input
								type="text"
								id="dropdown-hover-bg"
								class="form-input"
								value={settings.header.dropdownHoverBgColor}
								placeholder="#f3f4f6"
								onchange={(e) => updateHeaderSetting('dropdownHoverBgColor', (e.target as HTMLInputElement).value)}
							/>
						</div>
					</div>

					<div class="form-group">
						<label class="form-label" for="dropdown-hover-text">Hover Text Color</label>
						<div class="color-input-row">
							<input
								type="color"
								id="dropdown-hover-text-picker"
								value={settings.header.dropdownHoverTextColor || '#1f2937'}
								onchange={(e) => updateHeaderSetting('dropdownHoverTextColor', (e.target as HTMLInputElement).value)}
							/>
							<input
								type="text"
								id="dropdown-hover-text"
								class="form-input"
								value={settings.header.dropdownHoverTextColor}
								placeholder="Inherit"
								onchange={(e) => updateHeaderSetting('dropdownHoverTextColor', (e.target as HTMLInputElement).value)}
							/>
						</div>
					</div>
				</div>

				<!-- Mobile Navigation -->
				<div class="settings-section">
					<h4 class="section-title">Mobile Navigation</h4>
					
					<div class="form-group">
						<label class="form-label">Style</label>
						<div class="toggle-group">
							<button
								type="button"
								class="toggle-btn"
								class:active={settings.header.mobileNavStyle === 'drawer'}
								onclick={() => updateHeaderSetting('mobileNavStyle', 'drawer')}
							>
								<Smartphone size={14} />
								Drawer
							</button>
							<button
								type="button"
								class="toggle-btn"
								class:active={settings.header.mobileNavStyle === 'fullscreen'}
								onclick={() => updateHeaderSetting('mobileNavStyle', 'fullscreen')}
							>
								<Maximize size={14} />
								Fullscreen
							</button>
						</div>
					</div>

					{#if settings.header.mobileNavStyle === 'drawer'}
						<div class="form-group">
							<label class="form-label">Drawer Position</label>
							<div class="toggle-group">
								<button
									type="button"
									class="toggle-btn"
									class:active={settings.header.mobileDrawerPosition === 'left'}
									onclick={() => updateHeaderSetting('mobileDrawerPosition', 'left')}
								>
									<PanelLeftClose size={14} />
									Left
								</button>
								<button
									type="button"
									class="toggle-btn"
									class:active={settings.header.mobileDrawerPosition === 'right'}
									onclick={() => updateHeaderSetting('mobileDrawerPosition', 'right')}
								>
									<PanelRightClose size={14} />
									Right
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		{:else}
			<!-- Footer Settings -->
			<div class="settings-section">
				<div class="info-card">
					<Menu size={16} />
					<div class="info-content">
						<span class="info-label">Menu Items</span>
						<span class="info-value">{footerItemCount} items</span>
					</div>
					<a href="/menus" class="info-link" title="Manage menus in Dashboard">
						<ExternalLink size={14} />
					</a>
				</div>
			</div>

			<!-- Visibility -->
			<div class="settings-section">
				<label class="toggle-row">
					<span class="toggle-label">Show Navigation</span>
					<input 
						type="checkbox" 
						checked={settings.footer.visible}
						onchange={(e) => updateFooterSetting('visible', (e.target as HTMLInputElement).checked)}
					/>
				</label>
			</div>
		{/if}

		<!-- Reset Button -->
		<div class="settings-section">
			<button type="button" class="reset-btn" onclick={resetSettings}>
				<RotateCcw size={14} />
				Reset to Defaults
			</button>
		</div>
	</div>
</div>

<style>
	.nav-plugin-sidebar {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--krt-editor-bg);
	}

	/* Region Tabs */
	.region-tabs {
		display: flex;
		gap: 4px;
		padding: 12px;
		border-bottom: 1px solid var(--krt-editor-border);
	}

	.region-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 12px;
		background: transparent;
		border: 1px solid var(--krt-editor-border);
		border-radius: 6px;
		color: var(--krt-editor-text-muted);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.region-tab:hover {
		background: var(--krt-editor-surface);
		color: var(--krt-editor-text);
	}

	.region-tab.active {
		background: var(--krt-editor-accent);
		border-color: var(--krt-editor-accent);
		color: var(--krt-editor-accent-text);
	}

	/* Settings Container */
	.settings-container {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
	}

	.settings-section {
		margin-bottom: 20px;
	}

	.settings-section:last-child {
		margin-bottom: 0;
	}

	/* Info Card */
	.info-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: var(--krt-editor-surface);
		border: 1px solid var(--krt-editor-border);
		border-radius: 8px;
	}

	.info-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.info-label {
		font-size: 11px;
		color: var(--krt-editor-text-muted);
	}

	.info-value {
		font-size: 13px;
		font-weight: 500;
		color: var(--krt-editor-text);
	}

	.info-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: 1px solid var(--krt-editor-border);
		border-radius: 6px;
		color: var(--krt-editor-text-muted);
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.info-link:hover {
		background: var(--krt-editor-accent);
		border-color: var(--krt-editor-accent);
		color: var(--krt-editor-accent-text);
	}

	/* Toggle Row */
	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		background: var(--krt-editor-surface);
		border: 1px solid var(--krt-editor-border);
		border-radius: 6px;
		cursor: pointer;
	}

	.toggle-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--krt-editor-text);
	}

	.toggle-row input[type="checkbox"] {
		width: 18px;
		height: 18px;
		accent-color: var(--krt-editor-accent);
		cursor: pointer;
	}

	/* Section Title */
	.section-title {
		margin: 0 0 12px;
		font-size: 12px;
		font-weight: 600;
		color: var(--krt-editor-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* Form Elements */
	.form-group {
		margin-bottom: 12px;
	}

	.form-group:last-child {
		margin-bottom: 0;
	}

	.form-label {
		display: block;
		margin-bottom: 6px;
		font-size: 12px;
		font-weight: 500;
		color: var(--krt-editor-text);
	}

	.form-input {
		width: 100%;
		padding: 8px 10px;
		background: var(--krt-editor-surface);
		border: 1px solid var(--krt-editor-border);
		border-radius: 6px;
		font-size: 13px;
		color: var(--krt-editor-text);
		transition: all 0.15s ease;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--krt-editor-accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--krt-editor-accent) 20%, transparent);
	}

	.form-input::placeholder {
		color: var(--krt-editor-text-muted);
	}

	/* Color Input Row */
	.color-input-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.color-input-row input[type="color"] {
		width: 36px;
		height: 36px;
		padding: 2px;
		border: 1px solid var(--krt-editor-border);
		border-radius: 6px;
		cursor: pointer;
		background: var(--krt-editor-surface);
	}

	.color-input-row .form-input {
		flex: 1;
	}

	/* Toggle Group */
	.toggle-group {
		display: flex;
		gap: 6px;
	}

	.toggle-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 8px 10px;
		background: var(--krt-editor-surface);
		border: 1px solid var(--krt-editor-border);
		border-radius: 6px;
		font-size: 11px;
		font-weight: 500;
		color: var(--krt-editor-text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toggle-btn:hover {
		border-color: var(--krt-editor-accent);
		color: var(--krt-editor-text);
	}

	.toggle-btn.active {
		background: var(--krt-editor-accent);
		border-color: var(--krt-editor-accent);
		color: var(--krt-editor-accent-text);
	}

	/* Reset Button */
	.reset-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		padding: 10px 16px;
		background: transparent;
		border: 1px solid var(--krt-editor-border);
		border-radius: 6px;
		color: var(--krt-editor-text-muted);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.reset-btn:hover {
		background: var(--krt-editor-surface);
		color: var(--krt-editor-text);
	}
</style>
