import { useState, type ReactNode } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  ListToolbar,
  Spinner,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@ki4jlu/design-system'
import { AdminGuard } from '@/components/admin-guard'
import { AdminNav } from '@/components/admin-nav'
import { AdminUserDetails, UserRoleBadge } from '@/components/admin-user-details'
import { PageHeader } from '@/components/page-header'
import { PageLoading } from '@/components/page-message'
import { PageSidePanel } from '@/components/page-side-panel'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserRoleDialog, type RoleChange } from '@/components/user-role-dialog'
import { filterUsers, formatUserDate, userInitials } from '@/lib/admin-users'
import { adminUsersQuery, meQuery } from '@/lib/queries'

const route = getRouteApi('/app/admin/users')

const ICON = { 'aria-hidden': true, width: '1em', height: '1em' } as const

export function AdminUsersPage(): React.JSX.Element {
  return (
    <AdminGuard>
      <Users />
    </AdminGuard>
  )
}

/**
 * Everyone who ever signed in, admins first. The user picked in the table shows in the shell's
 * column on the right (below `lg` in a card under the table), where their admin role is granted
 * or revoked. The pick is the `user` search param, so a reload keeps it.
 */
function Users(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const { user: selectedId } = route.useSearch()
  const { data: me } = useSuspenseQuery(meQuery)
  const { data: users, isPending, isError } = useQuery(adminUsersQuery)
  const [query, setQuery] = useState('')
  const [change, setChange] = useState<RoleChange | null>(null)
  const shown = filterUsers(users ?? [], query)
  const selected = users?.find((user) => user.id === selectedId) ?? null

  let details: ReactNode
  if (!selectedId) {
    details = <p className="m-0">{t('admin.users.details.empty')}</p>
  } else if (isPending) {
    details = <Spinner label={t('common.loading')} />
  } else if (!selected) {
    details = <p className="m-0">{t('admin.users.details.notFound')}</p>
  } else {
    details = (
      <AdminUserDetails
        user={selected}
        isSelf={selected.id === me.id}
        onChangeRole={(role) => setChange({ user: selected, role })}
      />
    )
  }

  return (
    <Container className="flex flex-col gap-gutter py-gutter md:py-margin-page">
      <PageHeader title={t('admin.users.title')} description={t('admin.users.description')} />
      <AdminNav />
      <ListToolbar
        search={
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon {...ICON} />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label={t('admin.users.search')}
              placeholder={t('admin.users.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
        }
      />
      {users ? (
        <p className="sr-only" aria-live="polite">
          {t('admin.users.resultCount', { count: shown.length })}
        </p>
      ) : null}
      <Card>
        <div className="overflow-x-auto">
          {isPending ? (
            <PageLoading label={t('common.loading')} />
          ) : isError ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertDescription>{t('admin.users.loadFailed')}</AlertDescription>
              </Alert>
            </div>
          ) : (
            <Table>
              <TableCaption className="sr-only">{t('admin.users.table.caption')}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.table.name')}</TableHead>
                  <TableHead>{t('admin.users.table.email')}</TableHead>
                  <TableHead>{t('admin.users.table.role')}</TableHead>
                  <TableHead>{t('admin.users.table.lastSignIn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center">
                      {users.length === 0
                        ? t('admin.users.table.empty')
                        : t('admin.users.table.noMatch', { query: query.trim() })}
                    </TableCell>
                  </TableRow>
                ) : (
                  shown.map((user) => (
                    <TableRow
                      key={user.id}
                      data-state={user.id === selectedId ? 'selected' : undefined}
                    >
                      <TableCell className="whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          {/* DS gap: Avatar shows initials only, not the user's picture. */}
                          <Avatar size="sm" initials={userInitials(user)} />
                          {/* The link is current (`aria-current="page"`) while its user is shown. */}
                          <Button variant="link" className="p-0" asChild>
                            <Link to="/admin/users" search={{ user: user.id }} replace>
                              {user.name}
                            </Link>
                          </Button>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{user.email}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <UserRoleBadge role={user.role} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {user.lastSignInAt ? (
                          <time dateTime={user.lastSignInAt}>
                            {formatUserDate(user.lastSignInAt, language)}
                          </time>
                        ) : (
                          t('admin.users.details.never')
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
      <PageSidePanel
        label={t('admin.users.details.label')}
        fallback={
          <Card>
            <CardHeader>
              <CardTitle asChild>
                <h2>{t('admin.users.details.label')}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>{details}</CardContent>
          </Card>
        }
      >
        {details}
      </PageSidePanel>
      <UserRoleDialog change={change} onClose={() => setChange(null)} />
    </Container>
  )
}
