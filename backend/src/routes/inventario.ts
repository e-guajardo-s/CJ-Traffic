import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireModulo } from "../auth";
import { registrarBitacora } from "../bitacora";

export const inventarioRouter = Router();

// ───────────────────────── Categorías (editables por el usuario) ─────────────────────────

inventarioRouter.get("/categorias", requireAuth, requireModulo("iot", "LECTURA"), async (_req, res) => {
  const categorias = await prisma.categoriaInventario.findMany({ orderBy: { nombre: "asc" } });
  res.json(categorias);
});

inventarioRouter.post("/categorias", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const { nombre } = req.body ?? {};
  if (!nombre) return res.status(400).json({ error: "nombre es requerido" });

  const existente = await prisma.categoriaInventario.findUnique({ where: { nombre } });
  if (existente) return res.status(409).json({ error: "Ya existe una categoría con ese nombre" });

  const categoria = await prisma.categoriaInventario.create({ data: { nombre } });
  res.status(201).json(categoria);
});

inventarioRouter.patch("/categorias/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const { nombre } = req.body ?? {};
  if (!nombre) return res.status(400).json({ error: "nombre es requerido" });

  const categoria = await prisma.categoriaInventario.findUnique({ where: { id } });
  if (!categoria) return res.status(404).json({ error: "Categoría no encontrada" });

  const actualizada = await prisma.categoriaInventario.update({ where: { id }, data: { nombre } });
  res.json(actualizada);
});

inventarioRouter.delete("/categorias/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);

  const categoria = await prisma.categoriaInventario.findUnique({ where: { id }, include: { items: { select: { id: true } } } });
  if (!categoria) return res.status(404).json({ error: "Categoría no encontrada" });
  if (categoria.items.length > 0) {
    return res.status(409).json({ error: "No se puede eliminar: hay items usando esta categoría" });
  }

  await prisma.categoriaInventario.delete({ where: { id } });
  res.status(204).send();
});

// ───────────────────────── Items (modelo/tipo de equipo) ─────────────────────────

inventarioRouter.get("/items", requireAuth, requireModulo("iot", "LECTURA"), async (_req, res) => {
  const items = await prisma.itemInventario.findMany({
    include: { categoria: true, unidades: { include: { cruce: true } } },
    orderBy: { nombre: "asc" },
  });
  res.json(items);
});

inventarioRouter.post("/items", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const { nombre, sku, categoriaId, precio, umbralMinimo } = req.body ?? {};
  if (!nombre || !categoriaId) return res.status(400).json({ error: "nombre y categoriaId son requeridos" });

  const item = await prisma.itemInventario.create({
    data: {
      nombre,
      sku: sku || null,
      categoriaId: Number(categoriaId),
      precio: precio === null || precio === undefined || precio === "" ? null : Number(precio),
      umbralMinimo: Number(umbralMinimo) || 0,
    },
    include: { categoria: true, unidades: true },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "inventario.item.crear",
    entidad: "ItemInventario",
    entidadId: item.id,
    detalle: { item },
  });

  res.status(201).json(item);
});

inventarioRouter.patch("/items/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, sku, categoriaId, precio, umbralMinimo } = req.body ?? {};

  const anterior = await prisma.itemInventario.findUnique({ where: { id } });
  if (!anterior) return res.status(404).json({ error: "Item no encontrado" });

  const actualizado = await prisma.itemInventario.update({
    where: { id },
    data: {
      ...(nombre !== undefined ? { nombre } : {}),
      ...(sku !== undefined ? { sku: sku || null } : {}),
      ...(categoriaId !== undefined ? { categoriaId: Number(categoriaId) } : {}),
      ...(precio !== undefined ? { precio: precio === null || precio === "" ? null : Number(precio) } : {}),
      ...(umbralMinimo !== undefined ? { umbralMinimo: Number(umbralMinimo) || 0 } : {}),
    },
    include: { categoria: true, unidades: { include: { cruce: true } } },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "inventario.item.actualizar",
    entidad: "ItemInventario",
    entidadId: id,
    detalle: { anterior, nuevo: actualizado },
  });

  res.json(actualizado);
});

inventarioRouter.delete("/items/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);

  const item = await prisma.itemInventario.findUnique({ where: { id }, include: { unidades: true } });
  if (!item) return res.status(404).json({ error: "Item no encontrado" });

  // Se elimina el item junto con todas sus unidades (incluidas las asignadas a un
  // cruce). No hay bloqueo por unidades: la confirmación doble vive en el frontend.
  await prisma.$transaction([
    prisma.unidadInventario.deleteMany({ where: { itemId: id } }),
    prisma.itemInventario.delete({ where: { id } }),
  ]);

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "inventario.item.eliminar",
    entidad: "ItemInventario",
    entidadId: id,
    detalle: { item },
  });

  res.status(204).send();
});

// ───────────────────────── Unidades individuales ─────────────────────────

// Alta de unidades: las unidades se numeran solas (1, 2, 3…) continuando desde
// el mayor número existente del item. Se pueden crear varias de una vez con
// `cantidad`. Ya no se ingresa el código a mano.
inventarioRouter.post("/items/:itemId/unidades", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const itemId = Number(req.params.itemId);
  const cantidad = Math.trunc(Number(req.body?.cantidad ?? 1));
  if (!Number.isFinite(cantidad) || cantidad < 1) return res.status(400).json({ error: "cantidad debe ser un entero ≥ 1" });
  if (cantidad > 500) return res.status(400).json({ error: "cantidad máxima por operación: 500" });

  const item = await prisma.itemInventario.findUnique({ where: { id: itemId } });
  if (!item) return res.status(404).json({ error: "Item no encontrado" });

  // Próximo número = mayor código numérico existente + 1 (los no numéricos se ignoran).
  const existentes = await prisma.unidadInventario.findMany({ where: { itemId }, select: { codigoUnidad: true } });
  const maxNum = existentes.reduce((m, u) => {
    const n = parseInt(u.codigoUnidad, 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, 0);

  const data = Array.from({ length: cantidad }, (_, i) => ({ itemId, codigoUnidad: String(maxNum + 1 + i) }));
  await prisma.unidadInventario.createMany({ data });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "inventario.unidad.crear",
    entidad: "ItemInventario",
    entidadId: itemId,
    detalle: { cantidad, desde: maxNum + 1, hasta: maxNum + cantidad },
  });

  res.status(201).json({ creadas: cantidad, desde: maxNum + 1, hasta: maxNum + cantidad });
});

inventarioRouter.delete("/unidades/:id", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);

  const unidad = await prisma.unidadInventario.findUnique({ where: { id } });
  if (!unidad) return res.status(404).json({ error: "Unidad no encontrada" });
  if (unidad.cruceId) {
    return res.status(409).json({ error: "No se puede eliminar: la unidad está asignada a un cruce. Retírala primero." });
  }

  await prisma.unidadInventario.delete({ where: { id } });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "inventario.unidad.eliminar",
    entidad: "UnidadInventario",
    entidadId: id,
    detalle: { unidad },
  });

  res.status(204).send();
});

// Asignación masiva de varias unidades a la vez, a un cruce o a una ubicación
// física (mutuamente excluyentes). Como un cruce admite varias unidades, no se
// libera ninguna existente. Las unidades dadas de baja se ignoran.
inventarioRouter.patch("/unidades/asignacion-masiva", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const { ids, cruceId, ubicacionFisica } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids es requerido" });
  const idsNum = ids.map(Number).filter((n) => Number.isInteger(n));

  let data: { cruceId: number; ubicacionFisica: null } | { cruceId: null; ubicacionFisica: string };
  let detalleExtra: Record<string, unknown>;

  if (cruceId !== null && cruceId !== undefined) {
    const cruce = await prisma.cruce.findUnique({ where: { id: Number(cruceId) } });
    if (!cruce) return res.status(404).json({ error: "Cruce no encontrado" });
    data = { cruceId: Number(cruceId), ubicacionFisica: null };
    detalleExtra = { cruceId: Number(cruceId) };
  } else if (typeof ubicacionFisica === "string" && ubicacionFisica.trim() !== "") {
    data = { cruceId: null, ubicacionFisica: ubicacionFisica.trim() };
    detalleExtra = { ubicacionFisica: ubicacionFisica.trim() };
  } else {
    return res.status(400).json({ error: "Debes indicar cruceId o ubicacionFisica" });
  }

  const result = await prisma.unidadInventario.updateMany({
    where: { id: { in: idsNum }, dadaDeBaja: false },
    data,
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: cruceId ? "inventario.unidad.asignar_masivo" : "inventario.unidad.ubicar_masivo",
    entidad: "UnidadInventario",
    entidadId: idsNum[0] ?? 0,
    detalle: { ids: idsNum, ...detalleExtra, actualizadas: result.count },
  });

  res.json({ actualizadas: result.count });
});

// Eliminación masiva de unidades (la confirmación doble vive en el frontend). No
// hay bloqueo por cruce: al borrar la unidad, el cruce queda libre.
inventarioRouter.post("/unidades/eliminar-masivo", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const { ids } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids es requerido" });
  const idsNum = ids.map(Number).filter((n) => Number.isInteger(n));

  const unidades = await prisma.unidadInventario.findMany({ where: { id: { in: idsNum } } });
  const result = await prisma.unidadInventario.deleteMany({ where: { id: { in: idsNum } } });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "inventario.unidad.eliminar_masivo",
    entidad: "UnidadInventario",
    entidadId: idsNum[0] ?? 0,
    detalle: { ids: idsNum, unidades, eliminadas: result.count },
  });

  res.json({ eliminadas: result.count });
});

// Dar de baja (con nota justificatoria) o reactivar una unidad. Al darla de baja
// se libera cualquier cruce/ubicación física asociada.
inventarioRouter.patch("/unidades/:id/baja", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const { dadaDeBaja, nota } = req.body ?? {};

  const unidad = await prisma.unidadInventario.findUnique({ where: { id } });
  if (!unidad) return res.status(404).json({ error: "Unidad no encontrada" });

  const baja = dadaDeBaja === undefined ? true : Boolean(dadaDeBaja);
  if (baja && (!nota || String(nota).trim() === "")) {
    return res.status(400).json({ error: "La nota justificatoria es requerida para dar de baja" });
  }

  const actualizada = await prisma.unidadInventario.update({
    where: { id },
    data: baja
      ? { dadaDeBaja: true, notaBaja: String(nota).trim(), cruceId: null, ubicacionFisica: null }
      : { dadaDeBaja: false, notaBaja: null },
    include: { cruce: true, item: true },
  });

  await registrarBitacora({
    autorId: req.user!.sub,
    accion: baja ? "inventario.unidad.baja" : "inventario.unidad.reactivar",
    entidad: "UnidadInventario",
    entidadId: id,
    detalle: { unidad: actualizada, nota: baja ? String(nota).trim() : undefined },
  });

  res.json(actualizada);
});

// Asignar una unidad a un cruce, a una ubicación física (bodega/estante), o
// dejarla disponible sin ubicación. cruceId y ubicacionFisica son mutuamente
// excluyentes. Es la misma operación que se dispara desde el Inventario o desde
// el Directorio de Gateways — ambos lados comparten este único endpoint.
inventarioRouter.patch("/unidades/:id/asignacion", requireAuth, requireModulo("iot", "ESCRITURA"), async (req, res) => {
  const id = Number(req.params.id);
  const { cruceId, ubicacionFisica } = req.body ?? {};

  const unidad = await prisma.unidadInventario.findUnique({ where: { id } });
  if (!unidad) return res.status(404).json({ error: "Unidad no encontrada" });

  // Ubicación física (bodega/estante): libera cualquier cruce asignado.
  if (typeof ubicacionFisica === "string" && ubicacionFisica.trim() !== "") {
    const actualizada = await prisma.unidadInventario.update({
      where: { id },
      data: { cruceId: null, ubicacionFisica: ubicacionFisica.trim() },
      include: { cruce: true, item: true },
    });
    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "inventario.unidad.ubicar",
      entidad: "UnidadInventario",
      entidadId: id,
      detalle: { unidad: actualizada },
    });
    return res.json(actualizada);
  }

  // Asignación a un cruce: limpia la ubicación física. Un cruce puede tener varias
  // unidades, así que no se libera ninguna existente.
  if (cruceId !== null && cruceId !== undefined) {
    const cruce = await prisma.cruce.findUnique({ where: { id: Number(cruceId) } });
    if (!cruce) return res.status(404).json({ error: "Cruce no encontrado" });

    const actualizada = await prisma.unidadInventario.update({
      where: { id },
      data: { cruceId: Number(cruceId), ubicacionFisica: null },
      include: { cruce: true, item: true },
    });
    await registrarBitacora({
      autorId: req.user!.sub,
      accion: "inventario.unidad.asignar",
      entidad: "UnidadInventario",
      entidadId: id,
      detalle: { unidad: actualizada },
    });
    return res.json(actualizada);
  }

  // Sin cruce ni ubicación física: la unidad vuelve a disponible.
  const actualizada = await prisma.unidadInventario.update({
    where: { id },
    data: { cruceId: null, ubicacionFisica: null },
    include: { cruce: true, item: true },
  });
  await registrarBitacora({
    autorId: req.user!.sub,
    accion: "inventario.unidad.desasignar",
    entidad: "UnidadInventario",
    entidadId: id,
    detalle: { unidad: actualizada },
  });

  res.json(actualizada);
});
