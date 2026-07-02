import { useEffect, useState } from "react";
import { apiFetch } from "../../api";
import type { Cruce } from "./types";
import type { CategoriaInventario, ItemInventario } from "./inventarioTypes";
import IotResumen from "./Resumen";
import IotDirectorio from "./Directorio";
import Inventario from "./Inventario";
import CargandoTabla from "../../components/CargandoTabla";

// "proyectos" y "tecnologias" son submódulos de Desarrollo pero se renderizan
// aparte en App.tsx, así que nunca llegan hasta acá.
export default function IotModule({ submodulo }: { submodulo: "resumen" | "directorio" | "inventario" }) {
  if (submodulo === "resumen") return <IotResumen />;
  if (submodulo === "inventario") return <InventarioModule />;
  return <DirectorioModule />;
}

function DirectorioModule() {
  const [cruces, setCruces] = useState<Cruce[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    apiFetch<Cruce[]>("/iot/gateways")
      .then(setCruces)
      .catch((e) => setError(e.message));
  }

  useEffect(cargar, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!cruces) return <CargandoTabla />;

  return <IotDirectorio cruces={cruces} onChange={cargar} />;
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
  if (!items || !categorias) return <CargandoTabla />;

  return <Inventario items={items} categorias={categorias} onChange={cargar} />;
}
