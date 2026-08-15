"use client";

import { useEffect, useMemo } from "react";

import { staffField, staffLabel } from "@/components/staff-ui";
import { useT } from "@/lib/i18n/useT";

export type PendingPhoto = { file: File; caption: string };

/**
 * PhotoInput collects photos client-side before a record exists (create
 * mode), so they can be uploaded once the record's id is known. It makes no
 * network calls itself.
 */
export function PhotoInput({
  value,
  onChange,
}: {
  value: PendingPhoto[];
  onChange: (value: PendingPhoto[]) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">{t.staff.photos}</h2>
      <div className="space-y-1">
        <label htmlFor="pendingPhotoFile" className={staffLabel}>
          {t.staff.photoFile}
        </label>
        <input
          id="pendingPhotoFile"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange([...value, { file, caption: "" }]);
            e.target.value = "";
          }}
          className="block text-sm text-ink-soft"
        />
      </div>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-4">
          {value.map((pending, index) => (
            <PendingPhotoRow
              key={index}
              pending={pending}
              onCaptionChange={(caption) => {
                const next = value.slice();
                next[index] = { ...pending, caption };
                onChange(next);
              }}
              onRemove={() => onChange(value.filter((_, i) => i !== index))}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-faint">{t.staff.noPhotosAddedYet}</p>
      )}
    </div>
  );
}

function PendingPhotoRow({
  pending,
  onCaptionChange,
  onRemove,
}: {
  pending: PendingPhoto;
  onCaptionChange: (caption: string) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const url = useMemo(() => URL.createObjectURL(pending.file), [pending.file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <li className="w-40 space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, no next/image optimization needed */}
      <img src={url} alt={pending.file.name} className="size-24 rounded-lg border border-line object-cover" />
      <input
        aria-label={t.staff.caption}
        value={pending.caption}
        placeholder={t.staff.caption}
        onChange={(e) => onCaptionChange(e.target.value)}
        className={`${staffField} max-w-sm`}
      />
      <button type="button" onClick={onRemove} className="block text-sm text-destructive underline">
        {t.staff.removePending}
      </button>
    </li>
  );
}
