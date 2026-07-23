import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

// Mismo estilo corporativo que ReportePDF.tsx (logo + línea naranja CJ).
const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#f97316",
    paddingBottom: 12,
    marginBottom: 16,
  },
  logo: { width: 110 },
  headerTextContainer: { textAlign: "right" },
  title: { fontSize: 16, fontWeight: "bold", color: "#1f2937" },
  subtitle: { fontSize: 9, color: "#6b7280", marginTop: 3 },
  entry: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#f9fafb",
    borderLeftWidth: 3,
    borderLeftColor: "#f97316",
    borderRadius: 2,
  },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  entryFecha: { fontSize: 11, fontWeight: "bold", color: "#1f2937" },
  entryMeta: { fontSize: 8, color: "#6b7280" },
  entryTexto: { fontSize: 9.5, color: "#374151", lineHeight: 1.4 },
  entryLabel: { fontSize: 8, fontWeight: "bold", color: "#6b7280", marginTop: 3 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 8, color: "#9ca3af", textAlign: "center" },
});

const CLIMA_LABEL: Record<string, string> = { DESPEJADO: "Despejado", NUBLADO: "Nublado", LLUVIA: "Lluvia", VIENTO: "Viento" };

interface ReporteDiarioPDFItem {
  id: number;
  autor: { nombre: string };
  fecha: string;
  personal: number | null;
  clima: string | null;
  horasTrabajadas: string | null;
  trabajoRealizado: string;
  materiales: string | null;
  observaciones: string | null;
  trackLabel: string | null;
}

export function ReporteDiarioPDF({
  obraNombre, obraCodigo, desde, hasta, reportes,
}: {
  obraNombre: string;
  obraCodigo: string;
  desde: string;
  hasta: string;
  reportes: ReporteDiarioPDFItem[];
}) {
  const fechaGeneracion = new Date().toLocaleDateString("es-CL");
  const rango = desde || hasta
    ? `${desde ? new Date(desde).toLocaleDateString("es-CL") : "…"} — ${hasta ? new Date(hasta).toLocaleDateString("es-CL") : "…"}`
    : "Todos los registros";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image style={styles.logo} src="/logo.png" />
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Parte Diario de Obra</Text>
            <Text style={styles.subtitle}>{obraNombre} · {obraCodigo}</Text>
            <Text style={styles.subtitle}>Período: {rango}</Text>
            <Text style={styles.subtitle}>Generado el {fechaGeneracion}</Text>
          </View>
        </View>

        {reportes.map((r) => (
          <View key={r.id} style={styles.entry} wrap={false}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryFecha}>
                {new Date(r.fecha).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}
                {r.trackLabel ? ` — ${r.trackLabel}` : ""}
              </Text>
              <Text style={styles.entryMeta}>
                {r.autor.nombre}
                {r.clima ? ` · ${CLIMA_LABEL[r.clima] ?? r.clima}` : ""}
                {r.personal != null ? ` · ${r.personal} pers.` : ""}
                {r.horasTrabajadas != null ? ` · ${r.horasTrabajadas}h` : ""}
              </Text>
            </View>
            <Text style={styles.entryTexto}>{r.trabajoRealizado}</Text>
            {r.materiales && (
              <>
                <Text style={styles.entryLabel}>Materiales</Text>
                <Text style={styles.entryTexto}>{r.materiales}</Text>
              </>
            )}
            {r.observaciones && (
              <>
                <Text style={styles.entryLabel}>Observaciones</Text>
                <Text style={styles.entryTexto}>{r.observaciones}</Text>
              </>
            )}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          CJ Traffic — Documento generado automáticamente desde la Intranet de Operaciones.
        </Text>
      </Page>
    </Document>
  );
}
