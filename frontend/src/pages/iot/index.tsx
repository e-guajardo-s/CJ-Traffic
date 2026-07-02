import { useEffect, useState } from "react";
import { apiFetch } from "../../api";
import type { Cruce } from "./types";
import type { CategoriaInventario, ItemInventario } from "./inventarioTypes";
import IotResumen from "./Resumen";
import IotDirectorio from "./Directorio";
import Inventario from "./Inventario";

// "proyectos" es un submódulo de Desarrollo pero se renderiza aparte en App.tsx
// (ProyectosModule), así que nunca llega hasta acá.
export default function IotModule({ submodulo }: { submodulo: "resumen" | "directorio" | "inventario" }) {
  if (submodulo === "inventario") return <InventarioModule />;
  return <CrucesModule submodulo={submodulo} />;
}

function CrucesModule({ submodulo }: { submodulo: "resumen" | "directorio" }) {
  const [cruces, setCruces] = useState<Cruce[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    apiFetch<Cruce[]>("/iot/gateways")
      .then(setCruces)
      .catch((e) => setError(e.message));
  }

  useEffect(cargar, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!cruces) return <p className="text-sm text-neutral-500">Cargando…</p>;

  if (submodulo === "directorio") return <IotDirectorio cruces={cruces} onChange={cargar} />;
  return <IotResumen cruces={cruces} />;
}

function InventarioModule() {
  const [items, setItems] = useState<ItemInventario[] | null>(null);
  const [categorias, setCategorias] = useState<CategoriaInventario[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    Promise.all([apiFetch<ItemInventario[]>("/iot/inventario/items"), apiFetch<CategoriaInventario[]>("/iot/inventario/categorias")])
      .then(([i, c]) => {
        setItems(i);
        setCategorias(c);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(cargar, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!items || !categorias) return <p className="text-sm text-neutral-500">Cargando…</p>;

  return <Inventario items={items} categorias={categorias} onChange={cargar} />;
}
