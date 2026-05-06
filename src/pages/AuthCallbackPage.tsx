import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
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
    return <p className="muted">Confirming...</p>
  }

  return <Navigate to="/" replace />
}
