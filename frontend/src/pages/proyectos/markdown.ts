// Renderer de markdown minimalista (sin dependencias externas): negrita, cursiva,
// títulos, listas, enlaces y código en línea. Alcanza para documentación técnica
// simple; no pretende cubrir el spec completo de markdown.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code class='bg-neutral-100 text-neutral-700 px-1 py-0.5 rounded text-[0.9em]'>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href='$2' target='_blank' rel='noopener noreferrer' class='text-orange-600 underline'>$1</a>");
}

export function renderMarkdown(md: string): string {
  const lineas = md.split("\n");
  const html: string[] = [];
  let enLista: "ul" | "ol" | null = null;

  function cerrarLista() {
    if (enLista) html.push(`</${enLista}>`);
    enLista = null;
  }

  for (const linea of lineas) {
    const h = linea.match(/^(#{1,3})\s+(.*)$/);
    const ul = linea.match(/^[-*]\s+(.*)$/);
    const ol = linea.match(/^\d+\.\s+(.*)$/);

    if (h) {
      cerrarLista();
      const nivel = h[1].length;
      html.push(`<h${nivel + 2} class="font-bold text-neutral-800 mt-4 mb-1.5 ${nivel === 1 ? "text-lg" : nivel === 2 ? "text-base" : "text-sm"}">${inline(h[2])}</h${nivel + 2}>`);
    } else if (ul) {
      if (enLista !== "ul") {
        cerrarLista();
        html.push("<ul class='list-disc pl-5 space-y-0.5 my-1.5'>");
        enLista = "ul";
      }
      html.push(`<li>${inline(ul[1])}</li>`);
    } else if (ol) {
      if (enLista !== "ol") {
        cerrarLista();
        html.push("<ol class='list-decimal pl-5 space-y-0.5 my-1.5'>");
        enLista = "ol";
      }
      html.push(`<li>${inline(ol[1])}</li>`);
    } else if (linea.trim() === "") {
      cerrarLista();
    } else {
      cerrarLista();
      html.push(`<p class="my-1.5 leading-relaxed">${inline(linea)}</p>`);
    }
  }
  cerrarLista();
  return html.join("\n");
}
