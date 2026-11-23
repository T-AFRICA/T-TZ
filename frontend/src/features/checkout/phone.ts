/**
 * The WhatsApp number asked for at checkout (owner request 2026-11-23: a
 * WhatsApp number with its country code, in place of a Tanzanian phone
 * number).
 *
 * The number is stored as it always was: `+<country code><number>`, digits
 * only (orders.contact_phone, checked again by place_cod_order). What
 * changed is that the country code is no longer assumed to be Tanzania's:
 * the customer picks it from a list or types it with a plus sign.
 *
 * Plain functions, no dependency, shared by the browser (inline errors)
 * and the server (which never trusts the browser's result). Nothing here
 * checks that the number is on WhatsApp or sends a message: it is a
 * contact number that staff and riders use.
 */

export interface DialCode {
  /** ISO 3166-1 alpha-2, as a stable key. */
  iso: string;
  name: string;
  /** With the plus sign: "+255". */
  code: string;
}

/**
 * Tanzania first, then East and Southern Africa, then the countries
 * customers most often have a WhatsApp number from. Not every country: a
 * number from anywhere else is typed in full, with a plus sign, under
 * "Other". No two entries share a code and none is the start of another.
 */
export const DIAL_CODES: readonly DialCode[] = [
  { iso: "TZ", name: "Tanzania", code: "+255" },
  { iso: "KE", name: "Kenya", code: "+254" },
  { iso: "UG", name: "Uganda", code: "+256" },
  { iso: "RW", name: "Rwanda", code: "+250" },
  { iso: "BI", name: "Burundi", code: "+257" },
  { iso: "CD", name: "DR Congo", code: "+243" },
  { iso: "CG", name: "Congo (Brazzaville)", code: "+242" },
  { iso: "ZM", name: "Zambia", code: "+260" },
  { iso: "MW", name: "Malawi", code: "+265" },
  { iso: "MZ", name: "Mozambique", code: "+258" },
  { iso: "ZW", name: "Zimbabwe", code: "+263" },
  { iso: "ZA", name: "South Africa", code: "+27" },
  { iso: "KM", name: "Comoros", code: "+269" },
  { iso: "MG", name: "Madagascar", code: "+261" },
  { iso: "MU", name: "Mauritius", code: "+230" },
  { iso: "ET", name: "Ethiopia", code: "+251" },
  { iso: "SO", name: "Somalia", code: "+252" },
  { iso: "SS", name: "South Sudan", code: "+211" },
  { iso: "SD", name: "Sudan", code: "+249" },
  { iso: "EG", name: "Egypt", code: "+20" },
  { iso: "NG", name: "Nigeria", code: "+234" },
  { iso: "GH", name: "Ghana", code: "+233" },
  { iso: "AO", name: "Angola", code: "+244" },
  { iso: "NA", name: "Namibia", code: "+264" },
  { iso: "BW", name: "Botswana", code: "+267" },
  { iso: "AE", name: "United Arab Emirates", code: "+971" },
  { iso: "SA", name: "Saudi Arabia", code: "+966" },
  { iso: "OM", name: "Oman", code: "+968" },
  { iso: "QA", name: "Qatar", code: "+974" },
  { iso: "KW", name: "Kuwait", code: "+965" },
  { iso: "BH", name: "Bahrain", code: "+973" },
  { iso: "IN", name: "India", code: "+91" },
  { iso: "PK", name: "Pakistan", code: "+92" },
  { iso: "BD", name: "Bangladesh", code: "+880" },
  { iso: "CN", name: "China", code: "+86" },
  { iso: "TR", name: "Türkiye", code: "+90" },
  { iso: "GB", name: "United Kingdom", code: "+44" },
  { iso: "US", name: "United States / Canada", code: "+1" },
  { iso: "DE", name: "Germany", code: "+49" },
  { iso: "FR", name: "France", code: "+33" },
  { iso: "IT", name: "Italy", code: "+39" },
  { iso: "NL", name: "Netherlands", code: "+31" },
  { iso: "SE", name: "Sweden", code: "+46" },
  { iso: "AU", name: "Australia", code: "+61" },
];

export const DEFAULT_DIAL_CODE = "+255";
/** The choice for a country that is not in the list: the number is then typed in full, with a plus sign. */
export const OTHER_DIAL_CODE = "";

/** True for a code from the list. Anything else a request carries as its country code is not used. */
export function isDialCode(value: string): boolean {
  return DIAL_CODES.some((entry) => entry.code === value);
}

/** Total digits of `+<country code><number>` the orders table accepts (migration 0004: 9 to 15). */
const E164 = /^[1-9]\d{8,14}$/;
/** A Tanzanian mobile number: 255, then 6 or 7, then eight more digits. WhatsApp runs on a mobile number. */
const TZ_MOBILE = /^255[67]\d{8}$/;

/**
 * A WhatsApp number as `+<country code><number>`, or null when it is not
 * one. A number typed with a plus sign (or 00) carries its own country
 * code and the chosen one is ignored; otherwise the chosen code is put in
 * front and a leading 0 (the trunk prefix, as in 0712 345 678) is dropped.
 * Spaces, dashes, dots and brackets are ignored.
 */
export function normalizeWhatsApp(input: string, dialCode: string = OTHER_DIAL_CODE): string | null {
  const compact = input.replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(compact)) return null;
  let digits: string;
  if (compact.startsWith("+")) digits = compact.slice(1);
  else if (compact.startsWith("00")) digits = compact.slice(2);
  else {
    if (!isDialCode(dialCode)) return null;
    const code = dialCode.slice(1);
    // "255712345678" with Tanzania chosen: the code was typed again, as people often do.
    digits = code === "255" && TZ_MOBILE.test(compact) ? compact : `${code}${compact.replace(/^0+/, "")}`;
  }
  if (!E164.test(digits)) return null;
  if (digits.startsWith("255") && !TZ_MOBILE.test(digits)) return null;
  return `+${digits}`;
}

/**
 * A stored number as the form shows it: the country code for the list and
 * the rest for the field. A Tanzanian number is spaced the way it is said
 * (712 345 678). Null when the code is not in the list: the form then
 * shows the number in full under "Other".
 */
export function splitWhatsApp(number: string | null | undefined): { dialCode: string; national: string } | null {
  if (!number || !/^\+[1-9]\d{8,14}$/.test(number)) return null;
  const entry = DIAL_CODES.find((candidate) => number.startsWith(candidate.code));
  if (!entry) return null;
  const national = number.slice(entry.code.length);
  const spaced = entry.code === "+255" ? national.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3") : national;
  return { dialCode: entry.code, national: spaced };
}

/** A Tanzanian number as it is typed in Tanzania (0712 345 678), for the mobile money field; null for any other country. */
export function tzLocalNumber(number: string | null | undefined): string | null {
  const match = /^\+255(\d{3})(\d{3})(\d{3})$/.exec(number ?? "");
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : null;
}
