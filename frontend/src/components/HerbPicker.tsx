"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchHerbs, herbListKey } from "@/lib/staff-queries";

type HerbLink = { herbId: number; amount: string };

export function HerbPicker({ value, onChange }: { value: HerbLink[]; onChange: (v: HerbLink[]) => void }) {
  const { data: herbs } = useQuery({ queryKey: herbListKey, queryFn: fetchHerbs });

  const setRow = (i: number, patch: Partial<HerbLink>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const addRow = () => {
    if (!herbs || herbs.length === 0) return;
    onChange([...value, { herbId: herbs[0].id, amount: "" }]);
  };
  const removeRow = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">ตัวยา (Herbs)</p>
      {value.map((row, i) => (
        <div key={i} className="flex gap-2">
          <select
            aria-label="herb"
            className="rounded border border-stone-300 p-2"
            value={row.herbId}
            onChange={(e) => setRow(i, { herbId: Number(e.target.value) })}
          >
            {(herbs ?? []).map((h) => (
              <option key={h.id} value={h.id}>
                {h.nameThai}
              </option>
            ))}
          </select>
          <input
            aria-label="amount"
            className="flex-1 rounded border border-stone-300 p-2"
            placeholder="ปริมาณ (amount)"
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
        disabled={!herbs || herbs.length === 0}
        className="rounded border border-stone-300 px-3 py-1 text-sm disabled:opacity-50"
      >
        + add herb
      </button>
    </div>
  );
}
