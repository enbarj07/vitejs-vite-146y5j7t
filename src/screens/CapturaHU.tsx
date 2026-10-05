import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';

import { db, obtenerFolioPorId } from '../db/database';
import type {
  BrickForm,
  EstadoRegistro,
  RegistroHU,
  RegistroHUForm,
} from '../types';
import Scanner from '../scanner/Scanner';

function formatearHora(timestamp?: number): string {
  if (!timestamp) {
    return '--:--:--';
  }

  return new Date(timestamp).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatearDuracion(duracionMs?: number): string {
  if (duracionMs === undefined || duracionMs < 0) {
    return '00:00:00';
  }

  const totalSegundos = Math.floor(duracionMs / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  return [
    String(horas).padStart(2, '0'),
    String(minutos).padStart(2, '0'),
    String(segundos).padStart(2, '0'),
  ].join(':');
}

function crearFormularioInicial(): RegistroHUForm {
  return {
    codigo_hu: '',
    hora_entrada: null,
    hora_salida: null,
    duracion_ms: null,
    estado: 'En proceso',
    verifico_proceso: '',
    cantidad_danada: 0,
    causa_dano: '',
    se_repuso: 0,
    hu_donante: '',
    cantidad_repuesta: 0,
    verifico_reposicion: '',
    observaciones: '',
  };
}

function crearBrickInicial(): BrickForm {
  return {
    codigo_brick: '',
    causa: '',
  };
}

export default function CapturaHU() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const folioId = Number(id);

  const folio = useLiveQuery(
    async () => {
      if (!Number.isFinite(folioId)) {
        return undefined;
      }

      return obtenerFolioPorId(folioId);
    },
    [folioId],
  );

  const registros = useLiveQuery(
    async () => {
      if (!Number.isFinite(folioId)) {
        return [];
      }

      return db.registros
        .where('folio_id')
        .equals(folioId)
        .sortBy('numero_linea');
    },
    [folioId],
  );

  const [formulario, setFormulario] =
    useState<RegistroHUForm>(crearFormularioInicial);

  const [bricks, setBricks] = useState<BrickForm[]>([]);

  const [scannerActivo, setScannerActivo] = useState<
    'entrada' | 'donante' | 'salida' | null
  >(null);

  const [mensajeError, setMensajeError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');

  const [ahora, setAhora] = useState<number>(() => Date.now());

  const [guardando, setGuardando] = useState(false);

  const [mostrarBricks, setMostrarBricks] = useState(false);

  useEffect(() => {
    if (!formulario.hora_entrada || formulario.hora_salida) {
      return;
    }

    const intervalo = window.setInterval(() => {
      setAhora(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalo);
    };
  }, [formulario.hora_entrada, formulario.hora_salida]);

  useEffect(() => {
    if (!mensajeError && !mensajeExito) {
      return;
    }

    const temporizador = window.setTimeout(() => {
      setMensajeError('');
      setMensajeExito('');
    }, 5000);

    return () => {
      window.clearTimeout(temporizador);
    };
  }, [mensajeError, mensajeExito]);

  const numeroSiguiente = useMemo(() => {
    if (!registros || registros.length === 0) {
      return 1;
    }

    return (
      Math.max(
        ...registros.map((registro) => registro.numero_linea),
      ) + 1
    );
  }, [registros]);

  const duracionActual = useMemo(() => {
    if (
      !formulario.hora_entrada ||
      formulario.hora_salida === null
    ) {
      return null;
    }

    return Math.max(
      0,
      formulario.hora_salida - formulario.hora_entrada,
    );
  }, [formulario.hora_entrada, formulario.hora_salida]);

  const tiempoEnProceso = useMemo(() => {
    if (!formulario.hora_entrada || formulario.hora_salida) {
      return 0;
    }

    return Math.max(0, ahora - formulario.hora_entrada);
  }, [formulario.hora_entrada, formulario.hora_salida, ahora]);

  const actualizarCampo = <
    K extends keyof RegistroHUForm,
  >(
    campo: K,
    valor: RegistroHUForm[K],
  ) => {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));

    setMensajeError('');
    setMensajeExito('');
  };

  const manejarEscaneo = (codigo: string) => {
    const codigoLimpio = codigo.trim();

    if (!codigoLimpio) {
      setMensajeError('El código escaneado está vacío.');
      return;
    }

    if (scannerActivo === 'entrada') {
      if (formulario.hora_entrada) {
        setMensajeError(
          'Esta HU ya tiene registrada la hora de entrada.',
        );
        setScannerActivo(null);
        return;
      }

      actualizarCampo('codigo_hu', codigoLimpio);
      actualizarCampo('hora_entrada', Date.now());
      actualizarCampo('hora_salida', null);
      actualizarCampo('duracion_ms', null);

      setScannerActivo(null);
      setMensajeExito(
        `HU ${codigoLimpio} registrada correctamente.`,
      );
      return;
    }

    if (scannerActivo === 'donante') {
      if (!formulario.hora_entrada) {
        setMensajeError(
          'Primero registra la HU afectada/destino.',
        );
        setScannerActivo(null);
        return;
      }

      if (codigoLimpio === formulario.codigo_hu) {
        setMensajeError(
          'La HU origen no puede ser la misma HU afectada.',
        );
        setScannerActivo(null);
        return;
      }

      actualizarCampo('hu_donante', codigoLimpio);
      actualizarCampo('se_repuso', 1);

      setScannerActivo(null);
      setMensajeExito(
        `HU origen ${codigoLimpio} registrada.`,
      );
      return;
    }

    if (scannerActivo === 'salida') {
      if (!formulario.hora_entrada) {
        setMensajeError(
          'Primero registra la hora de entrada.',
        );
        setScannerActivo(null);
        return;
      }

      if (codigoLimpio !== formulario.codigo_hu) {
        setMensajeError(
          `La HU de salida (${codigoLimpio}) no coincide con la HU de entrada (${formulario.codigo_hu}).`,
        );
        setScannerActivo(null);
        return;
      }

      const horaSalida = Date.now();
      const duracion = Math.max(
        0,
        horaSalida - formulario.hora_entrada,
      );

      actualizarCampo('hora_salida', horaSalida);
      actualizarCampo('duracion_ms', duracion);

      setScannerActivo(null);
      setMensajeExito(
        `Salida registrada. Tiempo en proceso: ${formatearDuracion(duracion)}.`,
      );
    }
  };

  const agregarBrick = () => {
    setBricks((actuales) => [
      ...actuales,
      crearBrickInicial(),
    ]);
  };

  const actualizarBrick = (
    indice: number,
    campo: keyof BrickForm,
    valor: string,
  ) => {
    setBricks((actuales) =>
      actuales.map((brick, index) =>
        index === indice
          ? {
              ...brick,
              [campo]: valor,
            }
          : brick,
      ),
    );
  };

  const eliminarBrick = (indice: number) => {
    setBricks((actuales) =>
      actuales.filter((_, index) => index !== indice),
    );
  };

  const validarFormulario = (): string | null => {
    if (!folio) {
      return 'No se encontró el folio seleccionado.';
    }

    if (!formulario.codigo_hu.trim()) {
      return 'Debes escanear la HU antes de guardar.';
    }

    if (!formulario.hora_entrada) {
      return 'La HU no tiene registrada la hora de entrada.';
    }

    if (!formulario.hora_salida) {
      return 'Debes escanear la HU de salida antes de guardar.';
    }

    if (
      formulario.hora_salida <= formulario.hora_entrada
    ) {
      return 'La hora de salida debe ser posterior a la hora de entrada.';
    }

    if (
      formulario.cantidad_danada < 0 ||
      !Number.isFinite(formulario.cantidad_danada)
    ) {
      return 'La cantidad dañada no es válida.';
    }

    if (
      formulario.cantidad_danada > 0 &&
      !formulario.causa_dano.trim()
    ) {
      return 'Indica la causa del daño cuando exista cantidad dañada.';
    }

    if (formulario.se_repuso === 1) {
      if (!formulario.hu_donante.trim()) {
        return 'Debes registrar la HU origen de la reposición.';
      }

      if (
        formulario.hu_donante.trim() ===
        formulario.codigo_hu.trim()
      ) {
        return 'La HU origen no puede ser igual a la HU afectada.';
      }

      if (
        formulario.cantidad_repuesta <= 0 ||
        !Number.isFinite(formulario.cantidad_repuesta)
      ) {
        return 'La cantidad tomada de otra HU debe ser mayor a cero.';
      }

      if (!formulario.verifico_reposicion.trim()) {
        return 'Indica quién verificó la reposición.';
      }
    }

    if (!formulario.verifico_proceso.trim()) {
      return 'Indica quién verificó el proceso.';
    }

    for (const brick of bricks) {
      if (
        brick.codigo_brick.trim() &&
        !brick.causa.trim()
      ) {
        return `Indica la causa del brick ${brick.codigo_brick}.`;
      }
    }

    return null;
  };

  const guardarRegistro = async () => {
    setMensajeError('');
    setMensajeExito('');

    const error = validarFormulario();

    if (error) {
      setMensajeError(error);
      return;
    }

    if (!folio?.id) {
      setMensajeError('El folio no tiene un identificador válido.');
      return;
    }

    setGuardando(true);

    try {
      const ahoraGuardado = Date.now();

      const estado: EstadoRegistro =
        formulario.cantidad_danada > 0
          ? 'Con daño'
          : 'Completado';

      const registro: RegistroHU = {
        folio_id: folio.id,
        numero_linea: numeroSiguiente,
        codigo_hu: formulario.codigo_hu.trim(),
        hora_entrada: formulario.hora_entrada!,
        hora_salida: formulario.hora_salida!,
        duracion_ms:
          duracionActual ??
          Math.max(
            0,
            formulario.hora_salida! -
              formulario.hora_entrada!,
          ),
        estado,
        verifico_proceso:
          formulario.verifico_proceso.trim(),
        cantidad_danada: Math.max(
          0,
          Number(formulario.cantidad_danada) || 0,
        ),
        causa_dano:
          formulario.causa_dano.trim(),
        se_repuso: formulario.se_repuso,
        hu_donante:
          formulario.se_repuso === 1
            ? formulario.hu_donante.trim()
            : '',
        cantidad_repuesta:
          formulario.se_repuso === 1
            ? Math.max(
                0,
                Number(formulario.cantidad_repuesta) || 0,
              )
            : 0,
        verifico_reposicion:
          formulario.se_repuso === 1
            ? formulario.verifico_reposicion.trim()
            : '',
        observaciones:
          formulario.observaciones.trim(),
        sync_status: 'pending',
        created_at: ahoraGuardado,
        updated_at: ahoraGuardado,
      };

      await db.transaction(
        'rw',
        db.registros,
        db.bricks,
        db.folios,
        async () => {
          const registroId =
            await db.registros.add(registro);

          const bricksValidos = bricks.filter(
            (brick) =>
              brick.codigo_brick.trim() !== '',
          );

          if (bricksValidos.length > 0) {
            await db.bricks.bulkAdd(
              bricksValidos.map((brick) => ({
                registro_hu_id: registroId,
                codigo_brick:
                  brick.codigo_brick.trim(),
                causa: brick.causa.trim(),
                sync_status: 'pending' as const,
              })),
            );
          }

          await db.folios.update(folio.id!, {
            updated_at: ahoraGuardado,
            sync_status: 'pending',
          });
        },
      );

      setFormulario(crearFormularioInicial());
      setBricks([]);
      setMostrarBricks(false);
      setAhora(Date.now());

      setMensajeExito(
        `Registro ${numeroSiguiente} guardado correctamente.`,
      );
    } catch (error) {
      console.error(
        'Error al guardar registro de HU:',
        error,
      );

      setMensajeError(
        'No fue posible guardar el registro. Verifica el almacenamiento local.',
      );
    } finally {
      setGuardando(false);
    }
  };

  const cancelarCaptura = () => {
    setFormulario(crearFormularioInicial());
    setBricks([]);
    setMostrarBricks(false);
    setScannerActivo(null);
    setMensajeError('');
    setMensajeExito('');
    setAhora(Date.now());
  };

  if (!Number.isFinite(folioId)) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2 style={styles.title}>
            Folio no válido
          </h2>

          <p style={styles.text}>
            El identificador del folio no es válido.
          </p>

          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => navigate('/')}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (folio === undefined) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>
          Cargando folio...
        </div>
      </div>
    );
  }

  const estaCapturando =
    formulario.hora_entrada !== null;

  const salidaRegistrada =
    formulario.hora_salida !== null;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.documentLabel}>
            REG-INO-013 · Trazabilidad HU
          </div>

          <h1 style={styles.title}>
            Captura de HU
          </h1>

          <p style={styles.subtitle}>
            Registro de tarimas, daños y reposiciones
          </p>
        </div>

        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() =>
            navigate(`/historial?folio=${folio.id}`)
          }
        >
          Historial
        </button>
      </div>

      <div style={styles.folioCard}>
        <div>
          <span style={styles.smallLabel}>
            Folio
          </span>

          <strong style={styles.folioValue}>
            {folio.folio}
          </strong>
        </div>

        <div>
          <span style={styles.smallLabel}>
            Fecha
          </span>

          <strong style={styles.infoValue}>
            {folio.fecha}
          </strong>
        </div>

        <div>
          <span style={styles.smallLabel}>
            Cliente
          </span>

          <strong style={styles.infoValue}>
            {folio.cliente}
          </strong>
        </div>

        <div>
          <span style={styles.smallLabel}>
            Producto
          </span>

          <strong style={styles.infoValue}>
            {folio.producto}
          </strong>
        </div>

        <div>
          <span style={styles.smallLabel}>
            Proceso
          </span>

          <strong style={styles.infoValue}>
            {folio.proceso}
          </strong>
        </div>

        <div>
          <span style={styles.smallLabel}>
            Turno
          </span>

          <strong style={styles.infoValue}>
            {folio.turno}
          </strong>
        </div>

        <div>
          <span style={styles.smallLabel}>
            Línea / módulo
          </span>

          <strong style={styles.infoValue}>
            {folio.linea_modulo}
          </strong>
        </div>

        <div>
          <span style={styles.smallLabel}>
            Registros
          </span>

          <strong style={styles.infoValue}>
            {registros?.length ?? 0}
          </strong>
        </div>
      </div>

      {mensajeError && (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {mensajeError}
        </div>
      )}

      {mensajeExito && (
        <div style={styles.successBox}>
          {mensajeExito}
        </div>
      )}

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <span style={styles.sectionNumber}>
              01
            </span>

            <div>
              <h2 style={styles.sectionTitle}>
                Captura de HU
              </h2>

              <p style={styles.sectionDescription}>
                Escanea la HU al entrar al proceso y
                nuevamente al salir.
              </p>
            </div>
          </div>

          <div style={styles.lineBadge}>
            Línea {numeroSiguiente}
          </div>
        </div>

        <div style={styles.captureGrid}>
          <div style={styles.huMainCard}>
            <span style={styles.smallLabel}>
              HU afectada / destino
            </span>

            <div style={styles.huCode}>
              {formulario.codigo_hu || 'Sin escanear'}
            </div>

            <div style={styles.scanButtonRow}>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => {
                  setMensajeError('');
                  setScannerActivo('entrada');
                }}
                disabled={estaCapturando}
              >
                Escanear entrada
              </button>

              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setMensajeError('');
                  setScannerActivo('salida');
                }}
                disabled={!estaCapturando || salidaRegistrada}
              >
                Escanear salida
              </button>
            </div>
          </div>

          <div style={styles.timerCard}>
            <span style={styles.smallLabel}>
              Tiempo en proceso
            </span>

            <strong style={styles.timer}>
              {formatearDuracion(
                salidaRegistrada
                  ? formulario.duracion_ms ?? 0
                  : tiempoEnProceso,
              )}
            </strong>

            <span
              style={{
                ...styles.statusBadge,
                backgroundColor: salidaRegistrada
                  ? '#dcfce7'
                  : estaCapturando
                    ? '#fef3c7'
                    : '#e2e8f0',
                color: salidaRegistrada
                  ? '#166534'
                  : estaCapturando
                    ? '#92400e'
                    : '#475569',
              }}
            >
              {salidaRegistrada
                ? 'Salida registrada'
                : estaCapturando
                  ? 'En proceso'
                  : 'Esperando HU'}
            </span>
          </div>
        </div>

        <div style={styles.timeGrid}>
          <div style={styles.timeBox}>
            <span style={styles.smallLabel}>
              Hora de entrada
            </span>

            <strong>
              {formatearHora(
                formulario.hora_entrada ?? undefined,
              )}
            </strong>
          </div>

          <div style={styles.timeBox}>
            <span style={styles.smallLabel}>
              Hora de salida
            </span>

            <strong>
              {formatearHora(
                formulario.hora_salida ?? undefined,
              )}
            </strong>
          </div>

          <div style={styles.timeBox}>
            <span style={styles.smallLabel}>
              Duración
            </span>

            <strong>
              {formatearDuracion(
                formulario.duracion_ms ?? 0,
              )}
            </strong>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <span style={styles.sectionNumber}>
              02
            </span>

            <div>
              <h2 style={styles.sectionTitle}>
                Daños / PNC
              </h2>

              <p style={styles.sectionDescription}>
                Registra los bricks dañados encontrados
                durante el proceso.
              </p>
            </div>
          </div>

          <span style={styles.optionalBadge}>
            Opcional
          </span>
        </div>

        <div style={styles.formGrid}>
          <label style={styles.field}>
            <span style={styles.label}>
              Cantidad dañada (bricks)
            </span>

            <input
              type="number"
              min="0"
              step="1"
              value={formulario.cantidad_danada}
              onChange={(event) =>
                actualizarCampo(
                  'cantidad_danada',
                  Math.max(
                    0,
                    Number(event.target.value) || 0,
                  ),
                )
              }
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>
              Tipo / causa de daño
            </span>

            <input
              type="text"
              value={formulario.causa_dano}
              onChange={(event) =>
                actualizarCampo(
                  'causa_dano',
                  event.target.value,
                )
              }
              placeholder="Ej. Brick golpeado, empaque roto..."
            />
          </label>
        </div>

        <div style={styles.brickHeader}>
          <div>
            <strong>
              Identificación individual de bricks
            </strong>

            <p style={styles.mutedText}>
              Puedes capturar el código individual de
              cada brick cuando sea necesario.
            </p>
          </div>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => {
              setMostrarBricks((actual) => !actual);

              if (
                !mostrarBricks &&
                bricks.length === 0
              ) {
                agregarBrick();
              }
            }}
          >
            {mostrarBricks
              ? 'Ocultar bricks'
              : 'Agregar bricks'}
          </button>
        </div>

        {mostrarBricks && (
          <div style={styles.bricksContainer}>
            {bricks.map((brick, index) => (
              <div
                key={`${index}-${brick.codigo_brick}`}
                style={styles.brickRow}
              >
                <div style={styles.brickNumber}>
                  {index + 1}
                </div>

                <input
                  type="text"
                  value={brick.codigo_brick}
                  onChange={(event) =>
                    actualizarBrick(
                      index,
                      'codigo_brick',
                      event.target.value,
                    )
                  }
                  placeholder="Código del brick"
                />

                <input
                  type="text"
                  value={brick.causa}
                  onChange={(event) =>
                    actualizarBrick(
                      index,
                      'causa',
                      event.target.value,
                    )
                  }
                  placeholder="Causa"
                />

                <button
                  type="button"
                  style={styles.dangerButton}
                  onClick={() => eliminarBrick(index)}
                  aria-label={`Eliminar brick ${index + 1}`}
                >
                  Eliminar
                </button>
              </div>
            ))}

            <button
              type="button"
              style={styles.addButton}
              onClick={agregarBrick}
            >
              + Agregar otro brick
            </button>
          </div>
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <span style={styles.sectionNumber}>
              03
            </span>

            <div>
              <h2 style={styles.sectionTitle}>
                Reposición de bricks
              </h2>

              <p style={styles.sectionDescription}>
                Registra si la HU afectada recibió
                bricks provenientes de otra HU.
              </p>
            </div>
          </div>
        </div>

        <div style={styles.replacementToggle}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={formulario.se_repuso === 1}
              onChange={(event) =>
                actualizarCampo(
                  'se_repuso',
                  event.target.checked ? 1 : 0,
                )
              }
              style={styles.checkbox}
            />

            <span>
              Sí, se repusieron bricks desde otra HU
            </span>
          </label>
        </div>

        {formulario.se_repuso === 1 && (
          <div style={styles.formGrid}>
            <div style={styles.field}>
              <span style={styles.label}>
                HU origen / donante
              </span>

              <div style={styles.inlineField}>
                <input
                  type="text"
                  value={formulario.hu_donante}
                  onChange={(event) =>
                    actualizarCampo(
                      'hu_donante',
                      event.target.value,
                    )
                  }
                  placeholder="Escanea o captura la HU origen"
                />

                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => {
                    setMensajeError('');
                    setScannerActivo('donante');
                  }}
                >
                  Escanear
                </button>
              </div>
            </div>

            <label style={styles.field}>
              <span style={styles.label}>
                Cantidad tomada de otra HU (bricks)
              </span>

              <input
                type="number"
                min="1"
                step="1"
                value={
                  formulario.cantidad_repuesta
                }
                onChange={(event) =>
                  actualizarCampo(
                    'cantidad_repuesta',
                    Math.max(
                      0,
                      Number(event.target.value) || 0,
                    ),
                  )
                }
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>
                Verificó reposición
              </span>

              <input
                type="text"
                value={
                  formulario.verifico_reposicion
                }
                onChange={(event) =>
                  actualizarCampo(
                    'verifico_reposicion',
                    event.target.value,
                  )
                }
                placeholder="Nombre / iniciales"
              />
            </label>
          </div>
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <span style={styles.sectionNumber}>
              04
            </span>

            <div>
              <h2 style={styles.sectionTitle}>
                Verificación y observaciones
              </h2>

              <p style={styles.sectionDescription}>
                Identifica al responsable de verificar el
                proceso y cualquier observación relevante.
              </p>
            </div>
          </div>
        </div>

        <div style={styles.formGrid}>
          <label style={styles.field}>
            <span style={styles.label}>
              Verificó proceso
            </span>

            <input
              type="text"
              value={formulario.verifico_proceso}
              onChange={(event) =>
                actualizarCampo(
                  'verifico_proceso',
                  event.target.value,
                )
              }
              placeholder="Nombre / iniciales"
            />
          </label>

          <label
            style={{
              ...styles.field,
              gridColumn: '1 / -1',
            }}
          >
            <span style={styles.label}>
              Observaciones
            </span>

            <textarea
              rows={3}
              value={formulario.observaciones}
              onChange={(event) =>
                actualizarCampo(
                  'observaciones',
                  event.target.value,
                )
              }
              placeholder="Observaciones del proceso, daño, reposición o trazabilidad..."
            />
          </label>
        </div>
      </section>

      <section style={styles.actionCard}>
        <div>
          <span style={styles.smallLabel}>
            Estado del registro
          </span>

          <strong style={styles.actionStatus}>
            {!estaCapturando
              ? 'Esperando escaneo de entrada'
              : !salidaRegistrada
                ? 'HU en proceso'
                : formulario.cantidad_danada > 0
                  ? 'Completado con daño'
                  : 'Listo para guardar'}
          </strong>
        </div>

        <div style={styles.actionButtons}>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={cancelarCaptura}
            disabled={
              guardando ||
              (!formulario.codigo_hu &&
                !formulario.hora_entrada)
            }
          >
            Cancelar captura
          </button>

          <button
            type="button"
            style={styles.primaryButton}
            onClick={guardarRegistro}
            disabled={
              guardando ||
              !formulario.hora_entrada ||
              !formulario.hora_salida
            }
          >
            {guardando
              ? 'Guardando...'
              : `Guardar registro ${numeroSiguiente}`}
          </button>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <span style={styles.sectionNumber}>
              05
            </span>

            <div>
              <h2 style={styles.sectionTitle}>
                Registros capturados
              </h2>

              <p style={styles.sectionDescription}>
                Historial de HUs registradas dentro de este
                folio.
              </p>
            </div>
          </div>
        </div>

        {!registros || registros.length === 0 ? (
          <div style={styles.emptyState}>
            Todavía no hay registros capturados en este
            folio.
          </div>
        ) : (
          <div className="table-container">
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>No.</th>
                  <th style={styles.th}>HU</th>
                  <th style={styles.th}>
                    Entrada
                  </th>
                  <th style={styles.th}>Salida</th>
                  <th style={styles.th}>
                    Duración
                  </th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>
                    Daño
                  </th>
                  <th style={styles.th}>
                    Reposición
                  </th>
                  <th style={styles.th}>
                    HU origen
                  </th>
                  <th style={styles.th}>
                    Cant. repuesta
                  </th>
                  <th style={styles.th}>
                    Verificó
                  </th>
                </tr>
              </thead>

              <tbody>
                {registros.map((registro) => (
                  <tr key={registro.id}>
                    <td style={styles.td}>
                      {registro.numero_linea}
                    </td>

                    <td
                      style={{
                        ...styles.td,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {registro.codigo_hu}
                    </td>

                    <td style={styles.td}>
                      {formatearHora(
                        registro.hora_entrada,
                      )}
                    </td>

                    <td style={styles.td}>
                      {formatearHora(
                        registro.hora_salida,
                      )}
                    </td>

                    <td style={styles.td}>
                      {formatearDuracion(
                        registro.duracion_ms,
                      )}
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.tableStatus,
                          backgroundColor:
                            registro.estado ===
                            'Con daño'
                              ? '#fee2e2'
                              : '#dcfce7',
                          color:
                            registro.estado ===
                            'Con daño'
                              ? '#991b1b'
                              : '#166534',
                        }}
                      >
                        {registro.estado}
                      </span>
                    </td>

                    <td style={styles.td}>
                      {registro.cantidad_danada}
                    </td>

                    <td style={styles.td}>
                      {registro.se_repuso === 1
                        ? 'Sí'
                        : 'No'}
                    </td>

                    <td style={styles.td}>
                      {registro.hu_donante || '--'}
                    </td>

                    <td style={styles.td}>
                      {registro.cantidad_repuesta}
                    </td>

                    <td style={styles.td}>
                      {registro.verifico_proceso ||
                        '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div style={styles.footerInfo}>
        <span>
          Bill Pack · REG-INO-013 · Versión 01
        </span>

        <span>
          Trazabilidad local activa · Sincronización:
          pendiente
        </span>
      </div>

      {scannerActivo && (
        <div style={styles.modalOverlay}>
          <div style={styles.scannerModal}>
            <div style={styles.modalHeader}>
              <div>
                <span style={styles.smallLabel}>
                  Escáner
                </span>

                <h2 style={styles.modalTitle}>
                  {scannerActivo === 'entrada'
                    ? 'Escanear HU de entrada'
                    : scannerActivo === 'donante'
                      ? 'Escanear HU origen'
                      : 'Escanear HU de salida'}
                </h2>
              </div>

              <button
                type="button"
                style={styles.closeButton}
                onClick={() => setScannerActivo(null)}
              >
                ×
              </button>
            </div>

            <Scanner
              onScan={manejarEscaneo}
              onClose={() => setScannerActivo(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '20px',
    background: '#f4f6f8',
  },

  header: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
  },

  documentLabel: {
    color: '#0b5d3b',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },

  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: '28px',
    lineHeight: 1.15,
  },

  subtitle: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: '14px',
  },

  folioCard: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto 18px',
    padding: '16px',
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '14px',
    background: '#ffffff',
    border: '1px solid #dbe3ea',
    borderRadius: '12px',
    boxShadow:
      '0 2px 8px rgba(15, 23, 42, 0.05)',
  },

  smallLabel: {
    display: 'block',
    marginBottom: '5px',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  folioValue: {
    display: 'block',
    color: '#0b5d3b',
    fontSize: '16px',
  },

  infoValue: {
    display: 'block',
    color: '#1e293b',
    fontSize: '14px',
  },

  card: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto 18px',
    padding: '18px',
    background: '#ffffff',
    border: '1px solid #dbe3ea',
    borderRadius: '12px',
    boxShadow:
      '0 2px 8px rgba(15, 23, 42, 0.05)',
  },

  loadingCard: {
    width: '100%',
    maxWidth: '600px',
    margin: '80px auto',
    padding: '30px',
    textAlign: 'center',
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #dbe3ea',
    color: '#475569',
  },

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '18px',
  },

  sectionNumber: {
    flex: '0 0 auto',
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    background: '#0b5d3b',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 800,
  },

  sectionTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '18px',
  },

  sectionDescription: {
    margin: '4px 0 0',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.45,
  },

  lineBadge: {
    padding: '7px 11px',
    borderRadius: '999px',
    background: '#ecfdf5',
    color: '#047857',
    fontSize: '12px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },

  optionalBadge: {
    padding: '6px 10px',
    borderRadius: '999px',
    background: '#f1f5f9',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },

  captureGrid: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(0, 1.7fr) minmax(220px, 0.8fr)',
    gap: '14px',
  },

  huMainCard: {
    padding: '18px',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    background: '#f8fafc',
  },

  huCode: {
    minHeight: '62px',
    display: 'flex',
    alignItems: 'center',
    padding: '10px 0',
    color: '#0f172a',
    fontSize: '24px',
    fontWeight: 800,
    wordBreak: 'break-all',
  },

  scanButtonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '8px',
  },

  timerCard: {
    minHeight: '150px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    border: '1px solid #bbf7d0',
    borderRadius: '10px',
    background: '#f0fdf4',
    textAlign: 'center',
  },

  timer: {
    display: 'block',
    margin: '5px 0 12px',
    color: '#166534',
    fontSize: '30px',
    letterSpacing: '0.04em',
  },

  statusBadge: {
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 800,
  },

  timeGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
    marginTop: '14px',
  },

  timeBox: {
    padding: '12px',
    borderRadius: '8px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },

  label: {
    color: '#334155',
    fontSize: '13px',
    fontWeight: 700,
  },

  inlineField: {
    display: 'flex',
    gap: '8px',
    alignItems: 'stretch',
  },

  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#1e293b',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  checkbox: {
    width: '20px',
    height: '20px',
    margin: 0,
    accentColor: '#0b5d3b',
  },

  replacementToggle: {
    marginBottom: '16px',
    padding: '13px',
    borderRadius: '9px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
  },

  brickHeader: {
    marginTop: '18px',
    paddingTop: '16px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },

  mutedText: {
    margin: '4px 0 0',
    color: '#64748b',
    fontSize: '12px',
  },

  bricksContainer: {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  brickRow: {
    display: 'grid',
    gridTemplateColumns:
      '34px minmax(150px, 1fr) minmax(150px, 1fr) auto',
    gap: '8px',
    alignItems: 'center',
  },

  brickNumber: {
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    background: '#e2e8f0',
    color: '#475569',
    fontSize: '12px',
    fontWeight: 800,
  },

  addButton: {
    alignSelf: 'flex-start',
    marginTop: '5px',
    padding: '9px 12px',
    border: '1px dashed #94a3b8',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#475569',
    fontWeight: 700,
  },

  actionCard: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto 18px',
    padding: '18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    background: '#0f172a',
    borderRadius: '12px',
    color: '#ffffff',
    boxShadow:
      '0 4px 14px rgba(15, 23, 42, 0.16)',
  },

  actionStatus: {
    display: 'block',
    fontSize: '16px',
  },

  actionButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: '10px',
  },

  primaryButton: {
    minHeight: '42px',
    padding: '10px 15px',
    border: '1px solid #0b5d3b',
    borderRadius: '8px',
    background: '#0b5d3b',
    color: '#ffffff',
    fontWeight: 800,
    boxShadow:
      '0 2px 4px rgba(11, 93, 59, 0.15)',
  },

  secondaryButton: {
    minHeight: '42px',
    padding: '10px 15px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#334155',
    fontWeight: 700,
  },

  dangerButton: {
    minHeight: '40px',
    padding: '8px 11px',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    background: '#fef2f2',
    color: '#b91c1c',
    fontWeight: 700,
  },

  errorBox: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto 12px',
    padding: '12px 14px',
    borderRadius: '9px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: '14px',
  },

  successBox: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto 12px',
    padding: '12px 14px',
    borderRadius: '9px',
    border: '1px solid #bbf7d0',
    background: '#f0fdf4',
    color: '#166534',
    fontSize: '14px',
  },

  emptyState: {
    padding: '30px 20px',
    border: '1px dashed #cbd5e1',
    borderRadius: '9px',
    background: '#f8fafc',
    color: '#64748b',
    textAlign: 'center',
    fontSize: '14px',
  },

  table: {
    width: '100%',
    minWidth: '1050px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
  },

  th: {
    padding: '10px 9px',
    border: '1px solid #cbd5e1',
    background: '#f1f5f9',
    color: '#334155',
    fontSize: '11px',
    fontWeight: 800,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },

  td: {
    padding: '9px',
    border: '1px solid #e2e8f0',
    color: '#475569',
    fontSize: '12px',
    verticalAlign: 'middle',
  },

  tableStatus: {
    display: 'inline-block',
    padding: '4px 7px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },

  footerInfo: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '4px 2px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    color: '#94a3b8',
    fontSize: '11px',
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    padding: '20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'rgba(15, 23, 42, 0.72)',
  },

  scannerModal: {
    width: '100%',
    maxWidth: '520px',
    maxHeight: 'calc(100vh - 40px)',
    overflowY: 'auto',
    padding: '18px',
    borderRadius: '14px',
    background: '#ffffff',
    boxShadow:
      '0 20px 60px rgba(15, 23, 42, 0.35)',
  },

  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '12px',
  },

  modalTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '20px',
  },

  closeButton: {
    width: '38px',
    height: '38px',
    padding: 0,
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#475569',
    fontSize: '26px',
    lineHeight: 1,
  },
};
