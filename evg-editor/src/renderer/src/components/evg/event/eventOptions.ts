import type { EventType } from '../../../../../shared/evgData'

export interface EventOption {
  key: string
  label?: string
}

export function createDefaultEvent(id: string): EventType {
  return {
    id,
    label: '新事件',
    canExecute: true,
    actions: []
  }
}

function getCanExecuteSummary(value: EventType['canExecute']): string {
  if (value === true) return '始终执行'
  if (typeof value === 'string') return `引用条件 · ${value}`
  return '内联条件'
}

export function getEventSummary(event: EventType): string {
  const actionCount = event.actions.length
  const actionSummary = actionCount === 0 ? '无动作' : `${actionCount} 个动作`
  return `${getCanExecuteSummary(event.canExecute)} · ${actionSummary}`
}
