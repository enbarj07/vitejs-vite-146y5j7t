import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db, eliminarFolioCompleto } from '../db/database';
import type { Folio } from '../types';

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f4f6f8',
    padding: '20px 16px 40px',
  },
  container: {
    width: '100%',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  header: {
    background: '#0b5d3b',
    color: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
  },
  title: {
    margin: 0,
    fontSize: '30px',
    fontWeight: 800,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: '7px 0 0',
    fontSize: '14px',
    opacity: 0.9,
  },
  actions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '20px',
  },
  primaryButton: {
    border: 'none',
    borderRadius: '10px',
    padding: '13px 18px',
    background: '#ffffff',
    color: '#0b5d3b',
    fontWeight: 700,
    fontSize: '15px',
    minHeight: '46px',
  },
  secondaryButton: {
    border: '1px solid rgba(255,255,255,0.45)',
    borderRadius: '10px',
    padding: '13px 18px',
    background: 'transparent',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '15px',
    minHeight: '46px',
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: '20px',
    color: '#17202a',
  },
  list: {
    display: 'grid',
    gap: '12px',
  },
  card: {
    width: '100%',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '16px',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
    textAlign: 'left',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '4px',
  },
  cardButton: {
    width: '100%',
    border: 'none',
    padding: 0,
    background: 'transparent',
    textAlign: 'left',
    color: 'inherit',
    cursor: 'pointer',
  },
  deleteButton: {
    flex: '0 0 auto',
    width: '40px',
    height: '40px',
    padding: 0,
    border: '1px solid #fecaca',
    borderRadius: '10px',
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: '18px',
    lineHeight: 1,
    cursor: 'pointer',
  },
  folio: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 800,
    color: '#0b5d3b',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '10px',
    marginTop: '13px',
  },
  infoItem: {
    minWidth: 0,
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: '3px',
  },
  value: {
    display: 'block',
    fontSize: '14px',
    color: '#1f2937',
    wordBreak: 'break-word',
  },
  sync: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    marginTop: '13px',
    padding: '5px 9px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
  },
  empty: {
    background: '#ffffff',
    border: '1px dashed #cbd5e1',
    borderRadius: '14px',
    padding: '35px 20px',
    textAlign: 'center',
    color: '#64748b',
  },
  emptyTitle: {
    margin: '0 0 7px',
    fontSize: '17px',
    fontWeight: 700,
    color: '#334155',
  },
  emptyText: {
    margin: 0,
    fontSize: '14px',
  },
  loading: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#64748b',
  },
};

function formatearFecha(fecha: string): string {
  if (!fecha) {
    return '';
  }

  const partes = fecha.split('-');

  if (partes.length !== 3) {
    return fecha;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function obtenerEstadoSync(folio: Folio) {
  if (folio.sync_status === 'synced') {
    return {
      texto: 'Sincronizado',
      icono: '☁️',
      background: '#dcfce7',
      color: '#166534',
    };
  }

  return {
    texto: 'Pendiente de sincronizar',
    icono: '⏳',
    background: '#fef3c7',
    color: '#92400e',
  };
}

export default function Home() {
  const navigate = useNavigate();

  const folios = useLiveQuery(
    async () => {
      return db.folios.orderBy('created_at').reverse().toArray();
    },
    [],
    undefined,
  );

  const cantidadFolios = folios?.length ?? 0;

  const manejarEliminar = async (folio: Folio) => {
    if (folio.id === undefined) {
      return;
    }

    const confirmado = window.confirm(
      `¿Eliminar el folio ${folio.folio}?\n\n` +
        `Se borrarán todos sus registros de HU.\n` +
        `Esta acción no se puede deshacer.`,
    );

    if (!confirmado) {
      return;
    }

    try {
      await eliminarFolioCompleto(folio.id);
    } catch (error) {
      console.error('Error al eliminar folio:', error);
      window.alert('No fue posible eliminar el folio.');
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Trazabilidad HU</h1>

          <p style={styles.subtitle}>
            Bill Pack · Control de Tarimas y HU en Proceso
          </p>

          <div style={styles.actions}>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => navigate('/nuevo-folio')}
            >
              + Nuevo Folio
            </button>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => navigate('/historial')}
            >
              📋 Historial
            </button>
          </div>
        </header>

        <section>
          <h2 style={styles.sectionTitle}>
            Folios guardados
            {cantidadFolios > 0 ? ` (${cantidadFolios})` : ''}
          </h2>

          {folios === undefined && (
            <div style={styles.loading}>
              Cargando información local...
            </div>
          )}

          {folios !== undefined && folios.length === 0 && (
            <div style={styles.empty}>
              <p style={styles.emptyTitle}>No hay folios registrados</p>

              <p style={styles.emptyText}>
                Crea tu primer folio para comenzar a registrar las HU.
              </p>

              <button
                type="button"
                style={{
                  ...styles.primaryButton,
                  marginTop: '18px',
                  background: '#0b5d3b',
                  color: '#ffffff',
                }}
                onClick={() => navigate('/nuevo-folio')}
              >
                + Crear primer folio
              </button>
            </div>
          )}

          {folios !== undefined && folios.length > 0 && (
            <div style={styles.list}>
              {folios.map((folio) => {
                const sync = obtenerEstadoSync(folio);

                return (
                  <article
                    key={folio.id}
                    style={styles.card}
                  >
                    <div style={styles.cardHeader}>
                      <h3 style={styles.folio}>
                        {folio.folio}
                      </h3>

                      <button
                        type="button"
                        style={styles.deleteButton}
                        onClick={() => manejarEliminar(folio)}
                        aria-label={`Eliminar folio ${folio.folio}`}
                        title="Eliminar folio"
                      >
                        🗑️
                      </button>
                    </div>

                    <button
                      type="button"
                      style={styles.cardButton}
                      onClick={() => {
                        if (folio.id !== undefined) {
                          navigate(`/captura/${folio.id}`);
                        }
                      }}
                    >
                      <div style={styles.infoGrid}>
                        <div style={styles.infoItem}>
                          <span style={styles.label}>Fecha</span>
                          <span style={styles.value}>
                            {formatearFecha(folio.fecha)}
                          </span>
                        </div>

                        <div style={styles.infoItem}>
                          <span style={styles.label}>Área</span>
                          <span style={styles.value}>
                            {folio.area}
                          </span>
                        </div>

                        <div style={styles.infoItem}>
                          <span style={styles.label}>Cliente</span>
                          <span style={styles.value}>
                            {folio.cliente || '—'}
                          </span>
                        </div>

                        <div style={styles.infoItem}>
                          <span style={styles.label}>Producto</span>
                          <span style={styles.value}>
                            {folio.producto || '—'}
                          </span>
                        </div>

                        <div style={styles.infoItem}>
                          <span style={styles.label}>Proceso</span>
                          <span style={styles.value}>
                            {folio.proceso || '—'}
                          </span>
                        </div>

                        <div style={styles.infoItem}>
                          <span style={styles.label}>Turno</span>
                          <span style={styles.value}>
                            {folio.turno || '—'}
                          </span>
                        </div>

                        <div style={styles.infoItem}>
                          <span style={styles.label}>Línea / módulo</span>
                          <span style={styles.value}>
                            {folio.linea_modulo || '—'}
                          </span>
                        </div>

                        <div style={styles.infoItem}>
                          <span style={styles.label}>Supervisor</span>
                          <span style={styles.value}>
                            {folio.supervisor || '—'}
                          </span>
                        </div>
                      </div>

                      <span
                        style={{
                          ...styles.sync,
                          background: sync.background,
                          color: sync.color,
                        }}
                      >
                        {sync.icono} {sync.texto}
                      </span>
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
