type Props = {
  columnKey: string
  label: string
  collapsed: boolean
  onToggle: (key: string) => void
}

export function ResultsColCollapseBtn({ columnKey, label, collapsed, onToggle }: Props) {
  return (
    <button
      type="button"
      className="results-col-collapse-btn"
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Expand ${label} column` : `Collapse ${label} column`}
      title={collapsed ? `Expand ${label}` : `Collapse ${label}`}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle(columnKey)
      }}
    >
      {collapsed ? '+' : '−'}
    </button>
  )
}
