import { useMutation } from '@tanstack/react-query';
import type { PlanGenerationRequest, PlanGenerationResponse } from '@/types/plan';

/**
 * React Query mutation hook for generating implementation plans
 *
 * @returns Mutation object with mutate function and state
 *
 * @example
 * ```tsx
 * const { mutate: generatePlan, isPending, error } = usePlanGeneration();
 *
 * generatePlan(
 *   { prompt: 'Add user authentication' },
 *   {
 *     onSuccess: (data) => {
 *       console.log('Generated plan:', data.plan);
 *     },
 *     onError: (error) => {
 *       console.error('Error:', error.message);
 *     }
 *   }
 * );
 * ```
 */
export function usePlanGeneration() {
  return useMutation({
    mutationFn: async (request: PlanGenerationRequest): Promise<PlanGenerationResponse> => {
      const response = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to generate plan');
      }

      return response.json();
    },
  });
}
