import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "../../api";
import { showToast } from "../../components/toast";

// ───────────────────────── Modelo de datos ─────────────────────────
// Todos los elementos viven en coordenadas de "mundo": el lienzo es infinito y
// la vista se desplaza (pan) y escala (zoom) por encima.

type Elemento =
  | { tipo: "trazo"; color: string; grosor: number; puntos: number[] }
  | { tipo: "rect"; x: number; y: number; w: number; h: number; color: string; grosor: number }
  | { tipo: "elipse"; x: number; y: number; w: number; h: number; color: string; grosor: number }
  | { tipo: "rombo"; x: number; y: number; w: number; h: number; color: string; grosor: number }
  | { tipo: "flecha"; x1: number; y1: number; x2: number; y2: number; color: string; grosor: number }
  | { tipo: "texto"; x: number; y: number; texto: string; color: string; tam: number };

type Herramienta = "mano" | "lapiz" | "rect" | "elipse" | "rombo" | "flecha" | "texto" | "borrador";

const COLORES = [
  { valor: "#262626", nombre: "Negro" },
  { valor: "#f97316", nombre: "Naranja" },
  { valor: "#0284c7", nombre: "Azul" },
  { valor: "#059669", nombre: "Verde" },
  { valor: "#dc2626", nombre: "Rojo" },
  { valor: "#7c3aed", nombre: "Violeta" },
];

const GROSORES = [
  { valor: 2, nombre: "Fino" },
  { valor: 4, nombre: "Medio" },
  { valor: 8, nombre: "Grueso" },
];

const TAM_TEXTO: Record<number, number> = { 2: 16, 4: 22, 8: 32 };

// ───────────────────────── Dibujo ─────────────────────────

function dibujarElemento(ctx: CanvasRenderingContext2D, e: Elemento) {
  ctx.strokeStyle = "color" in e ? e.color : "#262626";
  ctx.fillStyle = "color" in e ? e.color : "#262626";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (e.tipo) {
    case "trazo": {
      if (e.puntos.length < 4) return;
      ctx.lineWidth = e.grosor;
      ctx.beginPath();
      ctx.moveTo(e.puntos[0], e.puntos[1]);
      for (let i = 2; i < e.puntos.length; i += 2) ctx.lineTo(e.puntos[i], e.puntos[i + 1]);
      ctx.stroke();
      break;
    }
    case "rect": {
      ctx.lineWidth = e.grosor;
      ctx.strokeRect(e.x, e.y, e.w, e.h);
      break;
    }
    case "elipse": {
      ctx.lineWidth = e.grosor;
      ctx.beginPath();
      ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, Math.abs(e.w / 2), Math.abs(e.h / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "rombo": {
      ctx.lineWidth = e.grosor;
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, e.y);
      ctx.lineTo(e.x + e.w, cy);
      ctx.lineTo(cx, e.y + e.h);
      ctx.lineTo(e.x, cy);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "flecha": {
      ctx.lineWidth = e.grosor;
      ctx.beginPath();
      ctx.moveTo(e.x1, e.y1);
      ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
      // Punta de flecha proporcional al grosor
      const ang = Math.atan2(e.y2 - e.y1, e.x2 - e.x1);
      const largo = 10 + e.grosor * 2;
      ctx.beginPath();
      ctx.moveTo(e.x2, e.y2);
      ctx.lineTo(e.x2 - largo * Math.cos(ang - Math.PI / 6), e.y2 - largo * Math.sin(ang - Math.PI / 6));
      ctx.moveTo(e.x2, e.y2);
      ctx.lineTo(e.x2 - largo * Math.cos(ang + Math.PI / 6), e.y2 - largo * Math.sin(ang + Math.PI / 6));
      ctx.stroke();
      break;
    }
    case "texto": {
      ctx.font = `600 ${e.tam}px system-ui, sans-serif`;
      ctx.textBaseline = "top";
      const lineas = e.texto.split("\n");
      lineas.forEach((linea, i) => ctx.fillText(linea, e.x, e.y + i * e.tam * 1.3));
      break;
    }
  }
}

function bboxElemento(e: Elemento): { minX: number; minY: number; maxX: number; maxY: number } {
  switch (e.tipo) {
    case "trazo": {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < e.puntos.length; i += 2) {
        minX = Math.min(minX, e.puntos[i]);
        maxX = Math.max(maxX, e.puntos[i]);
        minY = Math.min(minY, e.puntos[i + 1]);
        maxY = Math.max(maxY, e.puntos[i + 1]);
      }
      return { minX, minY, maxX, maxY };
    }
    case "flecha":
      return { minX: Math.min(e.x1, e.x2), minY: Math.min(e.y1, e.y2), maxX: Math.max(e.x1, e.x2), maxY: Math.max(e.y1, e.y2) };
    case "texto": {
      const lineas = e.texto.split("\n");
      const ancho = Math.max(...lineas.map((l) => l.length)) * e.tam * 0.6;
      return { minX: e.x, minY: e.y, maxX: e.x + ancho, maxY: e.y + lineas.length * e.tam * 1.3 };
    }
    default:
      return { minX: Math.min(e.x, e.x + e.w), minY: Math.min(e.y, e.y + e.h), maxX: Math.max(e.x, e.x + e.w), maxY: Math.max(e.y, e.y + e.h) };
  }
}

function tocaElemento(e: Elemento, x: number, y: number, tol: number): boolean {
  const b = bboxElemento(e);
  if (x < b.minX - tol || x > b.maxX + tol || y < b.minY - tol || y > b.maxY + tol) return false;
  // Para trazos exigimos cercanía real a algún punto (el bbox puede ser enorme).
  if (e.tipo === "trazo") {
    for (let i = 0; i < e.puntos.length; i += 2) {
      const dx = e.puntos[i] - x;
      const dy = e.puntos[i + 1] - y;
      if (dx * dx + dy * dy <= tol * tol * 4) return true;
    }
    return false;
  }
  return true;
}

// Compatibilidad con el formato anterior ({ strokes: [{color,width,points}] }).
function normalizarContenido(contenido: any): Elemento[] {
  if (Array.isArray(contenido?.elements)) return contenido.elements;
  if (Array.isArray(contenido?.strokes)) {
    return contenido.strokes.map((s: any) => ({ tipo: "trazo", color: s.color, grosor: s.width, puntos: s.points }));
  }
  return [];
}

// ───────────────────────── Componente ─────────────────────────

export default function PizarraBoard({
  endpoint,
  nombreArchivo,
  puedeEscribir,
  titulo = "Pizarra de Planificación",
  descripcion = "Lienzo infinito para bocetear diagramas de flujo, topologías e ideas. Arrastra con la mano (o botón central) para moverte.",
}: {
  endpoint: string;
  nombreArchivo: string;
  puedeEscribir: boolean;
  titulo?: string;
  descripcion?: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elementosRef = useRef<Elemento[]>([]);
  const actualRef = useRef<Elemento | null>(null);
  const vistaRef = useRef({ x: 0, y: 0, escala: 1 });
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [herramienta, setHerramienta] = useState<Herramienta>("lapiz");
  const [color, setColor] = useState(COLORES[0].valor);
  const [grosor, setGrosor] = useState(GROSORES[1].valor);
  const [textoEdit, setTextoEdit] = useState<{ wx: number; wy: number; sx: number; sy: number; valor: string } | null>(null);
  const [, setVersion] = useState(0);

  const redibujar = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { x, y, escala } = vistaRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.translate(x, y);
    ctx.scale(escala, escala);
    for (const e of elementosRef.current) dibujarElemento(ctx, e);
    if (actualRef.current) dibujarElemento(ctx, actualRef.current);
  }, []);

  // Tamaño del canvas acoplado al contenedor (con soporte de pantallas retina).
  useEffect(() => {
    const contenedor = contenedorRef.current;
    const canvas = canvasRef.current;
    if (!contenedor || !canvas) return;
    const ajustar = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = contenedor.clientWidth * dpr;
      canvas.height = contenedor.clientHeight * dpr;
      canvas.style.width = `${contenedor.clientWidth}px`;
      canvas.style.height = `${contenedor.clientHeight}px`;
      redibujar();
    };
    ajustar();
    const obs = new ResizeObserver(ajustar);
    obs.observe(contenedor);
    return () => obs.disconnect();
  }, [redibujar]);

  useEffect(() => {
    apiFetch<{ contenido: unknown }>(endpoint)
      .then((p) => {
        elementosRef.current = normalizarContenido(p.contenido);
        setCargando(false);
        setVersion((v) => v + 1);
        requestAnimationFrame(redibujar);
      })
      .catch(() => {
        setCargando(false);
        showToast("No se pudo cargar la pizarra", "error");
      });
  }, [endpoint, redibujar]);

  // Zoom con la rueda, centrado en el cursor.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      const v = vistaRef.current;
      const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nuevaEscala = Math.min(4, Math.max(0.2, v.escala * factor));
      // El punto del mundo bajo el cursor se mantiene fijo.
      const wx = (sx - v.x) / v.escala;
      const wy = (sy - v.y) / v.escala;
      v.escala = nuevaEscala;
      v.x = sx - wx * nuevaEscala;
      v.y = sy - wy * nuevaEscala;
      setVersion((n) => n + 1);
      redibujar();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [redibujar]);

  function aMundo(e: React.PointerEvent): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect();
    const v = vistaRef.current;
    return [(e.clientX - rect.left - v.x) / v.escala, (e.clientY - rect.top - v.y) / v.escala];
  }

  function borrarEn(x: number, y: number) {
    const tol = 8 / vistaRef.current.escala;
    for (let i = elementosRef.current.length - 1; i >= 0; i--) {
      if (tocaElemento(elementosRef.current[i], x, y, tol)) {
        elementosRef.current.splice(i, 1);
        setSinGuardar(true);
        setVersion((v) => v + 1);
        redibujar();
        return;
      }
    }
  }

  function confirmarTexto() {
    setTextoEdit((t) => {
      if (t && t.valor.trim()) {
        elementosRef.current.push({ tipo: "texto", x: t.wx, y: t.wy, texto: t.valor.trim(), color, tam: TAM_TEXTO[grosor] ?? 22 });
        setSinGuardar(true);
        redibujar();
      }
      return null;
    });
    setVersion((v) => v + 1);
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (cargando) return;
    if (textoEdit) {
      confirmarTexto();
      return;
    }
    // Botón central (o herramienta mano) = pan. Siempre disponible, incluso en solo lectura.
    if (herramienta === "mano" || e.button === 1) {
      panRef.current = { sx: e.clientX, sy: e.clientY, ox: vistaRef.current.x, oy: vistaRef.current.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (!puedeEscribir || e.button !== 0) return;

    const [x, y] = aMundo(e);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (herramienta === "borrador") {
      borrarEn(x, y);
      panRef.current = null;
      actualRef.current = { tipo: "trazo", color: "transparent", grosor: 0, puntos: [] }; // marca "arrastrando borrador"
      return;
    }
    if (herramienta === "texto") {
      const rect = canvasRef.current!.getBoundingClientRect();
      setTextoEdit({ wx: x, wy: y, sx: e.clientX - rect.left, sy: e.clientY - rect.top, valor: "" });
      return;
    }
    if (herramienta === "lapiz") {
      actualRef.current = { tipo: "trazo", color, grosor, puntos: [x, y] };
    } else if (herramienta === "flecha") {
      actualRef.current = { tipo: "flecha", x1: x, y1: y, x2: x, y2: y, color, grosor };
    } else {
      actualRef.current = { tipo: herramienta, x, y, w: 0, h: 0, color, grosor };
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (panRef.current) {
      vistaRef.current.x = panRef.current.ox + (e.clientX - panRef.current.sx);
      vistaRef.current.y = panRef.current.oy + (e.clientY - panRef.current.sy);
      redibujar();
      return;
    }
    const actual = actualRef.current;
    if (!actual) return;
    const [x, y] = aMundo(e);

    if (herramienta === "borrador") {
      borrarEn(x, y);
      return;
    }
    if (actual.tipo === "trazo") actual.puntos.push(x, y);
    else if (actual.tipo === "flecha") {
      actual.x2 = x;
      actual.y2 = y;
    } else if (actual.tipo !== "texto") {
      actual.w = x - actual.x;
      actual.h = y - actual.y;
    }
    redibujar();
  }

  function onPointerUp() {
    panRef.current = null;
    const actual = actualRef.current;
    actualRef.current = null;
    if (!actual || herramienta === "borrador") {
      redibujar();
      return;
    }
    const b = bboxElemento(actual);
    const tamMin = actual.tipo === "trazo" ? 2 : 6;
    if (b.maxX - b.minX >= tamMin || b.maxY - b.minY >= tamMin) {
      // Normaliza rectángulos dibujados "hacia atrás".
      if (actual.tipo === "rect" || actual.tipo === "elipse" || actual.tipo === "rombo") {
        const nx = Math.min(actual.x, actual.x + actual.w);
        const ny = Math.min(actual.y, actual.y + actual.h);
        actual.w = Math.abs(actual.w);
        actual.h = Math.abs(actual.h);
        actual.x = nx;
        actual.y = ny;
      }
      elementosRef.current.push(actual);
      setSinGuardar(true);
    }
    setVersion((v) => v + 1);
    redibujar();
  }

  function deshacer() {
    elementosRef.current.pop();
    setSinGuardar(true);
    setVersion((v) => v + 1);
    redibujar();
  }

  function limpiar() {
    if (elementosRef.current.length === 0) return;
    if (!confirm("¿Borrar todo el contenido de la pizarra? (No se guarda hasta que presiones Guardar)")) return;
    elementosRef.current = [];
    setSinGuardar(true);
    setVersion((v) => v + 1);
    redibujar();
  }

  function centrarVista() {
    if (elementosRef.current.length === 0) {
      vistaRef.current = { x: 0, y: 0, escala: 1 };
    } else {
      const canvas = canvasRef.current!;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const el of elementosRef.current) {
        const b = bboxElemento(el);
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const escala = Math.min(2, Math.max(0.2, Math.min(cw / (maxX - minX + 120), ch / (maxY - minY + 120))));
      vistaRef.current = {
        escala,
        x: cw / 2 - ((minX + maxX) / 2) * escala,
        y: ch / 2 - ((minY + maxY) / 2) * escala,
      };
    }
    setVersion((v) => v + 1);
    redibujar();
  }

  async function guardar() {
    setGuardando(true);
    try {
      await apiFetch(endpoint, {
        method: "PUT",
        body: JSON.stringify({ contenido: { elements: elementosRef.current } }),
      });
      setSinGuardar(false);
      showToast("Pizarra guardada.", "success");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo guardar la pizarra", "error");
    } finally {
      setGuardando(false);
    }
  }

  function exportarPNG() {
    if (elementosRef.current.length === 0) {
      showToast("La pizarra está vacía.", "info");
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elementosRef.current) {
      const b = bboxElemento(el);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    const pad = 40;
    const off = document.createElement("canvas");
    off.width = Math.ceil(maxX - minX) + pad * 2;
    off.height = Math.ceil(maxY - minY) + pad * 2;
    const ctx = off.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, off.width, off.height);
    ctx.translate(pad - minX, pad - minY);
    for (const el of elementosRef.current) dibujarElemento(ctx, el);
    const a = document.createElement("a");
    a.download = `${nombreArchivo}.png`;
    a.href = off.toDataURL("image/png");
    a.click();
  }

  const HERRAMIENTAS: { id: Herramienta; nombre: string; icono: string; soloEscritura: boolean }[] = [
    { id: "mano", nombre: "Mover lienzo", icono: "✋", soloEscritura: false },
    { id: "lapiz", nombre: "Lápiz", icono: "✏️", soloEscritura: true },
    { id: "rect", nombre: "Rectángulo (proceso)", icono: "▭", soloEscritura: true },
    { id: "elipse", nombre: "Elipse (inicio/fin)", icono: "◯", soloEscritura: true },
    { id: "rombo", nombre: "Rombo (decisión)", icono: "◇", soloEscritura: true },
    { id: "flecha", nombre: "Flecha (flujo)", icono: "→", soloEscritura: true },
    { id: "texto", nombre: "Texto", icono: "T", soloEscritura: true },
    { id: "borrador", nombre: "Borrador", icono: "🧹", soloEscritura: true },
  ];

  const btnHerr = (activo: boolean) =>
    `w-9 h-9 flex items-center justify-center rounded-lg border text-sm font-bold transition ${
      activo ? "bg-orange-500 border-orange-500 text-white shadow-sm" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
    }`;

  const cursor =
    herramienta === "mano" ? (panRef.current ? "cursor-grabbing" : "cursor-grab") : herramienta === "texto" ? "cursor-text" : puedeEscribir ? "cursor-crosshair" : "cursor-grab";

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-lg font-black text-neutral-800">{titulo}</h2>
          <p className="text-xs text-neutral-500 mt-1">{descripcion}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sinGuardar && <span className="text-[11px] font-semibold text-amber-600">● Cambios sin guardar</span>}
          <button onClick={centrarVista} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg" title="Encajar el contenido en pantalla">
            Centrar
          </button>
          <button onClick={exportarPNG} className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 px-3 py-2 rounded-lg">
            Exportar PNG
          </button>
          {puedeEscribir && (
            <button
              onClick={guardar}
              disabled={guardando || !sinGuardar}
              className="text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg"
            >
              {guardando ? "Guardando…" : "Guardar pizarra"}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-4 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2">
        <div className="flex items-center gap-1">
          {HERRAMIENTAS.filter((h) => !h.soloEscritura || puedeEscribir).map((h) => (
            <button key={h.id} onClick={() => setHerramienta(h.id)} className={btnHerr(herramienta === h.id)} title={h.nombre}>
              {h.icono}
            </button>
          ))}
        </div>

        {puedeEscribir && (
          <>
            <div className="h-5 w-px bg-neutral-200" />
            <div className="flex items-center gap-1.5">
              {COLORES.map((c) => (
                <button
                  key={c.valor}
                  onClick={() => setColor(c.valor)}
                  title={c.nombre}
                  className={`w-6 h-6 rounded-full border-2 transition ${color === c.valor ? "border-neutral-800 scale-110" : "border-white shadow-sm"}`}
                  style={{ backgroundColor: c.valor }}
                />
              ))}
            </div>
            <div className="h-5 w-px bg-neutral-200" />
            <div className="flex items-center gap-1.5">
              {GROSORES.map((g) => (
                <button
                  key={g.valor}
                  onClick={() => setGrosor(g.valor)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg border transition ${
                    grosor === g.valor ? "bg-zinc-800 border-zinc-800 text-white" : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                  title={g.nombre}
                >
                  <span className="inline-block rounded-full bg-current" style={{ width: g.valor + 3, height: g.valor + 3 }} />
                </button>
              ))}
            </div>
            <div className="h-5 w-px bg-neutral-200" />
            <button onClick={deshacer} disabled={elementosRef.current.length === 0} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40" title="Deshacer último elemento">
              ↩ Deshacer
            </button>
            <button onClick={limpiar} disabled={elementosRef.current.length === 0} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border bg-white border-neutral-200 text-red-600 hover:bg-neutral-50 disabled:opacity-40" title="Borrar todo">
              Limpiar
            </button>
          </>
        )}

        <span className="text-[11px] text-neutral-400 ml-auto">
          {Math.round(vistaRef.current.escala * 100)}% · {elementosRef.current.length} elemento{elementosRef.current.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div ref={contenedorRef} className="rounded-xl border border-neutral-200 overflow-hidden relative h-[600px] bg-white">
        {cargando && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <p className="text-sm text-neutral-500">Cargando pizarra…</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className={`block ${cursor}`}
          style={{ touchAction: "none" }}
        />
        {textoEdit && (
          <textarea
            autoFocus
            value={textoEdit.valor}
            onChange={(e) => setTextoEdit((t) => (t ? { ...t, valor: e.target.value } : t))}
            onBlur={confirmarTexto}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                confirmarTexto();
              }
              if (e.key === "Escape") setTextoEdit(null);
            }}
            placeholder="Escribe y presiona Enter…"
            className="absolute z-20 bg-white border-2 border-orange-400 rounded-lg px-2 py-1 text-sm font-semibold text-neutral-800 shadow-lg resize focus:outline-none min-w-[180px]"
            style={{ left: textoEdit.sx, top: textoEdit.sy }}
            rows={1}
          />
        )}
      </div>

      <p className="text-[11px] text-neutral-400 mt-2">
        Rueda del mouse: zoom · Botón central o herramienta ✋: mover el lienzo{!puedeEscribir ? " · Vista de solo lectura" : " · Enter confirma el texto (Shift+Enter salto de línea)"}
      </p>
    </div>
  );
}
