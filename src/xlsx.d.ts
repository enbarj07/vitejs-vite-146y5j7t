declare module 'xlsx' {
  export type WorkSheet = any;
  export type CellStyle = any;
  export type CellObject = any;
  export type WorkBook = any;

  export const utils: {
    book_new: () => WorkBook;
    book_append_sheet: (wb: WorkBook, ws: WorkSheet, name: string) => void;
    aoa_to_sheet: (data: unknown[][]) => WorkSheet;
    encode_cell: (addr: { r: number; c: number }) => string;
    encode_col: (col: number) => string;
  };

  export function writeFile(wb: WorkBook, filename: string): void;
}
