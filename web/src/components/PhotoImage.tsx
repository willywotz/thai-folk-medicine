import { photoUrl } from "@/lib/api";

export function PhotoImage({ photoId, alt }: { photoId: number; alt: string }) {
  // A plain <img> (not next/image) keeps the API host config-free and streams
  // straight through the /api proxy.
  return (
    // eslint-disable-next-line @next/next/no-img-element -- served by our own /api proxy, no next/image optimization needed
    <img
      src={photoUrl(photoId)}
      alt={alt}
      className="max-h-96 w-auto rounded-lg border border-stone-200"
    />
  );
}
