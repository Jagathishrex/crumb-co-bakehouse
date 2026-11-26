import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// The app's logo: public/logo.svg, which is also its favicon. The path follows the build's base, so it loads in the
// preview, from the root of a host and under a folder (Catalyst's /app/) alike. Size it with a class: <Logo className="size-10" />.
export function Logo({ className, alt = '', ...props }: ComponentProps<'img'>) {
  return <img src={`${import.meta.env.BASE_URL}logo.svg`} alt={alt} draggable={false} className={cn('size-8 shrink-0 select-none', className)} {...props} />
}
