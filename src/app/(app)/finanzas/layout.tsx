import { requireUser } from "@/lib/dal";
import FinanceTabs from "./tabs";

export default async function FinanzasLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role === "DENTIST") return <p className="card">Finanzas es para administración. Pronto verás aquí tus pagos como profesional.</p>;
  return (
    <div className="space-y-6">
      {user.role === "ADMIN" && <FinanceTabs />}
      {children}
    </div>
  );
}
