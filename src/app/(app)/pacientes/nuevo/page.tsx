import PatientForm from "./form";

export default function NuevoPaciente() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="page-title">Nuevo paciente</h1>
      <PatientForm />
    </div>
  );
}
