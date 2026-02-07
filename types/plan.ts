/**
 * Type definitions for plan generation feature
 */

/**
 * Request payload for plan generation API
 */
export interface PlanGenerationRequest {
  /** Task description or prompt for the plan agent */
  prompt: string;
  /** Optional base64-encoded OpenCode authentication JSON */
  opencodeAuthJsonB64?: string;
}

/**
 * Successful response from plan generation API
 */
export interface PlanGenerationResponse {
  /** Generated implementation plan text (usually markdown) */
  plan: string;
  /** OpenCode session ID that generated this plan */
  sessionId: string;
}

/**
 * Error response from plan generation API
 */
export interface PlanGenerationError {
  /** Error message */
  error: string;
  /** Detailed error message (optional) */
  message?: string;
  /** Additional error details (optional) */
  details?: unknown;
}
