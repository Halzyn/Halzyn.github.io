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

// need this because using glow in index.css doesn't work well with gradients lol
export function displayNameGlowFilter(info: DisplayNameStyleInfo): string | undefined {
  if (info.effect !== 'glow') return undefined
  const fallback = '#446688'
  const c1 = info.color1 ?? info.color2 ?? fallback
  const c2 = info.color2 ?? info.color1 ?? c1
  const rgb1 = hexToRgb(c1)
  const rgb2 = hexToRgb(c2)
  if (!rgb1) return undefined
  const soft = '0.4'
  const wide = '0.28'
  const core = `drop-shadow(0 0 5px rgba(${rgb1.r},${rgb1.g},${rgb1.b},${soft}))`
  const halo = `drop-shadow(0 0 14px rgba(${rgb1.r},${rgb1.g},${rgb1.b},${wide}))`
  if (!rgb2 || (rgb2.r === rgb1.r && rgb2.g === rgb1.g && rgb2.b === rgb1.b)) {
    return `${core} ${halo}`
  }
  const halo2 = `drop-shadow(0 0 12px rgba(${rgb2.r},${rgb2.g},${rgb2.b},${wide}))`
  return `${core} ${halo} ${halo2}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().startsWith('#') ? hex.trim().slice(1) : hex.trim()
  if (normalized.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(normalized)) return null
  const n = Number.parseInt(normalized, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function displayNameEffectClass(effect: DisplayNameEffect): string {
  if (effect === 'none' || effect === 'glow') return ''
  return `display-name-effect-${effect}`
}

export function displayNameStyleIsPlain(info: DisplayNameStyleInfo): boolean {
  return !info.color1 && !info.color2 && info.effect === 'none'
}
