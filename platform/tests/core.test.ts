import { describe, it, expect } from 'vitest';
import { normalizeIraqiPhone, formatIraqiPhone, maskPhone, isAllowedReturnUrl, pinProblem, hmac, safeEqual, placeholderEmail, isPlaceholderEmail } from '@hemlo/core';

describe('Iraqi phone numbers', () => {
  it.each([
    ['0770 123 4567', '+9647701234567'], ['7701234567', '+9647701234567'], ['+964 770 123 4567', '+9647701234567'],
    ['00964-770-123-4567', '+9647701234567'], ['964(770)1234567', '+9647701234567'], ['٠٧٧٠١٢٣٤٥٦٧', '+9647701234567'],
    ['۰۷۸۱ ۵۵۵ ۰۱۹۹', '+9647815550199'], ['‎0750 000 1122', '+9647500001122'],
  ])('%s → %s', (input, out) => expect(normalizeIraqiPhone(input)).toBe(out));
  it.each(['', '123', '0660 123 4567', '+1 202 555 0101', '07701234567x', '077012345678', '+9641234567890'])('rejects %s', (s) => expect(normalizeIraqiPhone(s)).toBeNull());
  it('formats and masks', () => {
    expect(formatIraqiPhone('+9647701234567')).toBe('0770 123 4567');
    expect(maskPhone('+9647701234567')).toBe('0770 ••• ••67');
  });
  it('placeholder emails are recognisable', () => {
    const e = placeholderEmail('+9647701234567');
    expect(e).toBe('p9647701234567@phone.hemlohq.invalid');
    expect(isPlaceholderEmail(e)).toBe(true);
    expect(isPlaceholderEmail('a@b.com')).toBe(false);
  });
});

describe('return URLs', () => {
  const hosts = ['hemlohq.com', '*.hemlohq.com', 'localhost'];
  it.each(['https://systems.hemlohq.com/app', 'https://hemlohq.com/', 'http://localhost:4321/x'])('allows %s', (u) => expect(isAllowedReturnUrl(u, hosts)).toBe(true));
  it.each(['https://evil.com', 'https://hemlohq.com.evil.com/', 'javascript:void(0)', 'http://systems.hemlohq.com/', 'https://user:pw@hemlohq.com/', '//evil.com'])(
    'blocks %s', (u) => expect(isAllowedReturnUrl(u, hosts)).toBe(false));
});

describe('PINs', () => {
  it.each(['0000', '1234', '987654', '111111', '1212'])('weak %s', (p) => expect(pinProblem(p)).toBe('weak'));
  it.each(['12', '1234567', '12a4'])('bad format %s', (p) => expect(pinProblem(p)).toBe('format'));
  it.each(['4827', '903114'])('ok %s', (p) => expect(pinProblem(p)).toBeNull());
});

describe('crypto', () => {
  it('hmac is stable and keyed', async () => {
    const a = await hmac('k1', 'x'), b = await hmac('k1', 'x'), c = await hmac('k2', 'x');
    expect(a).toBe(b); expect(a).not.toBe(c); expect(safeEqual(a, b)).toBe(true); expect(safeEqual(a, c)).toBe(false);
  });
});
