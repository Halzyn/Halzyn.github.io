import { lazy, type ComponentType } from 'react'

function lazyPage<T extends Record<string, ComponentType<unknown>>>(
  loader: () => Promise<T>,
  exportName: keyof T,
) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })))
}

export const AdminLogin = lazyPage(() => import('./AdminLogin'), 'AdminLogin')
export const AdminContests = lazyPage(() => import('./AdminContests'), 'AdminContests')
export const AdminContestEdit = lazyPage(() => import('./AdminContestEdit'), 'AdminContestEdit')
export const AdminGrading = lazyPage(() => import('./AdminGrading'), 'AdminGrading')
export const AdminGames = lazyPage(() => import('./AdminGames'), 'AdminGames')
export const AdminGameEdit = lazyPage(() => import('./AdminGameEdit'), 'AdminGameEdit')
export const AdminUsers = lazyPage(() => import('./AdminUsers'), 'AdminUsers')
export const AdminUserEdit = lazyPage(() => import('./AdminUserEdit'), 'AdminUserEdit')
