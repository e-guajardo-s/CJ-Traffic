import * as XLSX from "xlsx";

// Parser de los Estados de Pago (EP) de subcontratos, en el formato de
// planilla usado por Javiera Orozco (hojas "Carátula EEPP" y "Detalle EP").
// Es tolerante a filas en blanco insertadas/eliminadas (busca por etiqueta,
// no por número de fila fijo), pero asume el layout de columnas del
// formato observado. Si la planilla cambia de formato, lanza un error claro
// en vez de importar datos incorrectos.

export interface ParsedEstadoPago {
  subcontrato: {
    especialidad: string;
    empresa: string;
    numeroOc: string | null;
    montoContrato: number; // "Total Obra" (neto) de la carátula
    montoAnticipo: number | null;
    devAnticipoPct: number;
    retencionPct: number;
    ivaPct: number;
  };
  ep: {
    numeroEp: string;
    fechaEp: Date;
    emisor: string | null;
    subtotal: number;
    devAnticipo: number; // negativo
    retencion: number; // negativo
    montoNeto: number;
    iva: number;
    totalPagar: number;
    avanceAcumuladoPct: number; // 0-1
  };
  partidas: ParsedPartida[];
}

export interface ParsedPartida {
  orden: number;
  esCapitulo: boolean;
  itemNumero: string | null;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  precioUnitario: number | null;
  total: number | null;
  avance: {
    avanceAcumuladoPct: number;
    avanceAnteriorPct: number;
    avanceActualPct: number;
    montoAcumulado: number;
    montoAnterior: number;
    montoActual: number;
  } | null;
}

type Grid = any[][];

function normalizar(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .trim()
    .toUpperCase();
}

function esVacio(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

function aNumero(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function excelSerialADate(serial: number): Date {
  // Excel (sistema 1900): día 0 = 1899-12-30 (UTC), en milisegundos.
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000);
}

// Busca la primera celda de la grilla cuyo texto (normalizado) coincida con
// el patrón, dentro del rango de columnas indicado. Devuelve [fila, col].
function buscarCelda(grid: Grid, patron: RegExp, colDesde = 0, colHasta = 13): [number, number] | null {
  for (let r = 0; r < grid.length; r++) {
    const fila = grid[r] ?? [];
    for (let c = colDesde; c <= colHasta; c++) {
      if (patron.test(normalizar(fila[c]))) return [r, c];
    }
  }
  return null;
}

// A partir de una celda-etiqueta, devuelve el primer valor no vacío a su
// derecha en la misma fila (tolera celdas combinadas de distinto ancho).
function valorALaDerecha(grid: Grid, fila: number, colEtiqueta: number): unknown {
  const row = grid[fila] ?? [];
  for (let c = colEtiqueta + 1; c < row.length; c++) {
    if (!esVacio(row[c])) return row[c];
  }
  return null;
}

function requerido<T>(v: T | null | undefined, mensaje: string): T {
  if (v === null || v === undefined) throw new Error(mensaje);
  return v;
}

function parseCaratula(grid: Grid) {
  const posNumeroEp = buscarCelda(grid, /ESTADO DE PAGO/, 0, 4);
  const textoNumeroEp = posNumeroEp ? String(grid[posNumeroEp[0]][posNumeroEp[1]] ?? "") : "";
  const matchNumero = textoNumeroEp.match(/N[°º]?\s*(\d+)/i);
  const numeroEp = matchNumero ? `EP-${matchNumero[1].padStart(2, "0")}` : requerido(null, "No se encontró el N° de Estado de Pago en la carátula");

  const posEmpresa = buscarCelda(grid, /^EMPRESA$/, 0, 3);
  const empresa = posEmpresa
    ? String(valorALaDerecha(grid, posEmpresa[0], posEmpresa[1]) ?? "")
    : requerido(null, "No se encontró la fila 'EMPRESA' en la carátula");

  const posEspecialidad = buscarCelda(grid, /ESPECIALIDAD/, 0, 3);
  const especialidad = posEspecialidad ? String(valorALaDerecha(grid, posEspecialidad[0], posEspecialidad[1]) ?? "") : "Sin especialidad";

  const posOc = buscarCelda(grid, /N[°º]?\s*OC/, 0, 3);
  const numeroOcRaw = posOc ? valorALaDerecha(grid, posOc[0], posOc[1]) : null;
  const numeroOc = numeroOcRaw != null ? String(numeroOcRaw).replace(/\.0$/, "") : null;

  const posTotalObra = buscarCelda(grid, /TOTAL OBRA/, 4, 10);
  const montoContrato = posTotalObra
    ? aNumero(valorALaDerecha(grid, posTotalObra[0], posTotalObra[1]))
    : requerido(null, "No se encontró 'Total Obra' en la carátula");

  const posIvaPct = buscarCelda(grid, /IVA\s*\d+\s*%/, 4, 10);
  let ivaPct = 0.19;
  if (posIvaPct) {
    const m = String(grid[posIvaPct[0]][posIvaPct[1]] ?? "").match(/(\d+)\s*%/);
    if (m) ivaPct = Number(m[1]) / 100;
  }

  const posAnticipo = buscarCelda(grid, /^ANTICIPO$/, 4, 8);
  const montoAnticipo = posAnticipo ? aNumero(valorALaDerecha(grid, posAnticipo[0], posAnticipo[1])) : null;

  const posEmisor = buscarCelda(grid, /EMISOR/, 4, 10);
  const emisor = posEmisor ? String(valorALaDerecha(grid, posEmisor[0], posEmisor[1]) ?? "") || null : null;

  const posFecha = buscarCelda(grid, /FECHA EMISION/, 4, 10);
  const serialFecha = posFecha ? aNumero(valorALaDerecha(grid, posFecha[0], posFecha[1])) : null;
  const fechaEp = serialFecha ? excelSerialADate(serialFecha) : requerido(null, "No se encontró 'Fecha Emisión' en la carátula");

  // Bloque "Sub-Total 1" (desglose financiero del EP actual): usar columna 3
  // para el monto y columna 2 para el % cuando corresponde (Dev. Anticipo /
  // Dev. Retención), buscando por etiqueta para tolerar filas desplazadas.
  const posSubtotal = buscarCelda(grid, /SUB-TOTAL 1/, 0, 2);
  const subtotal = posSubtotal ? aNumero(grid[posSubtotal[0]][3]) : requerido(null, "No se encontró 'Sub-Total 1' en la carátula");

  const posDevAnticipo = buscarCelda(grid, /DEV\.?\s*ANTICIPO/, 0, 2);
  const devAnticipoPct = posDevAnticipo ? aNumero(grid[posDevAnticipo[0]][2]) : 0;
  const devAnticipo = posDevAnticipo ? -Math.abs(aNumero(grid[posDevAnticipo[0]][3])) : 0;

  const posRetencion = buscarCelda(grid, /DEV\.?\s*RETENCI/, 0, 2);
  const retencionPct = posRetencion ? aNumero(grid[posRetencion[0]][2]) : 0;
  const retencion = posRetencion ? -Math.abs(aNumero(grid[posRetencion[0]][3])) : 0;

  const posNeto = buscarCelda(grid, /TOTAL A PAGAR NETO/, 0, 2);
  const montoNeto = posNeto ? aNumero(grid[posNeto[0]][3]) : requerido(null, "No se encontró 'Total a Pagar Neto' en la carátula");

  const posIvaMonto = buscarCelda(grid, /IVA\s*\(UF\)/, 0, 2);
  const iva = posIvaMonto ? aNumero(grid[posIvaMonto[0]][3]) : montoNeto * ivaPct;

  const posTotalPagar = buscarCelda(grid, /TOTAL A PAGAR\s*\(UF\)/, 0, 2);
  const totalPagar = posTotalPagar ? aNumero(grid[posTotalPagar[0]][3]) : montoNeto + iva;

  const posPct = buscarCelda(grid, /% EJECUTADO/, 0, 2);
  const avanceAcumuladoPct = posPct ? aNumero(grid[posPct[0]][3]) : 0;

  return {
    subcontrato: {
      especialidad,
      empresa,
      numeroOc,
      montoContrato,
      montoAnticipo,
      devAnticipoPct,
      retencionPct,
      ivaPct,
    },
    ep: {
      numeroEp,
      fechaEp,
      emisor,
      subtotal,
      devAnticipo,
      retencion,
      montoNeto,
      iva,
      totalPagar,
      avanceAcumuladoPct,
    },
  };
}

function parseDetalle(grid: Grid): ParsedPartida[] {
  const posHeader = buscarCelda(grid, /^ITEM$/, 0, 2);
  if (!posHeader) throw new Error("No se encontró la fila de encabezado (Item/Descripción) en 'Detalle EP'");
  const filaInicio = posHeader[0] + 1;

  const partidas: ParsedPartida[] = [];
  let orden = 0;

  for (let r = filaInicio; r < grid.length; r++) {
    const fila = grid[r] ?? [];
    const todasVacias = fila.slice(1, 14).every((v) => esVacio(v));
    if (todasVacias) break; // fin de partidas (footer más abajo)

    const descripcion = String(fila[2] ?? "").trim();
    if (!descripcion) continue;

    const unidad = esVacio(fila[3]) ? null : String(fila[3]).trim();
    const esCapitulo = unidad === null;

    partidas.push({
      orden: orden++,
      esCapitulo,
      itemNumero: esVacio(fila[1]) ? null : String(fila[1]).replace(/\.0$/, ""),
      descripcion,
      unidad,
      cantidad: esVacio(fila[4]) ? null : aNumero(fila[4]),
      precioUnitario: esVacio(fila[5]) ? null : aNumero(fila[5]),
      total: esVacio(fila[6]) ? null : aNumero(fila[6]),
      avance: esCapitulo
        ? null
        : {
            avanceAcumuladoPct: aNumero(fila[8]),
            avanceAnteriorPct: aNumero(fila[9]),
            avanceActualPct: aNumero(fila[10]),
            montoAcumulado: aNumero(fila[11]),
            montoAnterior: aNumero(fila[12]),
            montoActual: aNumero(fila[13]),
          },
    });
  }

  if (partidas.length === 0) throw new Error("No se encontraron partidas en la hoja 'Detalle EP'");
  return partidas;
}

// sheet_to_json indexa las columnas del array desde el primer límite del
// rango usado (!ref) de la hoja, no desde la columna A del spreadsheet. Si la
// hoja no tiene datos en la columna A (como "Detalle EP", que parte en B),
// eso desalinea todos los índices de columna que asumimos fijos. Forzamos el
// rango a partir de la columna A para que los índices sean siempre absolutos.
function grillaDesdeColumnaA(sheet: XLSX.WorkSheet): Grid {
  const ref = sheet["!ref"];
  if (!ref) return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  const range = XLSX.utils.decode_range(ref);
  range.s.c = 0;
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, range });
}

export function parseEstadoPagoXls(buffer: Buffer): ParsedEstadoPago {
  const wb = XLSX.read(buffer, { type: "buffer" });

  const nombreCaratula = wb.SheetNames.find((n) => /car[aá]tula/i.test(n));
  const nombreDetalle = wb.SheetNames.find((n) => /detalle/i.test(n));
  if (!nombreCaratula) throw new Error("El archivo no tiene una hoja 'Carátula EEPP'");
  if (!nombreDetalle) throw new Error("El archivo no tiene una hoja 'Detalle EP'");

  const gridCaratula: Grid = grillaDesdeColumnaA(wb.Sheets[nombreCaratula]);
  const gridDetalle: Grid = grillaDesdeColumnaA(wb.Sheets[nombreDetalle]);

  const { subcontrato, ep } = parseCaratula(gridCaratula);
  const partidas = parseDetalle(gridDetalle);

  return { subcontrato, ep, partidas };
}
