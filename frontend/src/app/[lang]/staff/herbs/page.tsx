import { HerbAdminList } from "@/components/HerbAdminList";
import { StaffPageHeader } from "@/components/StaffPageHeader";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function StaffHerbsPage() {
  const t = await getDictionary();
  return (
    <section>
      <StaffPageHeader eyebrow={t.staff.headers.herbsEyebrow} title={t.staff.headers.herbLibrary} />
      <p className="-mt-4 mb-6 text-sm text-ink-soft">{t.staff.herbsSharedNote}</p>
      <HerbAdminList />
    </section>
  );
}
