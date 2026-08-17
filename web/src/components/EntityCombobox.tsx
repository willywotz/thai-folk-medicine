"use client";

import { Combobox } from "@base-ui/react/combobox";

import { staffField } from "@/components/staff-ui";

type Option = { value: number; label: string };

/** EntityCombobox is a searchable single-select over {value,label} entity options. */
export function EntityCombobox({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  options: Option[];
  value: number;
  onChange: (value: number) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <Combobox.Root
      items={options}
      value={options.find((o) => o.value === value) ?? null}
      onValueChange={(next) => next && onChange(next.value)}
    >
      <Combobox.Input aria-label={ariaLabel} placeholder={placeholder} className={staffField} />
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50">
          <Combobox.Popup className="max-h-60 w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-line bg-surface shadow-md">
            <Combobox.Empty className="p-2 text-sm text-ink-faint">No matches found.</Combobox.Empty>
            <Combobox.List>
              {(item: Option) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className="cursor-pointer p-2 text-sm data-[highlighted]:bg-surface-2"
                >
                  {item.label}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
