export type SyncStatus = 'pending' | 'synced';

export type Area = 'Inocuidad' | 'Producción' | 'Embarques';

export type EstadoRegistro = 'En proceso' | 'Completado' | 'Con daño';

export type SiNo = 'Sí' | 'No';

export interface Folio {
  id?: number;
  folio: string;
  empresa: string;
  codigo_doc: string;
  version: string;
  fecha: string;
  area: Area;
  cliente: string;
  producto: string;
  proceso: string;
  turno: string;
  encargado_linea: string;
  linea_modulo: string;
  supervisor: string;
  inspector_qa: string;
  sync_status: SyncStatus;
  created_at: number;
  updated_at: number;
}

export interface RegistroHU {
  id?: number;
  folio_id: number;
  numero_linea: number;
  codigo_hu: string;
  hora_entrada: number;
  hora_salida?: number;
  duracion_ms?: number;
  estado: EstadoRegistro;
  verifico_proceso: string;
  cantidad_danada: number;
  causa_dano: string;
  se_repuso: 0 | 1;
  hu_donante: string;
  cantidad_repuesta: number;
  verifico_reposicion: string;
  observaciones: string;
  sync_status: SyncStatus;
  created_at: number;
  updated_at: number;
}

export interface Brick {
  id?: number;
  registro_hu_id: number;
  codigo_brick: string;
  causa: string;
  sync_status: SyncStatus;
}

export interface RegistroHUConBricks extends RegistroHU {
  bricks: Brick[];
}

export interface FolioConRegistros extends Folio {
  registros: RegistroHUConBricks[];
}

export interface NuevoFolioForm {
  fecha: string;
  area: Area;
  cliente: string;
  producto: string;
  proceso: string;
  turno: string;
  encargado_linea: string;
  linea_modulo: string;
  supervisor: string;
  inspector_qa: string;
}

export interface RegistroHUForm {
  codigo_hu: string;
  hora_entrada: number | null;
  hora_salida: number | null;
  duracion_ms: number | null;
  estado: EstadoRegistro;
  verifico_proceso: string;
  cantidad_danada: number;
  causa_dano: string;
  se_repuso: 0 | 1;
  hu_donante: string;
  cantidad_repuesta: number;
  verifico_reposicion: string;
  observaciones: string;
}

export interface BrickForm {
  codigo_brick: string;
  causa: string;
}

export interface FiltroHistorial {
  fecha_desde: string;
  fecha_hasta: string;
  cliente: string;
}

export interface ResultadoEscaneo {
  codigo: string;
  fecha_hora: number;
}

export const DATOS_DOCUMENTO = {
  empresa: 'Bill Pack',
  codigo_doc: 'REG-INO-013',
  version: '01',
  nombre_documento: 'Control de Tarimas y HU en Proceso',
} as const;