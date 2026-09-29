import { useEffect, useRef } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { TranslatorCall } from '@/lib/queries'

export interface LatestRequest<Req, Res> {
  /** Starts `request` and aborts the one on its way; only the latest answer reaches `onSuccess`. */
  run: (request: Req, onSuccess: (response: Res) => void) => void
  /** Aborts the request on its way and forgets the last error. */
  cancel: () => void
  pending: boolean
  error: Error | null
}

/**
 * One translator request at a time. Live editing sends a request per pause
 * in typing, so a newer one aborts the older, and an answer that arrives
 * late anyway never replaces a newer one.
 */
export function useLatestRequest<Req, Res>(
  mutation: UseMutationResult<Res, Error, TranslatorCall<Req>>
): LatestRequest<Req, Res> {
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  return {
    run: (request, onSuccess) => {
      controller.current?.abort()
      const current = new AbortController()
      controller.current = current
      mutation.mutate(
        { request, signal: current.signal },
        {
          onSuccess: (response) => {
            if (controller.current === current) onSuccess(response)
          }
        }
      )
    },
    cancel: () => {
      controller.current?.abort()
      controller.current = null
      mutation.reset()
    },
    pending: mutation.isPending,
    error: mutation.error
  }
}
