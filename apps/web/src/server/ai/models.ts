export type KuratchiAiModel = {
  id: string;
  name: string;
  description: string;
  provider: 'cloudflare';
};

export const KURATCHI_AI_MODELS: KuratchiAiModel[] = [
  {
    id: '@cf/meta/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout (17B)',
    description: 'Fast, general-purpose instruction model',
    provider: 'cloudflare',
  },
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    name: 'Llama 3.3 (70B) Fast',
    description: 'High quality responses with low latency',
    provider: 'cloudflare',
  },
  {
    id: '@cf/meta/llama-3.2-11b-vision-instruct',
    name: 'Llama 3.2 Vision (11B)',
    description: 'Vision-capable model for image and text understanding',
    provider: 'cloudflare',
  },
  {
    id: '@cf/meta/llama-3.2-3b-instruct',
    name: 'Llama 3.2 (3B)',
    description: 'Lightweight and fast for simple assistant tasks',
    provider: 'cloudflare',
  },
  {
    id: '@cf/meta/llama-3.1-70b-instruct',
    name: 'Llama 3.1 (70B)',
    description: 'Large general-purpose instruction model',
    provider: 'cloudflare',
  },
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 (8B)',
    description: 'Balanced model for everyday chat and coding help',
    provider: 'cloudflare',
  },
  {
    id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    name: 'DeepSeek R1 Distill Qwen (32B)',
    description: 'Reasoning-focused model currently available on Workers AI',
    provider: 'cloudflare',
  },
  {
    id: '@cf/qwen/qwq-32b',
    name: 'QwQ (32B)',
    description: 'Reasoning-oriented Qwen model',
    provider: 'cloudflare',
  },
  {
    id: '@cf/qwen/qwen3-30b-a3b-fp8',
    name: 'Qwen 3 30B A3B',
    description: 'Strong reasoning and instruction following',
    provider: 'cloudflare',
  },
];

export const DEFAULT_KURATCHI_AI_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

export function isSupportedKuratchiAiModel(modelId: string): boolean {
  return KURATCHI_AI_MODELS.some((model) => model.id === modelId);
}

export function resolveKuratchiAiModel(modelId: unknown): string {
  if (typeof modelId === 'string' && modelId.trim() && isSupportedKuratchiAiModel(modelId.trim())) {
    return modelId.trim();
  }
  return DEFAULT_KURATCHI_AI_MODEL;
}
