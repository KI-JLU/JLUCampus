import type { ReactNode } from 'react'
import { AlertCircleIcon } from 'lucide-react'
import { cn, Label } from '@ki4jlu/design-system'

export interface FieldControlProps {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': true | undefined
}

interface FieldProps {
  id: string
  label: string
  /** Shown under the control. Explains the format, never repeats the label. */
  hint?: ReactNode
  error?: string
  className?: string
  children: (props: FieldControlProps) => ReactNode
}

/**
 * One labelled control with its hint and error wired through
 * `aria-describedby`, so the error reaches a screenreader at the field rather
 * than only in a banner somewhere else on the page.
 */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children
}: FieldProps): React.JSX.Element {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={id} className={cn(error && 'text-error')}>
        {label}
      </Label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-error">
          <AlertCircleIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-sm text-on-surface-variant">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
