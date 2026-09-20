import { EditorDialog } from '../../data/EditorDialog'
import { ActionRefPicker } from './ActionRefPicker'
import type { ActionOption } from './actionOptions'

interface ActionRefPickerDialogProps {
  title?: string
  value: string | null
  options: ActionOption[]
  disabled?: boolean
  onSelect: (key: string) => void
  onClose: () => void
}

export function ActionRefPickerDialog({
  title = '选择动作',
  value,
  options,
  disabled = false,
  onSelect,
  onClose
}: ActionRefPickerDialogProps) {
  return (
    <EditorDialog title={title} closeDisabled={disabled} onClose={onClose}>
      <ActionRefPicker
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
