export interface FormState {
  error?: string;
  message?: string;
  /** Inline, per-field messages. */
  fieldErrors?: Record<string, string>;
  /** Non-sensitive values to re-populate the form (NEVER passwords). */
  values?: { email?: string; fullName?: string };
}
