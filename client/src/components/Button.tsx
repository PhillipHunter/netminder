import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary';
    loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'primary', loading = false, disabled, children, className, ...props }, ref) => {
        const baseClasses = 'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 relative overflow-hidden group';

        const variantClasses = {
            primary: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] focus:ring-indigo-500',
            secondary: 'border border-slate-700/70 bg-gradient-to-b from-slate-800 to-slate-900 text-slate-100 hover:border-slate-600 hover:from-slate-700 hover:to-slate-800 shadow-md shadow-black/20 focus:ring-slate-500'
        };

        return (
            <button
                ref={ref}
                disabled={disabled ?? loading}
                className={`${baseClasses} ${variantClasses[variant]} ${className ?? ''}`}
                style={{ backgroundSize: '200% 100%' }}
                {...props}
            >
                {loading ? (
                    <>
                        <svg className='mr-2 h-4 w-4 animate-spin' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
                            <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                            <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
                        </svg>
                        Loading...
                    </>
                ) : children}
            </button>
        );
    }
);

Button.displayName = 'Button';