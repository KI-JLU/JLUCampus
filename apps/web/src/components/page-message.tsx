import type { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Container,
  Spinner
} from '@ki4jlu/design-system'

interface PageMessageProps {
  icon: ReactNode
  title: string
  description: ReactNode
  /** A Button or two: back to the dashboard, retry, sign in. */
  actions?: ReactNode
}

/** A whole-page state instead of content: not found, forbidden, failed to load. */
export function PageMessage({
  icon,
  title,
  description,
  actions
}: PageMessageProps): React.JSX.Element {
  return (
    <Container size="reading" className="flex flex-1 flex-col justify-center py-margin-page">
      <Card>
        <CardHeader className="items-center text-center">
          <span aria-hidden="true" className="text-on-surface-variant [&_svg]:size-10">
            {icon}
          </span>
          <CardTitle asChild>
            <h1>{title}</h1>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {actions ? (
          <CardContent className="flex flex-wrap justify-center gap-stack-sm">
            {actions}
          </CardContent>
        ) : null}
      </Card>
    </Container>
  )
}

/** Centered spinner while a page's data loads. */
export function PageLoading({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center py-margin-page">
      <Spinner size="lg" label={label} />
    </div>
  )
}
