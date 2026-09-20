import { EditorDialog } from '../../data/EditorDialog'
import { EventRefPicker } from './EventRefPicker'
import type { EventOption } from './eventOptions'

interface EventRefPickerDialogProps {
  title?: string
  value: string | null
  options: EventOption[]
  disabled?: boolean
  onSelect: (key: string) => void
  onClose: () => void
}

export function EventRefPickerDialog({
  title = '选择事件',
  value,
  options,
  disabled = false,
  onSelect,
  onClose
}: EventRefPickerDialogProps) {
  return (
    <EditorDialog title={title} closeDisabled={disabled} onClose={onClose}>
      <EventRefPicker
        value={value}
        options={options}
        disabled={disabled}
        onSelect={(key) => {
          onSelect(key)
          onClose()
        }}
      />
    </EditorDialog>
  )
}
