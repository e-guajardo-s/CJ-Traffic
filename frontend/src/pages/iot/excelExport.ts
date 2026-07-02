import ExcelJS from "exceljs";
import { categoriaCiclo, CATEGORIA_LABEL, ESTADO_GATEWAY_LABEL, type Cruce } from "./types";

function formatFecha(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CL");
}

export async function exportarDirectorioExcel(cruces: Cruce[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Directorio IoT");

  ws.columns = [
    { header: "ID Cruce", key: "codigo", width: 12 },
    { header: "Ubicación", key: "ubicacion", width: 32 },
    { header: "Controlador", key: "controlador", width: 16 },
    { header: "Modelo Gateway", key: "modelo", width: 20 },
    { header: "Fecha Instalación", key: "fechaInstalacion", width: 18 },
    { header: "Fecha Desinstalación", key: "fechaDesinstalacion", width: 20 },
    { header: "En Mantención", key: "enMantencion", width: 14 },
    { header: "Estado Actual", key: "estado", width: 20 },
    { header: "Categoría", key: "categoria", width: 24 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const c of cruces) {
    ws.addRow({
      codigo: c.codigo,
      ubicacion: c.ubicacion,
      controlador: c.controlador,
      modelo: c.gateway?.modelo ?? "",
      fechaInstalacion: formatFecha(c.gateway?.fechaInstalacion ?? null),
      fechaDesinstalacion: formatFecha(c.gateway?.fechaDesinstalacion ?? null),
      enMantencion: c.gateway?.enMantencion ? "Sí" : "No",
      estado: c.gateway ? ESTADO_GATEWAY_LABEL[c.gateway.estado] : "",
      categoria: CATEGORIA_LABEL[categoriaCiclo(c.gateway)],
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `directorio-iot-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
