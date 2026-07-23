// Catálogos compartidos del módulo Proyectos-Empresa: tipos de proyecto
// (semaforización/ITS) y tipos de línea de trabajo (tracks del kanban).

export const TIPOS_OBRA: { code: string; label: string }[] = [
  { code: "SEMAFORIZACION_NUEVA", label: "Semaforización nueva" },
  { code: "MODIFICACION_SEMAFORO", label: "Modificación de semáforo" },
  { code: "SINTONIA_FINA", label: "Sintonía fina" },
  { code: "RECONFIGURACION", label: "Reconfiguración" },
  { code: "ESPIRAS_SCOOT", label: "Espiras SCOOT" },
  { code: "PROYECTO_COMUNICACIONES", label: "Proyecto de comunicaciones" },
  { code: "INSTALACION_CCTV", label: "Instalación de CCTV" },
  { code: "ESTUDIO_JUSTIFICACION", label: "Estudio de justificación" },
  { code: "PROYECTO_SEMAFORO", label: "Proyecto de semáforo" },
  { code: "ALUMBRADO_PUBLICO", label: "Alumbrado público" },
  { code: "DEMARCACIONES", label: "Demarcaciones" },
  { code: "INSTALACION_VMS", label: "Instalación VMS" },
  { code: "PASOS_PEATONALES", label: "Pasos peatonales" },
  { code: "BALIZAS", label: "Balizas" },
  { code: "MANTENCION_PARADEROS", label: "Mantención paraderos" },
  { code: "PAVIMENTACION", label: "Pavimentación" },
  { code: "PROVISION_ELEMENTOS", label: "Provisión de elementos" },
  { code: "LEVANTAMIENTOS", label: "Levantamientos" },
  { code: "INGENIERIA", label: "Ingeniería" },
  { code: "OTRO", label: "Otro" },
];

// Incluye además los códigos legacy de obras creadas antes de este catálogo,
// para que sigan mostrando un label legible en vez del código crudo.
export const TIPO_OBRA_LABEL: Record<string, string> = {
  ...Object.fromEntries(TIPOS_OBRA.map((t) => [t.code, t.label])),
  NUEVO_SEMAFORO: "Nuevo semáforo",
  MODIFICACION: "Modificación",
  CCTV: "CCTV",
  MANTENCION: "Mantención",
};

export const TIPOS_TRACK: { code: string; label: string }[] = [
  { code: "PERMISOS", label: "Permisos" },
  { code: "ADQUISICIONES", label: "Materiales" },
  { code: "PROGRAMACION", label: "Programación" },
  { code: "INSTALACION", label: "Instalación" },
  { code: "ENLACES", label: "Enlaces" },
  { code: "EMPALMES", label: "Empalmes" },
  { code: "HITOS_UOCT", label: "Hitos UOCT" },
  { code: "SINTONIA_FINA", label: "Sintonía Fina" },
  { code: "TRASPASOS_MANTENCION", label: "Traspasos y Mantención" },
  { code: "CANALIZACION", label: "Canalización" },
  { code: "OBRAS_CIVILES", label: "Obras Civiles" },
  { code: "OTRO", label: "Otro (personalizada)" },
];
