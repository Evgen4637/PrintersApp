export const PRINTER_MODELS = [
  'Ricoh IM C300',
  'Ricoh IM C2500',
  'Ricoh MP C4504ex',
  'Ricoh SP 230Dnw',
] as const;

export type PrinterModel = (typeof PRINTER_MODELS)[number];