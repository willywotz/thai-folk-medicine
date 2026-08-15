"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { PhotoImage } from "@/components/PhotoImage";
import { btnPrimary, staffField } from "@/components/staff-ui";
import { deletePhoto, fetchPhotos, photoListKey, uploadPhoto } from "@/lib/staff-queries";

export function PhotoManager({ ownerType, ownerId }: { ownerType: string; ownerId: number }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const key = photoListKey(ownerType, ownerId);
  const { data: photos } = useQuery({ queryKey: key, queryFn: () => fetchPhotos(ownerType, ownerId) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("no file");
      return uploadPhoto({ ownerType, ownerId, file, caption });
    },
    onSuccess: () => {
      setCaption("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      invalidate();
    },
  });

  const remove = useMutation({ mutationFn: deletePhoto, onSuccess: invalidate });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Photos</h2>

      {photos && photos.length > 0 ? (
        <ul className="flex flex-wrap gap-4">
          {photos.map((p) => (
            <li key={p.id} className="space-y-1">
              <PhotoImage photoId={p.id} alt={p.caption || "photo"} />
              <button
                type="button"
                onClick={() => remove.mutate(p.id)}
                disabled={remove.isPending}
                className="block text-sm text-destructive underline disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-faint">No photos yet.</p>
      )}
      {remove.isError ? <p className="text-sm text-destructive">Could not delete that photo.</p> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          upload.mutate();
        }}
        className="space-y-2 border-t border-line pt-4"
      >
        <div className="space-y-1">
          <label htmlFor="photoFile" className="text-sm font-medium">
            Photo file
          </label>
          <input
            id="photoFile"
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="photoCaption" className="text-sm font-medium">
            Caption
          </label>
          <input
            id="photoCaption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className={`${staffField} max-w-sm`}
          />
        </div>
        {upload.isError ? <p className="text-sm text-destructive">Could not upload. Try again.</p> : null}
        <button type="submit" disabled={!file || upload.isPending} className={btnPrimary}>
          Upload
        </button>
      </form>
    </div>
  );
}
