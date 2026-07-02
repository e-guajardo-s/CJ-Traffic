import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { Proyecto } from './types';

// Estilos corporativos para el PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#f97316', // Naranja corporativo CJ
    paddingBottom: 15,
    marginBottom: 20
  },
  logo: {
    width: 120, // Ajusta según la proporción de tu logo.png
  },
  headerTextContainer: {
    textAlign: 'right',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937'
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingBottom: 4
  },
  text: {
    fontSize: 11,
    color: '#4b5563',
    lineHeight: 1.5
  },
  highlightBox: {
    backgroundColor: '#f9fafb',
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
    padding: 12,
    marginTop: 5
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 15,
    borderRadius: 4,
    alignItems: 'center'
  },
  metricValue: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4
  }
});

export interface TerminoGlosarioPDF {
  id: number;
  termino: string;
  definicion: string;
}

interface ReportePDFProps {
  proyecto: Proyecto;
  resumenIA: string;
  autor: string;
  glosario?: TerminoGlosarioPDF[];
}

export const ReportePDF = ({ proyecto, resumenIA, autor, glosario = [] }: ReportePDFProps) => {
  // Calculamos métricas automáticamente del Kanban
  const tareas = proyecto.tareas ?? [];
  const total = tareas.length;
  const hechas = tareas.filter((t) => t.estado === "HECHO").length;
  const progreso = total === 0 ? 0 : Math.round((hechas / total) * 100);
  const fechaActual = new Date().toLocaleDateString('es-CL');
  const componentes = proyecto.componentesStack ?? [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* 1. Encabezado Permanente */}
        <View style={styles.header}>
          {/* Carga el logo directamente desde la carpeta public */}
          <Image style={styles.logo} src="/logo.png" />
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Informe Ejecutivo de Avance</Text>
            <Text style={styles.subtitle}>Proyecto: {proyecto.nombre}</Text>
            <Text style={styles.subtitle}>{fechaActual} | Responsable: {autor}</Text>
          </View>
        </View>

        {/* 2. Resumen Ejecutivo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Síntesis Operativa</Text>
          <View style={styles.highlightBox}>
            <Text style={styles.text}>
              {resumenIA || "No se adjuntó un resumen ejecutivo para este reporte."}
            </Text>
          </View>
        </View>

        {/* 3. Estado de Avance (Métricas Kanban) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Estado de Avance Técnico</Text>
          <View style={styles.row}>
            <View style={styles.metricBox}>
              <Text style={{ ...styles.metricValue, color: '#f97316' }}>{progreso}%</Text>
              <Text style={styles.text}>Progreso Global</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={{ ...styles.metricValue, color: '#10b981' }}>{hechas}</Text>
              <Text style={styles.text}>Tareas Completadas</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={{ ...styles.metricValue, color: '#ef4444' }}>{total - hechas}</Text>
              <Text style={styles.text}>Tareas Pendientes</Text>
            </View>
          </View>
        </View>

        {/* 4. Arquitectura del Stack Tecnológico */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Arquitectura del Stack Tecnológico</Text>
          
          {/* Hardware */}
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1f2937', marginTop: 4 }}>[Terreno / Equipos]</Text>
          {componentes.filter(c => c.capa === 'HARDWARE').map(c => (
            <Text key={c.id} style={{ fontSize: 10, color: '#4b5563', marginLeft: 10 }}>• {c.nombre} {c.detalles ? `(${c.detalles})` : ''}</Text>
          ))}
          {componentes.filter(c => c.capa === 'HARDWARE').length === 0 && (
            <Text style={{ fontSize: 10, color: '#9ca3af', marginLeft: 10 }}>• Sin componentes registrados</Text>
          )}

          {/* Conectividad */}
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1f2937', marginTop: 6 }}>[Conectividad y Red]</Text>
          {componentes.filter(c => c.capa === 'RED').map(c => (
            <Text key={c.id} style={{ fontSize: 10, color: '#4b5563', marginLeft: 10 }}>• {c.nombre} {c.detalles ? `(${c.detalles})` : ''}</Text>
          ))}
          {componentes.filter(c => c.capa === 'RED').length === 0 && (
            <Text style={{ fontSize: 10, color: '#9ca3af', marginLeft: 10 }}>• Sin componentes registrados</Text>
          )}

          {/* Procesamiento */}
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1f2937', marginTop: 6 }}>[Procesamiento / Servidores]</Text>
          {componentes.filter(c => c.capa === 'PROCESAMIENTO').map(c => (
            <Text key={c.id} style={{ fontSize: 10, color: '#4b5563', marginLeft: 10 }}>• {c.nombre} {c.detalles ? `(${c.detalles})` : ''}</Text>
          ))}
          {componentes.filter(c => c.capa === 'PROCESAMIENTO').length === 0 && (
            <Text style={{ fontSize: 10, color: '#9ca3af', marginLeft: 10 }}>• Sin componentes registrados</Text>
          )}

          {/* Visualización */}
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1f2937', marginTop: 6 }}>[Visualización / Aplicación]</Text>
          {componentes.filter(c => c.capa === 'VISUALIZACION').map(c => (
            <Text key={c.id} style={{ fontSize: 10, color: '#4b5563', marginLeft: 10 }}>• {c.nombre} {c.detalles ? `(${c.detalles})` : ''}</Text>
          ))}
          {componentes.filter(c => c.capa === 'VISUALIZACION').length === 0 && (
            <Text style={{ fontSize: 10, color: '#9ca3af', marginLeft: 10 }}>• Sin componentes registrados</Text>
          )}
        </View>

        {/* 5. Planificación y Próximos Pasos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Planificación y Próximos Pasos</Text>
          <Text style={styles.text}>
            • Las acciones inmediatas se centran en la resolución de los ítems pendientes detallados en la plataforma centralizada (CJ SMART).
          </Text>
        </View>

        {/* 6. Referencias del Glosario Técnico */}
        {glosario.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Referencias — Glosario Técnico</Text>
            <Text style={{ fontSize: 9, color: '#9ca3af', marginBottom: 6 }}>
              Términos y siglas del glosario corporativo utilizados en este proyecto.
            </Text>
            {glosario.map((t) => (
              <View key={t.id} style={{ flexDirection: 'row', marginBottom: 4, paddingLeft: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1f2937', width: 90 }}>{t.termino}</Text>
                <Text style={{ fontSize: 10, color: '#4b5563', flex: 1, lineHeight: 1.4 }}>{t.definicion}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
};
