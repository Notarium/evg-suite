import type { ProjectVariable, VariableType } from '../../../../shared/variable'
import { Combobox, type ComboboxOption } from './Combobox'

const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  string: '字符串',
  number: '数字',
  bool: '布尔',
  pending: '待定'
}

interface VariableComboboxProps {
  value: string
  variables: ProjectVariable[]
  disabled?: boolean
  onChange: (value: string) => void
}

export function VariableCombobox({
  value,
  variables,
  disabled = false,
  onChange
}: VariableComboboxProps) {
  const options: ComboboxOption[] = variables.map((variable) => ({
    value: variable.name,
    label: variable.name,
    meta: VARIABLE_TYPE_LABELS[variable.type],
    metaClassName: `badge badge--${variable.type}`
  }))

  return (
    <Combobox
      value={value}
      options={options}
      disabled={disabled}
      placeholder="未选择变量"
      searchPlaceholder="搜索变量"
      emptyMessage="没有匹配的变量"
      onChange={onChange}
    />
  )
}
