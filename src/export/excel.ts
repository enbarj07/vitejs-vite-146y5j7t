import * as XLSX from 'xlsx';
import { db, obtenerBricksDeRegistro } from '../db/database';
import type { Brick, Folio, RegistroHU } from '../types';
import { DATOS_DOCUMENTO } from '../types';

interface RegistroExportacion extends RegistroHU {
  bricks: Brick[];
}

interface DatosFolioExportacion {
  folio: Folio;
  registros: RegistroExportacion[];
}

const NOMBRE_HOJA_PRINCIPAL = 'REG-INO-013';
const NOMBRE_HOJA_RESUMEN = 'Resumen';
const NOMBRE_HOJA_BRICKS = 'Bricks';

const COLUMNAS_TABLA = [
  'No.',
  'HU',
  'Hora entrada',
  'Hora salida',
  'Estado',
  'Verificó proceso',
  'Cant. dañada (bricks)',
  'Tipo / causa de daño',
  '¿Se repuso?',
  'HU origen',
  'Cant. tomada de otra HU (bricks)',
  'Verificó reposición',
  'Observaciones',
];

const NOTA_TRAZABILIDAD =
  'Flujo de trazabilidad: HU afectada / destino (HU.C) ← cantidad tomada (HU. B) ← HU origen (HU. A). Si un brick se daña, complete cantidad, si hubo reposición, registre también origen, cantidad, verificación y folio.';

export async function exportarFolioAExcel(
  folioId: number,
): Promise<void> {
  const datos = await obtenerDatosFolio(folioId);

  if (!datos) {
    throw new Error(
      `No se encontró el folio con ID ${folioId}.`,
    );
  }

  const workbook = XLSX.utils.book_new();

  const hojaPrincipal = crearHojaFolio(datos);

  XLSX.utils.book_append_sheet(
    workbook,
    hojaPrincipal,
    NOMBRE_HOJA_PRINCIPAL,
  );

  const hojaBricks = crearHojaBricks([datos]);

  if (hojaBricks) {
    XLSX.utils.book_append_sheet(
      workbook,
      hojaBricks,
      NOMBRE_HOJA_BRICKS,
    );
  }

  const nombreArchivo = construirNombreArchivo(
    datos.folio.folio,
  );

  XLSX.writeFile(workbook, nombreArchivo);
}

export async function exportarFoliosAExcel(
  folioIds: number[],
): Promise<void> {
  const idsUnicos = Array.from(
    new Set(
      folioIds.filter(
        (id): id is number =>
          Number.isInteger(id) && id > 0,
      ),
    ),
  );

  if (idsUnicos.length === 0) {
    throw new Error(
      'No se seleccionaron folios para exportar.',
    );
  }

  const resultados =
    await Promise.all(
      idsUnicos.map((id) =>
        obtenerDatosFolio(id),
      ),
    );

  const datosFolios = resultados.filter(
    (
      datos,
    ): datos is DatosFolioExportacion =>
      datos !== null,
  );

  if (datosFolios.length === 0) {
    throw new Error(
      'No se encontraron los folios seleccionados.',
    );
  }

  const workbook = XLSX.utils.book_new();

  if (datosFolios.length === 1) {
    const datos = datosFolios[0];

    const hojaPrincipal =
      crearHojaFolio(datos);

    XLSX.utils.book_append_sheet(
      workbook,
      hojaPrincipal,
      NOMBRE_HOJA_PRINCIPAL,
    );

    const hojaBricks =
      crearHojaBricks(datosFolios);

    if (hojaBricks) {
      XLSX.utils.book_append_sheet(
        workbook,
        hojaBricks,
        NOMBRE_HOJA_BRICKS,
      );
    }

    const nombreArchivo =
      construirNombreArchivo(
        datos.folio.folio,
      );

    XLSX.writeFile(
      workbook,
      nombreArchivo,
    );

    return;
  }

  const hojaResumen =
    crearHojaResumen(datosFolios);

  XLSX.utils.book_append_sheet(
    workbook,
    hojaResumen,
    NOMBRE_HOJA_RESUMEN,
  );

  const nombresHojas = new Set<string>();

  for (const datos of datosFolios) {
    const nombreBase =
      limpiarNombreHoja(
        datos.folio.folio,
      );

    const nombreHoja =
      obtenerNombreHojaUnico(
        nombreBase,
        nombresHojas,
      );

    nombresHojas.add(nombreHoja);

    const hoja =
      crearHojaFolio(datos);

    XLSX.utils.book_append_sheet(
      workbook,
      hoja,
      nombreHoja,
    );
  }

  const hojaBricks =
    crearHojaBricks(datosFolios);

  if (hojaBricks) {
    const nombreHojaBricks =
      obtenerNombreHojaUnico(
        NOMBRE_HOJA_BRICKS,
        new Set([
          NOMBRE_HOJA_RESUMEN,
          ...nombresHojas,
        ]),
      );

    XLSX.utils.book_append_sheet(
      workbook,
      hojaBricks,
      nombreHojaBricks,
    );
  }

  const fechaArchivo =
    formatearFechaParaArchivo(
      new Date(),
    );

  XLSX.writeFile(
    workbook,
    `REG-INO-013_Exportacion_${fechaArchivo}.xlsx`,
  );
}

async function obtenerDatosFolio(
  folioId: number,
): Promise<DatosFolioExportacion | null> {
  const folio = await db.folios.get(
    folioId,
  );

  if (!folio) {
    return null;
  }

  const registros =
    await db.registros
      .where('folio_id')
      .equals(folioId)
      .sortBy('numero_linea');

  const registrosConBricks: RegistroExportacion[] =
    [];

  for (const registro of registros) {
    const bricks =
      registro.id !== undefined
        ? await obtenerBricksDeRegistro(
            registro.id,
          )
        : [];

    registrosConBricks.push({
      ...registro,
      bricks,
    });
  }

  return {
    folio,
    registros: registrosConBricks,
  };
}

function crearHojaFolio(
  datos: DatosFolioExportacion,
): XLSX.WorkSheet {
  const { folio, registros } = datos;

  const totalDanados =
    registros.reduce(
      (total, registro) =>
        total +
        numeroSeguro(
          registro.cantidad_danada,
        ),
      0,
    );

  const totalRepuestos =
    registros.reduce(
      (total, registro) =>
        total +
        numeroSeguro(
          registro.cantidad_repuesta,
        ),
      0,
    );

  const fecha =
    formatearFecha(
      folio.fecha,
    );

  const datosHoja: unknown[][] = [
    [
      'Control de Tarimas y HU en Proceso — Trazabilidad de Bricks',
    ],

    [
      `Empresa: ${DATOS_DOCUMENTO.empresa}`,
      '',
      `Código: ${DATOS_DOCUMENTO.codigo_doc}`,
      '',
      '',
      `Versión: ${DATOS_DOCUMENTO.version}`,
      '',
      `Fecha: ${fecha}`,
      '',
      '',
      '',
      '',
      '',
    ],

    [
      `Área: ${folio.area}`,
      '',
      '',
      `Documento: ${DATOS_DOCUMENTO.nombre_documento}`,
      '',
      '',
      '',
      `Página: 1 de 1`,
      '',
      '',
      '',
      '',
      '',
    ],

    [
      `Total bricks dañados: ${totalDanados}`,
      '',
      '',
      '',
      `Total tomados de otras HU: ${totalRepuestos}`,
      '',
      '',
      `Supervisor: ${folio.supervisor || 'N/A'}`,
      '',
      '',
      `Inspector QA: ${folio.inspector_qa || 'N/A'}`,
      '',
      '',
    ],

    [],

    [
      'Fecha',
      'Folio',
      'Cliente',
      'Producto',
      'Proceso',
      'Turno',
      'Encargado de Linea',
      'Línea/modulo',
    ],

    [
      fecha,
      folio.folio,
      folio.cliente,
      folio.producto,
      folio.proceso,
      folio.turno,
      folio.encargado_linea,
      folio.linea_modulo,
    ],

    [],

    COLUMNAS_TABLA,

    ...registros.map(
      (registro) =>
        [
          registro.numero_linea,
          registro.codigo_hu,
          formatearHora(
            registro.hora_entrada,
          ),
          registro.hora_salida
            ? formatearHora(
                registro.hora_salida,
              )
            : '',
          registro.estado,
          registro.verifico_proceso,
          numeroSeguro(
            registro.cantidad_danada,
          ),
          registro.causa_dano,
          registro.se_repuso === 1
            ? 'Sí'
            : 'No',
          registro.hu_donante,
          numeroSeguro(
            registro.cantidad_repuesta,
          ),
          registro.verifico_reposicion,
          registro.observaciones,
        ] as unknown[],
    ),
  ];

  const filaNota =
    9 + registros.length;

  datosHoja.push([]);

  datosHoja.push([
    NOTA_TRAZABILIDAD,
  ]);

  const hoja =
    XLSX.utils.aoa_to_sheet(
      datosHoja,
    );

  aplicarConfiguracionHoja(
    hoja,
    registros.length,
  );

  aplicarEstilosHoja(
    hoja,
    registros.length,
  );

  aplicarMergesHoja(
    hoja,
    registros.length,
    filaNota + 1,
  );

  return hoja;
}

function crearHojaResumen(
  datosFolios: DatosFolioExportacion[],
): XLSX.WorkSheet {
  const totalHUs =
    datosFolios.reduce(
      (total, datos) =>
        total + datos.registros.length,
      0,
    );

  const totalDanados =
    datosFolios.reduce(
      (total, datos) =>
        total +
        datos.registros.reduce(
          (
            subtotal,
            registro,
          ) =>
            subtotal +
            numeroSeguro(
              registro.cantidad_danada,
            ),
          0,
        ),
      0,
    );

  const totalRepuestos =
    datosFolios.reduce(
      (total, datos) =>
        total +
        datos.registros.reduce(
          (
            subtotal,
            registro,
          ) =>
            subtotal +
            numeroSeguro(
              registro.cantidad_repuesta,
            ),
          0,
        ),
      0,
    );

  const filas: unknown[][] = [
    [
      'Exportación de Folios — REG-INO-013',
    ],

    [
      'Empresa',
      DATOS_DOCUMENTO.empresa,
      'Código',
      DATOS_DOCUMENTO.codigo_doc,
      'Versión',
      DATOS_DOCUMENTO.version,
      'Fecha de exportación',
      formatearFecha(
        new Date(),
      ),
    ],

    [],

    [
      'Total folios',
      datosFolios.length,
      'Total HUs',
      totalHUs,
      'Total bricks dañados',
      totalDanados,
      'Total tomados de otras HU',
      totalRepuestos,
    ],

    [],

    [
      'No.',
      'Folio',
      'Fecha',
      'Área',
      'Cliente',
      'Producto',
      'Proceso',
      'Turno',
      'Encargado de Linea',
      'Línea/modulo',
      'Supervisor',
      'Inspector QA',
      'HUs',
      'Bricks dañados',
      'Bricks tomados',
    ],

    ...datosFolios.map(
      (datos, indice) => {
        const folio =
          datos.folio;

        const danados =
          datos.registros.reduce(
            (total, registro) =>
              total +
              numeroSeguro(
                registro.cantidad_danada,
              ),
            0,
          );

        const repuestos =
          datos.registros.reduce(
            (total, registro) =>
              total +
              numeroSeguro(
                registro.cantidad_repuesta,
              ),
            0,
          );

        return [
          indice + 1,
          folio.folio,
          formatearFecha(
            folio.fecha,
          ),
          folio.area,
          folio.cliente,
          folio.producto,
          folio.proceso,
          folio.turno,
          folio.encargado_linea,
          folio.linea_modulo,
          folio.supervisor,
          folio.inspector_qa,
          datos.registros.length,
          danados,
          repuestos,
        ];
      },
    ),
  ];

  const hoja =
    XLSX.utils.aoa_to_sheet(
      filas,
    );

  hoja['!cols'] = [
    { wch: 7 },
    { wch: 22 },
    { wch: 13 },
    { wch: 15 },
    { wch: 24 },
    { wch: 30 },
    { wch: 22 },
    { wch: 12 },
    { wch: 24 },
    { wch: 18 },
    { wch: 24 },
    { wch: 24 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
  ];

  hoja['!merges'] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: 14 },
    },
  ];

  configurarPagina(
    hoja,
    14,
  );

  return hoja;
}

function crearHojaBricks(
  datosFolios: DatosFolioExportacion[],
): XLSX.WorkSheet | null {
  const filasBricks: unknown[][] = [
    [
      'Detalle de Bricks Dañados — REG-INO-013',
    ],

    [
      'Folio',
      'No. HU',
      'HU',
      'Código brick',
      'Causa',
      'Estado de sincronización',
    ],
  ];

  let cantidadBricks = 0;

  for (const datos of datosFolios) {
    for (const registro of datos.registros) {
      for (const brick of registro.bricks) {
        filasBricks.push([
          datos.folio.folio,
          registro.numero_linea,
          registro.codigo_hu,
          brick.codigo_brick,
          brick.causa,
          brick.sync_status,
        ]);

        cantidadBricks += 1;
      }
    }
  }

  if (cantidadBricks === 0) {
    return null;
  }

  const hoja =
    XLSX.utils.aoa_to_sheet(
      filasBricks,
    );

  hoja['!cols'] = [
    { wch: 24 },
    { wch: 10 },
    { wch: 22 },
    { wch: 28 },
    { wch: 35 },
    { wch: 22 },
  ];

  hoja['!merges'] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: 5 },
    },
  ];

  configurarPagina(
    hoja,
    5,
  );

  return hoja;
}

function aplicarConfiguracionHoja(
  hoja: XLSX.WorkSheet,
  cantidadRegistros: number,
): void {
  hoja['!cols'] = [
    { wch: 7 },
    { wch: 22 },
    { wch: 13 },
    { wch: 13 },
    { wch: 17 },
    { wch: 22 },
    { wch: 18 },
    { wch: 28 },
    { wch: 13 },
    { wch: 22 },
    { wch: 25 },
    { wch: 23 },
    { wch: 40 },
  ];

  hoja['!rows'] = [
    { hpt: 30 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 24 },
    { hpt: 8 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 8 },
    { hpt: 42 },
  ];

  for (
    let i = 0;
    i < cantidadRegistros;
    i += 1
  ) {
    hoja['!rows']!.push({
      hpt: 30,
    });
  }

  hoja['!rows']!.push({
    hpt: 8,
  });

  hoja['!rows']!.push({
    hpt: 55,
  });

  configurarPagina(
    hoja,
    12,
  );
}

function aplicarMergesHoja(
  hoja: XLSX.WorkSheet,
  cantidadRegistros: number,
  filaNota: number,
): void {
  hoja['!merges'] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: 12 },
    },

    {
      s: { r: 1, c: 0 },
      e: { r: 1, c: 1 },
    },
    {
      s: { r: 1, c: 2 },
      e: { r: 1, c: 4 },
    },
    {
      s: { r: 1, c: 5 },
      e: { r: 1, c: 6 },
    },
    {
      s: { r: 1, c: 7 },
      e: { r: 1, c: 12 },
    },

    {
      s: { r: 2, c: 0 },
      e: { r: 2, c: 2 },
    },
    {
      s: { r: 2, c: 3 },
      e: { r: 2, c: 6 },
    },
    {
      s: { r: 2, c: 7 },
      e: { r: 2, c: 12 },
    },

    {
      s: { r: 3, c: 0 },
      e: { r: 3, c: 3 },
    },
    {
      s: { r: 3, c: 4 },
      e: { r: 3, c: 6 },
    },
    {
      s: { r: 3, c: 7 },
      e: { r: 3, c: 9 },
    },
    {
      s: { r: 3, c: 10 },
      e: { r: 3, c: 12 },
    },

    {
      s: { r: 5, c: 0 },
      e: { r: 5, c: 0 },
    },
    {
      s: { r: 5, c: 1 },
      e: { r: 5, c: 1 },
    },
    {
      s: { r: 5, c: 2 },
      e: { r: 5, c: 2 },
    },
    {
      s: { r: 5, c: 3 },
      e: { r: 5, c: 3 },
    },
    {
      s: { r: 5, c: 4 },
      e: { r: 5, c: 4 },
    },
    {
      s: { r: 5, c: 5 },
      e: { r: 5, c: 5 },
    },
    {
      s: { r: 5, c: 6 },
      e: { r: 5, c: 6 },
    },
    {
      s: { r: 5, c: 7 },
      e: { r: 5, c: 7 },
    },

    {
      s: { r: filaNota, c: 0 },
      e: { r: filaNota, c: 12 },
    },
  ];

  if (
    cantidadRegistros === 0
  ) {
    hoja['!rows'] = [
      ...(hoja['!rows'] ?? []),
    ];
  }
}

function aplicarEstilosHoja(
  hoja: XLSX.WorkSheet,
  cantidadRegistros: number,
): void {
  const titulo =
    obtenerCelda(
      hoja,
      'A1',
    );

  if (titulo) {
    titulo.s = {
      font: {
        bold: true,
        sz: 16,
      },
      alignment: {
        horizontal: 'center',
        vertical: 'center',
      },
    };
  }

  aplicarEstiloRango(
    hoja,
    1,
    12,
    {
      font: {
        bold: true,
      },
      alignment: {
        vertical: 'center',
      },
    },
  );

  aplicarEstiloRango(
    hoja,
    5,
    7,
    {
      font: {
        bold: true,
      },
      alignment: {
        horizontal: 'center',
        vertical: 'center',
      },
    },
  );

  aplicarEstiloRango(
    hoja,
    8,
    12,
    {
      font: {
        bold: true,
      },
      alignment: {
        horizontal: 'center',
        vertical: 'center',
        wrapText: true,
      },
    },
  );

  const filaInicioDatos = 9;
  const filaFinDatos =
    filaInicioDatos +
    cantidadRegistros -
    1;

  if (
    cantidadRegistros > 0
  ) {
    aplicarEstiloRango(
      hoja,
      filaInicioDatos,
      filaFinDatos,
      {
        alignment: {
          vertical: 'center',
          wrapText: true,
        },
      },
    );
  }

  const ultimaFila =
    9 + cantidadRegistros;

  aplicarEstiloRango(
    hoja,
    ultimaFila + 1,
    ultimaFila + 1,
    {
      font: {
        italic: true,
        sz: 10,
      },
      alignment: {
        vertical: 'top',
        wrapText: true,
      },
    },
  );
}

function aplicarEstiloRango(
  hoja: XLSX.WorkSheet,
  filaInicio: number,
  filaFin: number,
  estilo: XLSX.CellStyle,
): void {
  for (
    let fila = filaInicio;
    fila <= filaFin;
    fila += 1
  ) {
    for (
      let columna = 0;
      columna <= 12;
      columna += 1
    ) {
      const referencia =
        XLSX.utils.encode_cell({
          r: fila,
          c: columna,
        });

      const celda =
        obtenerCelda(
          hoja,
          referencia,
        );

      if (celda) {
        celda.s = estilo;
      }
    }
  }
}

function configurarPagina(
  hoja: XLSX.WorkSheet,
  ultimaColumna: number,
): void {
  hoja['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 9,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  hoja['!margins'] = {
    left: 0.25,
    right: 0.25,
    top: 0.5,
    bottom: 0.5,
    header: 0.2,
    footer: 0.2,
  };

  hoja['!autofilter'] = {
    ref: `A9:${XLSX.utils.encode_col(
      ultimaColumna,
    )}9`,
  };
}

function obtenerCelda(
  hoja: XLSX.WorkSheet,
  referencia: string,
): XLSX.CellObject | undefined {
  return hoja[
    referencia
  ] as XLSX.CellObject | undefined;
}

function numeroSeguro(
  valor: number | undefined | null,
): number {
  if (
    typeof valor !== 'number' ||
    Number.isNaN(valor)
  ) {
    return 0;
  }

  return valor;
}

function formatearFecha(
  fecha: string | Date,
): string {
  const fechaObjeto =
    fecha instanceof Date
      ? fecha
      : convertirFechaLocal(
          fecha,
        );

  if (
    Number.isNaN(
      fechaObjeto.getTime(),
    )
  ) {
    return String(fecha);
  }

  const dia =
    String(
      fechaObjeto.getDate(),
    ).padStart(2, '0');

  const mes =
    String(
      fechaObjeto.getMonth() + 1,
    ).padStart(2, '0');

  const anio =
    fechaObjeto.getFullYear();

  return `${dia}/${mes}/${anio}`;
}

function convertirFechaLocal(
  fecha: string,
): Date {
  const partes =
    fecha.split('-');

  if (
    partes.length === 3 &&
    partes.every(
      (parte) =>
        /^\d+$/.test(parte),
    )
  ) {
    const anio =
      Number(partes[0]);
    const mes =
      Number(partes[1]) - 1;
    const dia =
      Number(partes[2]);

    return new Date(
      anio,
      mes,
      dia,
    );
  }

  return new Date(fecha);
}

function formatearHora(
  timestamp: number,
): string {
  const fecha =
    new Date(timestamp);

  if (
    Number.isNaN(
      fecha.getTime(),
    )
  ) {
    return '';
  }

  const horas =
    String(
      fecha.getHours(),
    ).padStart(2, '0');

  const minutos =
    String(
      fecha.getMinutes(),
    ).padStart(2, '0');

  const segundos =
    String(
      fecha.getSeconds(),
    ).padStart(2, '0');

  return `${horas}:${minutos}:${segundos}`;
}

function formatearFechaParaArchivo(
  fecha: Date,
): string {
  const anio =
    fecha.getFullYear();

  const mes =
    String(
      fecha.getMonth() + 1,
    ).padStart(2, '0');

  const dia =
    String(
      fecha.getDate(),
    ).padStart(2, '0');

  return `${anio}${mes}${dia}`;
}

function construirNombreArchivo(
  folio: string,
): string {
  const folioSeguro =
    folio
      .trim()
      .replace(
        /[<>:"/\\|?*\x00-\x1F]/g,
        '_',
      );

  return `REG-INO-013_${folioSeguro}.xlsx`;
}

function limpiarNombreHoja(
  nombre: string,
): string {
  const limpio =
    nombre
      .replace(
        /[\\/*?:[\]]/g,
        '_',
      )
      .trim();

  if (!limpio) {
    return 'Folio';
  }

  return limpio.slice(
    0,
    31,
  );
}

function obtenerNombreHojaUnico(
  nombreBase: string,
  nombresExistentes: Set<string>,
): string {
  const base =
    limpiarNombreHoja(
      nombreBase,
    );

  if (
    !nombresExistentes.has(base)
  ) {
    return base;
  }

  for (
    let contador = 2;
    contador < 1000;
    contador += 1
  ) {
    const sufijo =
      `_${contador}`;

    const longitudMaxima =
      31 - sufijo.length;

    const candidato =
      `${base.slice(
        0,
        longitudMaxima,
      )}${sufijo}`;

    if (
      !nombresExistentes.has(
        candidato,
      )
    ) {
      return candidato;
    }
  }

  return `Folio_${Date.now()}`.slice(
    0,
    31,
  );
}