import { EditorDialog } from '../../data/EditorDialog'
import {
  ConditionRefPicker,
  type ConditionRefOption
} from './ConditionRefPicker'

interface ConditionRefPickerDialogProps {
  title?: string
  value: string | null
  options: ConditionRefOption[]
  disabled?: boolean
  onSelect: (key: string) => void
  onClose: () => void
}

export function ConditionRefPickerDialog({
  title = '选择条件',
  value,
  options,
  disabled = false,
  onSelect,
  onClose
}: ConditionRefPickerDialogProps) {
  return (
    <EditorDialog title={title} closeDisabled={disabled} onClose={onClose}>
      <ConditionRefPicker
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
