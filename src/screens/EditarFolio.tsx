import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, obtenerFolioPorId } from '../db/database';
import type { Area, Folio } from '../types';

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f4f6f8',
    padding: '20px 16px 40px',
  },
  container: {
    width: '100%',
    maxWidth: '850px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  backButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    background: '#ffffff',
    color: '#334155',
    padding: '10px 14px',
    fontWeight: 700,
    minHeight: '44px',
  },
  titleBlock: { flex: 1 },
  title: {
    margin: 0,
    fontSize: '26px',
    color: '#17202a',
  },
  subtitle: {
    margin: '4px 0 0',
    color: '#64748b',
    fontSize: '13px',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
  },
  sectionTitle: {
    margin: '0 0 16px',
    fontSize: '18px',
    color: '#0b5d3b',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '15px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#334155',
  },
  input: {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '11px 12px',
    minHeight: '44px',
    background: '#ffffff',
    color: '#1f2937',
    outline: 'none',
  },
  select: {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '11px 12px',
    minHeight: '44px',
    background: '#ffffff',
    color: '#1f2937',
    outline: 'none',
  },
  error: {
    marginTop: '16px',
    background: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    borderRadius: '9px',
    padding: '11px 13px',
    fontSize: '14px',
    fontWeight: 600,
  },
  success: {
    marginTop: '16px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
    borderRadius: '9px',
    padding: '11px 13px',
    fontSize: '14px',
    fontWeight: 600,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
    flexWrap: 'wrap',
  },
  cancelButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    background: '#ffffff',
    color: '#334155',
    padding: '12px 18px',
    fontWeight: 700,
    minHeight: '46px',
  },
  submitButton: {
    border: 'none',
    borderRadius: '10px',
    background: '#0b5d3b',
    color: '#ffffff',
    padding: '12px 20px',
    fontWeight: 800,
    minHeight: '46px',
  },
  loading: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#64748b',
  },
};

export default function EditarFolio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const folioId = Number(id);

  const [folio, setFolio] = useState<Folio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      if (!Number.isFinite(folioId)) {
        setError('Folio no válido.');
        setCargando(false);
        return;
      }

      const encontrado = await obtenerFolioPorId(folioId);

      if (!encontrado) {
        setError('No se encontró el folio.');
        setCargando(false);
        return;
      }

      setFolio(encontrado);
      setCargando(false);
    };

    void cargar();
  }, [folioId]);

  const actualizarCampo = <K extends keyof Folio>(
    campo: K,
    valor: Folio[K],
  ) => {
    setFolio((actual) => (actual ? { ...actual, [campo]: valor } : actual));
    setError('');
    setExito(false);
  };

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!folio || folio.id === undefined) {
      setError('No hay folio para guardar.');
      return;
    }

    if (!folio.cliente.trim()) {
      setError('El cliente es obligatorio.');
      return;
    }

    if (!folio.producto.trim()) {
      setError('El producto es obligatorio.');
      return;
    }

    if (!folio.proceso.trim()) {
      setError('El proceso es obligatorio.');
      return;
    }

    if (!folio.turno.trim()) {
      setError('El turno es obligatorio.');
      return;
    }

    if (!folio.encargado_linea.trim()) {
      setError('El encargado de línea es obligatorio.');
      return;
    }

    if (!folio.linea_modulo.trim()) {
      setError('La línea/módulo es obligatorio.');
      return;
    }

    if (!folio.supervisor.trim()) {
      setError('El supervisor es obligatorio.');
      return;
    }

    if (!folio.inspector_qa.trim()) {
      setError('El inspector QA es obligatorio.');
      return;
    }

    setGuardando(true);

    try {
      await db.folios.update(folio.id, {
        fecha: folio.fecha,
        area: folio.area,
        cliente: folio.cliente.trim(),
        producto: folio.producto.trim(),
        proceso: folio.proceso.trim(),
        turno: folio.turno.trim(),
        encargado_linea: folio.encargado_linea.trim(),
        linea_modulo: folio.linea_modulo.trim(),
        supervisor: folio.supervisor.trim(),
        inspector_qa: folio.inspector_qa.trim(),
        sync_status: 'pending',
        updated_at: Date.now(),
      });

      setExito(true);

      window.setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (err) {
      console.error('Error al guardar folio:', err);
      setError('No fue posible guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.loading}>Cargando folio...</div>
        </div>
      </main>
    );
  }

  if (!folio) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <button
            type="button"
            style={styles.backButton}
            onClick={() => navigate('/')}
          >
            ← Volver
          </button>

          <div style={{ ...styles.card, marginTop: 20 }}>
            <p style={styles.error}>{error || 'Folio no encontrado.'}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <button
            type="button"
            style={styles.backButton}
            onClick={() => navigate('/')}
            disabled={guardando}
          >
            ← Volver
          </button>

          <div style={styles.titleBlock}>
            <h1 style={styles.title}>Editar Folio</h1>
            <p style={styles.subtitle}>{folio.folio}</p>
          </div>
        </header>

        <form onSubmit={guardar}>
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Datos del folio</h2>

            <div style={styles.grid}>
              <div style={styles.field}>
                <label style={styles.label} htmlFor="fecha">
                  Fecha
                </label>
                <input
                  id="fecha"
                  type="date"
                  value={folio.fecha}
                  onChange={(e) => actualizarCampo('fecha', e.target.value)}
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="area">
                  Área
                </label>
                <select
                  id="area"
                  value={folio.area}
                  onChange={(e) => actualizarCampo('area', e.target.value as Area)}
                  style={styles.select}
                  disabled={guardando}
                >
                  <option value="Inocuidad">Inocuidad</option>
                  <option value="Producción">Producción</option>
                  <option value="Embarques">Embarques</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="cliente">Cliente</label>
                <input
                  id="cliente"
                  type="text"
                  value={folio.cliente}
                  onChange={(e) => actualizarCampo('cliente', e.target.value)}
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="producto">Producto</label>
                <input
                  id="producto"
                  type="text"
                  value={folio.producto}
                  onChange={(e) => actualizarCampo('producto', e.target.value)}
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="proceso">Proceso</label>
                <input
                  id="proceso"
                  type="text"
                  value={folio.proceso}
                  onChange={(e) => actualizarCampo('proceso', e.target.value)}
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="turno">Turno</label>
                <input
                  id="turno"
                  type="text"
                  value={folio.turno}
                  onChange={(e) => actualizarCampo('turno', e.target.value)}
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="encargado_linea">
                  Encargado de línea
                </label>
                <input
                  id="encargado_linea"
                  type="text"
                  value={folio.encargado_linea}
                  onChange={(e) =>
                    actualizarCampo('encargado_linea', e.target.value)
                  }
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="linea_modulo">
                  Línea / módulo
                </label>
                <input
                  id="linea_modulo"
                  type="text"
                  value={folio.linea_modulo}
                  onChange={(e) =>
                    actualizarCampo('linea_modulo', e.target.value)
                  }
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="supervisor">
                  Supervisor
                </label>
                <input
                  id="supervisor"
                  type="text"
                  value={folio.supervisor}
                  onChange={(e) => actualizarCampo('supervisor', e.target.value)}
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="inspector_qa">
                  Inspector QA
                </label>
                <input
                  id="inspector_qa"
                  type="text"
                  value={folio.inspector_qa}
                  onChange={(e) =>
                    actualizarCampo('inspector_qa', e.target.value)
                  }
                  style={styles.input}
                  disabled={guardando}
                />
              </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {exito && (
              <div style={styles.success}>Cambios guardados ✅</div>
            )}

            <div style={styles.actions}>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={() => navigate('/')}
                disabled={guardando}
              >
                Cancelar
              </button>

              <button
                type="submit"
                style={styles.submitButton}
                disabled={guardando}
              >
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}
