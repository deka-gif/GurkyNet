import React, { useCallback, useEffect, useRef } from 'react';

const PIN_LENGTH = 6;

export interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: boolean;
  id?: string;
}

export const PinInput: React.FC<PinInputProps> = ({
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  error = false,
  id,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length: PIN_LENGTH }, (_, index) => value[index] ?? '');

  const focusIndex = useCallback((index: number) => {
    const el = inputRefs.current[index];
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const updateValue = useCallback(
    (next: string) => {
      onChange(next.replace(/\D/g, '').slice(0, PIN_LENGTH));
    },
    [onChange],
  );

  useEffect(() => {
    if (autoFocus && !disabled) {
      focusIndex(0);
    }
  }, [autoFocus, disabled, focusIndex]);

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const chars = [...digits];
    chars[index] = digit;
    const combined = chars.join('').replace(/\D/g, '').slice(0, PIN_LENGTH);
    updateValue(combined);
    if (digit && index < PIN_LENGTH - 1) {
      focusIndex(index + 1);
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      if (digits[index]) {
        const chars = [...digits];
        chars[index] = '';
        updateValue(chars.join(''));
      } else if (index > 0) {
        const chars = [...digits];
        chars[index - 1] = '';
        updateValue(chars.join(''));
        focusIndex(index - 1);
      }
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      focusIndex(index - 1);
      return;
    }

    if (event.key === 'ArrowRight' && index < PIN_LENGTH - 1) {
      focusIndex(index + 1);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH);
    if (!pasted) return;
    updateValue(pasted);
    focusIndex(Math.min(pasted.length, PIN_LENGTH - 1));
  };

  const boxClass = `w-11 h-12 sm:w-12 sm:h-14 text-center text-xl font-black rounded-2xl border border-gray-200 bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all disabled:opacity-60 ${
    error ? 'auth-input-error' : ''
  }`;

  return (
    <div className="flex gap-2 sm:gap-2.5 justify-start" id={id}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoComplete="off"
          aria-label={`Digit PIN ${index + 1}`}
          className={boxClass}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
};
