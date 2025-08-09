import * as React from 'react'

export function Card({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const classes = ['rounded-2xl shadow-soft border border-gray-100 bg-[var(--card)]', className].join(' ')
  return <div className={classes} {...props} />
}

export function CardHeader({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const classes = ['p-4 pb-2', className].join(' ')
  return <div className={classes} {...props} />
}

export function CardTitle({ className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const classes = ['font-semibold tracking-tight', className].join(' ')
  return <h3 className={classes} {...props} />
}

export function CardContent({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const classes = ['p-4 pt-0', className].join(' ')
  return <div className={classes} {...props} />
}
