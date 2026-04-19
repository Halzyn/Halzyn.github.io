import { isPast, parseISO } from 'date-fns'

export function contestClosed(deadlineIso: string): boolean {
  return isPast(parseISO(deadlineIso))
}
