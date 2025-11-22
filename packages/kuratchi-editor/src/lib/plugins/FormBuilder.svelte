<script lang="ts">
    import { Plus, Trash2, GripVertical, Settings, Mail, ChevronDown, ChevronUp, Eye } from '@lucide/svelte';
    import type { FormData, FormField, FormFieldType, FormFieldOption } from '../types';

    interface Props {
        formData: FormData;
        onUpdateForm?: (formData: FormData) => void | Promise<void>;
    }

    let {
        formData = $bindable(),
        onUpdateForm
    }: Props = $props();

    let selectedFieldId = $state<string | null>(null);
    let activeTab = $state<'design' | 'settings' | 'preview'>('design');
    let expandedSections = $state<Record<string, boolean>>({
        fields: true,
        recipients: false,
        autoResponder: false,
        styling: false
    });

    const uuid = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return Math.random().toString(36).slice(2);
    };

    const fieldTypeTemplates: Record<FormFieldType, Partial<FormField>> = {
        text: { label: 'Text Input', placeholder: 'Enter text...', width: '100' },
        email: { label: 'Email', placeholder: 'your@email.com', width: '100' },
        tel: { label: 'Phone Number', placeholder: '(123) 456-7890', width: '50' },
        number: { label: 'Number', placeholder: '0', width: '50' },
        textarea: { label: 'Message', placeholder: 'Type your message...', width: '100' },
        select: { label: 'Select Option', placeholder: 'Choose...', options: [
            { id: uuid(), label: 'Option 1', value: 'option1' },
            { id: uuid(), label: 'Option 2', value: 'option2' }
        ], width: '100' },
        checkbox: { label: 'Checkbox', options: [
            { id: uuid(), label: 'Option 1', value: 'option1' }
        ], width: '100' },
        radio: { label: 'Radio Group', options: [
            { id: uuid(), label: 'Option 1', value: 'option1' },
            { id: uuid(), label: 'Option 2', value: 'option2' }
        ], width: '100' },
        date: { label: 'Date', width: '50' },
        file: { label: 'File Upload', width: '100' }
    };

    function addField(type: FormFieldType) {
        const template = fieldTypeTemplates[type];
        const newField: FormField = {
            id: uuid(),
            type,
            label: template.label || 'New Field',
            name: `field_${Date.now()}`,
            required: false,
            placeholder: template.placeholder,
            options: template.options ? structuredClone(template.options) : undefined,
            width: template.width || '100'
        };

        formData.fields = [...formData.fields, newField];
        selectedFieldId = newField.id;
        notifyUpdate();
    }

    function updateField(fieldId: string, updates: Partial<FormField>) {
        formData.fields = formData.fields.map(field =>
            field.id === fieldId ? { ...field, ...updates } : field
        );
        notifyUpdate();
    }

    function removeField(fieldId: string) {
        formData.fields = formData.fields.filter(f => f.id !== fieldId);
        if (selectedFieldId === fieldId) {
            selectedFieldId = null;
        }
        notifyUpdate();
    }

    function moveField(fieldId: string, direction: 'up' | 'down') {
        const index = formData.fields.findIndex(f => f.id === fieldId);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= formData.fields.length) return;

        const newFields = [...formData.fields];
        [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
        formData.fields = newFields;
        notifyUpdate();
    }

    function addRecipient() {
        formData.settings.recipients = [...formData.settings.recipients, ''];
        notifyUpdate();
    }

    function updateRecipient(index: number, value: string) {
        formData.settings.recipients[index] = value;
        notifyUpdate();
    }

    function removeRecipient(index: number) {
        formData.settings.recipients = formData.settings.recipients.filter((_, i) => i !== index);
        notifyUpdate();
    }

    function toggleSection(section: string) {
        expandedSections[section] = !expandedSections[section];
    }

    function addOptionToField(fieldId: string) {
        const field = formData.fields.find(f => f.id === fieldId);
        if (!field) return;

        const newOption: FormFieldOption = {
            id: uuid(),
            label: 'New Option',
            value: `option_${Date.now()}`
        };

        const updatedOptions = [...(field.options || []), newOption];
        updateField(fieldId, { options: updatedOptions });
    }

    function updateFieldOption(fieldId: string, optionId: string, updates: Partial<FormFieldOption>) {
        const field = formData.fields.find(f => f.id === fieldId);
        if (!field || !field.options) return;

        const updatedOptions = field.options.map(opt =>
            opt.id === optionId ? { ...opt, ...updates } : opt
        );
        updateField(fieldId, { options: updatedOptions });
    }

    function removeFieldOption(fieldId: string, optionId: string) {
        const field = formData.fields.find(f => f.id === fieldId);
        if (!field || !field.options) return;

        const updatedOptions = field.options.filter(opt => opt.id !== optionId);
        updateField(fieldId, { options: updatedOptions });
    }

    function notifyUpdate() {
        if (onUpdateForm) {
            onUpdateForm(formData);
        }
    }
</script>

<div class="form-builder">
    <!-- Tab Navigation -->
    <div class="tabs">
        <button
            class="tab"
            class:tab-active={activeTab === 'design'}
            onclick={() => activeTab = 'design'}
        >
            Design
        </button>
        <button
            class="tab"
            class:tab-active={activeTab === 'settings'}
            onclick={() => activeTab = 'settings'}
        >
            <Settings size={16} />
            <span>Settings</span>
        </button>
        <button
            class="tab"
            class:tab-active={activeTab === 'preview'}
            onclick={() => activeTab = 'preview'}
        >
            <Eye size={16} />
            <span>Preview</span>
        </button>
    </div>

    <div class="content">
        {#if activeTab === 'design'}
            <!-- Add Field Buttons -->
            <div class="section">
                <div class="section-header">
                    <h3>Add Form Fields</h3>
                </div>
                <div class="field-grid">
                    <button onclick={() => addField('text')} class="field-btn">
                        <Plus size={16} />
                        <span>Text</span>
                    </button>
                    <button onclick={() => addField('email')} class="field-btn">
                        <Plus size={16} />
                        <span>Email</span>
                    </button>
                    <button onclick={() => addField('tel')} class="field-btn">
                        <Plus size={16} />
                        <span>Phone</span>
                    </button>
                    <button onclick={() => addField('number')} class="field-btn">
                        <Plus size={16} />
                        <span>Number</span>
                    </button>
                    <button onclick={() => addField('textarea')} class="field-btn">
                        <Plus size={16} />
                        <span>Textarea</span>
                    </button>
                    <button onclick={() => addField('select')} class="field-btn">
                        <Plus size={16} />
                        <span>Dropdown</span>
                    </button>
                    <button onclick={() => addField('checkbox')} class="field-btn">
                        <Plus size={16} />
                        <span>Checkbox</span>
                    </button>
                    <button onclick={() => addField('radio')} class="field-btn">
                        <Plus size={16} />
                        <span>Radio</span>
                    </button>
                    <button onclick={() => addField('date')} class="field-btn">
                        <Plus size={16} />
                        <span>Date</span>
                    </button>
                    <button onclick={() => addField('file')} class="field-btn">
                        <Plus size={16} />
                        <span>File</span>
                    </button>
                </div>
            </div>

            <!-- Form Fields List -->
            <div class="section">
                <button 
                    class="section-toggle"
                    onclick={() => toggleSection('fields')}
                >
                    <span class="section-title">Form Fields ({formData.fields.length})</span>
                    {#if expandedSections.fields}
                        <ChevronUp size={16} />
                    {:else}
                        <ChevronDown size={16} />
                    {/if}
                </button>
                
                {#if expandedSections.fields}
                    <div class="section-content">
                        {#if formData.fields.length === 0}
                            <p class="empty-message">No fields yet. Add fields using the buttons above.</p>
                        {:else}
                            {#each formData.fields as field, index (field.id)}
                                <div 
                                    class="field-item"
                                    class:field-item-selected={selectedFieldId === field.id}
                                >
                                    <div class="field-item-controls">
                                        <div class="move-buttons">
                                            <button
                                                onclick={() => moveField(field.id, 'up')}
                                                disabled={index === 0}
                                                class="icon-btn"
                                                title="Move up"
                                            >
                                                <ChevronUp size={14} />
                                            </button>
                                            <button
                                                onclick={() => moveField(field.id, 'down')}
                                                disabled={index === formData.fields.length - 1}
                                                class="icon-btn"
                                                title="Move down"
                                            >
                                                <ChevronDown size={14} />
                                            </button>
                                        </div>
                                        
                                        <button
                                            onclick={() => selectedFieldId = selectedFieldId === field.id ? null : field.id}
                                            class="field-item-main"
                                        >
                                            <GripVertical size={16} class="grip-icon" />
                                            <div class="field-item-info">
                                                <div class="field-label">{field.label}</div>
                                                <div class="field-meta">
                                                    {field.type} • {field.required ? 'Required' : 'Optional'} • Width: {field.width}%
                                                </div>
                                            </div>
                                        </button>
                                        
                                        <button
                                            onclick={() => removeField(field.id)}
                                            class="icon-btn delete-btn"
                                            title="Delete field"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {#if selectedFieldId === field.id}
                                    {@const hasOptions = ['select', 'checkbox', 'radio'].includes(field.type)}
                                    <div class="field-editor">
                                        <div class="form-group">
                                            <label class="label">Label</label>
                                            <input
                                                type="text"
                                                class="input"
                                                value={field.label}
                                                oninput={(e) => updateField(field.id, { label: e.currentTarget.value })}
                                            />
                                        </div>

                                        <div class="form-group">
                                            <label class="label">Field Name (for data)</label>
                                            <input
                                                type="text"
                                                class="input"
                                                value={field.name}
                                                oninput={(e) => updateField(field.id, { name: e.currentTarget.value })}
                                            />
                                            <p class="hint">Used for identifying this field in form submissions</p>
                                        </div>

                                        {#if !hasOptions && field.type !== 'checkbox'}
                                            <div class="form-group">
                                                <label class="label">Placeholder</label>
                                                <input
                                                    type="text"
                                                    class="input"
                                                    value={field.placeholder || ''}
                                                    oninput={(e) => updateField(field.id, { placeholder: e.currentTarget.value })}
                                                />
                                            </div>
                                        {/if}

                                        <div class="form-group">
                                            <label class="label">Help Text</label>
                                            <input
                                                type="text"
                                                class="input"
                                                placeholder="Optional hint for users"
                                                value={field.helpText || ''}
                                                oninput={(e) => updateField(field.id, { helpText: e.currentTarget.value })}
                                            />
                                        </div>

                                        <div class="form-group">
                                            <label class="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    class="checkbox"
                                                    checked={field.required}
                                                    onchange={(e) => updateField(field.id, { required: e.currentTarget.checked })}
                                                />
                                                <span>Required</span>
                                            </label>
                                        </div>

                                        <div class="form-group">
                                            <label class="label">Field Width</label>
                                            <select
                                                class="select"
                                                value={field.width}
                                                onchange={(e) => updateField(field.id, { width: e.currentTarget.value as any })}
                                            >
                                                <option value="25">25%</option>
                                                <option value="33">33%</option>
                                                <option value="50">50%</option>
                                                <option value="66">66%</option>
                                                <option value="75">75%</option>
                                                <option value="100">100%</option>
                                            </select>
                                        </div>

                                        {#if field.type === 'number'}
                                            <div class="form-row">
                                                <div class="form-group">
                                                    <label class="label">Min Value</label>
                                                    <input
                                                        type="number"
                                                        class="input"
                                                        value={field.validation?.min ?? ''}
                                                        oninput={(e) => updateField(field.id, { 
                                                            validation: { 
                                                                ...field.validation, 
                                                                min: e.currentTarget.value ? Number(e.currentTarget.value) : undefined 
                                                            } 
                                                        })}
                                                    />
                                                </div>
                                                <div class="form-group">
                                                    <label class="label">Max Value</label>
                                                    <input
                                                        type="number"
                                                        class="input"
                                                        value={field.validation?.max ?? ''}
                                                        oninput={(e) => updateField(field.id, { 
                                                            validation: { 
                                                                ...field.validation, 
                                                                max: e.currentTarget.value ? Number(e.currentTarget.value) : undefined 
                                                            } 
                                                        })}
                                                    />
                                                </div>
                                            </div>
                                        {/if}

                                        {#if field.type === 'text' || field.type === 'email' || field.type === 'tel'}
                                            <div class="form-group">
                                                <label class="label">Validation Pattern (Regex)</label>
                                                <input
                                                    type="text"
                                                    class="input"
                                                    placeholder="e.g., ^[A-Za-z]+$"
                                                    value={field.validation?.pattern ?? ''}
                                                    oninput={(e) => updateField(field.id, { 
                                                        validation: { 
                                                            ...field.validation, 
                                                            pattern: e.currentTarget.value || undefined 
                                                        } 
                                                    })}
                                                />
                                            </div>
                                            <div class="form-group">
                                                <label class="label">Validation Error Message</label>
                                                <input
                                                    type="text"
                                                    class="input"
                                                    placeholder="e.g., Please enter a valid value"
                                                    value={field.validation?.errorMessage ?? ''}
                                                    oninput={(e) => updateField(field.id, { 
                                                        validation: { 
                                                            ...field.validation, 
                                                            errorMessage: e.currentTarget.value || undefined 
                                                        } 
                                                    })}
                                                />
                                            </div>
                                        {/if}

                                        {#if hasOptions}
                                            <div class="options-section">
                                                <div class="options-header">
                                                    <label class="label">Options</label>
                                                    <button onclick={() => addOptionToField(field.id)} class="btn-sm">
                                                        <Plus size={14} />
                                                        <span>Add</span>
                                                    </button>
                                                </div>
                                                
                                                <div class="options-list">
                                                    {#each field.options || [] as option (option.id)}
                                                        <div class="option-item">
                                                            <div class="option-inputs">
                                                                <input
                                                                    type="text"
                                                                    class="input input-sm"
                                                                    placeholder="Label"
                                                                    value={option.label}
                                                                    oninput={(e) => updateFieldOption(field.id, option.id, { label: e.currentTarget.value })}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    class="input input-sm"
                                                                    placeholder="Value"
                                                                    value={option.value}
                                                                    oninput={(e) => updateFieldOption(field.id, option.id, { value: e.currentTarget.value })}
                                                                />
                                                            </div>
                                                            <button
                                                                onclick={() => removeFieldOption(field.id, option.id)}
                                                                class="icon-btn delete-btn"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    {/each}

                                                    {#if !field.options || field.options.length === 0}
                                                        <p class="empty-message-sm">No options yet</p>
                                                    {/if}
                                                </div>
                                            </div>
                                        {/if}

                                        <div class="form-group">
                                            <label class="label">Default Value</label>
                                            <input
                                                type="text"
                                                class="input"
                                                placeholder="Optional default value"
                                                value={field.defaultValue || ''}
                                                oninput={(e) => updateField(field.id, { defaultValue: e.currentTarget.value })}
                                            />
                                        </div>
                                    </div>
                                {/if}
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>

        {:else if activeTab === 'settings'}
            <!-- Form Settings -->
            <div class="settings-container">
                <!-- Basic Settings -->
                <div class="section">
                    <div class="section-header">
                        <h3>Basic Settings</h3>
                    </div>
                    <div class="section-content">
                        <div class="form-group">
                            <label class="label">Form Name</label>
                            <input
                                type="text"
                                class="input"
                                bind:value={formData.settings.formName}
                                onchange={notifyUpdate}
                            />
                        </div>
                        <div class="form-group">
                            <label class="label">Submit Button Text</label>
                            <input
                                type="text"
                                class="input"
                                bind:value={formData.settings.submitButtonText}
                                onchange={notifyUpdate}
                            />
                        </div>
                        <div class="form-group">
                            <label class="label">Success Message</label>
                            <textarea
                                class="textarea"
                                rows="2"
                                bind:value={formData.settings.successMessage}
                                onchange={notifyUpdate}
                            ></textarea>
                        </div>
                        <div class="form-group">
                            <label class="label">Error Message</label>
                            <textarea
                                class="textarea"
                                rows="2"
                                bind:value={formData.settings.errorMessage}
                                onchange={notifyUpdate}
                            ></textarea>
                        </div>
                        <div class="form-group">
                            <label class="label">Redirect URL (optional)</label>
                            <input
                                type="text"
                                class="input"
                                placeholder="https://example.com/thank-you"
                                bind:value={formData.settings.redirectUrl}
                                onchange={notifyUpdate}
                            />
                        </div>
                    </div>
                </div>

                <!-- Recipients -->
                <div class="section">
                    <button 
                        class="section-toggle"
                        onclick={() => toggleSection('recipients')}
                    >
                        <div class="section-toggle-left">
                            <Mail size={16} />
                            <span class="section-title">Email Recipients</span>
                        </div>
                        {#if expandedSections.recipients}
                            <ChevronUp size={16} />
                        {:else}
                            <ChevronDown size={16} />
                        {/if}
                    </button>
                    
                    {#if expandedSections.recipients}
                        <div class="section-content">
                            {#each formData.settings.recipients as recipient, index}
                                <div class="recipient-item">
                                    <input
                                        type="email"
                                        class="input"
                                        placeholder="recipient@example.com"
                                        value={recipient}
                                        oninput={(e) => updateRecipient(index, e.currentTarget.value)}
                                    />
                                    <button
                                        onclick={() => removeRecipient(index)}
                                        class="icon-btn delete-btn"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            {/each}
                            <button onclick={addRecipient} class="btn btn-block">
                                <Plus size={16} />
                                <span>Add Recipient</span>
                            </button>
                        </div>
                    {/if}
                </div>

                <!-- Auto Responder -->
                <div class="section">
                    <button 
                        class="section-toggle"
                        onclick={() => toggleSection('autoResponder')}
                    >
                        <span class="section-title">Auto Responder</span>
                        {#if expandedSections.autoResponder}
                            <ChevronUp size={16} />
                        {:else}
                            <ChevronDown size={16} />
                        {/if}
                    </button>
                    
                    {#if expandedSections.autoResponder}
                        <div class="section-content">
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    class="checkbox"
                                    bind:checked={formData.settings.autoResponder.enabled}
                                    onchange={notifyUpdate}
                                />
                                <span>Enable auto-responder</span>
                            </label>
                            
                            {#if formData.settings.autoResponder.enabled}
                                <div class="form-group">
                                    <label class="label">Subject</label>
                                    <input
                                        type="text"
                                        class="input"
                                        bind:value={formData.settings.autoResponder.subject}
                                        onchange={notifyUpdate}
                                    />
                                </div>
                                <div class="form-group">
                                    <label class="label">Message</label>
                                    <textarea
                                        class="textarea"
                                        rows="4"
                                        bind:value={formData.settings.autoResponder.message}
                                        onchange={notifyUpdate}
                                    ></textarea>
                                </div>
                                <div class="form-group">
                                    <label class="label">Reply-To Email (optional)</label>
                                    <input
                                        type="email"
                                        class="input"
                                        placeholder="no-reply@example.com"
                                        bind:value={formData.settings.autoResponder.replyTo}
                                        onchange={notifyUpdate}
                                    />
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>

                <!-- Styling -->
                <div class="section">
                    <button 
                        class="section-toggle"
                        onclick={() => toggleSection('styling')}
                    >
                        <span class="section-title">Styling</span>
                        {#if expandedSections.styling}
                            <ChevronUp size={16} />
                        {:else}
                            <ChevronDown size={16} />
                        {/if}
                    </button>
                    
                    {#if expandedSections.styling}
                        <div class="section-content">
                            <div class="form-group">
                                <label class="label">Spacing</label>
                                <select
                                    class="select"
                                    bind:value={formData.settings.styling.spacing}
                                    onchange={notifyUpdate}
                                >
                                    <option value="compact">Compact</option>
                                    <option value="normal">Normal</option>
                                    <option value="relaxed">Relaxed</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="label">Button Color</label>
                                <div class="color-input-group">
                                    <input
                                        type="color"
                                        class="color-picker"
                                        bind:value={formData.settings.styling.buttonColor}
                                        onchange={notifyUpdate}
                                    />
                                    <input
                                        type="text"
                                        class="input"
                                        bind:value={formData.settings.styling.buttonColor}
                                        onchange={notifyUpdate}
                                    />
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="label">Button Text Color</label>
                                <div class="color-input-group">
                                    <input
                                        type="color"
                                        class="color-picker"
                                        bind:value={formData.settings.styling.buttonTextColor}
                                        onchange={notifyUpdate}
                                    />
                                    <input
                                        type="text"
                                        class="input"
                                        bind:value={formData.settings.styling.buttonTextColor}
                                        onchange={notifyUpdate}
                                    />
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="label">Border Radius</label>
                                <input
                                    type="text"
                                    class="input"
                                    placeholder="0.375rem"
                                    bind:value={formData.settings.styling.borderRadius}
                                    onchange={notifyUpdate}
                                />
                            </div>
                        </div>
                    {/if}
                </div>
            </div>

        {:else if activeTab === 'preview'}
            <!-- Form Preview -->
            <div class="preview-container">
                <h3 class="preview-title">{formData.settings.formName}</h3>
                
                <form class="preview-form" style="--field-spacing: {formData.settings.styling.spacing === 'compact' ? '0.75rem' : formData.settings.styling.spacing === 'relaxed' ? '1.5rem' : '1rem'}">
                    <div class="preview-fields">
                        {#each formData.fields as field}
                            <div class="preview-field" style="width: {field.width}%">
                                <label class="preview-label">
                                    {field.label}
                                    {#if field.required}
                                        <span class="required-mark">*</span>
                                    {/if}
                                </label>
                                
                                {#if field.type === 'textarea'}
                                    <textarea
                                        class="preview-input preview-textarea"
                                        placeholder={field.placeholder}
                                        required={field.required}
                                        rows="4"
                                        style="border-radius: {formData.settings.styling.borderRadius}"
                                    ></textarea>
                                {:else if field.type === 'select'}
                                    <select
                                        class="preview-input preview-select"
                                        required={field.required}
                                        style="border-radius: {formData.settings.styling.borderRadius}"
                                    >
                                        <option value="">{field.placeholder || 'Choose...'}</option>
                                        {#each field.options || [] as option}
                                            <option value={option.value}>{option.label}</option>
                                        {/each}
                                    </select>
                                {:else if field.type === 'checkbox'}
                                    <div class="preview-options">
                                        {#each field.options || [] as option}
                                            <label class="preview-option-label">
                                                <input type="checkbox" class="preview-checkbox" value={option.value} />
                                                <span>{option.label}</span>
                                            </label>
                                        {/each}
                                    </div>
                                {:else if field.type === 'radio'}
                                    <div class="preview-options">
                                        {#each field.options || [] as option}
                                            <label class="preview-option-label">
                                                <input type="radio" class="preview-radio" name={field.name} value={option.value} />
                                                <span>{option.label}</span>
                                            </label>
                                        {/each}
                                    </div>
                                {:else}
                                    <input
                                        type={field.type}
                                        class="preview-input"
                                        placeholder={field.placeholder}
                                        required={field.required}
                                        style="border-radius: {formData.settings.styling.borderRadius}"
                                    />
                                {/if}
                                
                                {#if field.helpText}
                                    <p class="preview-help">{field.helpText}</p>
                                {/if}
                            </div>
                        {/each}
                    </div>

                    <button
                        type="submit"
                        class="preview-submit"
                        style="background-color: {formData.settings.styling.buttonColor}; color: {formData.settings.styling.buttonTextColor}; border-radius: {formData.settings.styling.borderRadius}"
                    >
                        {formData.settings.submitButtonText}
                    </button>
                </form>
            </div>
        {/if}
    </div>
</div>

<style>
    /* ===== RESET & BASE ===== */
    * {
        box-sizing: border-box;
    }

    /* ===== CONTAINER ===== */
    .form-builder {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #ffffff;
        color: #1f2937;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        line-height: 1.5;
    }

    /* ===== TABS ===== */
    .tabs {
        display: flex;
        gap: 0;
        border-bottom: 2px solid #e5e7eb;
        background: #f9fafb;
    }

    .tab {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #6b7280;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .tab:hover {
        color: #3b82f6;
        background: #eff6ff;
    }

    .tab-active {
        color: #3b82f6;
        border-bottom-color: #3b82f6;
        font-weight: 600;
    }

    /* ===== CONTENT AREA ===== */
    .content {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        background: #f9fafb;
    }

    .settings-container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    /* ===== SECTIONS ===== */
    .section {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
        box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05);
        overflow: hidden;
    }

    .section-header {
        padding: 0.75rem 1rem;
        background: linear-gradient(to bottom, #f3f4f6, #ffffff);
        border-bottom: 1px solid #e5e7eb;
    }

    .section-header h3 {
        margin: 0;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #374151;
    }

    .section-content {
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .section-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: linear-gradient(to bottom, #f3f4f6, #ffffff);
        border: none;
        border-bottom: 1px solid #e5e7eb;
        cursor: pointer;
        transition: background-color 0.2s ease;
        text-align: left;
    }

    .section-toggle:hover {
        background: #f3f4f6;
    }

    .section-toggle-left {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .section-title {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #374151;
    }

    /* ===== FIELD GRID ===== */
    .field-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
        padding: 0.75rem;
    }

    .field-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #3b82f6;
        background: transparent;
        border: 1px solid #3b82f620;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .field-btn:hover {
        background: #eff6ff;
        border-color: #3b82f6;
        transform: translateY(-1px);
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    .field-btn:active {
        transform: translateY(0);
    }

    /* ===== FIELD ITEMS ===== */
    .field-item {
        padding: 0.5rem;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        transition: all 0.2s ease;
    }

    .field-item:hover {
        background: #f3f4f6;
        box-shadow: 0 2px 4px 0 rgb(0 0 0 / 0.05);
    }

    .field-item-selected {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px #eff6ff;
        background: #eff6ff;
    }

    .field-item-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .move-buttons {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .field-item-main {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: left;
        padding: 0;
    }

    .grip-icon {
        color: #9ca3af;
        flex-shrink: 0;
    }

    .field-item-info {
        flex: 1;
        min-width: 0;
    }

    .field-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: #1f2937;
    }

    .field-meta {
        font-size: 0.75rem;
        color: #6b7280;
    }

    /* ===== FIELD EDITOR ===== */
    .field-editor {
        margin-left: 1.5rem;
        margin-top: 0.5rem;
        padding: 0.75rem;
        background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        box-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    /* ===== FORM ELEMENTS ===== */
    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
    }

    .label {
        display: block;
        font-size: 0.75rem;
        font-weight: 500;
        color: #374151;
    }

    .input,
    .textarea,
    .select {
        width: 100%;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        color: #1f2937;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        transition: all 0.2s ease;
        font-family: inherit;
    }

    .input::placeholder,
    .textarea::placeholder {
        color: #9ca3af;
    }

    .input:focus,
    .textarea:focus,
    .select:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px #eff6ff;
    }

    .input-sm {
        padding: 0.375rem 0.5rem;
        font-size: 0.8125rem;
    }

    .textarea {
        resize: vertical;
    }

    .select {
        cursor: pointer;
    }

    .checkbox {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
        accent-color: #3b82f6;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #1f2937;
        cursor: pointer;
    }

    .hint {
        font-size: 0.75rem;
        color: #6b7280;
        margin-top: 0.25rem;
    }

    .color-input-group {
        display: flex;
        gap: 0.5rem;
    }

    .color-picker {
        width: 3rem;
        height: 2.25rem;
        padding: 0.25rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: border-color 0.2s ease;
    }

    .color-picker:hover,
    .color-picker:focus {
        border-color: #3b82f6;
    }

    /* ===== BUTTONS ===== */
    .btn,
    .btn-sm {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #3b82f6;
        background: transparent;
        border: 1px solid #3b82f620;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
    }

    .btn-sm {
        padding: 0.375rem 0.75rem;
        font-size: 0.8125rem;
    }

    .btn:hover,
    .btn-sm:hover {
        background: #eff6ff;
        border-color: #3b82f6;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px -1px rgb(0 0 0 / 0.1);
    }

    .btn:active,
    .btn-sm:active {
        transform: translateY(0);
    }

    .btn-block {
        width: 100%;
    }

    .icon-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        background: transparent;
        border: none;
        color: #6b7280;
        cursor: pointer;
        transition: all 0.2s ease;
        border-radius: 0.25rem;
    }

    .icon-btn:hover {
        background: #f3f4f6;
        color: #1f2937;
    }

    .icon-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .delete-btn {
        color: #dc2626;
    }

    .delete-btn:hover {
        background: #fee2e2;
        color: #dc2626;
    }

    /* ===== OPTIONS SECTION ===== */
    .options-section {
        padding-top: 0.75rem;
        border-top: 1px solid #e5e7eb;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .options-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .options-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .option-item {
        display: flex;
        gap: 0.5rem;
        padding: 0.5rem;
        background: #f3f4f6;
        border-radius: 0.375rem;
    }

    .option-inputs {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    /* ===== RECIPIENT ITEM ===== */
    .recipient-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    /* ===== EMPTY STATES ===== */
    .empty-message {
        padding: 1rem;
        text-align: center;
        font-size: 0.875rem;
        color: #6b7280;
    }

    .empty-message-sm {
        padding: 0.5rem;
        text-align: center;
        font-size: 0.75rem;
        color: #9ca3af;
    }

    /* ===== PREVIEW ===== */
    .preview-container {
        background: linear-gradient(to bottom right, #ffffff, #f9fafb);
        border-radius: 0.5rem;
        padding: 1.5rem;
        border: 1px solid #e5e7eb;
    }

    .preview-title {
        margin: 0 0 1rem 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: #1f2937;
    }

    .preview-form {
        display: flex;
        flex-direction: column;
        gap: var(--field-spacing, 1rem);
    }

    .preview-fields {
        display: flex;
        flex-wrap: wrap;
        margin: 0 -0.5rem;
    }

    .preview-field {
        padding: 0 0.5rem var(--field-spacing, 1rem) 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .preview-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
    }

    .required-mark {
        color: #dc2626;
        margin-left: 0.25rem;
    }

    .preview-input,
    .preview-textarea,
    .preview-select {
        width: 100%;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        color: #1f2937;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-family: inherit;
    }

    .preview-textarea {
        resize: vertical;
    }

    .preview-options {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .preview-option-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #1f2937;
        cursor: pointer;
    }

    .preview-checkbox,
    .preview-radio {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
        accent-color: #3b82f6;
    }

    .preview-help {
        font-size: 0.75rem;
        color: #6b7280;
        margin: 0;
    }

    .preview-submit {
        width: 100%;
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        font-weight: 500;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
    }

    .preview-submit:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.2);
    }

    .preview-submit:active {
        transform: translateY(0);
    }
</style>
