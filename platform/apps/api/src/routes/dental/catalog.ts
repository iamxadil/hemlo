// A new clinic's starting price list: the procedures Iraqi clinics do every day, with common prices (IQD, or USD where
// clinics usually quote dollars: crowns, veneers, implants, braces). The clinic edits them in Settings.
type P = [ar: string, en: string, category: string, currency: 'IQD' | 'USD', price: number, minutes: number, scope: string, mark: string | null, lab?: boolean];

export const CATALOG: P[] = [
  ['كشفية وفحص', 'Examination & consultation', 'diagnostic', 'IQD', 10000, 15, 'mouth', null],
  ['أشعة سن (ذروية)', 'Periapical X-ray', 'diagnostic', 'IQD', 5000, 5, 'tooth', null],
  ['أشعة بانوراما', 'Panoramic X-ray (OPG)', 'diagnostic', 'IQD', 20000, 10, 'mouth', null],
  ['تنظيف وتلميع', 'Scaling & polishing', 'perio', 'IQD', 30000, 30, 'mouth', null],
  ['تنظيف عميق (لكل ربع)', 'Deep cleaning (per quadrant)', 'perio', 'IQD', 40000, 45, 'arch', null],
  ['حشوة تجميلية أمامية', 'Composite filling, front', 'restorative', 'IQD', 30000, 30, 'surface', 'filling'],
  ['حشوة تجميلية خلفية', 'Composite filling, back', 'restorative', 'IQD', 35000, 40, 'surface', 'filling'],
  ['حشوة أملغم', 'Amalgam filling', 'restorative', 'IQD', 25000, 30, 'surface', 'filling'],
  ['حشوة عصب - أمامي', 'Root canal, front tooth', 'endo', 'IQD', 75000, 60, 'tooth', 'rct'],
  ['حشوة عصب - ضاحك', 'Root canal, premolar', 'endo', 'IQD', 100000, 75, 'tooth', 'rct'],
  ['حشوة عصب - طاحن', 'Root canal, molar', 'endo', 'IQD', 150000, 90, 'tooth', 'rct'],
  ['إعادة حشوة عصب', 'Root canal re-treatment', 'endo', 'IQD', 175000, 90, 'tooth', 'rct'],
  ['وتد وقلب', 'Post & core', 'restorative', 'IQD', 50000, 30, 'tooth', 'post'],
  ['قلع بسيط', 'Simple extraction', 'surgery', 'IQD', 20000, 20, 'tooth', 'missing'],
  ['قلع جراحي', 'Surgical extraction', 'surgery', 'IQD', 75000, 45, 'tooth', 'missing'],
  ['قلع ضرس عقل مطمور', 'Impacted wisdom tooth', 'surgery', 'IQD', 150000, 60, 'tooth', 'missing'],
  ['تاج خزف على معدن', 'PFM crown', 'prostho', 'USD', 80, 45, 'tooth', 'crown', true],
  ['تاج زيركون', 'Zirconia crown', 'prostho', 'USD', 150, 45, 'tooth', 'crown', true],
  ['تاج إيماكس', 'E-max crown', 'prostho', 'USD', 180, 45, 'tooth', 'crown', true],
  ['فينير إيماكس', 'E-max veneer', 'cosmetic', 'USD', 200, 60, 'tooth', 'veneer', true],
  ['زرعة سن', 'Dental implant', 'implant', 'USD', 450, 90, 'tooth', 'implant'],
  ['تاج على زرعة', 'Implant crown', 'implant', 'USD', 200, 45, 'tooth', 'crown', true],
  ['طقم كامل (فك واحد)', 'Complete denture (one arch)', 'prostho', 'IQD', 350000, 60, 'arch', null, true],
  ['طقم جزئي أكريلك', 'Partial denture, acrylic', 'prostho', 'IQD', 200000, 60, 'arch', null, true],
  ['تبييض الأسنان بالعيادة', 'In-office whitening', 'cosmetic', 'IQD', 150000, 60, 'mouth', null],
  ['حشوة وقائية (سيلانت)', 'Fissure sealant', 'pedo', 'IQD', 15000, 15, 'tooth', 'sealant'],
  ['فلورايد', 'Fluoride treatment', 'pedo', 'IQD', 15000, 15, 'mouth', null],
  ['بتر لب (أطفال)', 'Pulpotomy (child)', 'pedo', 'IQD', 40000, 30, 'tooth', 'pulpotomy'],
  ['تاج ستانلس (أطفال)', 'Stainless steel crown (child)', 'pedo', 'IQD', 40000, 30, 'tooth', 'crown'],
  ['تقويم ثابت كامل', 'Fixed braces, full treatment', 'ortho', 'USD', 800, 60, 'mouth', null],
  ['زيارة تقويم شهرية', 'Monthly braces visit', 'ortho', 'IQD', 25000, 20, 'mouth', null],
  ['مثبّت بعد التقويم', 'Retainer', 'ortho', 'IQD', 75000, 20, 'arch', null, true],
];

/** A clinic's usual opening hours: Saturday to Thursday, afternoon and evening; Friday closed. */
export const DEFAULT_HOURS: Record<string, [string, string] | null> = { '0': ['14:00', '21:00'], '1': ['14:00', '21:00'], '2': ['14:00', '21:00'], '3': ['14:00', '21:00'], '4': ['14:00', '21:00'], '5': null, '6': ['14:00', '21:00'] };
