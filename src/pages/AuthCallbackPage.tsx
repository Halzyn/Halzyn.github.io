import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LoadingState } from '../components/LoadingState'
import { getSupabase } from '../lib/supabase'

export function AuthCallbackPage() {
  const supabase = getSupabase()
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    async function finishAuthRedirect() {
      await supabase.auth.getSession()
      setSessionChecked(true)
    }
    void finishAuthRedirect()
  }, [supabase])

  if (!sessionChecked) {
    return <LoadingState label="Confirming..." size="page" />
  }

  return <Navigate to="/" replace />
}
