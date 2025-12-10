<script lang="ts">
	import { page } from '$app/state';
	import { Button, Card, Dialog, FormField, Badge, SlidePanel } from '@kuratchi/ui';
	import {
		Bike,
		ArrowLeft,
		Pencil,
		Trash2,
		X,
		ExternalLink,
		Save,
		Check,
		Building2,
		Loader2,
		Star,
		GripVertical,
		Upload,
		Image as ImageIcon,
		Images,
		Package,
		Palette,
		RefreshCw,
		AlertCircle,
	} from '@lucide/svelte';
	import {
		getVehicle,
		getOems,
		updateVehicle,
		deleteVehicle,
		getVehicleImagesByVehicleId,
		addVehicleImage,
		updateVehicleImage,
		deleteVehicleImage,
		reorderVehicleImages,
		deleteAllVehicleImages,
		uploadVehicleImageFile,
		syncVehicleImagesFromJson,
	} from '$lib/functions/catalog.remote';
	import type { VehicleImage } from '$lib/functions/catalog.remote';

	// Data
	const vehicleQuery = getVehicle();
	const oems = getOems();
	const oemsData = $derived(oems.current || []);

	// Vehicle data
	const vehicle = $derived(vehicleQuery.current);
	const vehicleId = $derived(vehicle?.id);

	// Get vehicle images from dedicated table
	const vehicleImagesQuery = $derived(vehicleId ? getVehicleImagesByVehicleId(vehicleId) : null);
	const vehicleImages = $derived<VehicleImage[]>(vehicleImagesQuery?.current || []);

	// State
	let isEditing = $state(false);
	let showDeleteModal = $state(false);
	let activeImageIndex = $state(0);
	let isSaving = $state(false);
	let saveError = $state('');

	// Image management state
	let showImageManager = $state(false);
	let imageSourceFilter = $state<'all' | 'stock' | 'custom'>('all');
	let isUploadingImage = $state(false);
	let isDeletingImage = $state<string | null>(null);
	let isSyncingImages = $state(false);
	let showDeleteAllConfirm = $state(false);
	let uploadError = $state('');
	let draggedImageId = $state<string | null>(null);

	// Edit form state (initialized when entering edit mode)
	let editOemId = $state('');
	let editModelName = $state('');
	let editModelYear = $state<number | null>(null);
	let editCategory = $state('other');
	let editMsrp = $state<number | null>(null);
	let editStatus = $state('draft');
	let editDescription = $state('');
	let editSourceUrl = $state('');
	let editFeatures = $state('');
	let editSpecifications = $state('');

	// Filtered images based on source
	const filteredImages = $derived(() => {
		if (imageSourceFilter === 'all') return vehicleImages;
		return vehicleImages.filter((img) => img.image_source === imageSourceFilter);
	});

	// Get display images (prefer CDN URL, fallback to original)
	const displayImages = $derived(() => {
		return filteredImages().map((img) => ({
			...img,
			displayUrl: img.cdn_url || img.url,
		}));
	});

	// Primary image for hero display
	const primaryImage = $derived(() => {
		const primary = vehicleImages.find((img) => img.is_primary);
		if (primary) return primary.cdn_url || primary.url;
		if (vehicleImages.length > 0) return vehicleImages[0].cdn_url || vehicleImages[0].url;
		return vehicle?.cdn_thumbnail_url || vehicle?.thumbnail_url || null;
	});

	// All display URLs for gallery
	const galleryUrls = $derived(() => {
		if (vehicleImages.length > 0) {
			return vehicleImages.map((img) => img.cdn_url || img.url);
		}
		// Fallback to JSON images
		return images();
	});

	// Initialize edit form when editing starts
	function startEditing() {
		if (!vehicle) return;
		editOemId = vehicle.oem_id || '';
		editModelName = vehicle.model_name || '';
		editModelYear = vehicle.model_year || null;
		editCategory = vehicle.category || 'other';
		editMsrp = vehicle.msrp || null;
		editStatus = vehicle.status || 'draft';
		editDescription = vehicle.description || '';
		editSourceUrl = vehicle.source_url || '';
		editFeatures = features().join('\n');
		editSpecifications = JSON.stringify(specifications(), null, 2);
		isEditing = true;
	}

	// Save changes handler
	async function handleSave() {
		if (!vehicle) return;

		isSaving = true;
		saveError = '';

		try {
			const result = await updateVehicle({
				id: vehicle.id,
				oemId: editOemId || undefined,
				modelName: editModelName || undefined,
				modelYear: editModelYear || undefined,
				category: editCategory || undefined,
				msrp: editMsrp || undefined,
				status: (editStatus as 'draft' | 'published' | 'archived') || undefined,
				description: editDescription || undefined,
				sourceUrl: editSourceUrl || undefined,
				features: editFeatures || undefined,
				specifications: editSpecifications || undefined,
			});

			if (result?.success) {
				isEditing = false;
			} else {
				saveError = 'Failed to save changes';
			}
		} catch (err: any) {
			console.error('Save error:', err);
			saveError = err.message || 'Failed to save changes';
		} finally {
			isSaving = false;
		}
	}

	// Image management handlers
	async function handleSetPrimary(imageId: string) {
		if (!vehicleId) return;
		try {
			await updateVehicleImage({
				id: imageId,
				vehicleId,
				isPrimary: true,
			});
		} catch (err) {
			console.error('Failed to set primary:', err);
		}
	}

	async function handleToggleImageSource(imageId: string, currentSource: string) {
		if (!vehicleId) return;
		const newSource = currentSource === 'stock' ? 'custom' : 'stock';
		try {
			await updateVehicleImage({
				id: imageId,
				vehicleId,
				imageSource: newSource as 'stock' | 'custom',
			});
		} catch (err) {
			console.error('Failed to toggle source:', err);
		}
	}

	async function handleDeleteImage(imageId: string) {
		if (!vehicleId) return;
		isDeletingImage = imageId;
		try {
			await deleteVehicleImage({ id: imageId, vehicleId });
		} catch (err) {
			console.error('Failed to delete image:', err);
		} finally {
			isDeletingImage = null;
		}
	}

	async function handleDeleteAllImages() {
		if (!vehicleId) return;
		try {
			await deleteAllVehicleImages({ vehicleId });
			showDeleteAllConfirm = false;
		} catch (err) {
			console.error('Failed to delete all images:', err);
		}
	}

	async function handleSyncImages() {
		if (!vehicleId) return;
		isSyncingImages = true;
		try {
			const result = await syncVehicleImagesFromJson({ vehicleId });
			console.log('Sync result:', result);
		} catch (err) {
			console.error('Failed to sync images:', err);
		} finally {
			isSyncingImages = false;
		}
	}

	async function handleImageUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length || !vehicleId) return;

		isUploadingImage = true;
		uploadError = '';

		try {
			for (const file of Array.from(input.files)) {
				await uploadVehicleImageFile({
					vehicleId,
					file,
					imageSource: 'custom',
				});
			}
		} catch (err: any) {
			console.error('Upload error:', err);
			uploadError = err.message || 'Failed to upload image';
		} finally {
			isUploadingImage = false;
			input.value = '';
		}
	}

	// Drag and drop reordering
	function handleDragStart(imageId: string) {
		draggedImageId = imageId;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
	}

	async function handleDrop(targetImageId: string) {
		if (!draggedImageId || draggedImageId === targetImageId || !vehicleId) {
			draggedImageId = null;
			return;
		}

		const currentOrder = vehicleImages.map((img) => img.id);
		const draggedIndex = currentOrder.indexOf(draggedImageId);
		const targetIndex = currentOrder.indexOf(targetImageId);

		if (draggedIndex === -1 || targetIndex === -1) {
			draggedImageId = null;
			return;
		}

		// Reorder array
		currentOrder.splice(draggedIndex, 1);
		currentOrder.splice(targetIndex, 0, draggedImageId);

		try {
			await reorderVehicleImages({ vehicleId, imageIds: currentOrder });
		} catch (err) {
			console.error('Failed to reorder:', err);
		}

		draggedImageId = null;
	}

	// Parsed data from JSON fields (fallback)
	const specifications = $derived(() => {
		if (!vehicle?.specifications) return {};
		if (typeof vehicle.specifications === 'string') {
			try {
				return JSON.parse(vehicle.specifications);
			} catch {
				return {};
			}
		}
		return vehicle.specifications;
	});

	const features = $derived(() => {
		if (!vehicle?.features) return [];
		if (typeof vehicle.features === 'string') {
			try {
				return JSON.parse(vehicle.features);
			} catch {
				return [];
			}
		}
		return vehicle.features;
	});

	const images = $derived(() => {
		if (!vehicle?.images) return [];
		if (typeof vehicle.images === 'string') {
			try {
				return JSON.parse(vehicle.images);
			} catch {
				return [];
			}
		}
		return vehicle.images;
	});

	// Helpers
	function formatPrice(amount: number | null, currency: string = 'USD') {
		if (!amount) return 'N/A';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency.toUpperCase(),
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	}

	function getCategoryLabel(category: string) {
		const labels: Record<string, string> = {
			atv: 'ATV',
			utv: 'UTV / Side-by-Side',
			dirtbike: 'Dirt Bike',
			pitbike: 'Pit Bike',
			motorcycle: 'Motorcycle',
			electric: 'Electric',
			other: 'Other',
		};
		return labels[category] || category;
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'published':
				return 'primary';
			case 'draft':
				return 'secondary';
			case 'archived':
				return 'ghost';
			default:
				return 'secondary';
		}
	}

	function formatSpecKey(key: string) {
		return key
			.replace(/([A-Z])/g, ' $1')
			.replace(/^./, (str) => str.toUpperCase())
			.trim();
	}
</script>

<svelte:head>
	<title>{vehicle?.model_name || 'Vehicle'} - OEM Catalog - Kuratchi Dashboard</title>
</svelte:head>

{#if !vehicle}
	<div class="kui-not-found">
		<Card>
			<div class="kui-empty">
				<div class="kui-icon-hero">
					<Bike />
				</div>
				<h3>Vehicle not found</h3>
				<p class="kui-subtext">
					The vehicle you're looking for doesn't exist or has been deleted.
				</p>
				<Button variant="primary" href="/catalog">
					<ArrowLeft class="kui-icon" />
					Back to Catalog
				</Button>
			</div>
		</Card>
	</div>
{:else}
	<div class="kui-vehicle-detail">
		<header class="kui-header">
			<Button variant="ghost" size="sm" href="/catalog">
				<ArrowLeft class="kui-icon" />
				Back to Catalog
			</Button>
			<div class="kui-header__actions">
				<Button variant="secondary" size="sm" onclick={startEditing}>
					<Pencil class="kui-icon" />
					Edit
				</Button>
				<Button variant="ghost" size="sm" onclick={() => (showDeleteModal = true)}>
					<Trash2 class="kui-icon" />
				</Button>
			</div>
		</header>

		<!-- View Mode (always visible) -->
		<div class="kui-content">
			<div class="kui-main">
				<!-- Image Gallery -->
				<Card class="kui-gallery">
					<div class="kui-gallery__header">
						<div class="kui-gallery__info">
							<Images class="kui-icon" />
							<span>{vehicleImages.length || galleryUrls().length} images</span>
						</div>
						<Button
							variant="secondary"
							size="xs"
							onclick={() => (showImageManager = true)}
						>
							<ImageIcon class="kui-icon" />
							Manage Images
						</Button>
					</div>
					<div class="kui-gallery__main">
						{#if galleryUrls().length > 0}
							<img src={galleryUrls()[activeImageIndex]} alt={vehicle.model_name} />
						{:else if primaryImage()}
							<img src={primaryImage()} alt={vehicle.model_name} />
						{:else}
							<div class="kui-gallery__placeholder">
								<Bike />
								<p>No images available</p>
								<Button
									variant="secondary"
									size="sm"
									onclick={() => (showImageManager = true)}
								>
									<Upload class="kui-icon" />
									Add Images
								</Button>
							</div>
						{/if}
					</div>
					{#if galleryUrls().length > 1}
						<div class="kui-gallery__thumbs">
							{#each galleryUrls() as img, i}
								<button
									class={`kui-thumb ${i === activeImageIndex ? 'is-active' : ''}`}
									onclick={() => (activeImageIndex = i)}
								>
									<img src={img} alt="" />
									{#if vehicleImages[i]?.is_primary}
										<span class="kui-thumb__primary">
											<Star class="kui-icon-xs" />
										</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</Card>

				<!-- Specifications -->
				{#if Object.keys(specifications()).length > 0}
					<Card class="kui-section">
						<h3>Specifications</h3>
						<div class="kui-specs-grid">
							{#each Object.entries(specifications()) as [key, value]}
								<div class="kui-spec-item">
									<span class="kui-spec-item__label">{formatSpecKey(key)}</span>
									<span class="kui-spec-item__value">{value}</span>
								</div>
							{/each}
						</div>
					</Card>
				{/if}

				<!-- Features -->
				{#if features().length > 0}
					<Card class="kui-section">
						<h3>Features</h3>
						<ul class="kui-features-list">
							{#each features() as feature}
								<li>
									<Check class="kui-icon kui-success" />
									{feature}
								</li>
							{/each}
						</ul>
					</Card>
				{/if}

				<!-- Description -->
				{#if vehicle.description}
					<Card class="kui-section">
						<h3>Description</h3>
						<p class="kui-description">{vehicle.description}</p>
					</Card>
				{/if}
			</div>

			<div class="kui-sidebar">
				<!-- Info Card -->
				<Card class="kui-info-card">
					<div class="kui-info-card__header">
						<Badge variant={getStatusColor(vehicle.status)} size="sm"
							>{vehicle.status}</Badge
						>
					</div>

					<div class="kui-info-card__brand">
						<Building2 class="kui-icon" />
						<span>{vehicle.oem_name}</span>
					</div>

					<h2>{vehicle.model_name}</h2>

					{#if vehicle.model_year}
						<Badge variant="secondary" size="sm">{vehicle.model_year}</Badge>
					{/if}

					<div class="kui-price-block">
						<p class="kui-price">{formatPrice(vehicle.msrp, vehicle.currency)}</p>
						<span class="kui-price-label">MSRP</span>
					</div>

					<Badge variant="neutral">{getCategoryLabel(vehicle.category)}</Badge>

					{#if vehicle.source_url}
						<a
							href={vehicle.source_url}
							target="_blank"
							rel="noopener"
							class="kui-source-link"
						>
							<ExternalLink class="kui-icon" />
							View Source Page
						</a>
					{/if}
				</Card>

				<!-- Quick Stats -->
				<Card class="kui-quick-stats">
					<h4>Quick Stats</h4>
					<div class="kui-stat-list">
						{#if specifications().displacement}
							<div class="kui-stat-item">
								<span class="kui-stat-item__label">Displacement</span>
								<span class="kui-stat-item__value"
									>{specifications().displacement}</span
								>
							</div>
						{/if}
						{#if specifications().engine}
							<div class="kui-stat-item">
								<span class="kui-stat-item__label">Engine</span>
								<span class="kui-stat-item__value">{specifications().engine}</span>
							</div>
						{/if}
						{#if specifications().weight}
							<div class="kui-stat-item">
								<span class="kui-stat-item__label">Weight</span>
								<span class="kui-stat-item__value">{specifications().weight}</span>
							</div>
						{/if}
						{#if specifications().seatHeight}
							<div class="kui-stat-item">
								<span class="kui-stat-item__label">Seat Height</span>
								<span class="kui-stat-item__value"
									>{specifications().seatHeight}</span
								>
							</div>
						{/if}
					</div>
				</Card>

				<!-- Meta Info -->
				<Card class="kui-meta-card">
					<h4>Metadata</h4>
					<div class="kui-meta-list">
						<div class="kui-meta-item">
							<span>ID</span>
							<code>{vehicle.id}</code>
						</div>
						<div class="kui-meta-item">
							<span>Created</span>
							<span>{new Date(vehicle.created_at).toLocaleDateString()}</span>
						</div>
						<div class="kui-meta-item">
							<span>Updated</span>
							<span>{new Date(vehicle.updated_at).toLocaleDateString()}</span>
						</div>
						<div class="kui-meta-item">
							<span>Images</span>
							<span>{vehicleImages.length || images().length}</span>
						</div>
						{#if vehicleImages.length > 0}
							<div class="kui-meta-item">
								<span>Stock</span>
								<span
									>{vehicleImages.filter((i) => i.image_source === 'stock')
										.length}</span
								>
							</div>
							<div class="kui-meta-item">
								<span>Custom</span>
								<span
									>{vehicleImages.filter((i) => i.image_source === 'custom')
										.length}</span
								>
							</div>
						{/if}
					</div>
				</Card>
			</div>
		</div>
	</div>
{/if}

<!-- Edit SlidePanel -->
<SlidePanel
	bind:open={isEditing}
	title="Edit Vehicle"
	subtitle={vehicle ? `${vehicle.model_year || ''} ${vehicle.model_name}`.trim() : ''}
	size="lg"
	closeOnBackdrop={false}
>
	{#snippet children()}
		{#if saveError}
			<div class="kui-error-banner">
				<p>{saveError}</p>
			</div>
		{/if}

		<div class="kui-edit-sections">
			<section class="kui-edit-section">
				<h4>Basic Information</h4>
				<div class="kui-form-grid">
					<FormField label="OEM">
						<select bind:value={editOemId} class="kui-native-select">
							{#each oemsData as oem}
								<option value={oem.id}>{oem.name}</option>
							{/each}
						</select>
					</FormField>

					<FormField label="Model Name">
						<input type="text" bind:value={editModelName} class="kui-native-input" />
					</FormField>

					<FormField label="Model Year">
						<input type="number" bind:value={editModelYear} class="kui-native-input" />
					</FormField>

					<FormField label="Category">
						<select bind:value={editCategory} class="kui-native-select">
							<option value="atv">ATV</option>
							<option value="utv">UTV / Side-by-Side</option>
							<option value="dirtbike">Dirt Bike</option>
							<option value="pitbike">Pit Bike</option>
							<option value="motorcycle">Motorcycle</option>
							<option value="electric">Electric</option>
							<option value="other">Other</option>
						</select>
					</FormField>

					<FormField label="MSRP">
						<input type="number" bind:value={editMsrp} class="kui-native-input" />
					</FormField>

					<FormField label="Status">
						<select bind:value={editStatus} class="kui-native-select">
							<option value="draft">Draft</option>
							<option value="published">Published</option>
							<option value="archived">Archived</option>
						</select>
					</FormField>
				</div>

				<FormField label="Description">
					<textarea bind:value={editDescription} rows={3} class="kui-native-textarea"
					></textarea>
				</FormField>

				<FormField label="Source URL">
					<input type="url" bind:value={editSourceUrl} class="kui-native-input" />
				</FormField>
			</section>

			<section class="kui-edit-section">
				<h4>Features</h4>
				<FormField label="Features (one per line)">
					<textarea bind:value={editFeatures} rows={6} class="kui-native-textarea"
					></textarea>
				</FormField>
			</section>

			<section class="kui-edit-section">
				<h4>Specifications</h4>
				<FormField label="Specifications (JSON)">
					<textarea
						bind:value={editSpecifications}
						rows={10}
						class="kui-native-textarea font-mono"
					></textarea>
				</FormField>
			</section>
		</div>
	{/snippet}

	{#snippet footer()}
		<Button variant="ghost" onclick={() => (isEditing = false)} disabled={isSaving}>
			Cancel
		</Button>
		<Button variant="primary" onclick={handleSave} disabled={isSaving}>
			{#if isSaving}
				<Loader2 class="kui-icon kui-spin" />
				Saving...
			{:else}
				<Save class="kui-icon" />
				Save Changes
			{/if}
		</Button>
	{/snippet}
</SlidePanel>

<!-- Delete Modal -->
{#if showDeleteModal}
	<Dialog bind:open={showDeleteModal} size="sm" onClose={() => (showDeleteModal = false)}>
		{#snippet header()}
			<div class="kui-modal-header">
				<h3>Delete Vehicle</h3>
				<Button variant="ghost" size="xs" onclick={() => (showDeleteModal = false)}>
					<X class="kui-icon" />
				</Button>
			</div>
		{/snippet}
		{#snippet children()}
			<p>
				Are you sure you want to delete <strong>{vehicle?.model_name}</strong>? This action
				cannot be undone.
			</p>
			<form {...deleteVehicle} action="/catalog">
				<input type="hidden" name="id" value={vehicle?.id} />
				{#snippet actions(close)}
					<Button variant="ghost" type="button" onclick={close}>Cancel</Button>
					<Button type="submit" variant="error" disabled={!!deleteVehicle.pending}>
						Delete
					</Button>
				{/snippet}
			</form>
		{/snippet}
	</Dialog>
{/if}

<!-- Image Manager SlidePanel -->
<SlidePanel
	bind:open={showImageManager}
	title="Manage Images"
	subtitle={vehicle ? `${vehicle.model_year || ''} ${vehicle.model_name}`.trim() : ''}
	size="lg"
>
	{#snippet children()}
		<div class="kui-image-manager">
			<!-- Toolbar -->
			<div class="kui-image-toolbar">
				<div class="kui-image-filters">
					<button
						class={`kui-filter-btn ${imageSourceFilter === 'all' ? 'is-active' : ''}`}
						onclick={() => (imageSourceFilter = 'all')}
					>
						All ({vehicleImages.length})
					</button>
					<button
						class={`kui-filter-btn ${imageSourceFilter === 'stock' ? 'is-active' : ''}`}
						onclick={() => (imageSourceFilter = 'stock')}
					>
						<Package class="kui-icon-xs" />
						Stock ({vehicleImages.filter((i) => i.image_source === 'stock').length})
					</button>
					<button
						class={`kui-filter-btn ${imageSourceFilter === 'custom' ? 'is-active' : ''}`}
						onclick={() => (imageSourceFilter = 'custom')}
					>
						<Palette class="kui-icon-xs" />
						Custom ({vehicleImages.filter((i) => i.image_source === 'custom').length})
					</button>
				</div>

				<div class="kui-image-actions">
					{#if images().length > 0 && vehicleImages.length === 0}
						<Button
							variant="ghost"
							size="xs"
							onclick={handleSyncImages}
							disabled={isSyncingImages}
						>
							{#if isSyncingImages}
								<Loader2 class="kui-icon kui-spin" />
							{:else}
								<RefreshCw class="kui-icon" />
							{/if}
							Sync from JSON
						</Button>
					{/if}

					{#if vehicleImages.length > 0}
						<Button
							variant="ghost"
							size="xs"
							onclick={() => (showDeleteAllConfirm = true)}
						>
							<Trash2 class="kui-icon" />
							Delete All
						</Button>
					{/if}

					<label class="kui-upload-btn">
						<input
							type="file"
							accept="image/*"
							multiple
							onchange={handleImageUpload}
							disabled={isUploadingImage}
						/>
						{#if isUploadingImage}
							<Loader2 class="kui-icon kui-spin" />
							Uploading...
						{:else}
							<Upload class="kui-icon" />
							Upload Images
						{/if}
					</label>
				</div>
			</div>

			{#if uploadError}
				<div class="kui-error-banner">
					<AlertCircle class="kui-icon" />
					<p>{uploadError}</p>
				</div>
			{/if}

			<!-- Help text -->
			{#if vehicleImages.length === 0 && images().length > 0}
				<div class="kui-help-banner">
					<AlertCircle class="kui-icon" />
					<p>
						This vehicle has {images().length} images stored in JSON format. Click "Sync
						from JSON" to migrate them to the image manager.
					</p>
				</div>
			{/if}

			<!-- Image Grid -->
			{#if displayImages().length === 0}
				<div class="kui-empty-images">
					<ImageIcon class="kui-empty-icon" />
					<h4>No images</h4>
					<p>Upload images or sync from existing JSON data</p>
				</div>
			{:else}
				<div class="kui-image-grid">
					{#each displayImages() as image (image.id)}
						<div
							class={`kui-image-card ${image.is_primary ? 'is-primary' : ''} ${draggedImageId === image.id ? 'is-dragging' : ''}`}
							draggable="true"
							ondragstart={() => handleDragStart(image.id)}
							ondragover={handleDragOver}
							ondrop={() => handleDrop(image.id)}
							role="listitem"
						>
							<div class="kui-image-card__preview">
								<img
									src={image.displayUrl}
									alt={image.alt_text || 'Vehicle image'}
								/>

								<!-- Overlay actions -->
								<div class="kui-image-card__overlay">
									<button
										class="kui-image-action"
										onclick={() => handleSetPrimary(image.id)}
										title={image.is_primary
											? 'Primary image'
											: 'Set as primary'}
									>
										<Star
											class={`kui-icon ${image.is_primary ? 'kui-filled' : ''}`}
										/>
									</button>
									<button
										class="kui-image-action"
										onclick={() => handleDeleteImage(image.id)}
										title="Delete image"
										disabled={isDeletingImage === image.id}
									>
										{#if isDeletingImage === image.id}
											<Loader2 class="kui-icon kui-spin" />
										{:else}
											<Trash2 class="kui-icon" />
										{/if}
									</button>
								</div>

								<!-- Drag handle -->
								<div class="kui-image-card__drag">
									<GripVertical class="kui-icon" />
								</div>

								{#if image.is_primary}
									<div class="kui-image-card__badge">
										<Star class="kui-icon-xs" />
										Primary
									</div>
								{/if}
							</div>

							<div class="kui-image-card__footer">
								<button
									class={`kui-source-toggle ${image.image_source}`}
									onclick={() =>
										handleToggleImageSource(image.id, image.image_source)}
									title={`Switch to ${image.image_source === 'stock' ? 'custom' : 'stock'}`}
								>
									{#if image.image_source === 'stock'}
										<Package class="kui-icon-xs" />
										Stock
									{:else}
										<Palette class="kui-icon-xs" />
										Custom
									{/if}
								</button>
								<span class="kui-image-order">#{image.sort_order + 1}</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet footer()}
		<Button variant="ghost" onclick={() => (showImageManager = false)}>Close</Button>
	{/snippet}
</SlidePanel>

<!-- Delete All Images Confirmation -->
{#if showDeleteAllConfirm}
	<Dialog
		bind:open={showDeleteAllConfirm}
		size="sm"
		onClose={() => (showDeleteAllConfirm = false)}
	>
		{#snippet header()}
			<div class="kui-modal-header">
				<h3>Delete All Images</h3>
				<Button variant="ghost" size="xs" onclick={() => (showDeleteAllConfirm = false)}>
					<X class="kui-icon" />
				</Button>
			</div>
		{/snippet}
		{#snippet children()}
			<p>
				Are you sure you want to delete all {vehicleImages.length} images? This action cannot
				be undone.
			</p>
			<div class="kui-modal-actions">
				<Button variant="ghost" onclick={() => (showDeleteAllConfirm = false)}
					>Cancel</Button
				>
				<Button variant="error" onclick={handleDeleteAllImages}>Delete All Images</Button>
			</div>
		{/snippet}
	</Dialog>
{/if}

<style>
	.kui-vehicle-detail {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.kui-not-found {
		max-width: 500px;
		margin: 48px auto;
	}

	.kui-empty {
		display: grid;
		gap: 12px;
		justify-items: center;
		text-align: center;
		padding: 32px;
	}

	.kui-icon-hero {
		width: 80px;
		height: 80px;
		border-radius: 20px;
		background: linear-gradient(135deg, #fde68a, #fbbf24);
		display: grid;
		place-items: center;
		color: #78350f;
	}

	.kui-icon-hero :global(svg) {
		width: 40px;
		height: 40px;
	}

	.kui-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.kui-header__actions {
		display: flex;
		gap: 8px;
	}

	.kui-icon {
		width: 16px;
		height: 16px;
	}

	h2 {
		margin: 8px 0;
		font-size: 24px;
	}

	h3 {
		margin: 0 0 16px;
		font-size: 18px;
	}

	h4 {
		margin: 0 0 12px;
		font-size: 14px;
		color: #6b7280;
	}

	.kui-subtext {
		color: #6b7280;
		margin: 0;
	}

	/* Content Layout */
	.kui-content {
		display: grid;
		grid-template-columns: 1fr 320px;
		gap: 20px;
		align-items: start;
	}

	.kui-main {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.kui-sidebar {
		display: flex;
		flex-direction: column;
		gap: 16px;
		position: sticky;
		top: 20px;
	}

	/* Gallery */
	.kui-gallery {
		overflow: hidden;
	}

	.kui-gallery__main {
		aspect-ratio: 16/9;
		background: #f4f4f5;
		overflow: hidden;
	}

	.kui-gallery__main img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.kui-gallery__placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: #9ca3af;
	}

	.kui-gallery__placeholder :global(svg) {
		width: 48px;
		height: 48px;
	}

	.kui-gallery__thumbs {
		display: flex;
		gap: 8px;
		padding: 12px;
		overflow-x: auto;
	}

	.kui-thumb {
		width: 64px;
		height: 48px;
		border-radius: 6px;
		overflow: hidden;
		border: 2px solid transparent;
		cursor: pointer;
		flex-shrink: 0;
	}

	.kui-thumb.is-active {
		border-color: var(--kui-color-primary);
	}

	.kui-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* Sections */
	.kui-section {
		padding: 20px;
	}

	/* Specs Grid */
	.kui-specs-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 16px;
	}

	.kui-spec-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px;
		background: #f9fafb;
		border-radius: 8px;
	}

	.kui-spec-item__label {
		font-size: 11px;
		text-transform: uppercase;
		color: #9ca3af;
		letter-spacing: 0.05em;
	}

	.kui-spec-item__value {
		font-size: 14px;
		font-weight: 500;
	}

	/* Features List */
	.kui-features-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 12px;
	}

	.kui-features-list li {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 12px;
		background: #f9fafb;
		border-radius: 8px;
	}

	.kui-success {
		color: #059669;
		flex-shrink: 0;
	}

	.kui-description {
		line-height: 1.7;
		color: #374151;
	}

	/* Info Card */
	.kui-info-card {
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.kui-info-card__header {
		display: flex;
		justify-content: flex-end;
	}

	.kui-info-card__brand {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #6b7280;
		font-size: 14px;
	}

	.kui-price-block {
		background: linear-gradient(135deg, #ecfdf5, #d1fae5);
		padding: 16px;
		border-radius: 12px;
		text-align: center;
	}

	.kui-price {
		font-size: 28px;
		font-weight: 700;
		color: #059669;
		margin: 0;
	}

	.kui-price-label {
		font-size: 12px;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.kui-source-link {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		background: #f4f4f5;
		border-radius: 8px;
		color: var(--kui-color-primary);
		text-decoration: none;
		font-weight: 500;
		transition: background 0.2s;
	}

	.kui-source-link:hover {
		background: #e5e7eb;
	}

	/* Quick Stats */
	.kui-quick-stats {
		padding: 16px;
	}

	.kui-stat-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.kui-stat-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
		border-bottom: 1px solid #f4f4f5;
	}

	.kui-stat-item:last-child {
		border-bottom: none;
	}

	.kui-stat-item__label {
		font-size: 13px;
		color: #6b7280;
	}

	.kui-stat-item__value {
		font-size: 13px;
		font-weight: 500;
	}

	/* Meta Card */
	.kui-meta-card {
		padding: 16px;
	}

	.kui-meta-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.kui-meta-item {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
	}

	.kui-meta-item span:first-child {
		color: #6b7280;
	}

	code {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 11px;
		background: #f4f4f5;
		padding: 2px 6px;
		border-radius: 4px;
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Edit Form */
	.kui-edit-form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.kui-form-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
	}

	.kui-form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding-top: 12px;
		border-top: 1px solid #e5e7eb;
	}

	.font-mono {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 13px;
	}

	/* Native form elements for edit mode */
	.kui-native-input,
	.kui-native-select,
	.kui-native-textarea {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		font-size: 14px;
		background: white;
		transition: border-color 0.2s;
	}

	.kui-native-input:focus,
	.kui-native-select:focus,
	.kui-native-textarea:focus {
		outline: none;
		border-color: var(--kui-color-primary);
	}

	.kui-native-textarea {
		resize: vertical;
		min-height: 80px;
	}

	/* Modal */
	.kui-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	/* Edit sections in slide panel */
	.kui-edit-sections {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.kui-edit-section {
		padding-bottom: 24px;
		border-bottom: 1px solid #e5e7eb;
	}

	.kui-edit-section:last-child {
		padding-bottom: 0;
		border-bottom: none;
	}

	.kui-edit-section h4 {
		margin: 0 0 16px;
		font-size: 14px;
		font-weight: 600;
		color: #374151;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	@media (max-width: 1024px) {
		.kui-content {
			grid-template-columns: 1fr;
		}

		.kui-sidebar {
			position: static;
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
			gap: 16px;
		}
	}

	@media (max-width: 640px) {
		.kui-form-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Spinner animation */
	.kui-spin {
		animation: kui-spin 1s linear infinite;
	}

	@keyframes kui-spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* Error banner */
	.kui-error-banner {
		padding: 12px 16px;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		color: #dc2626;
		font-size: 14px;
		margin-bottom: 16px;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.kui-error-banner p {
		margin: 0;
	}

	/* Gallery Header */
	.kui-gallery__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid #f4f4f5;
	}

	.kui-gallery__info {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: #6b7280;
	}

	.kui-thumb__primary {
		position: absolute;
		top: 2px;
		right: 2px;
		background: #fbbf24;
		color: white;
		border-radius: 50%;
		width: 16px;
		height: 16px;
		display: grid;
		place-items: center;
	}

	.kui-thumb {
		position: relative;
	}

	.kui-icon-xs {
		width: 10px;
		height: 10px;
	}

	/* Image Manager */
	.kui-image-manager {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.kui-image-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		padding-bottom: 16px;
		border-bottom: 1px solid #e5e7eb;
	}

	.kui-image-filters {
		display: flex;
		gap: 4px;
	}

	.kui-filter-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		background: white;
		font-size: 13px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.kui-filter-btn:hover {
		background: #f9fafb;
	}

	.kui-filter-btn.is-active {
		background: var(--kui-color-primary);
		border-color: var(--kui-color-primary);
		color: white;
	}

	.kui-image-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.kui-upload-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		background: var(--kui-color-primary);
		color: white;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.kui-upload-btn:hover {
		opacity: 0.9;
	}

	.kui-upload-btn input {
		display: none;
	}

	.kui-help-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 8px;
		color: #1d4ed8;
		font-size: 14px;
	}

	.kui-help-banner p {
		margin: 0;
	}

	.kui-empty-images {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		text-align: center;
		color: #9ca3af;
	}

	.kui-empty-icon {
		width: 48px;
		height: 48px;
		margin-bottom: 12px;
	}

	.kui-empty-images h4 {
		margin: 0 0 4px;
		font-size: 16px;
		color: #6b7280;
	}

	.kui-empty-images p {
		margin: 0;
		font-size: 14px;
	}

	/* Image Grid */
	.kui-image-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 16px;
	}

	.kui-image-card {
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		overflow: hidden;
		background: white;
		transition: all 0.2s;
	}

	.kui-image-card:hover {
		border-color: #d1d5db;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}

	.kui-image-card.is-primary {
		border-color: #fbbf24;
		box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.2);
	}

	.kui-image-card.is-dragging {
		opacity: 0.5;
	}

	.kui-image-card__preview {
		position: relative;
		aspect-ratio: 4/3;
		background: #f9fafb;
		overflow: hidden;
	}

	.kui-image-card__preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.kui-image-card__overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.kui-image-card:hover .kui-image-card__overlay {
		opacity: 1;
	}

	.kui-image-action {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: none;
		background: white;
		color: #374151;
		cursor: pointer;
		display: grid;
		place-items: center;
		transition: all 0.2s;
	}

	.kui-image-action:hover {
		background: #f3f4f6;
	}

	.kui-image-action .kui-filled {
		fill: #fbbf24;
		color: #fbbf24;
	}

	.kui-image-card__drag {
		position: absolute;
		top: 8px;
		left: 8px;
		width: 24px;
		height: 24px;
		background: rgba(255, 255, 255, 0.9);
		border-radius: 4px;
		display: grid;
		place-items: center;
		cursor: grab;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.kui-image-card:hover .kui-image-card__drag {
		opacity: 1;
	}

	.kui-image-card__badge {
		position: absolute;
		bottom: 8px;
		left: 8px;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		background: #fbbf24;
		color: white;
		font-size: 11px;
		font-weight: 500;
		border-radius: 4px;
	}

	.kui-image-card__footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		border-top: 1px solid #f4f4f5;
	}

	.kui-source-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		border: 1px solid #e5e7eb;
		border-radius: 4px;
		background: #f9fafb;
		font-size: 11px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.kui-source-toggle:hover {
		background: #f3f4f6;
	}

	.kui-source-toggle.stock {
		background: #ecfdf5;
		border-color: #a7f3d0;
		color: #059669;
	}

	.kui-source-toggle.custom {
		background: #fef3c7;
		border-color: #fcd34d;
		color: #d97706;
	}

	.kui-image-order {
		font-size: 12px;
		color: #9ca3af;
		font-weight: 500;
	}

	.kui-modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 16px;
	}
</style>
