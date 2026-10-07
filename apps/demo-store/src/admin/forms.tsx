// Form pieces the control panel repeats: a field in both languages, a money field in the shop's currency, a switch,
// and a picture picker (upload a photo, or keep the drawn art).
import { useSignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { DECIMALS, sign, toMajor, toMinor } from '../lib/money';
import { lang } from '../lib/i18n';
import { savePhoto } from '../lib/media';
import { settings } from '../lib/store';
import type { Pic, T } from '../lib/types';
import { Icon, Img, toast } from '../ui/kit';

export const Field = ({ label, hint, err, children }: { label: string; hint?: string; err?: string; children: ComponentChildren }) => (
  <label class="field">{label}{children}{err ? <span class="field-err">{err}</span> : hint && <span class="field-hint">{hint}</span>}</label>
);

/** The same text in Arabic and English, side by side (stacked on phones). */
export function TFields({ value, onChange, labels, area = false, err }: { value: T; onChange(v: T): void; labels: [string, string]; area?: boolean; err?: string }) {
  const Tag = area ? 'textarea' : 'input';
  return (
    <div class="pair">
      <Field label={labels[0]} err={err && !value.ar.trim() ? err : undefined}><Tag class="input" dir="rtl" lang="ar" value={value.ar} onInput={(e: Event) => onChange({ ...value, ar: (e.target as HTMLInputElement).value })} /></Field>
      <Field label={labels[1]}><Tag class="input" dir="ltr" lang="en" value={value.en} onInput={(e: Event) => onChange({ ...value, en: (e.target as HTMLInputElement).value })} /></Field>
    </div>
  );
}

/**
 * Money typed as the owner thinks of it (45000, or 32.5) and kept as whole minor units. Shows the currency, and accepts
 * only as many decimals as the currency has (none for IQD, three for JOD).
 */
export function MoneyInput({ value, onChange, allowEmpty = false, label, err }: { value: number | null; onChange(v: number | null): void; allowEmpty?: boolean; label: string; err?: string }) {
  const cur = settings.value.currency, d = DECIMALS[cur];
  const draft = useSignal(value == null ? '' : String(toMajor(value, cur)));
  return (
    <Field label={label} err={err}>
      <span class="money-in">
        <input class="input num" inputMode={d ? 'decimal' : 'numeric'} dir="ltr" value={draft.value} placeholder={allowEmpty ? '—' : '0'}
          onInput={(e) => {
            const raw = (e.target as HTMLInputElement).value.replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[^\d.]/g, '');
            const [w, f = ''] = raw.split('.'), clean = d ? (raw.includes('.') ? `${w}.${f.slice(0, d)}` : w) : w;
            draft.value = clean;
            onChange(clean === '' ? (allowEmpty ? null : 0) : toMinor(Number(clean), cur));
          }} />
        <span class="money-sign">{sign(cur, lang.value)}</span>
      </span>
    </Field>
  );
}

export const Switch = ({ on, onChange, label }: { on: boolean; onChange(v: boolean): void; label: string }) => (
  <label class="switch"><input type="checkbox" role="switch" checked={on} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} /><span class="switch-ui" aria-hidden="true" /><span>{label}</span></label>
);

/** Pick a photo from the device; it's shrunk and kept in the browser. Returns the picture to store. */
export function PhotoButton({ onPicked, label, multiple = false }: { onPicked(p: Pic): void; label: string; multiple?: boolean }) {
  const busy = useSignal(false);
  return (
    <label class={`btn btn-line btn-sm photo-btn${busy.value ? ' busy' : ''}`}>
      <Icon n="image" />{label}
      <input type="file" accept="image/*" multiple={multiple} hidden disabled={busy.value} onChange={async (e) => {
        const files = [...((e.target as HTMLInputElement).files ?? [])];
        (e.target as HTMLInputElement).value = '';
        if (!files.length) return;
        busy.value = true;
        try { for (const f of files) onPicked(await savePhoto(f)); } catch { toast(lang.value === 'ar' ? 'تعذّر قراءة الصورة' : 'Couldn’t read that image'); }
        busy.value = false;
      }} />
    </label>
  );
}

/** One picture with a replace button: banners and categories. */
export function PicField({ pic, onChange, label }: { pic: Pic; onChange(p: Pic): void; label: string }) {
  return (
    <div class="field">{label}
      <div class="pic-field"><Img pic={pic} ratio="16 / 10" /><PhotoButton label={lang.value === 'ar' ? 'تغيير' : 'Replace'} onPicked={onChange} /></div>
    </div>
  );
}
