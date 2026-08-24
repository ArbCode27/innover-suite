"use client";

import { AppSelect } from "@/components/ui/app-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  currencyOptionLabel,
  type OrganizationCurrencySettings,
} from "@/lib/organizations/currencies";

type PriceCurrencyFieldProps = {
  id: string;
  label: string;
  amount: string;
  currency: string;
  currencies: OrganizationCurrencySettings;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  placeholder?: string;
};

export const PriceCurrencyField = ({
  id,
  label,
  amount,
  currency,
  currencies,
  onAmountChange,
  onCurrencyChange,
  placeholder,
}: PriceCurrencyFieldProps) => {
  const showSelector = currencies.codes.length > 1;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{showSelector ? label : `${label} (${currency})`}</Label>
      {showSelector ? (
        <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-2">
          <Input
            id={id}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder={placeholder}
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
          />
          <AppSelect
            aria-label="Moneda"
            value={currency}
            onValueChange={onCurrencyChange}
            options={currencies.codes.map((code) => ({
              value: code,
              label: currencyOptionLabel(code),
            }))}
          />
        </div>
      ) : (
        <Input
          id={id}
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          placeholder={placeholder}
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
        />
      )}
    </div>
  );
};
