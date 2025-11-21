<script lang="ts">
    import { HelpCircle, X, MessageSquare, Headphones, Send, Mail, MessageCircle } from 'lucide-svelte';
    import { Button, Card } from '@kuratchi/ui';
    import { enhance } from '$app/forms';
    import type { SubmitFunction } from '@sveltejs/kit';
    
    let isOpen = $state(false);
    let activeTab = $state<'feedback' | 'support'>('feedback');
    let isSubmitting = $state(false);
    
    const CHAT_URL = 'https://chat.kuratchi.dev';
    
    let feedbackRating = $state<1 | 2 | 3 | 4 | 5>(5);
    let feedbackText = $state('');
    let feedbackImage: File | null = $state(null);
    let feedbackImagePreview = $state('');
    
    let supportSubject = $state('');
    let supportMessage = $state('');
    let supportImage: File | null = $state(null);
    let supportImagePreview = $state('');
    
    const ratingEmojis = ['😞', '😕', '😐', '😊', '😍'];
    
    function toggleWidget() {
        isOpen = !isOpen;
    }
    
    function handleImageChange(event: Event, type: 'feedback' | 'support') {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = e.target?.result as string;
            if (type === 'feedback') {
                feedbackImage = file;
                feedbackImagePreview = preview;
            } else {
                supportImage = file;
                supportImagePreview = preview;
            }
        };
        reader.readAsDataURL(file);
    }
    
    const submitHandler: SubmitFunction = () => {
        isSubmitting = true;
        return async ({ update, result }) => {
            await update();
            isSubmitting = false;
            
            if (result.type === 'success') {
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

<div class="kui-help-widget">
    {#if !isOpen}
        <Button
            variant="ghost"
            size="sm"
            class="kui-help-button"
            onclick={toggleWidget}
            aria-label="Help & Support"
        >
            <HelpCircle class="kui-icon" />
        </Button>
    {/if}
    
    {#if isOpen}
        <Card class="kui-help-card">
            <div class="kui-help-head">
                <div>
                    <p class="kui-eyebrow">Need help?</p>
                    <h3>Help & Support</h3>
                </div>
                <Button variant="ghost" size="xs" onclick={toggleWidget} aria-label="Close">
                    <X class="kui-icon" />
                </Button>
            </div>
            
            <div class="kui-tabs">
                <button class:active={activeTab === 'feedback'} onclick={() => activeTab = 'feedback'}>
                    <MessageSquare class="kui-icon" />
                    Feedback
                </button>
                <button class:active={activeTab === 'support'} onclick={() => activeTab = 'support'}>
                    <Headphones class="kui-icon" />
                    Support
                </button>
            </div>
            
            <div class="kui-chat-link">
                <Button variant="outline" size="sm" href={CHAT_URL} target="_blank">
                    <MessageCircle class="kui-icon" />
                    Open live chat
                </Button>
            </div>
            
            <div class="kui-content">
                {#if activeTab === 'feedback'}
                    <form method="POST" action="/?/submitFeedback" enctype="multipart/form-data" use:enhance={submitHandler} class="kui-stack">
                        <div>
                            <label class="kui-label">How would you rate your experience?</label>
                            <div class="kui-rating-row">
                                {#each [1,2,3,4,5] as rating}
                                    <Button
                                        type="button"
                                        variant={feedbackRating === rating ? 'primary' : 'ghost'}
                                        size="xs"
                                        onclick={() => feedbackRating = rating as 1 | 2 | 3 | 4 | 5}
                                    >
                                        {ratingEmojis[rating - 1]}
                                    </Button>
                                {/each}
                            </div>
                            <input type="hidden" name="rating" value={feedbackRating} />
                        </div>
                        
                        <label class="kui-form-control">
                            <span class="kui-label">Tell us more</span>
                            <textarea
                                name="feedback"
                                bind:value={feedbackText}
                                class="kui-textarea"
                                placeholder="What's working well? What could be improved?"
                                required
                            ></textarea>
                        </label>
                        
                        <label class="kui-form-control">
                            <span class="kui-label">Screenshot (optional)</span>
                            <input
                                type="file"
                                name="image"
                                accept="image/*"
                                class="kui-input"
                                onchange={(e) => handleImageChange(e, 'feedback')}
                            />
                            {#if feedbackImagePreview}
                                <img src={feedbackImagePreview} alt="Preview" class="kui-preview" />
                            {/if}
                        </label>
                        
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={isSubmitting || !feedbackText.trim()}
                        >
                            {#if isSubmitting}
                                Sending...
                            {:else}
                                <Send class="kui-icon" />
                                Send feedback
                            {/if}
                        </Button>
                    </form>
                {:else}
                    <form method="POST" action="/?/submitSupport" enctype="multipart/form-data" use:enhance={submitHandler} class="kui-stack">
                        <label class="kui-form-control">
                            <span class="kui-label">Subject</span>
                            <input
                                type="text"
                                name="subject"
                                bind:value={supportSubject}
                                class="kui-input"
                                placeholder="Brief description of your issue"
                                required
                            />
                        </label>
                        
                        <label class="kui-form-control">
                            <span class="kui-label">Message</span>
                            <textarea
                                name="message"
                                bind:value={supportMessage}
                                class="kui-textarea"
                                placeholder="Please describe your issue in detail..."
                                required
                            ></textarea>
                        </label>
                        
                        <label class="kui-form-control">
                            <span class="kui-label">Attachment (optional)</span>
                            <input
                                type="file"
                                name="image"
                                accept="image/*"
                                class="kui-input"
                                onchange={(e) => handleImageChange(e, 'support')}
                            />
                            {#if supportImagePreview}
                                <img src={supportImagePreview} alt="Preview" class="kui-preview" />
                            {/if}
                        </label>
                        
                        <Button type="submit" variant="primary" disabled={isSubmitting || !supportSubject.trim() || !supportMessage.trim()}>
                            {#if isSubmitting}
                                Sending...
                            {:else}
                                <Send class="kui-icon" />
                                Send request
                            {/if}
                        </Button>
                    </form>
                {/if}
            </div>
        </Card>
    {/if}
</div>

<style>
    .kui-help-widget {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 50;
    }

    .kui-help-button {
        border-radius: 999px;
        width: 42px;
        height: 42px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }

    .kui-icon {
        width: 16px;
        height: 16px;
    }

    .kui-help-card {
        width: 360px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 14px;
    }

    .kui-help-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
    }

    h3 {
        margin: 0;
    }

    .kui-eyebrow {
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #6b7280;
        margin: 0;
    }

    .kui-tabs {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
    }

    .kui-tabs button {
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 8px 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: #f8fafc;
        cursor: pointer;
    }

    .kui-tabs button.active {
        border-color: #a5b4fc;
        background: #eef2ff;
    }

    .kui-chat-link {
        display: flex;
        justify-content: flex-end;
    }

    .kui-content {
        flex: 1;
        overflow-y: auto;
        padding: 4px;
    }

    .kui-stack {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .kui-form-control {
        display: grid;
        gap: 6px;
    }

    .kui-label {
        font-weight: 600;
        font-size: 13px;
    }

    .kui-input,
    .kui-textarea {
        width: 100%;
        border-radius: 10px;
        border: 1px solid #e4e4e7;
        padding: 10px 12px;
        background: white;
    }

    .kui-textarea {
        min-height: 90px;
    }

    .kui-input:focus,
    .kui-textarea:focus {
        outline: 2px solid rgba(129, 140, 248, 0.35);
        border-color: #a5b4fc;
    }

    .kui-rating-row {
        display: flex;
        gap: 6px;
        margin-top: 6px;
    }

    .kui-preview {
        width: 100%;
        height: 80px;
        object-fit: cover;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
    }
</style>
