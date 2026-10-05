import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate } from 'react-router-dom';

import { db } from '../db/database';
import type { FiltroHistorial, Folio } from '../types';

function obtenerFechaActual(): string {
  const ahora = new Date();

  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

function formatearFechaHora(timestamp: number): string {
  return new Date(timestamp).toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function calcularResumen(
  folio: Folio,
  registros: Array<{
    cantidad_danada: number;
    cantidad_repuesta: number;
    se_repuso: 0 | 1;
  }>,
) {
  const totalDaniados = registros.reduce(
    (total, registro) =>
      total + Number(registro.cantidad_danada || 0),
    0,
  );

  const totalRepuestos = registros.reduce(
    (total, registro) =>
      total + Number(registro.cantidad_repuesta || 0),
    0,
  );

  const totalHUs = registros.length;

  const hUsConDanio = registros.filter(
    (registro) => registro.cantidad_danada > 0,
  ).length;

  const hUsConReposicion = registros.filter(
    (registro) => registro.se_repuso === 1,
  ).length;

  return {
    folio: folio.folio,
    cliente: folio.cliente,
    producto: folio.producto,
    fecha: folio.fecha,
    totalHUs,
    totalDaniados,
    totalRepuestos,
    hUsConDanio,
    hUsConReposicion,
  };
}

export default function Historial() {
  const navigate = useNavigate();
  const location = useLocation();

  const parametros = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const folioInicial = Number(
    parametros.get('folio') || '',
  );

  const [filtros, setFiltros] =
    useState<FiltroHistorial>(() => ({
      fecha_desde: '',
      fecha_hasta: '',
      cliente: '',
    }));

  const [folioSeleccionado, setFolioSeleccionado] =
    useState<number | null>(
      Number.isFinite(folioInicial)
        ? folioInicial
        : null,
    );

  const [mostrarDetalle, setMostrarDetalle] =
    useState(false);

  const [mensaje, setMensaje] = useState('');
  const [mensajeError, setMensajeError] =
    useState('');

  const [cargandoExportacion, setCargandoExportacion] =
    useState(false);

  const folios = useLiveQuery(
    () =>
      db.folios
        .orderBy('created_at')
        .reverse()
        .toArray(),
    [],
  );

  const registros = useLiveQuery(
    async () => {
      if (
        folioSeleccionado === null ||
        !Number.isFinite(folioSeleccionado)
      ) {
        return [];
      }

      return db.registros
        .where('folio_id')
        .equals(folioSeleccionado)
        .sortBy('numero_linea');
    },
    [folioSeleccionado],
  );

  const bricks = useLiveQuery(
    async () => {
      if (
        folioSeleccionado === null ||
        !Number.isFinite(folioSeleccionado)
      ) {
        return [];
      }

      const registrosDelFolio = await db.registros
        .where('folio_id')
        .equals(folioSeleccionado)
        .toArray();

      if (registrosDelFolio.length === 0) {
        return [];
      }

      const ids = registrosDelFolio
        .map((registro) => registro.id)
        .filter(
          (registroId): registroId is number =>
            registroId !== undefined,
        );

      if (ids.length === 0) {
        return [];
      }

      const resultado = [];

      for (const registroId of ids) {
        const bricksRegistro = await db.bricks
          .where('registro_hu_id')
          .equals(registroId)
          .toArray();

        resultado.push(...bricksRegistro);
      }

      return resultado;
    },
    [folioSeleccionado],
  );

  useEffect(() => {
    if (!mensaje && !mensajeError) {
      return;
    }

    const temporizador = window.setTimeout(() => {
      setMensaje('');
      setMensajeError('');
    }, 5000);

    return () => {
      window.clearTimeout(temporizador);
    };
  }, [mensaje, mensajeError]);

  const clientes = useMemo(() => {
    if (!folios) {
      return [];
    }

    return Array.from(
      new Set(
        folios
          .map((folio) => folio.cliente.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [folios]);

  const foliosFiltrados = useMemo(() => {
    if (!folios) {
      return [];
    }

    return folios.filter((folio) => {
      const coincideDesde =
        !filtros.fecha_desde ||
        folio.fecha >= filtros.fecha_desde;

      const coincideHasta =
        !filtros.fecha_hasta ||
        folio.fecha <= filtros.fecha_hasta;

      const clienteBuscado =
        filtros.cliente.trim().toLowerCase();

      const coincideCliente =
        !clienteBuscado ||
        folio.cliente
          .toLowerCase()
          .includes(clienteBuscado);

      return (
        coincideDesde &&
        coincideHasta &&
        coincideCliente
      );
    });
  }, [folios, filtros]);

  const folioActual = useMemo(() => {
    if (
      folioSeleccionado === null ||
      !folios
    ) {
      return undefined;
    }

    return folios.find(
      (folio) => folio.id === folioSeleccionado,
    );
  }, [folios, folioSeleccionado]);

  const resumen = useMemo(() => {
    if (!folioActual || !registros) {
      return null;
    }

    return calcularResumen(
      folioActual,
      registros,
    );
  }, [folioActual, registros]);

  const actualizarFiltro = <
    K extends keyof FiltroHistorial,
  >(
    campo: K,
    valor: FiltroHistorial[K],
  ) => {
    setFiltros((actuales) => ({
      ...actuales,
      [campo]: valor,
    }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      fecha_desde: '',
      fecha_hasta: '',
      cliente: '',
    });
  };

  const seleccionarFolio = (folioId: number) => {
    setFolioSeleccionado(folioId);
    setMostrarDetalle(true);
  };

  const regresarInicio = () => {
    navigate('/');
  };

  const abrirCaptura = () => {
    if (folioSeleccionado === null) {
      setMensajeError(
        'Selecciona un folio antes de abrir la captura.',
      );
      return;
    }

    navigate(`/captura/${folioSeleccionado}`);
  };

  const exportarExcel = async () => {
    if (folioSeleccionado === null) {
      setMensajeError(
        'Selecciona un folio para exportar.',
      );
      return;
    }

    setCargandoExportacion(true);
    setMensaje('');
    setMensajeError('');

    try {
      const modulo = await import('../export/excel');

      if (
        typeof modulo.exportarFolioAExcel !==
        'function'
      ) {
        throw new Error(
          'No se encontró la función exportarFolioAExcel.',
        );
      }

      await modulo.exportarFolioAExcel(
        folioSeleccionado,
      );

      setMensaje(
        'El archivo Excel se generó correctamente.',
      );
    } catch (error) {
      console.error(
        'Error al exportar Excel:',
        error,
      );

      setMensajeError(
        'No fue posible generar el archivo Excel.',
      );
    } finally {
      setCargandoExportacion(false);
    }
  };

  const compartirFolio = async () => {
    if (!folioActual) {
      setMensajeError(
        'Selecciona un folio antes de compartir.',
      );
      return;
    }

    const texto =
      `Trazabilidad HU - Bill Pack\n\n` +
      `Folio: ${folioActual.folio}\n` +
      `Fecha: ${folioActual.fecha}\n` +
      `Cliente: ${folioActual.cliente}\n` +
      `Producto: ${folioActual.producto}\n` +
      `Proceso: ${folioActual.proceso}\n` +
      `Turno: ${folioActual.turno}\n` +
      `HUs registradas: ${resumen?.totalHUs ?? 0}\n` +
      `Bricks dañados: ${resumen?.totalDaniados ?? 0}\n` +
      `Bricks repuestos: ${resumen?.totalRepuestos ?? 0}`;

    try {
      if (
        navigator.share &&
        typeof navigator.share === 'function'
      ) {
        await navigator.share({
          title: `Trazabilidad HU - ${folioActual.folio}`,
          text: texto,
        });

        setMensaje('Folio compartido correctamente.');
        return;
      }

      await navigator.clipboard.writeText(texto);

      setMensaje(
        'El resumen fue copiado al portapapeles.',
      );
    } catch (error) {
      console.error(
        'Error al compartir folio:',
        error,
      );

      setMensajeError(
        'No fue posible compartir el folio.',
      );
    }
  };

  const exportarTodosLosFolios = async () => {
    if (foliosFiltrados.length === 0) {
      setMensajeError(
        'No hay folios que coincidan con los filtros.',
      );
      return;
    }

    setCargandoExportacion(true);
    setMensaje('');
    setMensajeError('');

    try {
      const modulo = await import('../export/excel');

      if (
        typeof modulo.exportarFoliosAExcel !==
        'function'
      ) {
        throw new Error(
          'No se encontró la función exportarFoliosAExcel.',
        );
      }

      await modulo.exportarFoliosAExcel(
        foliosFiltrados.map((folio) => folio.id!),
      );

      setMensaje(
        'Los folios filtrados se exportaron correctamente.',
      );
    } catch (error) {
      console.error(
        'Error al exportar folios:',
        error,
      );

      setMensajeError(
        'No fue posible exportar los folios filtrados.',
      );
    } finally {
      setCargandoExportacion(false);
    }
  };

  if (!folios) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>
          Cargando historial...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.documentLabel}>
            REG-INO-013 · Bill Pack
          </div>

          <h1 style={styles.title}>
            Historial de Trazabilidad HU
          </h1>

          <p style={styles.subtitle}>
            Consulta, revisión y exportación de folios
            registrados localmente.
          </p>
        </div>

        <button
          type="button"
          style={styles.primaryButton}
          onClick={regresarInicio}
        >
          Inicio
        </button>
      </header>

      {mensaje && (
        <div style={styles.successBox}>
          {mensaje}
        </div>
      )}

      {mensajeError && (
        <div style={styles.errorBox}>
          {mensajeError}
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
                Filtros de búsqueda
              </h2>

              <p style={styles.sectionDescription}>
                Filtra los folios por fecha o cliente.
              </p>
            </div>
          </div>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={limpiarFiltros}
          >
            Limpiar filtros
          </button>
        </div>

        <div style={styles.filterGrid}>
          <label style={styles.field}>
            <span style={styles.label}>
              Fecha desde
            </span>

            <input
              type="date"
              value={filtros.fecha_desde}
              onChange={(event) =>
                actualizarFiltro(
                  'fecha_desde',
                  event.target.value,
                )
              }
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>
              Fecha hasta
            </span>

            <input
              type="date"
              value={filtros.fecha_hasta}
              onChange={(event) =>
                actualizarFiltro(
                  'fecha_hasta',
                  event.target.value,
                )
              }
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>
              Cliente
            </span>

            <select
              value={filtros.cliente}
              onChange={(event) =>
                actualizarFiltro(
                  'cliente',
                  event.target.value,
                )
              }
            >
              <option value="">
                Todos los clientes
              </option>

              {clientes.map((cliente) => (
                <option
                  key={cliente}
                  value={cliente}
                >
                  {cliente}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={styles.filterSummary}>
          <strong>
            {foliosFiltrados.length}
          </strong>{' '}
          folio(s) encontrado(s)
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
                Folios registrados
              </h2>

              <p style={styles.sectionDescription}>
                Selecciona un folio para consultar su
                trazabilidad.
              </p>
            </div>
          </div>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={exportarTodosLosFolios}
            disabled={
              cargandoExportacion ||
              foliosFiltrados.length === 0
            }
          >
            {cargandoExportacion
              ? 'Exportando...'
              : 'Exportar filtrados'}
          </button>
        </div>

        {foliosFiltrados.length === 0 ? (
          <div style={styles.emptyState}>
            No existen folios que coincidan con los
            filtros seleccionados.
          </div>
        ) : (
          <div className="table-container">
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>
                    Folio
                  </th>

                  <th style={styles.th}>
                    Fecha
                  </th>

                  <th style={styles.th}>
                    Cliente
                  </th>

                  <th style={styles.th}>
                    Producto
                  </th>

                  <th style={styles.th}>
                    Proceso
                  </th>

                  <th style={styles.th}>
                    Turno
                  </th>

                  <th style={styles.th}>
                    Línea / módulo
                  </th>

                  <th style={styles.th}>
                    Estado
                  </th>

                  <th style={styles.th}>
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody>
                {foliosFiltrados.map((folio) => {
                  const seleccionado =
                    folio.id ===
                    folioSeleccionado;

                  return (
                    <tr
                      key={folio.id}
                      style={
                        seleccionado
                          ? styles.selectedRow
                          : undefined
                      }
                    >
                      <td style={styles.td}>
                        <strong>
                          {folio.folio}
                        </strong>
                      </td>

                      <td style={styles.td}>
                        {folio.fecha}
                      </td>

                      <td style={styles.td}>
                        {folio.cliente}
                      </td>

                      <td style={styles.td}>
                        {folio.producto}
                      </td>

                      <td style={styles.td}>
                        {folio.proceso}
                      </td>

                      <td style={styles.td}>
                        {folio.turno}
                      </td>

                      <td style={styles.td}>
                        {folio.linea_modulo}
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.syncBadge,
                            backgroundColor:
                              folio.sync_status ===
                              'synced'
                                ? '#dcfce7'
                                : '#fef3c7',
                            color:
                              folio.sync_status ===
                              'synced'
                                ? '#166534'
                                : '#92400e',
                          }}
                        >
                          {folio.sync_status ===
                          'synced'
                            ? 'Sincronizado'
                            : 'Pendiente'}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <button
                          type="button"
                          style={
                            seleccionado
                              ? styles.primarySmallButton
                              : styles.secondarySmallButton
                          }
                          onClick={() =>
                            seleccionarFolio(
                              folio.id!,
                            )
                          }
                        >
                          {seleccionado
                            ? 'Seleccionado'
                            : 'Ver detalle'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mostrarDetalle && folioActual && (
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <span style={styles.sectionNumber}>
                03
              </span>

              <div>
                <h2 style={styles.sectionTitle}>
                  Detalle del folio
                </h2>

                <p style={styles.sectionDescription}>
                  {folioActual.folio} ·{' '}
                  {folioActual.cliente}
                </p>
              </div>
            </div>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() =>
                setMostrarDetalle(false)
              }
            >
              Ocultar
            </button>
          </div>

          <div style={styles.detailGrid}>
            <div style={styles.detailItem}>
              <span style={styles.smallLabel}>
                Folio
              </span>

              <strong>
                {folioActual.folio}
              </strong>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.smallLabel}>
                Fecha
              </span>

              <strong>
                {folioActual.fecha}
              </strong>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.smallLabel}>
                Área
              </span>

              <strong>
                {folioActual.area}
              </strong>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.smallLabel}>
                Cliente
              </span>

              <strong>
                {folioActual.cliente}
              </strong>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.smallLabel}>
                Producto
              </span>

              <strong>
                {folioActual.producto}
              </strong>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.smallLabel}>
                Proceso
              </span>

              <strong>
                {folioActual.proceso}
              </strong>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.smallLabel}>
                Turno
              </span>

              <strong>
                {folioActual.turno}
              </strong>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.smallLabel}>
                Encargado de línea
              </span>

              <strong>
                {folioActual.encargado_linea}
              </strong>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.smallLabel}>
                Línea / módulo
              </span>

              <strong>
                {folioActual.linea_modulo}
              </strong>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.smallLabel}>
                Supervisor
              </span>

              <strong>
                {folioActual.supervisor}
              </strong>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.smallLabel}>
                Inspector QA
              </span>

              <strong>
                {folioActual.inspector_qa}
              </strong>
            </div>

            <div style={styles.detailItem}>
              <span style={styles.smallLabel}>
                Última actualización
              </span>

              <strong>
                {formatearFechaHora(
                  folioActual.updated_at,
                )}
              </strong>
            </div>
          </div>

          {resumen && (
            <div style={styles.summaryGrid}>
              <div style={styles.summaryCard}>
                <span style={styles.summaryNumber}>
                  {resumen.totalHUs}
                </span>

                <span style={styles.summaryLabel}>
                  HUs registradas
                </span>
              </div>

              <div style={styles.summaryCard}>
                <span style={styles.summaryNumber}>
                  {resumen.totalDaniados}
                </span>

                <span style={styles.summaryLabel}>
                  Bricks dañados
                </span>
              </div>

              <div style={styles.summaryCard}>
                <span style={styles.summaryNumber}>
                  {resumen.totalRepuestos}
                </span>

                <span style={styles.summaryLabel}>
                  Bricks repuestos
                </span>
              </div>

              <div style={styles.summaryCard}>
                <span style={styles.summaryNumber}>
                  {resumen.hUsConDanio}
                </span>

                <span style={styles.summaryLabel}>
                  HUs con daño
                </span>
              </div>

              <div style={styles.summaryCard}>
                <span style={styles.summaryNumber}>
                  {resumen.hUsConReposicion}
                </span>

                <span style={styles.summaryLabel}>
                  HUs con reposición
                </span>
              </div>

              <div style={styles.summaryCard}>
                <span style={styles.summaryNumber}>
                  {bricks?.length ?? 0}
                </span>

                <span style={styles.summaryLabel}>
                  Bricks identificados
                </span>
              </div>
            </div>
          )}

          <div style={styles.detailActions}>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={abrirCaptura}
            >
              Abrir captura de HU
            </button>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={exportarExcel}
              disabled={cargandoExportacion}
            >
              {cargandoExportacion
                ? 'Generando Excel...'
                : 'Exportar Excel'}
            </button>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={compartirFolio}
            >
              Compartir resumen
            </button>
          </div>
        </section>
      )}

      {folioActual &&
        mostrarDetalle &&
        registros &&
        registros.length > 0 && (
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <span style={styles.sectionNumber}>
                  04
                </span>

                <div>
                  <h2 style={styles.sectionTitle}>
                    Trazabilidad de HUs
                  </h2>

                  <p style={styles.sectionDescription}>
                    Relación entre HU afectada, HU origen,
                    daños y reposiciones.
                  </p>
                </div>
              </div>
            </div>

            <div className="table-container">
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>
                      No.
                    </th>

                    <th style={styles.th}>
                      HU afectada / destino
                    </th>

                    <th style={styles.th}>
                      Entrada
                    </th>

                    <th style={styles.th}>
                      Salida
                    </th>

                    <th style={styles.th}>
                      Estado
                    </th>

                    <th style={styles.th}>
                      Daño
                    </th>

                    <th style={styles.th}>
                      Causa
                    </th>

                    <th style={styles.th}>
                      ¿Se repuso?
                    </th>

                    <th style={styles.th}>
                      HU origen
                    </th>

                    <th style={styles.th}>
                      Cantidad tomada
                    </th>

                    <th style={styles.th}>
                      Verificó reposición
                    </th>

                    <th style={styles.th}>
                      Observaciones
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
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {registro.codigo_hu}
                      </td>

                      <td style={styles.td}>
                        {formatearFechaHora(
                          registro.hora_entrada,
                        )}
                      </td>

                      <td style={styles.td}>
                        {registro.hora_salida
                          ? formatearFechaHora(
                              registro.hora_salida,
                            )
                          : '--'}
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.syncBadge,
                            backgroundColor:
                              registro.estado ===
                              'Con daño'
                                ? '#fee2e2'
                                : registro.estado ===
                                    'Completado'
                                  ? '#dcfce7'
                                  : '#fef3c7',
                            color:
                              registro.estado ===
                              'Con daño'
                                ? '#991b1b'
                                : registro.estado ===
                                    'Completado'
                                  ? '#166534'
                                  : '#92400e',
                          }}
                        >
                          {registro.estado}
                        </span>
                      </td>

                      <td style={styles.td}>
                        {registro.cantidad_danada}
                      </td>

                      <td style={styles.td}>
                        {registro.causa_dano ||
                          '--'}
                      </td>

                      <td style={styles.td}>
                        {registro.se_repuso === 1
                          ? 'Sí'
                          : 'No'}
                      </td>

                      <td style={styles.td}>
                        {registro.hu_donante ||
                          '--'}
                      </td>

                      <td style={styles.td}>
                        {registro.cantidad_repuesta}
                      </td>

                      <td style={styles.td}>
                        {registro.verifico_reposicion ||
                          '--'}
                      </td>

                      <td style={styles.td}>
                        {registro.observaciones ||
                          '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={styles.traceabilityNote}>
              <strong>
                Flujo de trazabilidad:
              </strong>{' '}
              HU afectada / destino (HU.C) ← cantidad
              tomada (HU.B) ← HU origen (HU.A).
            </div>
          </section>
        )}

      <footer style={styles.footer}>
        <span>
          Bill Pack · Control de Tarimas y HU en Proceso
        </span>

        <span>
          REG-INO-013 · Versión 01
        </span>

        <span>
          {obtenerFechaActual()}
        </span>
      </footer>
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

  filterGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(200px, 1fr))',
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

  filterSummary: {
    marginTop: '14px',
    padding: '10px 12px',
    borderRadius: '8px',
    background: '#f8fafc',
    color: '#475569',
    fontSize: '13px',
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

  selectedRow: {
    background: '#f0fdf4',
  },

  syncBadge: {
    display: 'inline-block',
    padding: '4px 7px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
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

  primarySmallButton: {
    minHeight: '34px',
    padding: '7px 10px',
    border: '1px solid #0b5d3b',
    borderRadius: '7px',
    background: '#0b5d3b',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 800,
  },

  secondarySmallButton: {
    minHeight: '34px',
    padding: '7px 10px',
    border: '1px solid #cbd5e1',
    borderRadius: '7px',
    background: '#ffffff',
    color: '#334155',
    fontSize: '12px',
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

  detailGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
  },

  detailItem: {
    padding: '12px',
    borderRadius: '8px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#1e293b',
    fontSize: '13px',
  },

  summaryGrid: {
    marginTop: '16px',
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '10px',
  },

  summaryCard: {
    padding: '15px',
    borderRadius: '9px',
    border: '1px solid #dbe3ea',
    background: '#ffffff',
    textAlign: 'center',
  },

  summaryNumber: {
    display: 'block',
    color: '#0b5d3b',
    fontSize: '26px',
    fontWeight: 800,
  },

  summaryLabel: {
    display: 'block',
    marginTop: '4px',
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 700,
  },

  detailActions: {
    marginTop: '18px',
    paddingTop: '16px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },

  traceabilityNote: {
    marginTop: '14px',
    padding: '12px 14px',
    borderRadius: '8px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
    fontSize: '13px',
    lineHeight: 1.5,
  },

  footer: {
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
};