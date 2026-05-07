import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

export type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  ready: boolean
  userId: string | null
  isAdmin: boolean
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
  const [ready, setReady] = useState(false)
  const trackedAuthUserIdRef = useRef<string | null>(null)
  const profileLoadedForUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let providerUnmounted = false

    async function syncAuthState(nextSession: Session | null) {
      const nextUserId = nextSession?.user?.id ?? null
      trackedAuthUserIdRef.current = nextUserId

      setSession(nextSession)

      if (!nextUserId) {
        setProfile(null)
        setReady(true)
        profileLoadedForUserIdRef.current = null
        return
      }

      const sameUserAlreadyLoaded = profileLoadedForUserIdRef.current === nextUserId

      if (!sameUserAlreadyLoaded) {
        setReady(false)
        setProfile((prev) => (prev?.id === nextUserId ? prev : null))
      }

      const loaded = await fetchProfileRow(supabase, nextUserId)

      if (providerUnmounted) return
      if (trackedAuthUserIdRef.current !== nextUserId) {
        return
      }

      setProfile(loaded)
      setReady(true)
      profileLoadedForUserIdRef.current = nextUserId
    }

    void supabase.auth.getSession().then(({ data: { session: initial } }) => {
      void syncAuthState(initial)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncAuthState(nextSession)
    })

    return () => {
      providerUnmounted = true
      subscription.unsubscribe()
    }
  }, [supabase])

  const value = useMemo<AuthContextValue>(() => {
    const userId = session?.user?.id ?? null
    const isAdmin = Boolean(profile?.is_admin)
    return { session, profile, ready, userId, isAdmin }
  }, [session, profile, ready])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
