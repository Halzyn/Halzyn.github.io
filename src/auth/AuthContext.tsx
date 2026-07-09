import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { fetchModeratedContests, type ModeratedContest } from '../lib/moderation'
import { getSupabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

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

async function fetchProfileRow(client: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error || !data) return null
  return data as Profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [moderatedContests, setModeratedContests] = useState<ModeratedContest[]>([])
  const [moderatedContestsLoaded, setModeratedContestsLoaded] = useState(false)
  const [ready, setReady] = useState(false)
  const trackedAuthUserIdRef = useRef<string | null>(null)
  const profileLoadedForUserIdRef = useRef<string | null>(null)
  const profileFetchInFlightForUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let providerUnmounted = false

    async function syncAuthState(nextSession: Session | null, authEvent: string) {
      const nextUserId = nextSession?.user?.id ?? null
      trackedAuthUserIdRef.current = nextUserId

      setSession(nextSession)

      if (!nextUserId) {
        setProfile(null)
        setModeratedContests([])
        setModeratedContestsLoaded(false)
        setReady(true)
        profileLoadedForUserIdRef.current = null
        profileFetchInFlightForUserIdRef.current = null
        return
      }

      if (
        profileFetchInFlightForUserIdRef.current === nextUserId ||
        (profileLoadedForUserIdRef.current === nextUserId && authEvent !== 'USER_UPDATED')
      ) {
        return
      }

      profileFetchInFlightForUserIdRef.current = nextUserId

      const sameUserAlreadyLoaded = profileLoadedForUserIdRef.current === nextUserId
      if (!sameUserAlreadyLoaded) {
        setReady(false)
        setProfile((prev) => (prev?.id === nextUserId ? prev : null))
      }

      try {
        const loaded = await fetchProfileRow(supabase, nextUserId)

        if (providerUnmounted) return
        if (trackedAuthUserIdRef.current !== nextUserId) {
          return
        }

        setProfile(loaded)
        setReady(true)
        profileLoadedForUserIdRef.current = nextUserId
      } finally {
        if (profileFetchInFlightForUserIdRef.current === nextUserId) {
          profileFetchInFlightForUserIdRef.current = null
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void syncAuthState(nextSession, event)
    })

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (providerUnmounted) return
      void syncAuthState(session ?? null, '')
    })

    return () => {
      providerUnmounted = true
      subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    if (!profile) {
      setModeratedContests([])
      setModeratedContestsLoaded(false)
      return
    }

    if (profile.is_admin) {
      setModeratedContests([])
      setModeratedContestsLoaded(true)
      return
    }

    setModeratedContestsLoaded(false)
    const profileUserId = profile.id
    let cancelled = false

    void fetchModeratedContests(supabase, profileUserId).then((contests) => {
      if (cancelled) return
      setModeratedContests(contests)
      setModeratedContestsLoaded(true)
    })

    return () => {
      cancelled = true
    }
  }, [profile?.id, profile?.is_admin, supabase])

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id ?? null
    if (!uid) {
      setProfile(null)
      return
    }
    const loaded = await fetchProfileRow(supabase, uid)
    if (trackedAuthUserIdRef.current !== uid) return
    setProfile(loaded)
    profileLoadedForUserIdRef.current = uid
  }, [session?.user?.id, supabase])

  const value = useMemo<AuthContextValue>(() => {
    const userId = session?.user?.id ?? null
    const isAdmin = Boolean(profile?.is_admin)
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
  }, [session, profile, ready, moderatedContests, moderatedContestsLoaded, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
