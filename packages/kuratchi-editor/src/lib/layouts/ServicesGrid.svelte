<script lang="ts">
    import { LayoutBlock } from "$lib/shell";
    import { LucideIconMap, type LucideIconKey } from "$lib/utils/lucide-icons";
    import { Plus, ArrowUp, ArrowDown, Trash2 } from "@lucide/svelte";

    interface Props {
        id?: string;
        type?: string;
        metadata?: {
            title?: string;
            subtitle?: string;
            services?: Array<{
                title: string;
                description: string;
                icon?: LucideIconKey;
            }>;
            styling?: {
                backgroundColor?: string;
                textColor?: string;
                columns?: number;
                spacing?: string;
            };
        };
    }

    let {
        id = crypto.randomUUID(),
        type = 'services-grid',
        metadata = {
            title: 'Our Services',
            subtitle: 'We provide comprehensive professional services.',
            services: [
                {
                    title: 'Service One',
                    description: 'Professional service description here.',
                    icon: 'star'
                },
                {
                    title: 'Service Two', 
                    description: 'Professional service description here.',
                    icon: 'star'
                },
                {
                    title: 'Service Three',
                    description: 'Professional service description here.',
                    icon: 'star'
                }
            ],
            styling: {
                backgroundColor: '#ffffff',
                textColor: '#1f2937',
                columns: 3,
                spacing: 'large'
            }
        }
    }: Props = $props();

    // State variables following the pattern
    let title = $state(metadata.title || '');
    let subtitle = $state(metadata.subtitle || '');
    let services = $state(metadata.services || []);
    let backgroundColor = $state(metadata.styling?.backgroundColor || '#ffffff');
    let textColor = $state(metadata.styling?.textColor || '#1f2937');
    let columns = $state(metadata.styling?.columns || 3);
    let spacing = $state(metadata.styling?.spacing || 'large');

    // Derived content object
    let content = $derived({
        id,
        type,
        metadata: {
            title,
            subtitle,
            services,
            styling: {
                backgroundColor,
                textColor,
                columns,
                spacing
            }
        }
    });

    function addService() {
        services = [
            ...services,
            {
                title: 'New Service',
                description: 'Service description here',
                icon: 'star'
            }
        ];
    }

    function removeService(index: number) {
        services = services.filter((_, i) => i !== index);
    }

    function moveService(index: number, direction: 'up' | 'down') {
        const newServices = [...services];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (targetIndex >= 0 && targetIndex < services.length) {
            [newServices[index], newServices[targetIndex]] = [newServices[targetIndex], newServices[index]];
            services = newServices;
        }
    }
</script>

<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="space-y-6">
            <!-- Header Content -->
            <fieldset>
                <legend class="fieldset-legend">Header Content</legend>
                <div class="form-control gap-4">
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text">Title</span>
                        </label>
                        <input 
                            type="text" 
                            class="input input-bordered" 
                            bind:value={title}
                            placeholder="Enter section title"
                        />
                    </div>
                    
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text">Subtitle</span>
                        </label>
                        <textarea 
                            class="textarea textarea-bordered" 
                            bind:value={subtitle}
                            placeholder="Enter section subtitle"
                            rows="3"
                        ></textarea>
                    </div>
                </div>
            </fieldset>

            <div class="divider"></div>

            <!-- Services Management -->
            <fieldset>
                <legend class="fieldset-legend">Services</legend>
                <div class="form-control gap-4">
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium">Manage Services</span>
                        <button 
                            type="button" 
                            class="btn btn-sm btn-primary"
                            onclick={addService}
                        >
                            <Plus class="w-4 h-4" />
                            Add Service
                        </button>
                    </div>

                    {#each services as service, index}
                        <div class="card bg-base-200 p-4">
                            <div class="flex justify-between items-start mb-3">
                                <span class="badge badge-primary">Service {index + 1}</span>
                                <div class="flex gap-1">
                                    <button 
                                        type="button" 
                                        class="btn btn-xs btn-ghost"
                                        onclick={() => moveService(index, 'up')}
                                        disabled={index === 0}
                                    >
                                        <ArrowUp class="w-3 h-3" />
                                    </button>
                                    <button 
                                        type="button" 
                                        class="btn btn-xs btn-ghost"
                                        onclick={() => moveService(index, 'down')}
                                        disabled={index === services.length - 1}
                                    >
                                        <ArrowDown class="w-3 h-3" />
                                    </button>
                                    <button 
                                        type="button" 
                                        class="btn btn-xs btn-error"
                                        onclick={() => removeService(index)}
                                    >
                                        <Trash2 class="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            
                            <div class="form-control gap-3">
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text text-xs">Service Title</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        class="input input-bordered input-sm" 
                                        bind:value={service.title}
                                        placeholder="Service title"
                                    />
                                </div>
                                
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text text-xs">Description</span>
                                    </label>
                                    <textarea 
                                        class="textarea textarea-bordered textarea-sm" 
                                        bind:value={service.description}
                                        placeholder="Service description"
                                        rows="2"
                                    ></textarea>
                                </div>
                                
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text text-xs">Icon (Lucide key)</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        class="input input-bordered input-sm" 
                                        bind:value={service.icon}
                                        placeholder="star"
                                    />
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            </fieldset>

            <div class="divider"></div>

            <!-- Layout & Styling -->
            <fieldset>
                <legend class="fieldset-legend">Layout & Styling</legend>
                <div class="form-control gap-4">
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text">Columns</span>
                        </label>
                        <select class="select select-bordered" bind:value={columns}>
                            <option value={1}>1 Column</option>
                            <option value={2}>2 Columns</option>
                            <option value={3}>3 Columns</option>
                            <option value={4}>4 Columns</option>
                        </select>
                    </div>

                    <div class="form-control">
                        <label class="label">
                            <span class="label-text">Spacing</span>
                        </label>
                        <select class="select select-bordered" bind:value={spacing}>
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                        </select>
                    </div>

                    <div class="form-control">
                        <label class="label">
                            <span class="label-text">Background Color</span>
                        </label>
                        <input 
                            type="color" 
                            class="input input-bordered h-12" 
                            bind:value={backgroundColor}
                        />
                    </div>

                    <div class="form-control">
                        <label class="label">
                            <span class="label-text">Text Color</span>
                        </label>
                        <input 
                            type="color" 
                            class="input input-bordered h-12" 
                            bind:value={textColor}
                        />
                    </div>
                </div>
            </fieldset>
        </div>
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        <section 
            class="py-16 px-4"
            style="background-color: {backgroundColor}; color: {textColor};"
        >
            <div class="max-w-7xl mx-auto">
                <!-- Header -->
                {#if title || subtitle}
                    <div class="text-center mb-16 max-w-4xl mx-auto">
                        {#if title}
                            <h2 class="text-4xl md:text-5xl font-light mb-6 leading-tight">
                                {title}
                            </h2>
                        {/if}
                        {#if subtitle}
                            <p class="text-lg opacity-80 leading-relaxed">
                                {subtitle}
                            </p>
                        {/if}
                    </div>
                {/if}

                <!-- Services Grid -->
                <div 
                    class="grid gap-12 md:gap-16"
                    class:grid-cols-1={columns === 1}
                    class:md:grid-cols-2={columns === 2}
                    class:md:grid-cols-3={columns === 3}
                    class:md:grid-cols-4={columns === 4}
                    class:gap-8={spacing === 'small'}
                    class:gap-12={spacing === 'medium'}
                    class:gap-16={spacing === 'large'}
                >
                    {#each services as service}
                        <div class="text-center space-y-4">
                            <!-- Icon -->
                            {#if service.icon}
                                {@const Comp = LucideIconMap[service.icon as LucideIconKey]}
                                <div class="flex justify-center mb-6">
                                    <Comp class="w-8 h-8 opacity-60" style="color: {textColor};" />
                                </div>
                            {/if}

                            <!-- Title -->
                            <h3 class="text-xl font-medium mb-4 leading-tight">
                                {service.title}
                            </h3>

                            <!-- Description -->
                            <p class="opacity-80 leading-relaxed">
                                {service.description}
                            </p>
                        </div>
                    {/each}
                </div>
            </div>
        </section>
    {/snippet}
</LayoutBlock>
