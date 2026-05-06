import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  const allow = origin && /^https?:\/\/.+/i.test(origin) ? origin : '*'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim()
  const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://halzyn.github.io').replace(/\/$/, '')
  const fromEmail =
    Deno.env.get('NOTIFY_FROM_EMAIL')?.trim() || 'VGMGC <onboarding@resend.dev>'

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(req, 500, { error: 'Missing Supabase URL, anon key, or service role key.' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json(req, 401, { error: 'Missing or invalid Authorization header.' })
  }

  let body: { contest_id?: string }
  try {
    body = (await req.json()) as { contest_id?: string }
  } catch {
    return json(req, 400, { error: 'Invalid JSON body.' })
  }

  const contestId = body.contest_id?.trim()
  if (!contestId || !UUID_RE.test(contestId)) {
    return json(req, 400, { error: 'Invalid contest_id.' })
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userErr,
  } = await supabaseUser.auth.getUser()
  if (userErr || !user) return json(req, 401, { error: 'Invalid session.' })

  const { data: canManage, error: rpcErr } = await supabaseUser.rpc('can_manage_contest', {
    p_contest_id: contestId,
  })
  if (rpcErr) return json(req, 500, { error: rpcErr.message })
  if (!canManage) return json(req, 403, { error: 'You cannot manage this contest.' })

  const adminSb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: contestRow, error: cErr } = await adminSb
    .from('contests')
    .select('id, slug, title, published')
    .eq('id', contestId)
    .maybeSingle()

  if (cErr) return json(req, 500, { error: cErr.message })
  if (!contestRow) return json(req, 404, { error: 'Contest not found.' })

  const pub = (contestRow as { published?: boolean }).published
  if (!pub) {
    return json(req, 400, { error: 'Contest is not published; nothing to announce.' })
  }

  if (!resendKey) {
    return json(req, 200, {
      ok: true,
      skipped: true,
      reason: 'RESEND_API_KEY is not set on the Edge Function (no emails sent).',
      subscribers: 0,
    })
  }

  const { data: subs, error: subErr } = await adminSb
    .from('profiles')
    .select('id')
    .eq('notify_new_contest_email', true)

  if (subErr) return json(req, 500, { error: subErr.message })

  const rows = (subs ?? []) as { id: string }[]
  const title = String((contestRow as { title?: string }).title || 'Contest').trim() || 'Contest'
  const slug = String((contestRow as { slug?: string }).slug || '').trim() || contestId
  const contestUrl = `${siteUrl}/contests/${encodeURIComponent(slug)}`
  const safeTitle = escapeHtml(title)

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const row of rows) {
    const { data: authUser, error: auErr } = await adminSb.auth.admin.getUserById(row.id)
    if (auErr || !authUser.user?.email?.trim()) {
      failed++
      if (auErr?.message) errors.push(auErr.message)
      continue
    }
    const to = authUser.user.email.trim()

    const html =
      `<p>A new contest is live: <strong>${safeTitle}</strong></p>!` +
      `<p><a href="${escapeHtml(contestUrl)}">Open contest</a></p>` +
      `<p style="color:#666;font-size:12px;">You received this because you opted into these notifications. Visit your profile to change your preferences.</p>`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: `New contest: ${title}`,
        html,
      }),
    })

    if (!resendRes.ok) {
      const t = await resendRes.text()
      failed++
      errors.push(`${to}: ${resendRes.status} ${t.slice(0, 120)}`)
      continue
    }
    sent++
  }

  return json(req, 200, {
    ok: true,
    subscribers: rows.length,
    sent,
    failed,
    ...(errors.length ? { errors: errors.slice(0, 5) } : {}),
  })
})
