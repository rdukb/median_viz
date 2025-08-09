import * as React from 'react'

export function Label({ className = '', ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  const classes = ['text-sm font-medium text-gray-700', className].join(' ')
  return <label className={classes} {...props} />
}
