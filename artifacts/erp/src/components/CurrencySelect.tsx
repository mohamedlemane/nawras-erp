import { CURRENCIES, type CurrencyDef } from "@/lib/currencies";
import { Label } from "@/components/ui/label";
import ReactSelect from "react-select";
import { rsClassNames } from "@/lib/rs-styles";
import { useGetMyCompany } from "@workspace/api-client-react";

interface Props {
  value: string | null | undefined;
  onChange: (code: string | null) => void;
  label?: string;
  showDefault?: boolean;
}

interface Opt {
  value: string;
  label: string;
  currency: CurrencyDef | null;
  isDefault?: boolean;
}

const formatOption = (opt: Opt) => (
  <div className="flex items-center gap-2">
    <span className="text-base leading-none">
      {opt.isDefault ? "⭐" : opt.currency?.flag}
    </span>
    <span className="font-medium">
      {opt.isDefault ? "Par défaut" : opt.currency?.code}
    </span>
    <span className="text-muted-foreground text-xs truncate">
      {opt.isDefault
        ? `(${opt.currency?.code})`
        : `${opt.currency?.label} — ${opt.currency?.country}`}
    </span>
  </div>
);

export function CurrencySelect({ value, onChange, label = "Monnaie", showDefault = true }: Props) {
  const { data: company } = useGetMyCompany();
  const defaultCode = (company as any)?.currency ?? "MRU";
  const defaultCur = CURRENCIES.find((c) => c.code === defaultCode) ?? CURRENCIES[0];

  const defaultOpt: Opt = {
    value: "__default__",
    label: `Par défaut (${defaultCode})`,
    currency: defaultCur,
    isDefault: true,
  };

  const currencyOpts: Opt[] = CURRENCIES.map((c) => ({
    value: c.code,
    label: `${c.code} ${c.label} ${c.country}`,
    currency: c,
  }));

  const options: Opt[] = showDefault ? [defaultOpt, ...currencyOpts] : currencyOpts;

  const selected = showDefault
    ? (!value ? defaultOpt : options.find((o) => o.value === value) ?? defaultOpt)
    : (options.find((o) => o.value === value) ?? null);

  return (
    <div>
      <Label>{label}</Label>
      <ReactSelect
        unstyled
        classNames={rsClassNames}
        styles={{ menu: (base) => ({ ...base, zIndex: 9999 }) }}
        menuPosition="fixed"
        options={options}
        value={selected}
        onChange={(opt) =>
          onChange(opt && opt.value !== "__default__" ? opt.value : null)
        }
        formatOptionLabel={formatOption}
        filterOption={(opt, input) => {
          if (!input) return true;
          const q = input.toLowerCase();
          return (opt.data.label ?? "").toLowerCase().includes(q);
        }}
        placeholder="Choisir une monnaie…"
        isSearchable
      />
    </div>
  );
}
