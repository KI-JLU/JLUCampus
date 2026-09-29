import { useSyncExternalStore } from 'react'
import type { ToastVariant } from '@ki4jlu/design-system'

export interface ToastMessage {
  id: number
  variant: ToastVariant
  title: string
  description?: string
}

const MAX_TOASTS = 3

let toasts: ToastMessage[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit(next: ToastMessage[]): void {
  toasts = next
  listeners.forEach((listener) => listener())
}

/** Queues a toast. The same title twice in a row replaces the older one. */
export function toast(message: Omit<ToastMessage, 'id'>): void {
  const rest = toasts.filter((item) => item.title !== message.title)
  emit([...rest, { ...message, id: nextId++ }].slice(-MAX_TOASTS))
}

export function dismissToast(id: number): void {
  emit(toasts.filter((item) => item.id !== id))
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useToasts(): ToastMessage[] {
  return useSyncExternalStore(subscribe, () => toasts)
}

export function useToast(): { toast: typeof toast; dismiss: typeof dismissToast } {
  return { toast, dismiss: dismissToast }
}
