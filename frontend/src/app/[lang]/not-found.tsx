import Link from "next/link";

export default function NotFound() {
  return (
    <section className="text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-2 text-ink-soft">This record does not exist.</p>
      <Link href="/" className="mt-4 inline-block text-brand underline">
        Back to districts
      </Link>
    </section>
  );
}
