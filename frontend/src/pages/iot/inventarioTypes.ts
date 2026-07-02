export interface CategoriaInventario {
  id: number;
  nombre: string;
}

export interface UnidadInventario {
  id: number;
  itemId: number;
  codigoUnidad: string;
  cruceId: number | null;
  cruce: { id: number; codigo: string; ubicacion: string } | null;
  ubicacionFisica: string | null;
  dadaDeBaja: boolean;
  notaBaja: string | null;
}

export interface ItemInventario {
  id: number;
  nombre: string;
  sku: string | null;
  categoriaId: number;
  categoria: CategoriaInventario;
  precio: number | null;
  umbralMinimo: number;
  unidades: UnidadInventario[];
}

// Disponibles = en stock utilizable: no están en un cruce ni dadas de baja.
export function disponibles(item: ItemInventario): UnidadInventario[] {
  return item.unidades.filter((u) => !u.cruceId && !u.dadaDeBaja);
}

// Activas = todas las que siguen en circulación (excluye las dadas de baja).
export function activas(item: ItemInventario): UnidadInventario[] {
  return item.unidades.filter((u) => !u.dadaDeBaja);
}
