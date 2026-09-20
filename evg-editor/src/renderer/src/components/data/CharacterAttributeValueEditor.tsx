import { useEffect, useState } from 'react'
import type {
  AttributeType,
  AttributeValue,
  CharacterAttributeEntry
} from '../../../../shared/attribute'

interface CharacterAttributeValueEditorProps {
  definition: AttributeType
  character: CharacterAttributeEntry
  disabled: boolean
  onChange: (value: AttributeValue | undefined) => void
}

export function CharacterAttributeValueEditor({
  definition,
  character,
  disabled,
  onChange
}: CharacterAttributeValueEditorProps) {
  const explicit = character.attributeValues[definition.name]
  const hasExplicit = explicit !== undefined

  const valueStateClass = hasExplicit
    ? 'attribute-value--overridden'
    : 'attribute-value--inherited'

  if (definition.type === 'bool') {
    const currentValue = hasExplicit ? Boolean(explicit) : definition.defaultValue
    const filled = hasExplicit && currentValue

    return (
      <div className={`attribute-value ${valueStateClass}`}>
        <button
          type="button"
          className={`value-toggle${filled ? ' value-toggle--on' : ''}${
            hasExplicit ? ' value-toggle--overridden' : ' value-toggle--inherited'
          }`}
          disabled={disabled}
          onClick={() => onChange(!currentValue)}
        >
          {currentValue ? '真' : '假'}
        </button>
        {hasExplicit && (
          <button
            type="button"
            className="text-button"
            disabled={disabled}
            onClick={() => onChange(undefined)}
          >
            重置
          </button>
        )}
      </div>
    )
  }

  return (
    <TextAttributeValueEditor
      definition={definition}
      explicit={explicit}
      hasExplicit={hasExplicit}
      disabled={disabled}
      onChange={onChange}
    />
  )
}

interface TextAttributeValueEditorProps {
  definition: AttributeType
  explicit: AttributeValue | undefined
  hasExplicit: boolean
  disabled: boolean
  onChange: (value: AttributeValue | undefined) => void
}

function TextAttributeValueEditor({
  definition,
  explicit,
  hasExplicit,
  disabled,
  onChange
}: TextAttributeValueEditorProps) {
  const valueStateClass = hasExplicit
    ? 'attribute-value--overridden'
    : 'attribute-value--inherited'
  const [draft, setDraft] = useState(() =>
    hasExplicit ? String(explicit) : ''
  )

  useEffect(() => {
    setDraft(hasExplicit ? String(explicit) : '')
  }, [explicit, hasExplicit])

  const commit = (): void => {
    if (definition.type === 'number') {
      const text = draft.trim()
      if (text === '') {
        if (hasExplicit) onChange(undefined)
        return
      }

      const nextValue = Number(text)
      if (!Number.isFinite(nextValue)) {
        setDraft(hasExplicit ? String(explicit) : '')
        return
      }
      if (hasExplicit && nextValue === explicit) return

      onChange(nextValue)
      return
    }

    if (hasExplicit && draft === explicit) return
    if (!hasExplicit && draft === '') return

    onChange(draft)
  }

  return (
    <div className={`attribute-value ${valueStateClass}`}>
      <input
        className={`field-input${hasExplicit ? '' : ' field-input--inherited'}`}
        type={definition.type === 'number' ? 'number' : 'text'}
        value={draft}
        placeholder={String(definition.defaultValue)}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            ;(event.target as HTMLInputElement).blur()
          }
        }}
      />
      {hasExplicit && (
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          onClick={() => onChange(undefined)}
        >
          重置
        </button>
      )}
    </div>
  )
}
