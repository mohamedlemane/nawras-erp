import { CURRENCIES } from "@/lib/currencies";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useGetMyCompany } from "@workspace/api-client-react";

interface Props {
  value: string | null | undefined;
  onChange: (code: string | null) => void;
  label?: string;
}

export function CurrencySelect({ value, onChange, label = "Monnaie" }: Props) {
  const { data: company } = useGetMyCompany();
  const defaultCode = company?.currency ?? "MRU";
  const current = value ?? "__default__";

  return (
    <div>
      <Label>{label}</Label>
      <Select
        value={current}
        onValueChange={(v) => onChange(v === "__default__" ? null : v)}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__default__">Par défaut ({defaultCode})</SelectItem>
          {CURRENCIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
