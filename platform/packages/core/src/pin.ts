// Counter PINs: 4–6 digits, not trivially guessable.
export function pinProblem(pin: string): 'format' | 'weak' | null {
  if (!/^\d{4,6}$/.test(pin)) return 'format';
  if (/^(\d)\1+$/.test(pin)) return 'weak';                       // 0000, 111111
  const up = '0123456789012345', down = '9876543210987654';
  if (up.includes(pin) || down.includes(pin)) return 'weak';        // 1234, 987654
  if (['1122', '1212', '2580', '0852', '112233', '121212', '123123'].includes(pin)) return 'weak';
  return null;
}
