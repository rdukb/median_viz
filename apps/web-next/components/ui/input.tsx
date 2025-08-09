import * as React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', type='text', ...props }, ref) => {
    const classes = [
      'flex h-10 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white',
      'file:border-0 file:bg-transparent file:text-sm file:font-medium',
      'placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pastel-blue focus-visible:ring-offset-2',
      className
    ].join(' ')
    return <input type={type} className={classes} ref={ref} {...props} />
  }
)
Input.displayName = 'Input'
