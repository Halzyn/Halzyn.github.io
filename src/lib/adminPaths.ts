const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

const MODERATOR_ADMIN_PATH = new RegExp(`^/admin/contests/(${UUID})(?:/grade)?$`, 'i')

export function normalizePathname(pathname: string): string {
  if (pathname === '/' || pathname === '') return '/'
  return pathname.replace(/\/+$/, '')
}

export function contestIdFromModeratorAdminPath(pathname: string): string | null {
  const path = normalizePathname(pathname)
  const match = MODERATOR_ADMIN_PATH.exec(path)
  return match ? match[1] : null
}
