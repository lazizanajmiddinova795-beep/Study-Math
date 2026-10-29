import {
  AiNotConfiguredError,
  type AiProvider,
  type AiProviderFactory,
  type AiStatus,
} from "./types";

/**
 * Registry of provider adapters. Phase 1 ships NO adapter on purpose: nothing
 * here may pretend an AI call succeeded. To add Gemini later, implement
 * AiProviderFactory in src/lib/ai/providers/gemini.ts and register it below.
 */
const ADAPTERS: Record<string, AiProviderFactory> = {};

type AiEnv = Record<string, string | undefined>;

export function resolveAiStatus(
  env: AiEnv = process.env,
  adapters: Record<string, AiProviderFactory> = ADAPTERS,
): AiStatus {
  const provider = env.AI_PROVIDER?.trim().toLowerCase();
  if (!provider) return { configured: false, reason: "no_provider_selected" };
  if (!adapters[provider]) return { configured: false, reason: "unsupported_provider" };
  if (!env.AI_API_KEY?.trim()) return { configured: false, reason: "missing_api_key" };
  return { configured: true, provider };
}

export function getAiStatus(): AiStatus {
  return resolveAiStatus();
}

/** Throws AiNotConfiguredError when AI is unavailable. Server-side only. */
export function getAiProvider(
  env: AiEnv = process.env,
  adapters: Record<string, AiProviderFactory> = ADAPTERS,
): AiProvider {
  const status = resolveAiStatus(env, adapters);
  if (!status.configured) throw new AiNotConfiguredError(status.reason);
  const factory = adapters[status.provider] as AiProviderFactory;
  return factory({ apiKey: (env.AI_API_KEY as string).trim() });
}

const REASON_TEXT = {
  no_provider_selected: "No AI provider is selected.",
  missing_api_key: "An AI provider is selected but no API key is set.",
  unsupported_provider: "The selected AI provider has no adapter in this version.",
} as const;

/** Safe, user-presentable description. Never includes keys or env values. */
export function describeAiStatus(status: AiStatus): string {
  return status.configured ? `AI provider "${status.provider}" is configured.` : REASON_TEXT[status.reason];
}
