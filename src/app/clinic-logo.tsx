// Logo de la organización (ya optimizado por el servidor). No muestra nada si no hay.
export default function ClinicLogo({ clinicId, version, className = "h-12 w-auto max-w-40" }: { clinicId: string; version: Date | number | null | undefined; className?: string }) {
  if (!version) return null;
  const v = version instanceof Date ? version.getTime() : version;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/logo/${clinicId}?v=${v}`} alt="" className={`object-contain ${className}`} />;
}
