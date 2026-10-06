import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/errors'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Never retry something the server has answered definitively.
        retry: (count, err) =>
          import.meta.env.MODE !== 'test' && !(err instanceof ApiError && err.status > 0) && count < 2,
      },
    },
  })
}
