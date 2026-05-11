export function phoneDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 12);
}

export function formatPhoneInput(raw: string): string {
  let d = phoneDigitsOnly(raw);
  if (!d) return "";
  if (!d.startsWith("998")) {
    d = ("998" + d).slice(0, 12);
  } else {
    d = d.slice(0, 12);
  }
  const n = d.slice(3, 12);
  if (n.length === 0) return "+998 ";
  const a = n.slice(0, 2);
  const b = n.slice(2, 5);
  const c = n.slice(5, 7);
  const e = n.slice(7, 9);
  let out = `+998 ${a}`;
  if (b) out += ` ${b}`;
  if (c) out += ` ${c}`;
  if (e) out += ` ${e}`;
  return out;
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 12 && cleaned.startsWith("998")) {
    return `+998 (${cleaned.slice(3, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8, 10)}-${cleaned.slice(10, 12)}`;
  }
  if (cleaned.length === 9) {
    return `+998 (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 5)}-${cleaned.slice(5, 7)}-${cleaned.slice(7, 9)}`;
  }
  return phone;
}
