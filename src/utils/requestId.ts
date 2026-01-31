/**
 * Generate unique request IDs for tracing
 */

export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
