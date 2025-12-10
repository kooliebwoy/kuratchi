<script lang="ts">
	import { X, CheckCircle, AlertCircle, Loader2 } from '@lucide/svelte';
	import {
		modalManager,
		closeModal,
		closeTopModal,
		handleFormSubmission,
		type ModalConfig,
		type AfterSubmitAction,
	} from './modal-manager.svelte.js';
	import FormRenderer from './FormRenderer.svelte';
	import { getContext } from 'svelte';

	// Get forms from site metadata context if available
	interface Form {
		id: string;
		name: string;
		description?: string;
		fields: any[];
		settings: any;
		styling?: any;
	}

	const siteMetadata = getContext<{ forms?: Form[] }>('siteMetadata');

	// Handle escape key
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			const topModal = modalManager.activeModals[modalManager.activeModals.length - 1];
			if (topModal?.closeOnEscape !== false) {
				closeTopModal();
			}
		}
	}

	// Get form by ID
	function getForm(formId: string): Form | undefined {
		return siteMetadata?.forms?.find((f) => f.id === formId);
	}

	// Get modal size class
	function getSizeClass(size?: string): string {
		switch (size) {
			case 'sm':
				return 'modal-container__dialog--sm';
			case 'lg':
				return 'modal-container__dialog--lg';
			case 'xl':
				return 'modal-container__dialog--xl';
			case 'full':
				return 'modal-container__dialog--full';
			default:
				return 'modal-container__dialog--md';
		}
	}

	// Handle form submit
	async function onFormSubmit(modal: ModalConfig, data: Record<string, any>) {
		if (!modal.formId) return;

		// Call custom onSubmit if provided
		if (modal.onSubmit) {
			await modal.onSubmit(data);
		}

		// Submit to API
		const siteId = siteMetadata ? (siteMetadata as any).siteId : undefined;
		await handleFormSubmission(modal.id, modal.formId, data, siteId);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if modalManager.activeModals.length > 0}
	<div class="modal-container">
		{#each modalManager.activeModals as modal, index (modal.id)}
			{@const form = modal.formId ? getForm(modal.formId) : null}
			{@const isSubmitting = modalManager.submittingFormId === modal.formId}
			{@const hasError =
				modalManager.submissionError && modalManager.submittingFormId === null}
			{@const hasSuccess =
				modalManager.submissionSuccess && modalManager.submittingFormId === null}

			<div
				class="modal-container__backdrop"
				class:modal-container__backdrop--visible={true}
				style="z-index: {1000 + index}"
				onclick={() => modal.closeOnBackdrop !== false && closeModal(modal.id)}
				onkeydown={(e) =>
					e.key === 'Enter' && modal.closeOnBackdrop !== false && closeModal(modal.id)}
				role="button"
				tabindex="0"
				aria-label="Close modal"
			>
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div
					class="modal-container__dialog {getSizeClass(modal.size)}"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
					role="document"
				>
					<!-- Header -->
					{#if modal.title || modal.showCloseButton !== false}
						<div class="modal-container__header">
							{#if modal.title}
								<h2 id="modal-title-{modal.id}" class="modal-container__title">
									{modal.title}
								</h2>
							{/if}
							{#if modal.showCloseButton !== false}
								<button
									class="modal-container__close"
									onclick={() => closeModal(modal.id)}
									aria-label="Close"
								>
									<X size={20} />
								</button>
							{/if}
						</div>
					{/if}

					<!-- Content -->
					<div class="modal-container__content">
						{#if hasSuccess && modal.afterSubmit?.type === 'message'}
							<!-- Success Message -->
							<div class="modal-container__message modal-container__message--success">
								<CheckCircle size={48} />
								<p>
									{modal.afterSubmit.message ||
										'Thank you! Your submission was successful.'}
								</p>
							</div>
						{:else if hasError}
							<!-- Error Message -->
							<div class="modal-container__message modal-container__message--error">
								<AlertCircle size={48} />
								<p>{modalManager.submissionError}</p>
								<button
									class="modal-container__retryBtn"
									onclick={() => {
										/* Reset error state handled by form */
									}}
								>
									Try Again
								</button>
							</div>
						{:else if modal.type === 'form' || modal.type === 'vehicle-inquiry'}
							<!-- Form Modal -->
							{#if form}
								{#if modal.type === 'vehicle-inquiry' && modal.vehicleName}
									<div class="modal-container__vehicleInfo">
										<span class="modal-container__vehicleLabel">Vehicle:</span>
										<span class="modal-container__vehicleName"
											>{modal.vehicleName}</span
										>
									</div>
								{/if}

								<FormRenderer
									{form}
									prefillData={modal.formData}
									onSubmit={(data) => onFormSubmit(modal, data)}
									{isSubmitting}
								/>
							{:else}
								<div
									class="modal-container__message modal-container__message--error"
								>
									<AlertCircle size={32} />
									<p>Form not found. Please contact support.</p>
								</div>
							{/if}
						{:else if modal.type === 'confirm'}
							<!-- Confirmation Modal -->
							<div class="modal-container__confirm">
								{#if modal.content}
									<p>{modal.content}</p>
								{/if}
								<div class="modal-container__confirmActions">
									<button
										class="modal-container__btn modal-container__btn--secondary"
										onclick={() => closeModal(modal.id)}
									>
										Cancel
									</button>
									<button
										class="modal-container__btn modal-container__btn--primary"
										onclick={() => {
											modal.onSubmit?.({});
											closeModal(modal.id);
										}}
									>
										Confirm
									</button>
								</div>
							</div>
						{:else if modal.type === 'custom'}
							<!-- Custom Content -->
							{#if modal.content}
								{@html modal.content}
							{/if}
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.modal-container {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 1000;
	}

	.modal-container__backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		pointer-events: auto;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.modal-container__backdrop--visible {
		opacity: 1;
	}

	.modal-container__dialog {
		background: #ffffff;
		border-radius: 1rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		max-height: calc(100vh - 2rem);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		animation: modalSlideIn 0.2s ease;
	}

	@keyframes modalSlideIn {
		from {
			opacity: 0;
			transform: translateY(-20px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.modal-container__dialog--sm {
		width: 100%;
		max-width: 400px;
	}

	.modal-container__dialog--md {
		width: 100%;
		max-width: 500px;
	}

	.modal-container__dialog--lg {
		width: 100%;
		max-width: 700px;
	}

	.modal-container__dialog--xl {
		width: 100%;
		max-width: 900px;
	}

	.modal-container__dialog--full {
		width: calc(100vw - 2rem);
		max-width: none;
		height: calc(100vh - 2rem);
		max-height: none;
	}

	.modal-container__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #e2e8f0;
		flex-shrink: 0;
	}

	.modal-container__title {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #0f172a;
	}

	.modal-container__close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 0.5rem;
		color: #64748b;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.modal-container__close:hover {
		background: #f1f5f9;
		color: #0f172a;
	}

	.modal-container__content {
		padding: 1.5rem;
		overflow-y: auto;
		flex: 1;
	}

	.modal-container__message {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		text-align: center;
	}

	.modal-container__message--success {
		color: #059669;
	}

	.modal-container__message--success p {
		color: #0f172a;
		font-size: 1rem;
		margin: 0;
	}

	.modal-container__message--error {
		color: #dc2626;
	}

	.modal-container__message--error p {
		color: #0f172a;
		font-size: 1rem;
		margin: 0;
	}

	.modal-container__retryBtn {
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background: #f1f5f9;
		border: none;
		border-radius: 0.5rem;
		color: #0f172a;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.modal-container__retryBtn:hover {
		background: #e2e8f0;
	}

	.modal-container__vehicleInfo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.modal-container__vehicleLabel {
		font-size: 0.875rem;
		color: #64748b;
	}

	.modal-container__vehicleName {
		font-weight: 600;
		color: #166534;
	}

	.modal-container__confirm {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.modal-container__confirm p {
		margin: 0;
		color: #475569;
		line-height: 1.6;
	}

	.modal-container__confirmActions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.modal-container__btn {
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.modal-container__btn--primary {
		background: #0f172a;
		color: #ffffff;
		border: none;
	}

	.modal-container__btn--primary:hover {
		background: #1e293b;
	}

	.modal-container__btn--secondary {
		background: transparent;
		color: #64748b;
		border: 1px solid #e2e8f0;
	}

	.modal-container__btn--secondary:hover {
		background: #f8fafc;
		color: #0f172a;
	}

	@media (max-width: 640px) {
		.modal-container__backdrop {
			padding: 0;
			align-items: flex-end;
		}

		.modal-container__dialog {
			border-radius: 1rem 1rem 0 0;
			max-height: 90vh;
			width: 100%;
			max-width: none !important;
		}

		.modal-container__dialog--full {
			border-radius: 0;
			height: 100vh;
			max-height: 100vh;
		}
	}
</style>
