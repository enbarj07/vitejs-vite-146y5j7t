import Dexie, { type Table } from 'dexie';
import type {
  Brick,
  Folio,
  RegistroHU,
  SyncStatus,
} from '../types';

export class TrazabilidadDatabase extends Dexie {
  folios!: Table<Folio, number>;
  registros!: Table<RegistroHU, number>;
  bricks!: Table<Brick, number>;

  constructor() {
    super('TrazabilidadHU');

    this.version(1).stores({
      folios:
        '++id, folio, fecha, area, cliente, sync_status, created_at, updated_at',
      registros:
        '++id, folio_id, numero_linea, codigo_hu, hora_entrada, hora_salida, sync_status, created_at, updated_at',
      bricks:
        '++id, registro_hu_id, codigo_brick, sync_status',
    });
  }
}

export const db = new TrazabilidadDatabase();

export function obtenerFechaLocal(): string {
  const ahora = new Date();

  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

export function obtenerFechaHoraActual(): number {
  return Date.now();
}

export async function generarFolio(fecha?: string): Promise<string> {
  const fechaFolio = fecha ?? obtenerFechaLocal();

  const fechaCompacta = fechaFolio.replace(/-/g, '');

  const inicioDia = `${fechaFolio}T00:00:00`;

  const finDia = `${fechaFolio}T23:59:59.999`;

  const foliosDelDia = await db.folios
    .where('fecha')
    .between(inicioDia.slice(0, 10), finDia.slice(0, 10), true, true)
    .toArray();

  let consecutivo = foliosDelDia.length + 1;

  let folio = `BP-${fechaCompacta}-${String(consecutivo).padStart(3, '0')}`;

  while (await db.folios.where('folio').equals(folio).count()) {
    consecutivo += 1;
    folio = `BP-${fechaCompacta}-${String(consecutivo).padStart(3, '0')}`;
  }

  return folio;
}

export async function obtenerFolioPorId(
  id: number,
): Promise<Folio | undefined> {
  return db.folios.get(id);
}

export async function obtenerRegistrosDeFolio(
  folioId: number,
): Promise<RegistroHU[]> {
  return db.registros
    .where('folio_id')
    .equals(folioId)
    .sortBy('numero_linea');
}

export async function obtenerBricksDeRegistro(
  registroHuId: number,
): Promise<Brick[]> {
  return db.bricks
    .where('registro_hu_id')
    .equals(registroHuId)
    .toArray();
}

export async function obtenerRegistrosPendientes(): Promise<RegistroHU[]> {
  return db.registros
    .where('sync_status')
    .equals('pending')
    .toArray();
}

export async function obtenerFoliosPendientes(): Promise<Folio[]> {
  return db.folios
    .where('sync_status')
    .equals('pending')
    .toArray();
}

export async function marcarFolioComoSincronizado(
  folioId: number,
): Promise<void> {
  await db.folios.update(folioId, {
    sync_status: 'synced' satisfies SyncStatus,
    updated_at: Date.now(),
  });
}

export async function marcarRegistroComoSincronizado(
  registroId: number,
): Promise<void> {
  await db.registros.update(registroId, {
    sync_status: 'synced' satisfies SyncStatus,
    updated_at: Date.now(),
  });
}

export async function marcarBrickComoSincronizado(
  brickId: number,
): Promise<void> {
  await db.bricks.update(brickId, {
    sync_status: 'synced' satisfies SyncStatus,
  });
}

export async function eliminarRegistroCompleto(
  registroId: number,
): Promise<void> {
  await db.transaction(
    'rw',
    db.registros,
    db.bricks,
    async () => {
      await db.bricks
        .where('registro_hu_id')
        .equals(registroId)
        .delete();

      await db.registros.delete(registroId);
    },
  );
}

export async function eliminarFolioCompleto(
  folioId: number,
): Promise<void> {
  await db.transaction(
    'rw',
    db.folios,
    db.registros,
    db.bricks,
    async () => {
      const registros = await db.registros
        .where('folio_id')
        .equals(folioId)
        .toArray();

      for (const registro of registros) {
        if (registro.id !== undefined) {
          await db.bricks
            .where('registro_hu_id')
            .equals(registro.id)
            .delete();
        }
      }

      await db.registros
        .where('folio_id')
        .equals(folioId)
        .delete();

      await db.folios.delete(folioId);
    },
  );
}