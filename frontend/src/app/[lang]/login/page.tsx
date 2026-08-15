import { LoginForm } from "@/components/LoginForm";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function LoginPage() {
  const t = await getDictionary();
  return (
    <section>
      <h1 className="mb-6 text-center text-2xl font-bold">{t.login.title}</h1>
      <LoginForm />
    </section>
  );
}
