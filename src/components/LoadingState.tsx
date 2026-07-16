type LoadingStateSize = 'inline' | 'block' | 'page'

type Props = {
  label?: string
  size?: LoadingStateSize
  className?: string
}

export function LoadingState({ label = 'Loading...', size = 'block', className = '' }: Props) {
  const classes = ['loading-state', `loading-state--${size}`, className].filter(Boolean).join(' ')

  return (
    <div className={classes} role="status" aria-live="polite" aria-busy="true">
      <span className="loading-state-spinner" aria-hidden />
      <span className="loading-state-label">{label}</span>
    </div>
  )
}
