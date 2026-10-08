// shadcn/ui components (new-york, Tailwind v4) for Hemlo School: Button, Card, Badge, Input, Textarea, Label, Avatar,
// Skeleton, Progress, Separator. Copied in the shadcn way (our code, not a package) and tuned to the School's tokens:
// the muted background is "secondary" here, because the app's own "muted" is a text colour.
import * as React from 'react';
import { Slot, Avatar as AvatarPrimitive, Progress as ProgressPrimitive, Separator as SeparatorPrimitive, Label as LabelPrimitive } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// ---------- Button ----------
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[14.5px] font-medium transition-[color,background-color,box-shadow,transform] active:scale-[.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[18px] shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive: 'bg-destructive text-white shadow-xs hover:bg-destructive/90',
        outline: 'border border-border bg-card shadow-xs hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        ink: 'bg-foreground text-background hover:bg-foreground/90',
        whatsapp: 'bg-[#1FAF5A] text-white shadow-xs hover:bg-[#1FAF5A]/90',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 rounded-lg gap-1.5 px-3 text-[13.5px]',
        lg: 'h-12 rounded-xl px-6',
        icon: 'size-10',
        'icon-sm': 'size-8 rounded-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
export function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

// ---------- Card ----------
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card" className={cn('bg-card text-card-foreground flex flex-col rounded-2xl border border-border shadow-[0_1px_2px_rgba(18,23,43,.05),0_4px_16px_-6px_rgba(18,23,43,.08)]', className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 px-5 pt-5 pb-2 has-data-[slot=card-action]:grid-cols-[1fr_auto]', className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-title" className={cn('text-[15.5px] leading-none font-semibold', className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-description" className={cn('text-muted-foreground text-[13px]', className)} {...props} />;
}
export function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-action" className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)} {...props} />;
}
export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-5 pb-5', className)} {...props} />;
}

// ---------- Badge ----------
export const badgeVariants = cva('inline-flex items-center justify-center gap-1 rounded-full px-2.5 h-6 text-[12px] font-medium whitespace-nowrap shrink-0 [&>svg]:size-3.5', {
  variants: {
    variant: {
      default: 'bg-primary-soft text-primary',
      secondary: 'bg-secondary text-secondary-foreground',
      destructive: 'bg-danger-soft text-destructive',
      success: 'bg-success-soft text-success',
      warning: 'bg-warning-soft text-warning',
      info: 'bg-info-soft text-info',
      outline: 'border border-border text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});
export function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// ---------- Input, Textarea, Label ----------
const field = 'w-full min-w-0 rounded-xl border border-input bg-card px-3.5 text-[15.5px] text-foreground shadow-xs transition-[color,box-shadow,border-color] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[4px] focus-visible:ring-ring/20 disabled:opacity-50 aria-invalid:border-destructive';
export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(field, 'h-11', className)} {...props} />;
}
export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(field, 'min-h-22 py-3 leading-relaxed', className)} {...props} />;
}
export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root data-slot="label" className={cn('text-[13px] font-medium text-foreground/80 select-none', className)} {...props} />;
}
/** A label above its control, with an optional hint under it. */
export function Field({ label, hint, htmlFor, children, className }: { label: React.ReactNode; hint?: React.ReactNode; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return <div className={cn('grid gap-1.5', className)}><Label htmlFor={htmlFor}>{label}</Label>{children}{hint && <p className="text-muted-foreground text-[12px]">{hint}</p>}</div>;
}

// ---------- Avatar (initials, tinted by the name) ----------
const hue = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
export const initialsOf = (name: string) => { const w = (name || '·').trim().split(/\s+/); return /[؀-ۿ]/.test(w[0]) ? w[0][0] : w.slice(0, 2).map((x) => x[0]).join('').toUpperCase(); };
export function Avatar({ name, className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root> & { name: string }) {
  return (
    <AvatarPrimitive.Root data-slot="avatar" className={cn('sc-avatar relative flex shrink-0 overflow-hidden', className)} style={{ ['--h' as any]: hue(name) }} {...props}>
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center">{initialsOf(name)}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

// ---------- Skeleton, Progress, Separator ----------
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('sc-skel rounded-2xl', className)} {...props} />;
}
export function Progress({ className, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root data-slot="progress" className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-secondary', className)} {...props}>
      <ProgressPrimitive.Indicator className="h-full w-full flex-1 rounded-full bg-primary transition-transform duration-700 ease-[cubic-bezier(.22,.8,.24,1)] rtl:origin-right" style={{ transform: `translateX(${document.documentElement.dir === 'rtl' ? '' : '-'}${100 - (value || 0)}%)` }} />
    </ProgressPrimitive.Root>
  );
}
export function Separator({ className, orientation = 'horizontal', ...props }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return <SeparatorPrimitive.Root data-slot="separator" decorative orientation={orientation} className={cn('shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px', className)} {...props} />;
}
