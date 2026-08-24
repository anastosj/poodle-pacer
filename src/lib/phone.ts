/** Digits only, so "+1 (555) 123-4567" and "+15551234567" compare equal. */
export const normalize = (phone: string) => phone.replace(/\D/g, "");

/** Twilio wants E.164. Accept a bare 10-digit US number and add the country code. */
export function toE164(phone: string): string | null {
  const digits = normalize(phone);
  if (phone.trim().startsWith("+") && digits.length >= 8) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
