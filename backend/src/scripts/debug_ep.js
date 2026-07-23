// Script de diagnóstico: lee EP_01.xls y muestra qué extrae el parser
const XLSX = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "../../../legacy/archivos_prueba/EP_02.xls");
const wb = XLSX.read(require("fs").readFileSync(filePath), { type: "buffer" });

console.log("=== HOJAS ===");
console.log(wb.SheetNames);

// Carátula
const nombreCaratula = wb.SheetNames.find(n => /car[aá]tula/i.test(n));
const nombreDetalle = wb.SheetNames.find(n => /detalle/i.test(n));

function grillaDesdeColumnaA(sheet) {
  const ref = sheet["!ref"];
  if (!ref) return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  const range = XLSX.utils.decode_range(ref);
  range.s.c = 0;
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, range });
}

if (nombreCaratula) {
  const grid = grillaDesdeColumnaA(wb.Sheets[nombreCaratula]);
  console.log("\n=== CARÁTULA (busca '% EJECUTADO') ===");
  for (let r = 0; r < grid.length; r++) {
    const fila = grid[r] || [];
    for (let c = 0; c < Math.min(fila.length, 10); c++) {
      const val = String(fila[c] ?? "").toUpperCase();
      if (val.includes("EJECUTADO") || val.includes("AVANCE") || val.includes("SUB-TOTAL") || val.includes("TOTAL") || val.includes("ANTICIPO")) {
        console.log(`  Fila ${r}, Col ${c}: "${fila[c]}" => cols[0-6]:`, fila.slice(0, 7));
      }
    }
  }
}

if (nombreDetalle) {
  const grid = grillaDesdeColumnaA(wb.Sheets[nombreDetalle]);
  console.log("\n=== DETALLE EP (primeras 5 filas de datos + header) ===");
  
  // Buscar header
  let headerRow = -1;
  for (let r = 0; r < grid.length; r++) {
    const fila = grid[r] || [];
    for (let c = 0; c < 5; c++) {
      if (String(fila[c] ?? "").toUpperCase().trim() === "ITEM") {
        headerRow = r;
        break;
      }
    }
    if (headerRow >= 0) break;
  }
  
  if (headerRow >= 0) {
    console.log(`  Header en fila ${headerRow}:`, grid[headerRow]?.slice(0, 14));
    for (let r = headerRow + 1; r < Math.min(headerRow + 15, grid.length); r++) {
      const fila = grid[r] || [];
      const desc = String(fila[2] ?? "").trim();
      if (!desc) continue;
      console.log(`  Fila ${r}: item="${fila[1]}" desc="${desc}" un="${fila[3]}" cant=${fila[4]} pu=${fila[5]} total=${fila[6]} | avAcum=${fila[8]} avAnt=${fila[9]} avAct=${fila[10]} $acum=${fila[11]} $ant=${fila[12]} $act=${fila[13]}`);
    }
  }
}

// Ahora ejecutar el parser real y ver resultado
const { parseEstadoPagoXls } = require("../lib/parseEstadoPago");
try {
  const buffer = require("fs").readFileSync(filePath);
  const parsed = parseEstadoPagoXls(buffer);
  console.log("\n=== RESULTADO DEL PARSER ===");
  console.log("Subcontrato:", JSON.stringify(parsed.subcontrato, null, 2));
  console.log("EP:", JSON.stringify(parsed.ep, null, 2));
  console.log("Partidas (primeras 5):");
  parsed.partidas.slice(0, 5).forEach((p, i) => {
    console.log(`  [${i}] cap=${p.esCapitulo} desc="${p.descripcion}" avance=`, p.avance);
  });
  
  // Calcular promedio de avance actual de partidas (no capítulos)
  const partidasConAvance = parsed.partidas.filter(p => !p.esCapitulo && p.avance);
  const promedioActual = partidasConAvance.reduce((s, p) => s + p.avance.avanceActualPct, 0) / partidasConAvance.length;
  const promedioAcum = partidasConAvance.reduce((s, p) => s + p.avance.avanceAcumuladoPct, 0) / partidasConAvance.length;
  console.log(`\nPromedio avance ACTUAL (simple): ${(promedioActual * 100).toFixed(1)}%`);
  console.log(`Promedio avance ACUMULADO (simple): ${(promedioAcum * 100).toFixed(1)}%`);
  console.log(`avanceAcumuladoPct del EP (carátula): ${(parsed.ep.avanceAcumuladoPct * 100).toFixed(1)}%`);
  console.log(`=> avanceReal que se guardaría: ${Math.round(parsed.ep.avanceAcumuladoPct * 100)}%`);
  
} catch (e) {
  console.error("Error del parser:", e.message);
}
