import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import type { ModeratedContest } from '../lib/moderation'
import { getSupabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { queryKeys } from '../lib/queries/keys'
import { useAuthModeratedContests, useAuthProfile } from '../hooks/useAuthQueries'

export type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  ready: boolean
  userId: string | null
  isAdmin: boolean
  hasModerationAccess: boolean
  moderatedContests: ModeratedContest[]
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase()
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  const userId = session?.user?.id ?? null

  const {
    data: profile = null,
    isLoading: profileLoading,
    isFetching: profileFetching,
  } = useAuthProfile(userId)

  const isAdmin = Boolean(profile?.is_admin)

  const {
    data: moderatedContests = [],
    isLoading: moderatedContestsLoading,
    isFetching: moderatedContestsFetching,
  } = useAuthModeratedContests(userId, isAdmin)

  const moderatedContestsLoaded =
    !profile || isAdmin || (!moderatedContestsLoading && !moderatedContestsFetching)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'USER_UPDATED' && nextSession?.user?.id) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.authProfile(nextSession.user.id),
        })
      }
      if (!nextSession?.user) {
        setSessionReady(true)
      }
    })

    void supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession)
      setSessionReady(true)
    })

    return () => subscription.unsubscribe()
  }, [supabase, queryClient])

  const ready = sessionReady && (!userId || (!profileLoading && !profileFetching))

  const refreshProfile = useCallback(async () => {
    if (!userId) return
    await queryClient.invalidateQueries({ queryKey: queryKeys.authProfile(userId) })
  }, [queryClient, userId])

  const value = useMemo<AuthContextValue>(() => {
    const hasModerationAccess = Boolean(
      profile && (isAdmin || (moderatedContestsLoaded && moderatedContests.length > 0)),
    )
    return {
      session,
      profile,
      ready,
      userId,
      isAdmin,
      hasModerationAccess,
      moderatedContests,
      refreshProfile,
    }
  }, [
    session,
    profile,
    ready,
    userId,
    isAdmin,
    moderatedContests,
    moderatedContestsLoaded,
    refreshProfile,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
