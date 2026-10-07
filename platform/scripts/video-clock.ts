// For the demo video: move this process's clock to 16:40 Baghdad today, so the demo shop has an afternoon of trading.
// Imported first, before anything reads the time.
const now = new Date(Date.now() + 3 * 3600_000); // the date in Baghdad
export const FAKE_NOW = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 13, 40);
const OFFSET = FAKE_NOW - Date.now();
const RealDate = Date;
class ShiftedDate extends RealDate {
  constructor(...a: any[]) { if (a.length === 0) super(RealDate.now() + OFFSET); else super(...(a as [any])); }
  static now() { return RealDate.now() + OFFSET; }
}
(globalThis as any).Date = ShiftedDate;
