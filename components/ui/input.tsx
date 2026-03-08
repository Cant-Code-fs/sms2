import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, helperText, icon, className = '', ...props }, ref) => {
        return (
            <div className={className}>
                {label && (
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {label}
                        {props.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={`
              w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400
              transition-all outline-none
              focus:ring-2 focus:border-transparent
              disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
              ${icon ? 'pl-10' : ''}
              ${error
                                ? 'border-red-300 focus:ring-red-500/20'
                                : 'border-gray-200 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]'
                            }
            `}
                        {...props}
                    />
                </div>
                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
                {!error && helperText && <p className="mt-1 text-xs text-gray-400">{helperText}</p>}
            </div>
        );
    }
);

Input.displayName = 'Input';
