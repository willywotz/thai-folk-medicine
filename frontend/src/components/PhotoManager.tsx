"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { PhotoImage } from "@/components/PhotoImage";
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
                className="block text-sm text-red-600 underline disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-500">No photos yet.</p>
      )}
      {remove.isError ? <p className="text-sm text-red-600">Could not delete that photo.</p> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          upload.mutate();
        }}
        className="space-y-2 border-t border-stone-200 pt-4"
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
            className="w-full max-w-sm rounded border border-stone-300 p-2"
          />
        </div>
        {upload.isError ? <p className="text-sm text-red-600">Could not upload. Try again.</p> : null}
        <button
          type="submit"
          disabled={!file || upload.isPending}
          className="rounded bg-stone-800 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Upload
        </button>
      </form>
    </div>
  );
}
