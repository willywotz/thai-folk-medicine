"use client";

import { useQuery } from "@tanstack/react-query";

import { photoUrl } from "@/lib/api";
import { fetchPhotos, photoListKey } from "@/lib/staff-queries";

/**
 * RowAvatar shows an owner's first photo as a small thumbnail, or an initial-
 * letter placeholder when it has none.
 * withinlazy: one photo request per row (N+1); fine for a paginated admin list.
 */
export function RowAvatar({
  ownerType,
  ownerId,
  fallback,
}: {
  ownerType: string;
  ownerId: number;
  fallback: string;
}) {
  const { data } = useQuery({
    queryKey: photoListKey(ownerType, ownerId),
    queryFn: () => fetchPhotos(ownerType, ownerId),
  });
  const photo = data?.[0];

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served through our /api proxy
      <img src={photoUrl(photo.id)} alt="" className="size-9 flex-none rounded-lg object-cover" />
    );
  }
  return (
    <span
      className="grid size-9 flex-none place-items-center rounded-lg bg-brand-tint font-serif text-base font-semibold text-brand-strong"
      aria-hidden
    >
      {fallback}
    </span>
  );
}
