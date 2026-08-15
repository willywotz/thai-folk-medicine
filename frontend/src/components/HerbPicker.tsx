"use client";

import { Combobox } from "@base-ui/react/combobox";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useT } from "@/lib/i18n/useT";
import { fetchAllHerbs } from "@/lib/staff-queries";

type HerbLink = { herbId: number; amount: string };
type HerbOption = { value: number; label: string };

export function HerbPicker({ value, onChange }: { value: HerbLink[]; onChange: (v: HerbLink[]) => void }) {
  const t = useT();
  const { data } = useQuery({ queryKey: ["herbs", "all"], queryFn: fetchAllHerbs });

  // Base UI Combobox filters and labels {value,label} items automatically.
  const options = useMemo<HerbOption[]>(
    () => (data ?? []).map((h) => ({ value: h.id, label: h.nameThai })),
    [data],
  );

  const setRow = (i: number, patch: Partial<HerbLink>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const addRow = () => {
    if (options.length === 0) return;
    onChange([...value, { herbId: options[0].value, amount: "" }]);
  };
  const removeRow = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t.staff.form.herbs}</p>
      {value.map((row, i) => (
        <div key={i} className="flex gap-2">
          <Combobox.Root
            items={options}
            value={options.find((o) => o.value === row.herbId) ?? null}
            onValueChange={(next) => next && setRow(i, { herbId: next.value })}
          >
            <Combobox.Input
              aria-label="herb"
              placeholder={t.staff.form.searchHerb}
              className="w-48 rounded border border-stone-300 p-2"
            />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4} className="z-50">
                <Combobox.Popup className="max-h-60 w-[var(--anchor-width)] overflow-y-auto rounded border border-stone-300 bg-white shadow-md">
                  <Combobox.Empty className="p-2 text-sm text-stone-500">
                    {t.staff.form.noHerbsFound}
                  </Combobox.Empty>
                  <Combobox.List>
                    {(item: HerbOption) => (
                      <Combobox.Item
                        key={item.value}
                        value={item}
                        className="cursor-pointer p-2 text-sm data-[highlighted]:bg-stone-100"
                      >
                        {item.label}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <input
            aria-label="amount"
            className="flex-1 rounded border border-stone-300 p-2"
            placeholder={t.staff.form.amount}
            value={row.amount}
            onChange={(e) => setRow(i, { amount: e.target.value })}
          />
          <button type="button" onClick={() => removeRow(i)} className="text-sm text-red-600 underline">
            remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        disabled={options.length === 0}
        className="rounded border border-stone-300 px-3 py-1 text-sm disabled:opacity-50"
      >
        + add herb
      </button>
    </div>
  );
}
