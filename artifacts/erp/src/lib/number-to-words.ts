import { getCurrency } from "./currencies";

const ONES = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const TENS = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante",
  "soixante", "quatre-vingt", "quatre-vingt"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (t === 7) {
    return o === 1 ? "soixante-et-onze" : `soixante-${ONES[10 + o]}`;
  }
  if (t === 9) {
    return `quatre-vingt-${ONES[10 + o]}`;
  }
  if (t === 8) {
    return o === 0 ? "quatre-vingts" : `quatre-vingt-${ONES[o]}`;
  }
  if (o === 0) return TENS[t];
  if (o === 1) return `${TENS[t]}-et-un`;
  return `${TENS[t]}-${ONES[o]}`;
}

function belowThousand(n: number): string {
  if (n < 100) return belowHundred(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  const centStr = h === 1 ? "cent" : `${ONES[h]} cent${r === 0 ? "s" : ""}`;
  if (r === 0) return centStr;
  return `${centStr} ${belowHundred(r)}`;
}

function convert(n: number): string {
  if (n === 0) return "zéro";
  if (n < 0) return `moins ${convert(-n)}`;

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const rest = n % 1_000;

  const parts: string[] = [];

  if (billions > 0) {
    parts.push(`${billions === 1 ? "un" : belowThousand(billions)} milliard${billions > 1 ? "s" : ""}`);
  }
  if (millions > 0) {
    parts.push(`${millions === 1 ? "un" : belowThousand(millions)} million${millions > 1 ? "s" : ""}`);
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? "mille" : `${belowThousand(thousands)} mille`);
  }
  if (rest > 0) {
    parts.push(belowThousand(rest));
  }

  return parts.join(" ");
}

export function numberToWords(amount: number, currencyCode?: string | null): string {
  const cur = getCurrency(currencyCode);
  const intPart = Math.floor(amount);
  const decPart = cur.decimals > 0
    ? Math.round((amount - intPart) * Math.pow(10, cur.decimals))
    : 0;

  const intWords = convert(intPart).toUpperCase();
  const unit = intPart > 1 ? cur.unitPlural : cur.unitSingular;

  if (decPart === 0) {
    return `${intWords} ${unit} TTC`;
  }
  const decWords = convert(decPart).toUpperCase();
  return `${intWords} VIRGULE ${decWords} ${unit} TTC`;
}

/** @deprecated use numberToWords(amount, code) instead */
export function numberToWordsMRU(amount: number): string {
  return numberToWords(amount, "MRU");
}
