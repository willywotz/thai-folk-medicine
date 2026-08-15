import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="whitespace-nowrap font-serif text-lg font-semibold text-ink">
          ตำรายา<span className="text-brand">พื้นบ้าน</span>
        </Link>
        <Link
          href="/staff"
          prefetch={false}
          className="ml-auto whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-brand hover:text-brand"
        >
          สำหรับเจ้าหน้าที่
        </Link>
      </div>
    </header>
  );
}
