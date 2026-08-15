import { HerbForm } from "@/components/HerbForm";
import { StaffPageHeader } from "@/components/StaffPageHeader";

export default function NewHerbPage() {
  return (
    <section>
      <StaffPageHeader
        crumbs={[{ label: "Herbs", href: "/staff/herbs" }, { label: "New herb" }]}
        eyebrow="สมุนไพร · new record"
        title="Add a herb"
      />
      <HerbForm />
    </section>
  );
}
