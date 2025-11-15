<script lang="ts">
    import { HelpCircle, X, MessageSquare, Headphones, Send, Mail, MessageCircle } from 'lucide-svelte';
    import { enhance } from '$app/forms';
    import type { SubmitFunction } from '@sveltejs/kit';
    
    let isOpen = $state(false);
    let activeTab = $state<'feedback' | 'support'>('feedback');
    let isSubmitting = $state(false);
    
    const CHAT_URL = 'https://chat.kuratchi.dev'; // TODO: Update based on environment
    
    // Feedback form state
    let feedbackRating = $state<1 | 2 | 3 | 4 | 5>(5);
    let feedbackText = $state('');
    let feedbackImage: File | null = $state(null);
    let feedbackImagePreview = $state('');
    
    // Support form state
    let supportSubject = $state('');
    let supportMessage = $state('');
    let supportImage: File | null = $state(null);
    let supportImagePreview = $state('');
    
    const ratingEmojis = ['😞', '😕', '😐', '😊', '😍'];
    
    function toggleWidget() {
        isOpen = !isOpen;
    }
    
    function handleFeedbackImageChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            feedbackImage = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                feedbackImagePreview = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    }
    
    function handleSupportImageChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            supportImage = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                supportImagePreview = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    }
    
    const submitHandler: SubmitFunction = () => {
        isSubmitting = true;
        return async ({ update, result }) => {
            await update();
            isSubmitting = false;
            
            if (result.type === 'success') {
                // Reset forms and close widget
                feedbackText = '';
                feedbackRating = 5;
                feedbackImage = null;
                feedbackImagePreview = '';
                supportSubject = '';
                supportMessage = '';
                supportImage = null;
                supportImagePreview = '';
                isOpen = false;
            }
        };
    };
</script>

<!-- Help Widget Button -->
<div class="fixed bottom-6 right-6 z-50">
    {#if !isOpen}
        <button
            class="btn btn-circle btn-ghost border border-base-200 bg-base-100 hover:bg-base-200/50 text-base-content/70 hover:text-base-content shadow-lg"
            onclick={toggleWidget}
            aria-label="Help & Support"
        >
            <HelpCircle class="h-5 w-5" />
        </button>
    {/if}
    
    {#if isOpen}
        <div class="bg-base-100 rounded-xl shadow-2xl border border-base-200 w-96 max-h-[80vh] overflow-hidden flex flex-col">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-3 border-b border-base-200">
                <h3 class="font-semibold text-base">Help & Support</h3>
                <button
                    class="btn btn-ghost btn-xs btn-circle"
                    onclick={toggleWidget}
                >
                    <X class="h-4 w-4" />
                </button>
            </div>
            
            <!-- Tabs -->
            <div class="tabs tabs-boxed m-3 mb-0 gap-1">
                <button
                    class="tab tab-sm flex-1 text-xs"
                    class:tab-active={activeTab === 'feedback'}
                    onclick={() => activeTab = 'feedback'}
                >
                    <MessageSquare class="h-3 w-3 mr-1" />
                    Feedback
                </button>
                <button
                    class="tab tab-sm flex-1 text-xs"
                    class:tab-active={activeTab === 'support'}
                    onclick={() => activeTab = 'support'}
                >
                    <Headphones class="h-3 w-3 mr-1" />
                    Support
                </button>
            </div>
            
            <!-- Live Chat Button -->
            <div class="px-4 py-2">
                <a
                    href={CHAT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-outline btn-sm w-full text-xs gap-1"
                >
                    <MessageCircle class="h-3 w-3" />
                    Open Live Chat
                </a>
            </div>
            
            <!-- Content -->
            <div class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {#if activeTab === 'feedback'}
                    <!-- Feedback Form -->
                    <form method="POST" action="/?/submitFeedback" enctype="multipart/form-data" use:enhance={submitHandler}>
                        <div class="space-y-3">
                            <!-- Rating -->
                            <div>
                                <label class="label py-1" for="feedback-rating">
                                    <span class="label-text text-xs font-medium">How would you rate your experience?</span>
                                </label>
                                <div class="flex gap-1 justify-center">
                                    {#each [1, 2, 3, 4, 5] as rating}
                                        <button
                                            type="button"
                                            class="btn btn-ghost btn-sm text-lg"
                                            class:btn-primary={feedbackRating === rating}
                                            onclick={() => feedbackRating = rating as 1 | 2 | 3 | 4 | 5}
                                        >
                                            {ratingEmojis[rating - 1]}
                                        </button>
                                    {/each}
                                </div>
                                <input type="hidden" name="rating" id="feedback-rating" value={feedbackRating} />
                            </div>
                            
                            <!-- Feedback Text -->
                            <div>
                                <label class="label py-1" for="feedback-text">
                                    <span class="label-text text-xs font-medium">Tell us more</span>
                                </label>
                                <textarea
                                    name="feedback"
                                    id="feedback-text"
                                    bind:value={feedbackText}
                                    class="textarea textarea-bordered textarea-sm w-full h-20 text-xs"
                                    placeholder="What's working well? What could be improved?"
                                    required
                                ></textarea>
                            </div>
                            
                            <!-- Image Upload -->
                            <div>
                                <label class="label py-1" for="feedback-image">
                                    <span class="label-text text-xs font-medium">Screenshot (optional)</span>
                                </label>
                                <input
                                    type="file"
                                    name="image"
                                    id="feedback-image"
                                    accept="image/*"
                                    class="file-input file-input-bordered file-input-sm w-full text-xs"
                                    onchange={handleFeedbackImageChange}
                                />
                                {#if feedbackImagePreview}
                                    <div class="mt-2">
                                        <img src={feedbackImagePreview} alt="Preview" class="w-full h-24 object-cover rounded" />
                                    </div>
                                {/if}
                            </div>
                            
                            <!-- Submit Button -->
                            <button
                                type="submit"
                                class="btn btn-primary btn-sm w-full text-xs"
                                disabled={isSubmitting || !feedbackText.trim()}
                            >
                                {#if isSubmitting}
                                    <span class="loading loading-spinner loading-xs"></span>
                                    Sending...
                                {:else}
                                    <Send class="h-3 w-3" />
                                    Send Feedback
                                {/if}
                            </button>
                        </div>
                    </form>
                    
                {:else}
                    <!-- Support Form -->
                    <form method="POST" action="/?/submitSupport" enctype="multipart/form-data" use:enhance={submitHandler}>
                        <div class="space-y-3">
                            <!-- Subject -->
                            <div>
                                <label class="label py-1" for="support-subject">
                                    <span class="label-text text-xs font-medium">Subject</span>
                                </label>
                                <input
                                    type="text"
                                    name="subject"
                                    id="support-subject"
                                    bind:value={supportSubject}
                                    class="input input-bordered input-sm w-full text-xs"
                                    placeholder="Brief description of your issue"
                                    required
                                />
                            </div>
                            
                            <!-- Message -->
                            <div>
                                <label class="label py-1" for="support-message">
                                    <span class="label-text text-xs font-medium">Message</span>
                                </label>
                                <textarea
                                    name="message"
                                    id="support-message"
                                    bind:value={supportMessage}
                                    class="textarea textarea-bordered textarea-sm w-full h-20 text-xs"
                                    placeholder="Please describe your issue in detail..."
                                    required
                                ></textarea>
                            </div>
                            
                            <!-- Image Upload -->
                            <div>
                                <label class="label py-1" for="support-image">
                                    <span class="label-text text-xs font-medium">Attachment (optional)</span>
                                </label>
                                <input
                                    type="file"
                                    name="image"
                                    id="support-image"
                                    accept="image/*"
                                    class="file-input file-input-bordered file-input-sm w-full text-xs"
                                    onchange={handleSupportImageChange}
                                />
                                {#if supportImagePreview}
                                    <div class="mt-2">
                                        <img src={supportImagePreview} alt="Preview" class="w-full h-24 object-cover rounded" />
                                    </div>
                                {/if}
                            </div>
                            
                            <!-- Submit Button -->
                            <button
                                type="submit"
                                class="btn btn-secondary btn-sm w-full text-xs"
                                disabled={isSubmitting || !supportSubject.trim() || !supportMessage.trim()}
                            >
                                {#if isSubmitting}
                                    <span class="loading loading-spinner loading-xs"></span>
                                    Sending...
                                {:else}
                                    <Mail class="h-3 w-3" />
                                    Send to Support
                                {/if}
                            </button>
                        </div>
                    </form>
                {/if}
            </div>
            
            <!-- Footer -->
            <div class="px-4 py-2 border-t border-base-200 text-center bg-base-200/30">
                <p class="text-xs text-base-content/60">
                    We typically respond within 24 hours
                </p>
            </div>
        </div>
    {/if}
</div>
