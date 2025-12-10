/**
 * Modal Manager Store
 * 
 * A global state manager for modals that can be used across the application.
 * Supports form modals, confirmation dialogs, and custom content.
 */

export type ModalType = 'form' | 'confirm' | 'custom' | 'vehicle-inquiry';

export interface ModalConfig {
    id: string;
    type: ModalType;
    title?: string;
    // Form modal specific
    formId?: string;
    formData?: Record<string, any>;
    // Vehicle inquiry specific
    vehicleId?: string;
    vehicleName?: string;
    // Custom content
    content?: any;
    // Behavior
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    showCloseButton?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    // Callbacks
    onSubmit?: (data: any) => Promise<void> | void;
    onClose?: () => void;
    // Post-submission actions
    afterSubmit?: AfterSubmitAction;
}

export interface AfterSubmitAction {
    type: 'close' | 'redirect' | 'message' | 'callback';
    // For redirect
    url?: string;
    // For message
    message?: string;
    messageType?: 'success' | 'info' | 'warning';
    autoCloseDelay?: number;
    // For callback
    callback?: () => void;
}

export interface LeadCTA {
    id: string;
    label: string;
    formId: string;
    style: 'primary' | 'secondary' | 'outline' | 'ghost';
    icon?: string;
    position?: 'inline' | 'sticky' | 'floating';
    // Pre-fill data from context (e.g., vehicle info)
    prefillMapping?: Record<string, string>;
    // After submission
    afterSubmit?: AfterSubmitAction;
}

export interface LeadCTAConfig {
    // For list/grid views
    listCTAs?: LeadCTA[];
    // For detail/modal views
    detailCTAs?: LeadCTA[];
    // Max CTAs per view
    maxListCTAs?: number;
    maxDetailCTAs?: number;
}

class ModalManager {
    // Modal state
    public activeModals = $state<ModalConfig[]>([]);
    public modalHistory = $state<string[]>([]);

    // Form data being submitted
    public submittingFormId = $state<string | null>(null);
    public submissionError = $state<string | null>(null);
    public submissionSuccess = $state<boolean>(false);

    /**
     * Open a modal
     */
    openModal(config: ModalConfig) {
        // Ensure unique ID
        const id = config.id || `modal-${Date.now()}`;
        const modalConfig = { ...config, id };

        // Add to active modals
        this.activeModals = [...this.activeModals, modalConfig];
        this.modalHistory = [...this.modalHistory, id];

        // Prevent body scroll
        if (typeof document !== 'undefined') {
            document.body.style.overflow = 'hidden';
        }

        return id;
    }

    /**
     * Close a specific modal by ID
     */
    closeModal(id: string) {
        const modal = this.activeModals.find(m => m.id === id);
        if (modal?.onClose) {
            modal.onClose();
        }

        this.activeModals = this.activeModals.filter(m => m.id !== id);

        // Restore body scroll if no more modals
        if (this.activeModals.length === 0 && typeof document !== 'undefined') {
            document.body.style.overflow = '';
        }
    }

    /**
     * Close the topmost modal
     */
    closeTopModal() {
        if (this.activeModals.length > 0) {
            this.closeModal(this.activeModals[this.activeModals.length - 1].id);
        }
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        this.activeModals.forEach(m => m.onClose?.());
        this.activeModals = [];

        if (typeof document !== 'undefined') {
            document.body.style.overflow = '';
        }
    }

    /**
     * Open a form modal
     */
    openFormModal(options: {
        formId: string;
        title?: string;
        prefillData?: Record<string, any>;
        afterSubmit?: AfterSubmitAction;
        onSubmit?: (data: any) => Promise<void> | void;
    }) {
        return this.openModal({
            id: `form-${options.formId}-${Date.now()}`,
            type: 'form',
            formId: options.formId,
            formData: options.prefillData,
            title: options.title,
            closeOnBackdrop: true,
            closeOnEscape: true,
            showCloseButton: true,
            size: 'md',
            afterSubmit: options.afterSubmit || { type: 'message', message: 'Thank you! We\'ll be in touch soon.', messageType: 'success', autoCloseDelay: 3000 },
            onSubmit: options.onSubmit
        });
    }

    /**
     * Open a vehicle inquiry modal
     */
    openVehicleInquiryModal(options: {
        vehicleId: string;
        vehicleName: string;
        formId: string;
        additionalData?: Record<string, any>;
        afterSubmit?: AfterSubmitAction;
    }) {
        return this.openModal({
            id: `vehicle-inquiry-${options.vehicleId}-${Date.now()}`,
            type: 'vehicle-inquiry',
            formId: options.formId,
            vehicleId: options.vehicleId,
            vehicleName: options.vehicleName,
            title: `Inquire About ${options.vehicleName}`,
            formData: {
                vehicle_id: options.vehicleId,
                vehicle_name: options.vehicleName,
                ...options.additionalData
            },
            closeOnBackdrop: true,
            closeOnEscape: true,
            showCloseButton: true,
            size: 'md',
            afterSubmit: options.afterSubmit || {
                type: 'message',
                message: 'Thank you for your inquiry! Our team will contact you shortly.',
                messageType: 'success',
                autoCloseDelay: 3000
            }
        });
    }

    /**
     * Handle form submission
     */
    async handleFormSubmission(
        modalId: string,
        formId: string,
        data: Record<string, any>,
        siteId?: string
    ) {
        this.submittingFormId = formId;
        this.submissionError = null;
        this.submissionSuccess = false;

        try {
            // Submit to the forms API
            const response = await fetch('/api/forms/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formId,
                    siteId,
                    data
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to submit form');
            }

            this.submissionSuccess = true;

            // Get the modal config for after-submit action
            const modal = this.activeModals.find(m => m.id === modalId);
            if (modal?.afterSubmit) {
                await this.handleAfterSubmit(modalId, modal.afterSubmit);
            } else {
                // Default: close after delay
                setTimeout(() => this.closeModal(modalId), 2000);
            }

            return { success: true };
        } catch (err) {
            this.submissionError = err instanceof Error ? err.message : 'An error occurred';
            return { success: false, error: this.submissionError };
        } finally {
            this.submittingFormId = null;
        }
    }

    /**
     * Handle post-submission actions
     */
    async handleAfterSubmit(modalId: string, action: AfterSubmitAction) {
        switch (action.type) {
            case 'close':
                this.closeModal(modalId);
                break;

            case 'redirect':
                if (action.url) {
                    window.location.href = action.url;
                }
                break;

            case 'message':
                // The modal component will show the message
                // Auto-close after delay if specified
                if (action.autoCloseDelay) {
                    setTimeout(() => this.closeModal(modalId), action.autoCloseDelay);
                }
                break;

            case 'callback':
                action.callback?.();
                break;
        }
    }
}

// Create singleton instance
export const modalManager = new ModalManager();

// Export helper functions that delegate to the singleton
// This maintains backward compatibility for existing function calls
export const openModal = (config: ModalConfig) => modalManager.openModal(config);
export const closeModal = (id: string) => modalManager.closeModal(id);
export const closeTopModal = () => modalManager.closeTopModal();
export const closeAllModals = () => modalManager.closeAllModals();
export const openFormModal = (options: any) => modalManager.openFormModal(options);
export const openVehicleInquiryModal = (options: any) => modalManager.openVehicleInquiryModal(options);
export const handleFormSubmission = (modalId: string, formId: string, data: any, siteId?: string) =>
    modalManager.handleFormSubmission(modalId, formId, data, siteId);

