import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { TerminoGlosarioPDF } from "./ReportePDF";

// ── Conversión del HTML de Tiptap a bloques renderizables en react-pdf ──
// StarterKit produce un subconjunto acotado de HTML: p, h1-h6, strong, em,
// code, pre>code, ul/ol>li, blockquote, hr y br. Con eso alcanza.

interface Run {
  texto: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

type Bloque =
  | { tipo: "titulo"; nivel: number; runs: Run[] }
  | { tipo: "parrafo"; runs: Run[] }
  | { tipo: "item"; indice: string; runs: Run[] }
  | { tipo: "codigo"; texto: string }
  | { tipo: "cita"; runs: Run[] }
  | { tipo: "separador" };

function extraerRuns(nodo: Node, herencia: { bold?: boolean; italic?: boolean; code?: boolean } = {}): Run[] {
  const runs: Run[] = [];
  nodo.childNodes.forEach((hijo) => {
    if (hijo.nodeType === Node.TEXT_NODE) {
      if (hijo.textContent) runs.push({ texto: hijo.textContent, ...herencia });
      return;
    }
    if (hijo.nodeType !== Node.ELEMENT_NODE) return;
    const tag = (hijo as Element).tagName.toLowerCase();
    if (tag === "br") {
      runs.push({ texto: "\n", ...herencia });
      return;
    }
    const nueva = { ...herencia };
    if (tag === "strong" || tag === "b") nueva.bold = true;
    if (tag === "em" || tag === "i") nueva.italic = true;
    if (tag === "code") nueva.code = true;
    runs.push(...extraerRuns(hijo, nueva));
  });
  return runs;
}

export function htmlABloques(html: string): Bloque[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const bloques: Bloque[] = [];

  function procesarLista(lista: Element, ordenada: boolean, nivel: number) {
    let n = 1;
    lista.querySelectorAll(":scope > li").forEach((li) => {
      // Runs directos del li (excluye sublistas para procesarlas aparte).
      const clon = li.cloneNode(true) as Element;
      clon.querySelectorAll("ul, ol").forEach((sub) => sub.remove());
      const sangria = "   ".repeat(nivel);
      bloques.push({ tipo: "item", indice: `${sangria}${ordenada ? `${n}.` : "•"}`, runs: extraerRuns(clon) });
      n++;
      li.querySelectorAll(":scope > ul").forEach((sub) => procesarLista(sub, false, nivel + 1));
      li.querySelectorAll(":scope > ol").forEach((sub) => procesarLista(sub, true, nivel + 1));
    });
  }

  doc.body.childNodes.forEach((nodo) => {
    if (nodo.nodeType !== Node.ELEMENT_NODE) return;
    const el = nodo as Element;
    const tag = el.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      bloques.push({ tipo: "titulo", nivel: Number(tag[1]), runs: extraerRuns(el) });
    } else if (tag === "p") {
      const runs = extraerRuns(el);
      if (runs.some((r) => r.texto.trim())) bloques.push({ tipo: "parrafo", runs });
    } else if (tag === "ul") {
      procesarLista(el, false, 0);
    } else if (tag === "ol") {
      procesarLista(el, true, 0);
    } else if (tag === "pre") {
      bloques.push({ tipo: "codigo", texto: el.textContent ?? "" });
    } else if (tag === "blockquote") {
      bloques.push({ tipo: "cita", runs: extraerRuns(el) });
    } else if (tag === "hr") {
      bloques.push({ tipo: "separador" });
    } else if (el.textContent?.trim()) {
      bloques.push({ tipo: "parrafo", runs: extraerRuns(el) });
    }
  });

  return bloques;
}

// ── Documento PDF ──

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", backgroundColor: "#ffffff" },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#f97316",
    paddingBottom: 12,
    marginBottom: 18,
  },
  logo: { width: 110, marginBottom: 10 },
  titulo: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#1f2937" },
  subtitulo: { fontSize: 9, color: "#6b7280", marginTop: 4 },
  parrafo: { fontSize: 11, color: "#374151", lineHeight: 1.5, marginBottom: 6 },
  item: { fontSize: 11, color: "#374151", lineHeight: 1.4, marginBottom: 3, marginLeft: 10 },
  codigo: {
    fontFamily: "Courier",
    fontSize: 9,
    color: "#111827",
    backgroundColor: "#f3f4f6",
    padding: 10,
    borderRadius: 4,
    marginBottom: 8,
  },
  cita: {
    fontSize: 11,
    color: "#4b5563",
    fontFamily: "Helvetica-Oblique",
    borderLeftWidth: 3,
    borderLeftColor: "#f97316",
    paddingLeft: 10,
    marginBottom: 8,
  },
  separador: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb", marginVertical: 10 },
  seccionGlosario: { marginTop: 24, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 12 },
  tituloGlosario: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#374151", marginBottom: 6 },
});

function fuenteDe(run: Run): string {
  if (run.code) return "Courier";
  if (run.bold && run.italic) return "Helvetica-BoldOblique";
  if (run.bold) return "Helvetica-Bold";
  if (run.italic) return "Helvetica-Oblique";
  return "Helvetica";
}

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((r, i) => (
        <Text key={i} style={{ fontFamily: fuenteDe(r), ...(r.code ? { backgroundColor: "#f3f4f6", fontSize: 10 } : {}) }}>
          {r.texto}
        </Text>
      ))}
    </>
  );
}

export function PaginaPDF({
  titulo,
  proyectoNombre,
  html,
  glosario = [],
}: {
  titulo: string;
  proyectoNombre: string;
  html: string;
  glosario?: TerminoGlosarioPDF[];
}) {
  const bloques = htmlABloques(html);
  const fecha = new Date().toLocaleDateString("es-CL");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Image style={styles.logo} src="/logo.png" />
          <Text style={styles.titulo}>{titulo}</Text>
          <Text style={styles.subtitulo}>
            Documentación Técnica | Proyecto: {proyectoNombre} | {fecha}
          </Text>
        </View>

        {bloques.length === 0 && <Text style={styles.parrafo}>Esta página no tiene contenido.</Text>}

        {bloques.map((b, i) => {
          switch (b.tipo) {
            case "titulo": {
              const tam = b.nivel <= 1 ? 16 : b.nivel === 2 ? 14 : 12;
              return (
                <Text key={i} style={{ fontSize: tam, fontFamily: "Helvetica-Bold", color: "#1f2937", marginTop: 10, marginBottom: 5 }}>
                  <Runs runs={b.runs} />
                </Text>
              );
            }
            case "parrafo":
              return (
                <Text key={i} style={styles.parrafo}>
                  <Runs runs={b.runs} />
                </Text>
              );
            case "item":
              return (
                <Text key={i} style={styles.item}>
                  {b.indice} <Runs runs={b.runs} />
                </Text>
              );
            case "codigo":
              return (
                <View key={i} style={styles.codigo}>
                  <Text>{b.texto}</Text>
                </View>
              );
            case "cita":
              return (
                <Text key={i} style={styles.cita}>
                  <Runs runs={b.runs} />
                </Text>
              );
            case "separador":
              return <View key={i} style={styles.separador} />;
          }
        })}

        {glosario.length > 0 && (
          <View style={styles.seccionGlosario}>
            <Text style={styles.tituloGlosario}>Referencias — Glosario Técnico</Text>
            {glosario.map((t) => (
              <View key={t.id} style={{ flexDirection: "row", marginBottom: 4 }}>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1f2937", width: 90 }}>{t.termino}</Text>
                <Text style={{ fontSize: 10, color: "#4b5563", flex: 1, lineHeight: 1.4 }}>{t.definicion}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
