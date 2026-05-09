import type { CSSProperties, ReactNode } from 'react'
import {
  displayNameEffectClass,
  displayNameFillStyle,
  displayNameGlowFilter,
  displayNameStyleIsPlain,
  type DisplayNameStyleInfo,
} from '../lib/displayNameStyle'

type Props = {
  text: string
  info?: DisplayNameStyleInfo | null
  className?: string
  style?: CSSProperties
  title?: string
}

export function DisplayNameStyled({
  text,
  info,
  className = '',
  style: outerStyle,
  title,
}: Props): ReactNode {
  const useInfo = info ?? null
  if (!useInfo || displayNameStyleIsPlain(useInfo)) {
    return (
      <span className={className} style={outerStyle} title={title}>
        {text}
      </span>
    )
  }

  const fill = displayNameFillStyle(useInfo)
  const glowFilter = displayNameGlowFilter(useInfo)
  const fx = displayNameEffectClass(useInfo.effect)
  const innerClass = ['display-name-styled-inner', fx].filter(Boolean).join(' ')
  const mergedOuter = [className, 'display-name-styled-wrap'].filter(Boolean).join(' ')
  const innerStyle: CSSProperties = glowFilter ? { ...fill, filter: glowFilter } : fill

  return (
    <span className={mergedOuter} style={outerStyle} title={title}>
      <span className={innerClass} style={innerStyle}>
        {text}
      </span>
    </span>
  )
}
