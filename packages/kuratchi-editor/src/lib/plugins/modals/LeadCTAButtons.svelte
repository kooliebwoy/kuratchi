<script lang="ts">
    import { getContext } from 'svelte';
    import { openFormModal, openVehicleInquiryModal, type LeadCTA, type AfterSubmitAction } from './modal-manager.svelte.js';
    import { Phone, Mail, MessageSquare, FileText, Calendar, DollarSign } from '@lucide/svelte';

    interface Props {
        // CTAs to display
        ctas: LeadCTA[];
        // Vehicle context for prefilling forms
        vehicleId?: string;
        vehicleName?: string;
        vehiclePrice?: number;
        vehicleCategory?: string;
        vehicleOem?: string;
        // Layout
        layout?: 'horizontal' | 'vertical' | 'stacked';
        size?: 'sm' | 'md' | 'lg';
        fullWidth?: boolean;
        // Mode
        mode?: 'list' | 'detail';
    }

    let {
        ctas = [],
        vehicleId,
        vehicleName,
        vehiclePrice,
        vehicleCategory,
        vehicleOem,
        layout = 'horizontal',
        size = 'md',
        fullWidth = false,
        mode = 'list'
    }: Props = $props();

    // Icon mapping
    const iconMap: Record<string, typeof Phone> = {
        phone: Phone,
        mail: Mail,
        message: MessageSquare,
        form: FileText,
        calendar: Calendar,
        price: DollarSign
    };

    // Get button classes based on style
    function getButtonClass(style: LeadCTA['style']): string {
        const base = 'lead-cta__btn';
        const styleClass = `lead-cta__btn--${style}`;
        const sizeClass = `lead-cta__btn--${size}`;
        const fullWidthClass = fullWidth ? 'lead-cta__btn--full' : '';
        return `${base} ${styleClass} ${sizeClass} ${fullWidthClass}`.trim();
    }

    // Build after submit action
    function buildAfterSubmitAction(cta: LeadCTA): AfterSubmitAction {
        switch (cta.afterSubmitAction) {
            case 'close':
                return { type: 'close' };
            case 'redirect':
                return { type: 'redirect', url: cta.afterSubmitUrl || '/' };
            case 'message':
            default:
                return { 
                    type: 'message', 
                    message: cta.afterSubmitMessage || 'Thank you! We\'ll be in touch soon.',
                    messageType: 'success',
                    autoCloseDelay: 3000
                };
        }
    }

    // Handle CTA click
    function handleCTAClick(cta: LeadCTA) {
        const prefillData: Record<string, any> = {};
        
        // Add vehicle context if available
        if (vehicleId) prefillData.vehicle_id = vehicleId;
        if (vehicleName) prefillData.vehicle_name = vehicleName;
        if (vehiclePrice) prefillData.vehicle_price = vehiclePrice;
        if (vehicleCategory) prefillData.vehicle_category = vehicleCategory;
        if (vehicleOem) prefillData.vehicle_oem = vehicleOem;
        
        // Apply any prefill mappings from CTA config
        if (cta.prefillMapping) {
            Object.entries(cta.prefillMapping).forEach(([formField, contextField]) => {
                if (contextField === 'vehicleId' && vehicleId) prefillData[formField] = vehicleId;
                if (contextField === 'vehicleName' && vehicleName) prefillData[formField] = vehicleName;
                if (contextField === 'vehiclePrice' && vehiclePrice) prefillData[formField] = vehiclePrice;
                if (contextField === 'vehicleCategory' && vehicleCategory) prefillData[formField] = vehicleCategory;
                if (contextField === 'vehicleOem' && vehicleOem) prefillData[formField] = vehicleOem;
            });
        }

        // Open the form modal
        if (vehicleId && vehicleName) {
            openVehicleInquiryModal({
                vehicleId,
                vehicleName,
                formId: cta.formId,
                additionalData: prefillData,
                afterSubmit: buildAfterSubmitAction(cta)
            });
        } else {
            openFormModal({
                formId: cta.formId,
                title: cta.label,
                prefillData,
                afterSubmit: buildAfterSubmitAction(cta)
            });
        }
    }
</script>

{#if ctas.length > 0}
    <div 
        class="lead-cta"
        class:lead-cta--horizontal={layout === 'horizontal'}
        class:lead-cta--vertical={layout === 'vertical'}
        class:lead-cta--stacked={layout === 'stacked'}
        class:lead-cta--list={mode === 'list'}
        class:lead-cta--detail={mode === 'detail'}
    >
        {#each ctas as cta (cta.id)}
            <button
                class={getButtonClass(cta.style)}
                onclick={() => handleCTAClick(cta)}
                type="button"
            >
                {#if cta.icon && iconMap[cta.icon]}
                    <svelte:component this={iconMap[cta.icon]} size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
                {/if}
                <span>{cta.label}</span>
            </button>
        {/each}
    </div>
{/if}

<style>
    .lead-cta {
        display: flex;
        gap: 0.5rem;
    }

    .lead-cta--horizontal {
        flex-direction: row;
        flex-wrap: wrap;
    }

    .lead-cta--vertical {
        flex-direction: column;
    }

    .lead-cta--stacked {
        flex-direction: column;
        gap: 0.375rem;
    }

    .lead-cta--list {
        margin-top: 0.75rem;
    }

    .lead-cta--detail {
        margin-top: 1rem;
    }

    .lead-cta__btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        font-weight: 500;
        border-radius: 0.5rem;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
    }

    /* Sizes */
    .lead-cta__btn--sm {
        padding: 0.375rem 0.75rem;
        font-size: 0.8125rem;
    }

    .lead-cta__btn--md {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
    }

    .lead-cta__btn--lg {
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
    }

    .lead-cta__btn--full {
        width: 100%;
    }

    /* Styles */
    .lead-cta__btn--primary {
        background: #0f172a;
        color: #ffffff;
        border: none;
    }

    .lead-cta__btn--primary:hover {
        background: #1e293b;
    }

    .lead-cta__btn--secondary {
        background: #64748b;
        color: #ffffff;
        border: none;
    }

    .lead-cta__btn--secondary:hover {
        background: #475569;
    }

    .lead-cta__btn--outline {
        background: transparent;
        color: #0f172a;
        border: 1.5px solid #e2e8f0;
    }

    .lead-cta__btn--outline:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
    }

    .lead-cta__btn--ghost {
        background: transparent;
        color: #3b82f6;
        border: none;
    }

    .lead-cta__btn--ghost:hover {
        background: #eff6ff;
    }

    /* Focus states */
    .lead-cta__btn:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
    }

    .lead-cta__btn:active {
        transform: scale(0.98);
    }
</style>
