// shadcn/ui components for Hemlo School that open or switch: Select, Tabs, ToggleGroup, Drawer (Vaul) with a
// responsive Sheet (a drawer from the bottom on phones, a side panel on wide screens: shadcn's "responsive dialog"
// pattern), Command (cmdk) in a Dialog, and the Sonner toaster. The moving highlight on tabs and toggles is Motion.
import * as React from 'react';
import { Select as SelectPrimitive, Tabs as TabsPrimitive, ToggleGroup as ToggleGroupPrimitive, Dialog as DialogPrimitive } from 'radix-ui';
import { Drawer as DrawerPrimitive } from 'vaul';
import { Command as CommandPrimitive } from 'cmdk';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { motion } from 'motion/react';
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

// ---------- Select ----------
export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger data-slot="select-trigger" className={cn('flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-3.5 text-[15px] text-foreground shadow-xs outline-none data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-[4px] focus-visible:ring-ring/20 [&>span]:line-clamp-1 [&>span]:text-start', className)} {...props}>
      {children}
      <SelectPrimitive.Icon asChild><ChevronDownIcon className="size-4 opacity-50" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}
export function SelectContent({ className, children, position = 'popper', ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content data-slot="select-content" position={position} sideOffset={6}
        className={cn('sc-pop-in relative z-80 max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg', position === 'popper' && 'w-full min-w-(--radix-select-trigger-width)', className)} {...props}>
        <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}
export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item data-slot="select-item" className={cn('relative flex w-full cursor-default items-center gap-2 rounded-lg py-2 ps-3 pe-8 text-[14.5px] outline-none select-none data-[highlighted]:bg-accent data-[disabled]:opacity-50', className)} {...props}>
      <span className="absolute end-2 flex size-4 items-center justify-center"><SelectPrimitive.ItemIndicator><CheckIcon className="size-4" /></SelectPrimitive.ItemIndicator></span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
/** The common case: a value and its options. */
export function SimpleSelect({ value, onChange, options, placeholder, id, label, className }: { value: string; onChange(v: string): void; options: { value: string; label: string }[]; placeholder?: string; id?: string; label?: string; className?: string }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={label} className={className}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

// ---------- Tabs (a line that slides under the active tab) ----------
const TabsCtx = React.createContext<{ value?: string; id: string }>({ id: '' });
export function Tabs({ className, value, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const id = React.useId();
  return <TabsCtx.Provider value={{ value, id }}><TabsPrimitive.Root data-slot="tabs" value={value} className={cn('flex flex-col gap-4', className)} {...props} /></TabsCtx.Provider>;
}
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn('flex gap-5 overflow-x-auto border-b border-border [scrollbar-width:none]', className)} {...props} />;
}
export function TabsTrigger({ className, children, value, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const ctx = React.useContext(TabsCtx);
  return (
    <TabsPrimitive.Trigger data-slot="tabs-trigger" value={value} className={cn('relative inline-flex items-center gap-1.5 py-3 text-[14.5px] font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors data-[state=active]:text-foreground focus-visible:text-foreground', className)} {...props}>
      {children}
      {ctx.value === value && <motion.span layoutId={`tab-${ctx.id}`} className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
    </TabsPrimitive.Trigger>
  );
}
export const TabsContent = TabsPrimitive.Content;

// ---------- ToggleGroup (a segmented control; the chosen item's background slides) ----------
const ToggleCtx = React.createContext<{ value?: string; id: string; pill?: (v: string) => string }>({ id: '' });
export function ToggleGroup({ className, value, onValueChange, children, pill, ...props }: Omit<React.ComponentProps<typeof ToggleGroupPrimitive.Root>, 'type' | 'value' | 'onValueChange'> & { value: string; onValueChange(v: string): void; pill?: (v: string) => string }) {
  const id = React.useId();
  return (
    <ToggleCtx.Provider value={{ value, id, pill }}>
      <ToggleGroupPrimitive.Root data-slot="toggle-group" type="single" value={value} onValueChange={(v: string) => v && onValueChange(v)} className={cn('inline-flex items-center gap-0.5 rounded-xl bg-secondary p-[3px]', className)} {...props as any}>{children}</ToggleGroupPrimitive.Root>
    </ToggleCtx.Provider>
  );
}
export function ToggleGroupItem({ className, children, value, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  const ctx = React.useContext(ToggleCtx), on = ctx.value === value;
  return (
    <ToggleGroupPrimitive.Item data-slot="toggle-group-item" value={value} className={cn('relative inline-flex h-8 items-center justify-center rounded-[9px] px-3 text-[13.5px] font-medium text-muted-foreground outline-none transition-colors data-[state=on]:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40', className)} {...props}>
      {on && <motion.span layoutId={`tg-${ctx.id}`} className={cn('absolute inset-0 rounded-[9px] bg-card shadow-xs', ctx.pill?.(value))} transition={{ type: 'spring', stiffness: 560, damping: 38 }} />}
      <span className="relative z-1">{children}</span>
    </ToggleGroupPrimitive.Item>
  );
}

// ---------- Drawer (Vaul) and the responsive Sheet ----------
function useWide(min = 768) {
  const q = `(min-width: ${min}px)`;
  const [wide, set] = React.useState(() => matchMedia(q).matches);
  React.useEffect(() => { const m = matchMedia(q), on = () => set(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, [q]);
  return wide;
}
/** shadcn's responsive dialog: a Vaul drawer from the bottom on phones (drag to close), from the side on wide screens. */
export function Sheet({ open, onClose, title, description, children, footer }: { open: boolean; onClose(): void; title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  const wide = useWide(), rtl = document.documentElement.dir === 'rtl';
  const direction = wide ? (rtl ? 'left' : 'right') : 'bottom';
  return (
    <DrawerPrimitive.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }} direction={direction as any}>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay data-slot="drawer-overlay" className="fixed inset-0 z-60 bg-black/40 backdrop-blur-[2px]" />
        <DrawerPrimitive.Content data-slot="drawer-content" dir={rtl ? 'rtl' : 'ltr'} aria-describedby={undefined}
          className={cn('sc-root fixed z-61 flex flex-col bg-card text-card-foreground outline-none',
            direction === 'bottom' ? 'inset-x-0 bottom-0 max-h-[94dvh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]' : 'top-2.5 bottom-2.5 w-[min(480px,calc(100vw-20px))] rounded-3xl shadow-2xl',
            direction === 'right' && 'right-2.5', direction === 'left' && 'left-2.5')}>
          {!wide && <div className="mx-auto mt-2.5 mb-0.5 h-1.5 w-11 shrink-0 rounded-full bg-border" aria-hidden />}
          <div className="flex items-start gap-3 px-5 pt-4 pb-2">
            <div className="min-w-0 flex-1">
              <DrawerPrimitive.Title className="text-[19px] font-semibold tracking-tight">{title}</DrawerPrimitive.Title>
              {description && <DrawerPrimitive.Description className="text-muted-foreground mt-1 text-[13px]">{description}</DrawerPrimitive.Description>}
            </div>
            <button onClick={onClose} aria-label="close" className="text-muted-foreground hover:bg-accent grid size-8 place-items-center rounded-lg"><XIcon className="size-[18px]" /></button>
          </div>
          <div className="grid flex-1 content-start gap-4 overflow-y-auto overscroll-contain px-5 pt-2 pb-5">{children}</div>
          {footer && <div className="grid gap-2 border-t border-border px-5 pt-3 pb-4">{footer}</div>}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

// ---------- Command (cmdk) ----------
export function CommandDialog({ open, onOpenChange, title, children, footer }: { open: boolean; onOpenChange(o: boolean): void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="sc-fade-in fixed inset-0 z-70 bg-black/35 backdrop-blur-[3px]" />
        <DialogPrimitive.Content aria-describedby={undefined} dir={document.documentElement.dir as any}
          className="sc-root sc-pop-in fixed top-[max(10dvh,16px)] left-1/2 z-71 w-[min(620px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl">
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <CommandPrimitive data-slot="command" shouldFilter={false} loop className="flex flex-col">{children}</CommandPrimitive>
          {footer && <div className="text-muted-foreground border-t border-border px-4 py-2.5 text-[12px]">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex h-14 items-center gap-3 border-b border-border px-4">
      <SearchIcon className="text-muted-foreground size-5 shrink-0" />
      <CommandPrimitive.Input data-slot="command-input" className={cn('h-full w-full bg-transparent text-[16.5px] outline-none placeholder:text-muted-foreground', className)} {...props} />
    </div>
  );
}
export function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List data-slot="command-list" className={cn('max-h-[min(60dvh,440px)] overflow-y-auto p-2', className)} {...props} />;
}
export function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className="text-muted-foreground py-8 text-center text-[14px]" {...props} />;
}
export function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return <CommandPrimitive.Group data-slot="command-group" className={cn('[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-medium', className)} {...props} />;
}
export function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return <CommandPrimitive.Item data-slot="command-item" className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] outline-none select-none data-[selected=true]:bg-accent [&_svg:not([class*=size-])]:size-[18px] [&_svg]:text-muted-foreground', className)} {...props} />;
}

// ---------- Toaster (Sonner) ----------
export function Toaster(props: ToasterProps) {
  return <Sonner position="top-center" richColors dir={document.documentElement.dir as any} toastOptions={{ duration: 2600, style: { borderRadius: 14, fontFamily: 'inherit' } }} {...props} />;
}
