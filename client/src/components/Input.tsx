import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, className, id, ...props }, ref) => {
        const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

        return (
            <div className='w-full'>
                {label && (
                    <label
                        htmlFor={inputId}
                        className='mb-1.5 block text-sm font-medium text-slate-200'
                    >
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    className={`w-full rounded-lg border bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-2 ${
                        error
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50'
                            : 'border-slate-700/70 focus:border-indigo-500 focus:ring-indigo-500/50 focus:bg-slate-900'
                    } ${className ?? ''}`}
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    {...props}
                />
                {error && (
                    <p
                        id={`${inputId}-error`}
                        className='mt-1.5 text-sm text-red-400'
                        role='alert'
                    >
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';