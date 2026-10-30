import PatientForm from "./form";

export default function NuevoPaciente() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nuevo paciente</h1>
      <PatientForm />
    </div>
  );
}
