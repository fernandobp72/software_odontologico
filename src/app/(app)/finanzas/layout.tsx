import { requireUser } from "@/lib/dal";
import FinanceTabs from "./tabs";

export default async function FinanzasLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // El odontólogo solo entra a «Mis pagos» y a sus comprobantes; cada página de administración lo redirige.
  if (user.role === "DENTIST") return <div className="space-y-6">{children}</div>;
  return (
    <div className="space-y-6">
      {user.role === "ADMIN" && <FinanceTabs />}
      {children}
    </div>
  );
}
