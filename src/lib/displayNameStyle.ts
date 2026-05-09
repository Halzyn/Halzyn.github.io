import type { CSSProperties } from 'react'
import type { DisplayNameEffect } from './types'

export type { DisplayNameEffect }

export type DisplayNameStyleInfo = {
  color1: string | null
  color2: string | null
  effect: DisplayNameEffect
}

const HEX6 = /^#[0-9A-Fa-f]{6}$/

export function normalizeDisplayNameHex(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return HEX6.test(withHash) ? withHash : null
}

const EFFECTS: DisplayNameEffect[] = ['none', 'outline', 'drop_shadow', 'glow']

export function parseDisplayNameEffect(raw: string | null | undefined): DisplayNameEffect {
  const value = raw?.trim().toLowerCase()
  return EFFECTS.includes(value as DisplayNameEffect) ? (value as DisplayNameEffect) : 'none'
}

export function parseDisplayNameStyleInfo(raw: unknown): DisplayNameStyleInfo | null {
  if (!raw || typeof raw !== 'object') return null
  const info = raw as Record<string, unknown>
  return {
    color1: normalizeDisplayNameHex(typeof info.color1 === 'string' ? info.color1 : null),
    color2: normalizeDisplayNameHex(typeof info.color2 === 'string' ? info.color2 : null),
    effect: parseDisplayNameEffect(typeof info.effect === 'string' ? info.effect : undefined),
  }
}

export function displayNameStyleMapFromRpc(data: unknown): Map<string, DisplayNameStyleInfo> {
  const map = new Map<string, DisplayNameStyleInfo>()
  if (!data || typeof data !== 'object') return map
  for (const [userId, value] of Object.entries(data as Record<string, unknown>)) {
    const info = parseDisplayNameStyleInfo(value)
    if (info) map.set(userId, info)
  }
  return map
}

export type DisplayNameStyleCaps = {
  canGradient: boolean
  canEffect: boolean
}

export function parseDisplayNameStyleCaps(raw: unknown): DisplayNameStyleCaps | null {
  if (!raw || typeof raw !== 'object') return null
  const info = raw as Record<string, unknown>
  return {
    canGradient: Boolean(info.can_gradient ?? info.canGradient),
    canEffect: Boolean(info.can_effect ?? info.canEffect),
  }
}

export function displayNameFillStyle(info: DisplayNameStyleInfo): CSSProperties {
  const firstColor = info.color1
  const secondColor = info.color2
  if (firstColor && secondColor) {
    return {
      backgroundImage: `linear-gradient(90deg, ${firstColor}, ${secondColor})`,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      WebkitTextFillColor: 'transparent',
    }
  }
  if (firstColor) {
    return { color: firstColor }
  }
  return {}
}

export function displayNameEffectClass(effect: DisplayNameEffect): string {
  if (effect === 'none') return ''
  return `display-name-effect-${effect}`
}

export function displayNameStyleIsPlain(info: DisplayNameStyleInfo): boolean {
  return !info.color1 && !info.color2 && info.effect === 'none'
}
