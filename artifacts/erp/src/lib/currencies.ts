export interface CurrencyDef {
  code: string;
  symbol: string;
  label: string;
  unitSingular: string;
  unitPlural: string;
  locale: string;
  decimals: number;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: "MRU", symbol: "MRU", label: "Ouguiya mauritanienne (MRU)", unitSingular: "OUGUIYA", unitPlural: "OUGUIYAS", locale: "fr-MR", decimals: 2 },
  { code: "USD", symbol: "$",   label: "Dollar américain ($)",        unitSingular: "DOLLAR",   unitPlural: "DOLLARS",   locale: "en-US", decimals: 2 },
  { code: "EUR", symbol: "€",   label: "Euro (€)",                     unitSingular: "EURO",     unitPlural: "EUROS",     locale: "fr-FR", decimals: 2 },
  { code: "GBP", symbol: "£",   label: "Livre sterling (£)",           unitSingular: "LIVRE",    unitPlural: "LIVRES",    locale: "en-GB", decimals: 2 },
  { code: "XOF", symbol: "CFA", label: "Franc CFA (CFA)",              unitSingular: "FRANC CFA", unitPlural: "FRANCS CFA", locale: "fr-FR", decimals: 0 },
  { code: "MAD", symbol: "DH",  label: "Dirham marocain (DH)",         unitSingular: "DIRHAM",   unitPlural: "DIRHAMS",   locale: "fr-MA", decimals: 2 },
  { code: "DZD", symbol: "DA",  label: "Dinar algérien (DA)",          unitSingular: "DINAR",    unitPlural: "DINARS",    locale: "fr-DZ", decimals: 2 },
  { code: "TND", symbol: "DT",  label: "Dinar tunisien (DT)",          unitSingular: "DINAR",    unitPlural: "DINARS",    locale: "fr-TN", decimals: 3 },
  { code: "SAR", symbol: "SAR", label: "Riyal saoudien (SAR)",         unitSingular: "RIYAL",    unitPlural: "RIYALS",    locale: "ar-SA", decimals: 2 },
  { code: "AED", symbol: "AED", label: "Dirham émirati (AED)",         unitSingular: "DIRHAM",   unitPlural: "DIRHAMS",   locale: "ar-AE", decimals: 2 },
];

export const DEFAULT_CURRENCY: CurrencyDef = CURRENCIES[0];

export function getCurrency(code?: string | null): CurrencyDef {
  if (!code) return DEFAULT_CURRENCY;
  return CURRENCIES.find((c) => c.code.toUpperCase() === code.toUpperCase()) ?? DEFAULT_CURRENCY;
}
