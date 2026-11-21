import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface NumericFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number | string;
  onCommit: (value: number) => void;
  errorText?: string;
  helperText?: ReactNode;
  required?: boolean;
  className?: string;
}

export function NumericField({
  id,
  label,
  value,
  min,
  max,
  step = 'any',
  onCommit,
  errorText,
  helperText,
  required = true,
  className = '',
}: NumericFieldProps) {
  const [draft, setDraft] = useState<string>(() => String(value));
  const focusedRef = useRef(false);
  const errorId = `${id}-err`;

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(String(value));
    }
  }, [value]);

  return (
    <div className={className}>
      <label
        className="block text-[11px] font-medium mb-1 truncate"
        style={{ color: 'var(--text-secondary)' }}
        htmlFor={id}
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className="rf-input font-mono-num w-full"
        min={min}
        max={max}
        step={step}
        required={required}
        data-error={errorText ? errorId : undefined}
        value={draft}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          e.target.setCustomValidity('');
          if (raw.trim() === '') return;
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
            onCommit(parsed);
          }
        }}
        onBlur={(e) => {
          focusedRef.current = false;
          const raw = e.target.value.trim();
          if (raw === '') {
            e.target.setCustomValidity('');
            setDraft(String(value));
            return;
          }
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
            e.target.setCustomValidity('');
            setDraft(String(parsed));
            if (parsed !== value) {
              onCommit(parsed);
            }
          }
        }}
      />
      {errorText && (
        <span id={errorId} className="field-error-msg">
          {errorText}
        </span>
      )}
      {helperText && (
        <div
          className="font-mono-num text-[10.5px] mt-1"
          style={{ color: 'var(--text-muted)' }}
        >
          {helperText}
        </div>
      )}
    </div>
  );
}
