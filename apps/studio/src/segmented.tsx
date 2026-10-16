import type { ReactElement } from 'react'

/**
 * One choice of a few, drawn as a segmented control: native radios in a
 * fieldset, each laid over its option, so the group is one Tab stop and the
 * arrows choose. formancy.ai-data's host page's control, which switches its
 * renderer between React and Angular as this one switches the builder.
 */
export function Segmented<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  className,
}: {
  legend: string
  name: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  className: string
}): ReactElement {
  return (
    <fieldset className={`choice ${className}`}>
      <legend className="eyebrow">{legend}</legend>
      <div className="segmented">
        {options.map((option) => (
          <label className="segment" key={option.value}>
            <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={() => onChange(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
