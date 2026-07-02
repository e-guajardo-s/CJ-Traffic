import { useEffect, useState } from "react";
import { apiFetch } from "../../api";
import type { SubVistaFirmware } from "../../types";
import type { Programacion } from "./types";
import FirmwareResumen from "./Resumen";
import FirmwareHistorial from "./Historial";

export default function FirmwareModule({ submodulo }: { submodulo: SubVistaFirmware }) {
  const [programaciones, setProgramaciones] = useState<Programacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Programacion[]>("/firmware/programaciones")
      .then(setProgramaciones)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!programaciones) return <p className="text-sm text-neutral-500">Cargando…</p>;

  if (submodulo === "historial") return <FirmwareHistorial programaciones={programaciones} />;
  return <FirmwareResumen programaciones={programaciones} />;
}
