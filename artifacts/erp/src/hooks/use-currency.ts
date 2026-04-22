import { useGetMyCompany } from "@workspace/api-client-react";
import { getCurrency, DEFAULT_CURRENCY, type CurrencyDef } from "@/lib/currencies";
import { numberToWords } from "@/lib/number-to-words";

export function useCurrency() {
  const { data: company } = useGetMyCompany();
  const currency: CurrencyDef = company?.currency ? getCurrency(company.currency) : DEFAULT_CURRENCY;

  const formatCurrency = (val: number | string | null | undefined) => {
    const n = typeof val === "string" ? Number(val) : (val ?? 0);
    if (!Number.isFinite(n)) return `0 ${currency.symbol}`;
    try {
      return new Intl.NumberFormat(currency.locale, {
        style: "currency",
        currency: currency.code,
        minimumFractionDigits: currency.decimals,
        maximumFractionDigits: currency.decimals,
      }).format(n);
    } catch {
      return `${n.toLocaleString("fr-FR", { minimumFractionDigits: currency.decimals, maximumFractionDigits: currency.decimals })} ${currency.symbol}`;
    }
  };

  const amountInWords = (val: number) => numberToWords(val, currency.code);

  return { currency, formatCurrency, amountInWords };
}
