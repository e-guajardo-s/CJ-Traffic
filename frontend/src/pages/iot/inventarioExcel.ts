import ExcelJS from "exceljs";
import { activas, disponibles, type ItemInventario } from "./inventarioTypes";

const formatCLP = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

export async function exportarInventarioExcel(items: ItemInventario[]) {
  const wb = new ExcelJS.Workbook();

  // ── Hoja 1: resumen por item ──
  const ws = wb.addWorksheet("Inventario");
  ws.columns = [
    { header: "Item", key: "nombre", width: 28 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Categoría", key: "categoria", width: 16 },
    { header: "Precio unitario (CLP)", key: "precio", width: 20 },
    { header: "Unidades activas", key: "activas", width: 16 },
    { header: "Disponibles", key: "disponibles", width: 12 },
    { header: "En terreno", key: "enTerreno", width: 12 },
    { header: "De baja", key: "deBaja", width: 10 },
    { header: "Umbral mínimo", key: "umbral", width: 14 },
    { header: "Valor total (CLP)", key: "valorTotal", width: 18 },
  ];
  ws.getRow(1).font = { bold: true };

  let valorInventario = 0;
  for (const i of items) {
    const nActivas = activas(i).length;
    const nDisp = disponibles(i).length;
    const valorTotal = (i.precio ?? 0) * nActivas;
    valorInventario += valorTotal;
    ws.addRow({
      nombre: i.nombre,
      sku: i.sku ?? "",
      categoria: i.categoria.nombre,
      precio: i.precio ?? "",
      activas: nActivas,
      disponibles: nDisp,
      enTerreno: nActivas - nDisp,
      deBaja: i.unidades.length - nActivas,
      umbral: i.umbralMinimo,
      valorTotal: i.precio != null ? valorTotal : "",
    });
  }
  const totalRow = ws.addRow({ nombre: "TOTAL", valorTotal: valorInventario });
  totalRow.font = { bold: true };

  // ── Hoja 2: detalle por unidad ──
  const wsU = wb.addWorksheet("Unidades");
  wsU.columns = [
    { header: "Item", key: "item", width: 28 },
    { header: "Unidad", key: "codigo", width: 12 },
    { header: "Estado", key: "estado", width: 16 },
    { header: "Cruce / Ubicación", key: "donde", width: 32 },
    { header: "Nota de baja", key: "nota", width: 36 },
  ];
  wsU.getRow(1).font = { bold: true };

  for (const i of items) {
    for (const u of i.unidades) {
      wsU.addRow({
        item: i.nombre,
        codigo: `#${u.codigoUnidad}`,
        estado: u.dadaDeBaja ? "Dada de baja" : u.cruce ? "En terreno" : u.ubicacionFisica ? "En bodega" : "Disponible",
        donde: u.cruce ? `${u.cruce.codigo} — ${u.cruce.ubicacion}` : u.ubicacionFisica ?? "",
        nota: u.notaBaja ?? "",
      });
    }
  }

  console.info(`Inventario exportado: ${items.length} items, valor total ${formatCLP(valorInventario)}`);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inventario-desarrollo-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
