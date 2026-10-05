import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  db,
  generarFolio,
  obtenerFechaLocal,
} from '../db/database';
import {
  DATOS_DOCUMENTO,
  type Area,
  type NuevoFolioForm,
} from '../types';

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
  titleBlock: {
    flex: 1,
  },
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
  required: {
    color: '#dc2626',
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
  documentInfo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '10px',
    marginBottom: '20px',
  },
  documentItem: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '9px',
    padding: '10px 12px',
  },
  documentLabel: {
    display: 'block',
    fontSize: '10px',
    textTransform: 'uppercase',
    fontWeight: 800,
    color: '#64748b',
    marginBottom: '3px',
  },
  documentValue: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 700,
    color: '#1f2937',
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
};

function obtenerFormularioInicial(): NuevoFolioForm {
  return {
    fecha: obtenerFechaLocal(),
    area: 'Producción',
    cliente: '',
    producto: '',
    proceso: '',
    turno: '',
    encargado_linea: '',
    linea_modulo: '',
    supervisor: '',
    inspector_qa: '',
  };
}

export default function NuevoFolio() {
  const navigate = useNavigate();

  const [formulario, setFormulario] =
    useState<NuevoFolioForm>(obtenerFormularioInicial);

  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  function actualizarCampo<K extends keyof NuevoFolioForm>(
    campo: K,
    valor: NuevoFolioForm[K],
  ) {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));

    if (error) {
      setError('');
    }
  }

  function validarFormulario(): string | null {
    if (!formulario.fecha) {
      return 'La fecha es obligatoria.';
    }

    if (!formulario.area) {
      return 'El área es obligatoria.';
    }

    if (!formulario.cliente.trim()) {
      return 'El cliente es obligatorio.';
    }

    if (!formulario.producto.trim()) {
      return 'El producto es obligatorio.';
    }

    if (!formulario.proceso.trim()) {
      return 'El proceso es obligatorio.';
    }

    if (!formulario.turno.trim()) {
      return 'El turno es obligatorio.';
    }

    if (!formulario.encargado_linea.trim()) {
      return 'El encargado de línea es obligatorio.';
    }

    if (!formulario.linea_modulo.trim()) {
      return 'La línea/módulo es obligatorio.';
    }

    if (!formulario.supervisor.trim()) {
      return 'El supervisor es obligatorio.';
    }

    if (!formulario.inspector_qa.trim()) {
      return 'El inspector QA es obligatorio.';
    }

    return null;
  }

  async function crearFolio(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const mensajeError = validarFormulario();

    if (mensajeError) {
      setError(mensajeError);
      return;
    }

    setGuardando(true);
    setError('');

    try {
      const folioGenerado = await generarFolio(formulario.fecha);
      const ahora = Date.now();

      const folioId = await db.folios.add({
        folio: folioGenerado,
        empresa: DATOS_DOCUMENTO.empresa,
        codigo_doc: DATOS_DOCUMENTO.codigo_doc,
        version: DATOS_DOCUMENTO.version,
        fecha: formulario.fecha,
        area: formulario.area,
        cliente: formulario.cliente.trim(),
        producto: formulario.producto.trim(),
        proceso: formulario.proceso.trim(),
        turno: formulario.turno.trim(),
        encargado_linea: formulario.encargado_linea.trim(),
        linea_modulo: formulario.linea_modulo.trim(),
        supervisor: formulario.supervisor.trim(),
        inspector_qa: formulario.inspector_qa.trim(),
        sync_status: 'pending',
        created_at: ahora,
        updated_at: ahora,
      });

      navigate(`/captura/${folioId}`);
    } catch (err) {
      console.error('Error al crear folio:', err);
      setError(
        'No fue posible crear el folio. Verifica el almacenamiento local e inténtalo nuevamente.',
      );
    } finally {
      setGuardando(false);
    }
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
            <h1 style={styles.title}>Nuevo Folio</h1>

            <p style={styles.subtitle}>
              Control de Tarimas y HU en Proceso
            </p>
          </div>
        </header>

        <form onSubmit={crearFolio}>
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>
              Información del documento
            </h2>

            <div style={styles.documentInfo}>
              <div style={styles.documentItem}>
                <span style={styles.documentLabel}>
                  Empresa
                </span>

                <span style={styles.documentValue}>
                  {DATOS_DOCUMENTO.empresa}
                </span>
              </div>

              <div style={styles.documentItem}>
                <span style={styles.documentLabel}>
                  Código
                </span>

                <span style={styles.documentValue}>
                  {DATOS_DOCUMENTO.codigo_doc}
                </span>
              </div>

              <div style={styles.documentItem}>
                <span style={styles.documentLabel}>
                  Versión
                </span>

                <span style={styles.documentValue}>
                  {DATOS_DOCUMENTO.version}
                </span>
              </div>
            </div>

            <h2 style={styles.sectionTitle}>
              Datos del folio
            </h2>

            <div style={styles.grid}>
              <div style={styles.field}>
                <label style={styles.label} htmlFor="fecha">
                  Fecha <span style={styles.required}>*</span>
                </label>

                <input
                  id="fecha"
                  type="date"
                  value={formulario.fecha}
                  onChange={(event) =>
                    actualizarCampo(
                      'fecha',
                      event.target.value,
                    )
                  }
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="area">
                  Área <span style={styles.required}>*</span>
                </label>

                <select
                  id="area"
                  value={formulario.area}
                  onChange={(event) =>
                    actualizarCampo(
                      'area',
                      event.target.value as Area,
                    )
                  }
                  style={styles.select}
                  disabled={guardando}
                >
                  <option value="Inocuidad">
                    Inocuidad
                  </option>

                  <option value="Producción">
                    Producción
                  </option>

                  <option value="Embarques">
                    Embarques
                  </option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="cliente">
                  Cliente <span style={styles.required}>*</span>
                </label>

                <input
                  id="cliente"
                  type="text"
                  value={formulario.cliente}
                  onChange={(event) =>
                    actualizarCampo(
                      'cliente',
                      event.target.value,
                    )
                  }
                  placeholder="Ej. LALA"
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="producto">
                  Producto <span style={styles.required}>*</span>
                </label>

                <input
                  id="producto"
                  type="text"
                  value={formulario.producto}
                  onChange={(event) =>
                    actualizarCampo(
                      'producto',
                      event.target.value,
                    )
                  }
                  placeholder="Ej. Leche Entera"
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="proceso">
                  Proceso <span style={styles.required}>*</span>
                </label>

                <input
                  id="proceso"
                  type="text"
                  value={formulario.proceso}
                  onChange={(event) =>
                    actualizarCampo(
                      'proceso',
                      event.target.value,
                    )
                  }
                  placeholder="Ej. Smipack / Sixpack"
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="turno">
                  Turno <span style={styles.required}>*</span>
                </label>

                <input
                  id="turno"
                  type="text"
                  value={formulario.turno}
                  onChange={(event) =>
                    actualizarCampo(
                      'turno',
                      event.target.value,
                    )
                  }
                  placeholder="Ej. 1er turno"
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label
                  style={styles.label}
                  htmlFor="encargado_linea"
                >
                  Encargado de línea{' '}
                  <span style={styles.required}>*</span>
                </label>

                <input
                  id="encargado_linea"
                  type="text"
                  value={formulario.encargado_linea}
                  onChange={(event) =>
                    actualizarCampo(
                      'encargado_linea',
                      event.target.value,
                    )
                  }
                  placeholder="Nombre del encargado"
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label
                  style={styles.label}
                  htmlFor="linea_modulo"
                >
                  Línea / módulo{' '}
                  <span style={styles.required}>*</span>
                </label>

                <input
                  id="linea_modulo"
                  type="text"
                  value={formulario.linea_modulo}
                  onChange={(event) =>
                    actualizarCampo(
                      'linea_modulo',
                      event.target.value,
                    )
                  }
                  placeholder="Ej. Línea 1 / Módulo A"
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label
                  style={styles.label}
                  htmlFor="supervisor"
                >
                  Supervisor{' '}
                  <span style={styles.required}>*</span>
                </label>

                <input
                  id="supervisor"
                  type="text"
                  value={formulario.supervisor}
                  onChange={(event) =>
                    actualizarCampo(
                      'supervisor',
                      event.target.value,
                    )
                  }
                  placeholder="Nombre del supervisor"
                  style={styles.input}
                  disabled={guardando}
                />
              </div>

              <div style={styles.field}>
                <label
                  style={styles.label}
                  htmlFor="inspector_qa"
                >
                  Inspector QA{' '}
                  <span style={styles.required}>*</span>
                </label>

                <input
                  id="inspector_qa"
                  type="text"
                  value={formulario.inspector_qa}
                  onChange={(event) =>
                    actualizarCampo(
                      'inspector_qa',
                      event.target.value,
                    )
                  }
                  placeholder="Nombre del inspector"
                  style={styles.input}
                  disabled={guardando}
                />
              </div>
            </div>

            {error && (
              <div
                style={styles.error}
                role="alert"
              >
                {error}
              </div>
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
                {guardando
                  ? 'Creando folio...'
                  : 'Crear folio'}
              </button>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}