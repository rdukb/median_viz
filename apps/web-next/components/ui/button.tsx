import * as React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'md', ...props }, ref) => {
    const base = 'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
    const variants: Record<string,string> = {
      default: 'bg-pastel-blue text-black hover:opacity-90',
      outline: 'border border-gray-200 hover:bg-gray-50',
      ghost: 'hover:bg-gray-100',
    }
    const sizes: Record<string,string> = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
    }
    const classes = [base, variants[variant] || variants.default, sizes[size] || sizes.md, className].join(' ')
    return <button ref={ref} className={classes} {...props} />
  }
)
Button.displayName = 'Button'
