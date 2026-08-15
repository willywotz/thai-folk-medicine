import { HerbAdminList } from "@/components/HerbAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";

export default function StaffHerbsPage() {
  return (
    <section>
      <StaffPageHeader eyebrow="สมุนไพร · shared library" title="Herb library" />
      <p className="-mt-4 mb-6 text-sm text-ink-soft">
        Herbs are shared across all remedies. Editing one updates every remedy that uses it.
      </p>
      <HerbAdminList />
    </section>
  );
}
