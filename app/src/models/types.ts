// Типы данных для приложения учета обслуживания принтеров

export interface Printer {
  id: string;
  name: string; // AKK-PRN001
  brand?: string;
  modelId: string;
  serialNumber?: string;
  macAddress?: string;
  ipAddress?: string;
  location?: {
    building: string;
    room: string;
  };
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PrinterModel {
  id: string;
  name: string; // Ricoh IM C300, Ricoh IM C2500, etc.
  brand?: string;
  description?: string;
  createdAt: string;
}

export interface Part {
  id: string;
  partNumber: string;
  description: string;
  brand?: string;
  compatibleModels: string[]; // массив modelId
  quantity: number;
  location: {
    building: string;
    room: string;
    cabinet?: string;
  };
  minQuantity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseEntry {
  id: string;
  errorCode: string;
  title: string;
  solution: string;
  brand?: string;
  compatibleModels?: string[];
  relatedParts: string[]; // массив partId
  steps?: string[]; // пошаговая инструкция
  createdAt: string;
  updatedAt: string;
}

export interface DailyReport {
  id: string;
  date: string; // YYYY-MM-DD
  entries: DailyReportEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ReportsHistory {
  id: string;
  date: string; // YYYY-MM-DD
  report: DailyReport;
  completedAt: string; // дата и время завершения
}

export interface DailyReportEntry {
  printerId: string;
  printerName: string;
  actions: DailyAction[];
}

export interface DailyAction {
  id?: string;
  noteId?: string;
  partId?: string;
  partName?: string;
  quantity: number;
  actionType: 'replace' | 'repair' | 'maintenance' | 'other' | string;
  description: string;
  timestamp: string;
  printerName?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  completed: boolean;
  relatedPrinterId?: string;
  relatedPartId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryLocation {
  building: string;
  room: string;
  cabinet?: string;
}

export interface BrandItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeductedPartItem {
  partId: string;
  partName: string;
  quantity: number;
}

export interface PrinterLog {
  id: string;
  noteId?: string;
  printerId: string;
  date: string; // ISO string
  type?: 'Ремонт' | 'Замена расходников' | 'Профилактика' | string;
  description: string;
  partId?: string;
  partName?: string;
  quantityDeducted?: number;
  partsDeducted?: DeductedPartItem[];
}