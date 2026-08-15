import { HerbAdminList } from "@/components/HerbAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function StaffHerbsPage() {
  const t = await getDictionary();
  return (
    <section>
      <StaffPageHeader eyebrow={t.staff.headers.herbsEyebrow} title={t.staff.headers.herbLibrary} />
      <p className="-mt-4 mb-6 text-sm text-ink-soft">
        Herbs are shared across all remedies. Editing one updates every remedy that uses it.
      </p>
      <HerbAdminList />
    </section>
  );
}
