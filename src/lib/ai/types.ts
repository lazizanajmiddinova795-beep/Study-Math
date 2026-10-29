/**
 * Provider-independent AI contract. Application code depends ONLY on these types
 * and on getAiProvider()/getAiStatus() in ./index.ts, never on a vendor SDK.
 * All calls run on the server; API keys never reach the browser.
 */
export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiTextRequest {
  messages: AiMessage[];
  maxOutputTokens?: number;
  temperature?: number;
}

export interface AiTextResult {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiProvider {
  /** Stable identifier, e.g. "gemini". */
  readonly id: string;
  generateText(request: AiTextRequest): Promise<AiTextResult>;
}

export type AiProviderFactory = (config: { apiKey: string }) => AiProvider;

export type AiStatus =
  | { configured: true; provider: string }
  | { configured: false; reason: AiUnconfiguredReason };

export type AiUnconfiguredReason =
  | "no_provider_selected"
  | "missing_api_key"
  | "unsupported_provider";

export class AiNotConfiguredError extends Error {
  constructor(public readonly reason: AiUnconfiguredReason) {
    super(`AI is not configured (${reason})`);
    this.name = "AiNotConfiguredError";
  }
}
