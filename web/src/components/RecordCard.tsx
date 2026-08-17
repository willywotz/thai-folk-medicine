import { Link } from "react-router-dom";
import { Leaf } from "lucide-react";
import type { ReactNode } from "react";

export function RecordCard({
  href,
  title,
  subtitle,
  tag,
  imageUrl,
  children,
}: {
  href: string;
  title: string;
  subtitle?: string;
  tag?: string;
  imageUrl?: string;
  children?: ReactNode;
}) {
  return (
    <Link
      to={href}
      className="block overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg"
    >
      <div className="grid aspect-[16/10] place-items-center bg-brand-tint text-brand">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by our own /api proxy, no next/image optimization needed
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <Leaf className="h-8 w-8 opacity-80" aria-hidden />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-serif text-lg font-semibold text-ink">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm italic text-ink-faint">{subtitle}</p> : null}
        {tag ? (
          <span className="mt-2 inline-block rounded-full bg-brand-tint px-2.5 py-0.5 text-xs text-brand-strong">
            {tag}
          </span>
        ) : null}
        {children ? <div className="mt-2 text-sm text-ink-soft">{children}</div> : null}
      </div>
    </Link>
  );
}
