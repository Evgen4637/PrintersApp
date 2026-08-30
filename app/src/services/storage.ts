import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { db } from '../firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import {
  Printer,
  PrinterModel,
  Part,
  KnowledgeBaseEntry,
  DailyReport,
  DailyReportEntry,
  DailyAction,
  Note,
  ReportsHistory,
  BrandItem,
  PrinterLog,
} from '../models/types';

export interface LocationItem {
  id: string;
  building: string;
  room: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEYS = {
  PRINTERS: 'printers',
  MODELS: 'models',
  PARTS: 'parts',
  KNOWLEDGE: 'knowledgeBase',
  REPORTS: 'dailyReports',
  NOTES: 'notes',
  HISTORY: 'reportsHistory',
  LOCATIONS: 'locations',
  BRANDS: 'brands',
  PRINTER_LOGS: 'printer_logs',
};

const NOTES_LOCAL_KEY = '@notes_data';

let printers: Printer[] = [];
let models: PrinterModel[] = [];
let parts: Part[] = [];
let knowledgeBase: KnowledgeBaseEntry[] = [];
let dailyReports: DailyReport[] = [];
let notes: Note[] = [];
let reportsHistory: ReportsHistory[] = [];
let locations: LocationItem[] = [];
let brands: BrandItem[] = [];

let unsubscribeListeners: (() => void)[] = [];

let currentWorkspaceId: string | null = null;

export const setWorkspaceId = (id: string | null) => {
  console.log(`[storage.ts:setWorkspaceId] Setting workspaceId from "${currentWorkspaceId}" to "${id}"`);
  
  // 1. Отписываемся от всех старых прослушивателей
  if (unsubscribeListeners && unsubscribeListeners.length > 0) {
    console.log(`[storage.ts:setWorkspaceId] Unsubscribing ${unsubscribeListeners.length} active listeners...`);
    unsubscribeListeners.forEach(unsub => {
      try {
        if (typeof unsub === 'function') unsub();
      } catch (e) {
        console.error('[storage.ts:setWorkspaceId] Error unsubscribing:', e);
      }
    });
    unsubscribeListeners = [];
  }

  // 2. Устанавливаем новое значение текущей мастерской
  currentWorkspaceId = id;

  // 3. Сбрасываем в ноль локальные массивы в памяти
  printers = [];
  models = [];
  parts = [];
  knowledgeBase = [];
  dailyReports = [];
  notes = [];
  reportsHistory = [];
  locations = [];
  brands = [];

  // 4. Сбрасываем флаг инициализации
  if (storageServiceInstance) {
    storageServiceInstance.resetInitialization();
  }
};

const getWorkspaceCollectionRef = (collectionKey: string) => {
  if (!currentWorkspaceId) {
    throw new Error('Workspace ID is not set.');
  }
  return collection(db, 'workspaces', currentWorkspaceId, collectionKey);
};

const sanitizeData = <T extends Record<string, any>>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => (typeof item === 'object' && item !== null ? sanitizeData(item) : item)) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object') {
      result[key] = sanitizeData(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
};

const generateId = () => {
  return Date.now().toString() + '_' + Math.floor(Math.random() * 1000000).toString();
};

class StorageService {
  private writeQueue: Promise<any> = Promise.resolve();
  private isInitialized = false;

  resetInitialization() {
    this.isInitialized = false;
  }

  private async enqueueWrite<T>(op: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(op);
    this.writeQueue = next.then(() => {}, () => {});
    return next;
  }

  private getNotesLocalKey(): string {
    return `@notes_data_${currentWorkspaceId || 'default'}`;
  }

  private async saveNotesLocally(notesData: Note[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.getNotesLocalKey(), JSON.stringify(notesData));
    } catch (e) {
      console.error('Error saving notes to AsyncStorage:', e);
    }
  }

  async initialize() {
    if (!currentWorkspaceId) {
      return;
    }
    if (this.isInitialized) return;

    // Unsubscribe any previous listeners
    unsubscribeListeners.forEach(unsub => unsub());
    unsubscribeListeners = [];

    // Set up real-time Firestore listeners for cloud collections (excluding local notes)
    const unsubPrinters = onSnapshot(getWorkspaceCollectionRef(STORAGE_KEYS.PRINTERS), snapshot => {
      printers = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Printer));
    });

    const unsubModels = onSnapshot(getWorkspaceCollectionRef(STORAGE_KEYS.MODELS), snapshot => {
      models = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PrinterModel));
    });

    const unsubParts = onSnapshot(getWorkspaceCollectionRef(STORAGE_KEYS.PARTS), snapshot => {
      parts = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Part));
    });

    const unsubKB = onSnapshot(getWorkspaceCollectionRef(STORAGE_KEYS.KNOWLEDGE), snapshot => {
      knowledgeBase = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as KnowledgeBaseEntry));
    });

    const unsubReports = onSnapshot(getWorkspaceCollectionRef(STORAGE_KEYS.REPORTS), snapshot => {
      dailyReports = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as DailyReport));
    });

    const unsubHistory = onSnapshot(getWorkspaceCollectionRef(STORAGE_KEYS.HISTORY), snapshot => {
      reportsHistory = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ReportsHistory));
    });

    const unsubLocations = onSnapshot(getWorkspaceCollectionRef(STORAGE_KEYS.LOCATIONS), snapshot => {
      locations = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as LocationItem));
    });

    const unsubBrands = onSnapshot(getWorkspaceCollectionRef(STORAGE_KEYS.BRANDS), snapshot => {
      brands = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as BrandItem));
    });

    unsubscribeListeners.push(
      unsubPrinters,
      unsubModels,
      unsubParts,
      unsubKB,
      unsubReports,
      unsubHistory,
      unsubLocations,
      unsubBrands
    );

    // Initial fetch from Firestore for cloud collections
    try {
      const [
        printersSnap,
        modelsSnap,
        partsSnap,
        kbSnap,
        reportsSnap,
        historySnap,
        locationsSnap,
        brandsSnap,
      ] = await Promise.all([
        getDocs(getWorkspaceCollectionRef(STORAGE_KEYS.PRINTERS)),
        getDocs(getWorkspaceCollectionRef(STORAGE_KEYS.MODELS)),
        getDocs(getWorkspaceCollectionRef(STORAGE_KEYS.PARTS)),
        getDocs(getWorkspaceCollectionRef(STORAGE_KEYS.KNOWLEDGE)),
        getDocs(getWorkspaceCollectionRef(STORAGE_KEYS.REPORTS)),
        getDocs(getWorkspaceCollectionRef(STORAGE_KEYS.HISTORY)),
        getDocs(getWorkspaceCollectionRef(STORAGE_KEYS.LOCATIONS)),
        getDocs(getWorkspaceCollectionRef(STORAGE_KEYS.BRANDS)),
      ]);

      printers = printersSnap.docs.map(d => ({ ...d.data(), id: d.id } as Printer));
      models = modelsSnap.docs.map(d => ({ ...d.data(), id: d.id } as PrinterModel));
      parts = partsSnap.docs.map(d => ({ ...d.data(), id: d.id } as Part));
      knowledgeBase = kbSnap.docs.map(d => ({ ...d.data(), id: d.id } as KnowledgeBaseEntry));
      dailyReports = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id } as DailyReport));
      reportsHistory = historySnap.docs.map(d => ({ ...d.data(), id: d.id } as ReportsHistory));
      locations = locationsSnap.docs.map(d => ({ ...d.data(), id: d.id } as LocationItem));
      brands = brandsSnap.docs.map(d => ({ ...d.data(), id: d.id } as BrandItem));

      // Load local notes from AsyncStorage
      const localNotesJson = await AsyncStorage.getItem(this.getNotesLocalKey());
      notes = localNotesJson ? JSON.parse(localNotesJson) : [];
    } catch (error) {
      console.error('Error initializing Firestore storage:', error);
    }

    this.isInitialized = true;
  }

  // Общие методы CRUD
  async getAll<T>(key: string): Promise<T[]> {
    switch (key) {
      case STORAGE_KEYS.PRINTERS: return printers as unknown as T[];
      case STORAGE_KEYS.MODELS: return models as unknown as T[];
      case STORAGE_KEYS.PARTS: return parts as unknown as T[];
      case STORAGE_KEYS.KNOWLEDGE: return knowledgeBase as unknown as T[];
      case STORAGE_KEYS.REPORTS: return dailyReports as unknown as T[];
      case STORAGE_KEYS.NOTES: return (await this.getNotes()) as unknown as T[];
      case STORAGE_KEYS.HISTORY: return reportsHistory as unknown as T[];
      case STORAGE_KEYS.LOCATIONS: return locations as unknown as T[];
      case STORAGE_KEYS.BRANDS: return brands as unknown as T[];
      default: return [];
    }
  }

  async getById<T>(key: string, id: string): Promise<T | undefined> {
    const items = await this.getAll<T>(key);
    return items.find(item => (item as any).id === id);
  }

  async add<T extends Record<string, any>>(
    key: string,
    item: T
  ): Promise<T & { id: string; createdAt: string; updatedAt: string }> {
    if (key === STORAGE_KEYS.NOTES) {
      return (await this.addNote(item as any)) as unknown as T & { id: string; createdAt: string; updatedAt: string };
    }
    return this.enqueueWrite(() => this._add<T>(key, item));
  }

  private async _add<T extends Record<string, any>>(
    key: string,
    item: T
  ): Promise<T & { id: string; createdAt: string; updatedAt: string }> {
    const id = (item as any).id || generateId();
    const newItem = sanitizeData({
      ...item,
      id,
      createdAt: (item as any).createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await setDoc(doc(getWorkspaceCollectionRef(key), id), newItem);
    return newItem as T & { id: string; createdAt: string; updatedAt: string };
  }

  async update<T extends { id: string; createdAt: string; updatedAt: string }>(
    key: string,
    id: string,
    updates: Partial<T>
  ): Promise<T | null> {
    if (key === STORAGE_KEYS.NOTES) {
      return (await this.updateNote(id, updates as any)) as unknown as T | null;
    }
    return this.enqueueWrite(() => this._update<T>(key, id, updates));
  }

  private async _update<T extends { id: string; createdAt: string; updatedAt: string }>(
    key: string,
    id: string,
    updates: Partial<T>
  ): Promise<T | null> {
    const docRef = doc(getWorkspaceCollectionRef(key), id);
    const updateData = sanitizeData({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(docRef, updateData as any);

    const items = await this.getAll<T>(key);
    const existing = items.find(item => item.id === id);
    if (existing) {
      return { ...existing, ...updateData } as T;
    }
    return null;
  }

  async delete(key: string, id: string): Promise<boolean> {
    if (key === STORAGE_KEYS.NOTES) {
      return await this.deleteNote(id);
    }
    return this.enqueueWrite(() => this._delete(key, id));
  }

  private async _delete(key: string, id: string): Promise<boolean> {
    const docRef = doc(getWorkspaceCollectionRef(key), id);
    await deleteDoc(docRef);
    return true;
  }

  // Специфичные методы для каждой сущности
  async getPrinters(): Promise<Printer[]> {
    const printers = await this.getAll<Printer>(STORAGE_KEYS.PRINTERS);
    return printers.filter(p => !p.archived);
  }

  async getArchivedPrinters(): Promise<Printer[]> {
    const printers = await this.getAll<Printer>(STORAGE_KEYS.PRINTERS);
    return printers.filter(p => p.archived === true);
  }

  async addPrinter(printer: Partial<Printer>): Promise<Printer> {
    return this.add<Printer>(STORAGE_KEYS.PRINTERS, printer as Printer);
  }

  async updatePrinter(id: string, updates: Partial<Printer>): Promise<Printer | null> {
    return this.update<Printer>(STORAGE_KEYS.PRINTERS, id, updates);
  }

  async deletePrinter(id: string): Promise<boolean> {
    return this.enqueueWrite(async () => {
      const allLogs = await this.getPrinterLogs();
      const hasHistory = allLogs.some(log => log.printerId === id);

      if (hasHistory) {
        // Мягкое удаление / Архивация
        await this._update<Printer>(STORAGE_KEYS.PRINTERS, id, { archived: true });
        return true;
      } else {
        // Физическое полное удаление
        await this._delete(STORAGE_KEYS.PRINTERS, id);
        return true;
      }
    });
  }

  async restorePrinter(id: string): Promise<boolean> {
    return this.enqueueWrite(async () => {
      await this._update<Printer>(STORAGE_KEYS.PRINTERS, id, { archived: false });
      return true;
    });
  }

  async getModels(): Promise<PrinterModel[]> {
    return this.getAll<PrinterModel>(STORAGE_KEYS.MODELS);
  }

  async addModel(model: Partial<PrinterModel>): Promise<PrinterModel> {
    const id = model.id || generateId();
    const newModel: PrinterModel = sanitizeData({
      ...model,
      id,
      name: model.name || '',
      description: model.description || '',
      createdAt: model.createdAt || new Date().toISOString(),
    });
    await setDoc(doc(getWorkspaceCollectionRef(STORAGE_KEYS.MODELS), id), newModel);
    return newModel;
  }

  async updateModel(id: string, updates: Partial<PrinterModel>): Promise<PrinterModel | null> {
    const docRef = doc(getWorkspaceCollectionRef(STORAGE_KEYS.MODELS), id);
    const sanitizedUpdates = sanitizeData(updates);
    await updateDoc(docRef, sanitizedUpdates as any);
    const existing = models.find(m => m.id === id);
    return existing ? ({ ...existing, ...sanitizedUpdates } as PrinterModel) : null;
  }

  async deleteModel(id: string): Promise<boolean> {
    return this.delete(STORAGE_KEYS.MODELS, id);
  }

  async getBrands(): Promise<BrandItem[]> {
    return this.getAll<BrandItem>(STORAGE_KEYS.BRANDS);
  }

  async addBrand(name: string): Promise<BrandItem> {
    const trimmed = name.trim();
    const existing = brands.find(b => b.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      return existing;
    }
    return this.add<BrandItem>(STORAGE_KEYS.BRANDS, {
      name: trimmed,
    } as BrandItem);
  }

  async deleteBrand(idOrName: string): Promise<boolean> {
    const target = brands.find(b => b.id === idOrName || b.name.toLowerCase() === idOrName.toLowerCase());
    if (target) {
      return this.delete(STORAGE_KEYS.BRANDS, target.id);
    }
    return false;
  }

  async getParts(): Promise<Part[]> {
    return this.getAll<Part>(STORAGE_KEYS.PARTS);
  }

  async addPart(part: Partial<Part>): Promise<Part> {
    return this.add<Part>(STORAGE_KEYS.PARTS, part as Part);
  }

  async updatePart(id: string, updates: Partial<Part>): Promise<Part | null> {
    return this.update<Part>(STORAGE_KEYS.PARTS, id, updates);
  }

  async adjustPartQuantity(partId: string, delta: number): Promise<Part | null> {
    return this.enqueueWrite(() => this._adjustPartQuantity(partId, delta));
  }

  private async _adjustPartQuantity(partId: string, delta: number): Promise<Part | null> {
    const part = parts.find(p => p.id === partId);
    if (part) {
      const newQuantity = Math.max(0, part.quantity + delta);
      return this._update<Part>(STORAGE_KEYS.PARTS, partId, { quantity: newQuantity });
    }
    return null;
  }

  async getKnowledgeBase(): Promise<KnowledgeBaseEntry[]> {
    return this.getAll<KnowledgeBaseEntry>(STORAGE_KEYS.KNOWLEDGE);
  }

  async addKnowledgeEntry(entry: Partial<KnowledgeBaseEntry>): Promise<KnowledgeBaseEntry> {
    const sanitizedEntry = sanitizeData({
      ...entry,
      steps: entry.steps || [],
      relatedParts: entry.relatedParts || [],
      compatibleModels: entry.compatibleModels || [],
    });
    return this.add<KnowledgeBaseEntry>(STORAGE_KEYS.KNOWLEDGE, sanitizedEntry as KnowledgeBaseEntry);
  }

  async updateKnowledgeEntry(id: string, updates: Partial<KnowledgeBaseEntry>): Promise<KnowledgeBaseEntry | null> {
    const sanitizedUpdates = sanitizeData(updates);
    return this.update<KnowledgeBaseEntry>(STORAGE_KEYS.KNOWLEDGE, id, sanitizedUpdates);
  }

  async getDailyReports(): Promise<DailyReport[]> {
    return this.getAll<DailyReport>(STORAGE_KEYS.REPORTS);
  }

  async getDailyReportByDate(date: string): Promise<DailyReport | undefined> {
    const reports = await this.getDailyReports();
    return reports.find(r => r.date === date);
  }

  async addDailyReport(report: Partial<DailyReport>): Promise<DailyReport> {
    return this.enqueueWrite(() => this._addDailyReport(report));
  }

  private async _addDailyReport(report: Partial<DailyReport>): Promise<DailyReport> {
    const existing = await this.getDailyReportByDate(report.date || '');
    if (existing) {
      const updated = await this._update<DailyReport>(STORAGE_KEYS.REPORTS, existing.id, {
        entries: report.entries,
      });
      if (!updated) {
        throw new Error('Не удалось обновить ежедневный отчет');
      }
      return updated;
    }
    const added = await this._add<DailyReport>(STORAGE_KEYS.REPORTS, report as DailyReport);
    return added;
  }

  async finishDay(date: string): Promise<ReportsHistory | null> {
    return this.enqueueWrite(() => this._finishDay(date));
  }

  private async _finishDay(date: string): Promise<ReportsHistory | null> {
    const existing = await this.getDailyReportByDate(date);
    if (!existing) {
      return null;
    }

    const historyEntry: ReportsHistory = {
      id: generateId(),
      date: existing.date,
      report: { ...existing },
      completedAt: new Date().toISOString(),
    };

    await setDoc(doc(getWorkspaceCollectionRef(STORAGE_KEYS.HISTORY), historyEntry.id), historyEntry);

    // Обнуляем текущий отчет
    await updateDoc(doc(getWorkspaceCollectionRef(STORAGE_KEYS.REPORTS), existing.id), {
      entries: [],
      updatedAt: new Date().toISOString(),
    });

    return historyEntry;
  }

  async getReportsHistory(): Promise<ReportsHistory[]> {
    return reportsHistory;
  }

  async getReportsHistoryByPrinter(printerName: string): Promise<ReportsHistory[]> {
    return reportsHistory.filter(history =>
      history.report.entries.some(entry =>
        entry.printerName.toLowerCase().includes(printerName.toLowerCase())
      )
    );
  }

  async addToDailyReport(
    printerName: string,
    part: { id: string; partNumber: string; description: string },
    quantity: number,
    actionType: DailyAction['actionType'],
    description?: string
  ): Promise<DailyReport> {
    return this.enqueueWrite(() =>
      this._addToDailyReport(printerName, part, quantity, actionType, description)
    );
  }

  private async _addToDailyReport(
    printerName: string,
    part: { id: string; partNumber: string; description: string },
    quantity: number,
    actionType: DailyAction['actionType'],
    description?: string
  ): Promise<DailyReport> {
    const today = new Date().toISOString().split('T')[0];
    const existing = await this.getDailyReportByDate(today);

    const partDisplayName = (part && part.id && (part.partNumber || part.description) && quantity > 0)
      ? (part.partNumber && part.description ? `${part.partNumber} - ${part.description}` : (part.partNumber || part.description))
      : 'без списания';

    const newAction: DailyAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      partId: part.id || '',
      partName: partDisplayName,
      quantity: quantity || 0,
      actionType: actionType || 'other',
      timestamp: new Date().toISOString(),
      description: description || '',
      printerName: printerName || 'Не указан',
    };

    const newEntry: DailyReportEntry = {
      printerId: '',
      printerName,
      actions: [newAction],
    };

    let entries: DailyReportEntry[] = existing?.entries ? [...existing.entries] : [];

    const entryIndex = entries.findIndex(e => e.printerName === printerName);
    if (entryIndex !== -1) {
      entries[entryIndex] = {
        ...entries[entryIndex],
        actions: [...entries[entryIndex].actions, newAction],
      };
    } else {
      entries.push(newEntry);
    }

    const report: Omit<DailyReport, 'id' | 'createdAt' | 'updatedAt'> = {
      date: today,
      entries,
    };

    return this._addDailyReport(report);
  }

  async getDailyReportGroupedByPrinter(date?: string): Promise<Map<string, DailyReportEntry[]>> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const report = await this.getDailyReportByDate(targetDate);
    const printerLogs = await this.getPrinterLogs();
    const printersList = await this.getPrinters();

    const grouped = new Map<string, DailyReportEntry[]>();
    
    // 1. Из отчета дня (Задачи / Списания из DailyReport)
    if (report) {
      for (const entry of report.entries) {
        const existing = grouped.get(entry.printerName) || [];
        existing.push(entry);
        grouped.set(entry.printerName, existing);
      }
    }

    // 2. Из истории принтеров (PrinterLog за указанную дату)
    const targetDateLogs = printerLogs.filter(log => log.date && log.date.startsWith(targetDate));
    for (const log of targetDateLogs) {
      const printer = printersList.find(p => p.id === log.printerId);
      const printerName = printer ? printer.name : 'Не указан';
      
      const logAction: DailyAction = {
        partId: log.partId || '',
        partName: log.partName || (log.partId ? 'Деталь' : 'без списания'),
        quantity: log.quantityDeducted || (log.partId ? 1 : 0),
        actionType: log.type || 'Обслуживание',
        timestamp: log.date,
        description: log.description,
        printerName,
      };

      const existingEntries = grouped.get(printerName) || [];
      if (existingEntries.length > 0) {
        const hasDuplicate = existingEntries.some(e =>
          e.actions.some(a => a.timestamp === log.date || (a.description === log.description && a.partName === logAction.partName))
        );
        if (!hasDuplicate) {
          existingEntries[0].actions.push(logAction);
        }
      } else {
        grouped.set(printerName, [{
          printerId: log.printerId,
          printerName,
          actions: [logAction],
        }]);
      }
    }

    return grouped;
  }

  // Заметки — локальное хранение в AsyncStorage для каждого устройства
  async getNotes(): Promise<Note[]> {
    try {
      const localNotesJson = await AsyncStorage.getItem(this.getNotesLocalKey());
      notes = localNotesJson ? JSON.parse(localNotesJson) : [];
    } catch (e) {
      console.error('Error loading notes from AsyncStorage:', e);
    }
    return [...notes].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  }

  async addNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    return this.enqueueWrite(async () => {
      try {
        const existing = await AsyncStorage.getItem(this.getNotesLocalKey());
        const currentNotes: Note[] = existing ? JSON.parse(existing) : [];

        const newNote: Note = {
          title: note.title || '',
          content: note.content || '',
          completed: !!note.completed,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        notes = [newNote, ...currentNotes];
        await AsyncStorage.setItem(this.getNotesLocalKey(), JSON.stringify(notes));
        return newNote;
      } catch (e) {
        console.error('Error adding note to AsyncStorage:', e);
        throw e;
      }
    });
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<Note | null> {
    return this.enqueueWrite(async () => {
      try {
        const localNotesJson = await AsyncStorage.getItem(this.getNotesLocalKey());
        let currentNotes: Note[] = localNotesJson ? JSON.parse(localNotesJson) : notes;

        const index = currentNotes.findIndex(n => n.id === id);
        if (index !== -1) {
          currentNotes[index] = {
            ...currentNotes[index],
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          notes = [...currentNotes];
          await AsyncStorage.setItem(this.getNotesLocalKey(), JSON.stringify(notes));
          return notes[index];
        }
        return null;
      } catch (e) {
        console.error('Error updating note in AsyncStorage:', e);
        throw e;
      }
    });
  }

  async deleteNote(id: string): Promise<boolean> {
    return this.enqueueWrite(async () => {
      try {
        const localNotesJson = await AsyncStorage.getItem(this.getNotesLocalKey());
        let currentNotes: Note[] = localNotesJson ? JSON.parse(localNotesJson) : notes;

        const initialLen = currentNotes.length;
        currentNotes = currentNotes.filter(n => n.id !== id);
        if (currentNotes.length !== initialLen) {
          notes = [...currentNotes];
          await AsyncStorage.setItem(this.getNotesLocalKey(), JSON.stringify(notes));
          return true;
        }
        return false;
      } catch (e) {
        console.error('Error deleting note from AsyncStorage:', e);
        throw e;
      }
    });
  }

  async deleteDailyAction(dateOrActionId: string, printerName?: string, actionIdParam?: string | number): Promise<boolean> {
    return this.enqueueWrite(async () => {
      try {
        const actionId = String(actionIdParam || dateOrActionId);
        console.log(`[storage.ts:deleteDailyAction] START searching for actionId=${actionId}`);

        // 1. Поиск во всех DailyReport
        const reports = await this.getDailyReports();
        for (const report of reports) {
          let reportModified = false;
          let foundAction: DailyAction | null = null;

          for (let eIdx = report.entries.length - 1; eIdx >= 0; eIdx--) {
            const entry = report.entries[eIdx];
            const targetActionIdx = entry.actions.findIndex(a =>
              (a.id && String(a.id) === actionId) ||
              a.timestamp === actionId ||
              String(a.timestamp) === actionId
            );

            if (targetActionIdx !== -1) {
              foundAction = entry.actions[targetActionIdx];
              console.log(`[storage.ts:deleteDailyAction] Action found in DailyReport ${report.id}:`, foundAction);

              // Возврат детали на склад при списании
              if (foundAction.partId && foundAction.quantity && foundAction.quantity > 0) {
                try {
                  const partsList = await this.getParts();
                  const part = partsList.find(p => p.id === foundAction!.partId);
                  if (part) {
                    const restoredQty = part.quantity + foundAction.quantity;
                    console.log(`[storage.ts:deleteDailyAction] Restocking part ${part.id}: newQty=${restoredQty}`);
                    await this._update<Part>(STORAGE_KEYS.PARTS, part.id, { quantity: restoredQty });
                  }
                } catch (restockErr) {
                  console.warn('[storage.ts:deleteDailyAction] Error restocking part:', restockErr);
                }
              }

              // Удаляем акшн из массива действий
              entry.actions.splice(targetActionIdx, 1);
              reportModified = true;

              if (entry.actions.length === 0) {
                report.entries.splice(eIdx, 1);
              }
            }
          }

          if (reportModified) {
            console.log(`[storage.ts:deleteDailyAction] Updating DailyReport ${report.id} in Firestore...`);
            const docRef = doc(getWorkspaceCollectionRef(STORAGE_KEYS.REPORTS), report.id);
            await setDoc(docRef, {
              entries: report.entries,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            console.log(`[storage.ts:deleteDailyAction] DailyReport updated successfully.`);

            // Сброс статуса связанной задачи в false (через updateNote)
            if (foundAction) {
              try {
                const notesList = await this.getNotes();
                const targetNote = notesList.find(n =>
                  (foundAction!.noteId && n.id === foundAction!.noteId) ||
                  (n.completed && foundAction!.description && n.title.trim().toLowerCase() === foundAction!.description.trim().toLowerCase())
                );
                if (targetNote) {
                  console.log(`[storage.ts:deleteDailyAction] Resetting task ${targetNote.id} ("${targetNote.title}") to completed=false`);
                  await this.updateNote(targetNote.id, { completed: false });
                }
              } catch (noteErr) {
                console.warn('[storage.ts:deleteDailyAction] Could not reset task completed status:', noteErr);
              }
            }

            return true;
          }
        }

        // 2. Поиск в PrinterLog
        const logs = await this.getPrinterLogs();
        const targetLog = logs.find(log =>
          log.id === actionId ||
          log.date === actionId ||
          String(log.date) === actionId
        );

        if (targetLog) {
          console.log(`[storage.ts:deleteDailyAction] Action found in PrinterLog:`, targetLog);
          if (targetLog.partId && targetLog.quantityDeducted && targetLog.quantityDeducted > 0) {
            try {
              const partsList = await this.getParts();
              const part = partsList.find(p => p.id === targetLog.partId);
              if (part) {
                const restoredQty = part.quantity + targetLog.quantityDeducted;
                await this._update<Part>(STORAGE_KEYS.PARTS, part.id, { quantity: restoredQty });
              }
            } catch (restockErr) {
              console.warn('[storage.ts:deleteDailyAction] Error restocking part from PrinterLog:', restockErr);
            }
          }

          // Сброс статуса связанной задачи в false (через updateNote)
          try {
            const notesList = await this.getNotes();
            const targetNote = notesList.find(n =>
              (targetLog.noteId && n.id === targetLog.noteId) ||
              (n.completed && targetLog.description && n.title.trim().toLowerCase() === targetLog.description.trim().toLowerCase())
            );
            if (targetNote) {
              console.log(`[storage.ts:deleteDailyAction] Resetting task ${targetNote.id} ("${targetNote.title}") to completed=false`);
              await this.updateNote(targetNote.id, { completed: false });
            }
          } catch (noteErr) {
            console.warn('[storage.ts:deleteDailyAction] Could not reset task completed status:', noteErr);
          }

          await this._delete(STORAGE_KEYS.PRINTER_LOGS, targetLog.id);
          console.log(`[storage.ts:deleteDailyAction] PrinterLog deleted successfully.`);
          return true;
        }

        console.log(`[storage.ts:deleteDailyAction] Action with ID=${actionId} not found in any report or log.`);
        return false;
      } catch (error: any) {
        console.error('[storage.ts:deleteDailyAction] ERROR during deletion:', error);
        return false;
      }
    });
  }

  async cancelNoteCompletion(noteId: string, noteTitle: string): Promise<boolean> {
    return this.enqueueWrite(async () => {
      try {
        console.log(`[storage.ts:cancelNoteCompletion] START noteId=${noteId}, noteTitle="${noteTitle}"`);
        
        // 1. Сбрасываем статус задачи (completed: false) через официальный метод updateNote
        try {
          await this.updateNote(noteId, { completed: false });
          console.log(`[storage.ts:cancelNoteCompletion] Task ${noteId} status set to completed=false.`);
        } catch (updateErr) {
          console.warn('[storage.ts:cancelNoteCompletion] Warning updating note status:', updateErr);
        }

        // 2. Ищем и удаляем соответствующую запись в PrinterLog
        const allLogs = await this.getPrinterLogs();
        const matchingLog = allLogs.find(
          l => (l.noteId && l.noteId === noteId) || (l.description && (l.description === noteTitle || l.description.includes(noteTitle)))
        );

        if (matchingLog) {
          console.log(`[storage.ts:cancelNoteCompletion] Found matching PrinterLog:`, matchingLog);
          if (matchingLog.partId && matchingLog.quantityDeducted && matchingLog.quantityDeducted > 0) {
            try {
              const partsList = await this.getParts();
              const part = partsList.find(p => p.id === matchingLog.partId);
              if (part) {
                const restoredQty = part.quantity + matchingLog.quantityDeducted;
                await this._update<Part>(STORAGE_KEYS.PARTS, part.id, { quantity: restoredQty });
              }
            } catch (restockErr) {
              console.warn('[storage.ts:cancelNoteCompletion] Error restocking part from PrinterLog:', restockErr);
            }
          }
          await this._delete(STORAGE_KEYS.PRINTER_LOGS, matchingLog.id);
          console.log(`[storage.ts:cancelNoteCompletion] PrinterLog deleted.`);
        }

        // 3. Ищем и удаляем запись в DailyReport
        const reports = await this.getDailyReports();
        for (const report of reports) {
          let reportModified = false;
          for (let eIdx = report.entries.length - 1; eIdx >= 0; eIdx--) {
            const entry = report.entries[eIdx];
            const aIdx = entry.actions.findIndex(
              a => (a.noteId && a.noteId === noteId) || (a.description && (a.description === noteTitle || a.description.includes(noteTitle))) || a.actionType === noteTitle
            );

            if (aIdx !== -1) {
              const action = entry.actions[aIdx];
              console.log(`[storage.ts:cancelNoteCompletion] Found matching action in report:`, action);

              if (action && action.partId && action.quantity && action.quantity > 0) {
                try {
                  const partsList = await this.getParts();
                  const part = partsList.find(p => p.id === action.partId);
                  if (part) {
                    const restoredQty = part.quantity + action.quantity;
                    await this._update<Part>(STORAGE_KEYS.PARTS, part.id, { quantity: restoredQty });
                  }
                } catch (restockErr) {
                  console.warn('[storage.ts:cancelNoteCompletion] Error restocking part:', restockErr);
                }
              }

              entry.actions.splice(aIdx, 1);
              reportModified = true;

              if (entry.actions.length === 0) {
                report.entries.splice(eIdx, 1);
              }
            }
          }

          if (reportModified) {
            const docRef = doc(getWorkspaceCollectionRef(STORAGE_KEYS.REPORTS), report.id);
            await setDoc(docRef, {
              entries: report.entries,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            console.log(`[storage.ts:cancelNoteCompletion] DailyReport updated.`);
          }
        }

        console.log(`[storage.ts:cancelNoteCompletion] SUCCESS`);
        return true;
      } catch (error: any) {
        console.error('[storage.ts:cancelNoteCompletion] ERROR:', error);
        return false;
      }
    });
  }

  async deletePart(id: string): Promise<boolean> {
    return this.delete(STORAGE_KEYS.PARTS, id);
  }

  async deleteKnowledgeEntry(id: string): Promise<boolean> {
    return this.delete(STORAGE_KEYS.KNOWLEDGE, id);
  }

  async getLocations(): Promise<LocationItem[]> {
    return this.getAll<LocationItem>(STORAGE_KEYS.LOCATIONS);
  }

  async addLocation(location: { building: string; room: string }): Promise<LocationItem> {
    return this.add<LocationItem>(STORAGE_KEYS.LOCATIONS, location as LocationItem);
  }

  async updateLocation(
    id: string,
    updates: Partial<{ building: string; room: string }>
  ): Promise<LocationItem | null> {
    return this.update<LocationItem>(STORAGE_KEYS.LOCATIONS, id, updates);
  }

  async deleteLocation(id: string): Promise<boolean> {
    return this.delete(STORAGE_KEYS.LOCATIONS, id);
  }

  async exportDatabase(): Promise<void> {
    try {
      const data = {
        printers: await this.getPrinters(),
        models: await this.getModels(),
        parts: await this.getParts(),
        knowledgeBase: await this.getKnowledgeBase(),
        dailyReports: await this.getDailyReports(),
        notes: await this.getNotes(),
        reportsHistory: await this.getReportsHistory(),
        locations: await this.getLocations(),
        exportedAt: new Date().toISOString(),
      };

      const fileUri = FileSystem.cacheDirectory + 'database_backup.json';
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Экспорт базы данных',
          UTI: 'public.json',
        });
      } else {
        console.warn('Sharing is not available on this platform');
      }
    } catch (error) {
      console.error('Error exporting database:', error);
      throw error;
    }
  }

  async importDatabase(): Promise<boolean> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return false;
      }

      const fileUri = result.assets[0].uri;
      const jsonContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const parsed = JSON.parse(jsonContent);
      const data = parsed.data || parsed;

      const newPrinters: Printer[] = data[STORAGE_KEYS.PRINTERS] || data.printers || [];
      const newModels: PrinterModel[] = data[STORAGE_KEYS.MODELS] || data.models || [];
      const newParts: Part[] = data[STORAGE_KEYS.PARTS] || data.parts || [];
      const newKB: KnowledgeBaseEntry[] = data[STORAGE_KEYS.KNOWLEDGE] || data.knowledgeBase || data.knowledge_base || [];
      const newReports: DailyReport[] = data[STORAGE_KEYS.REPORTS] || data.dailyReports || data.daily_reports || [];
      const newNotes: Note[] = data[STORAGE_KEYS.NOTES] || data.notes || [];
      const newHistory: ReportsHistory[] = data[STORAGE_KEYS.HISTORY] || data.reportsHistory || data.reports_history || [];
      const newLocations: LocationItem[] = data[STORAGE_KEYS.LOCATIONS] || data.locations || [];

      await this.enqueueWrite(async () => {
        for (const item of newPrinters) await setDoc(doc(getWorkspaceCollectionRef(STORAGE_KEYS.PRINTERS), item.id || generateId()), item);
        for (const item of newModels) await setDoc(doc(getWorkspaceCollectionRef(STORAGE_KEYS.MODELS), item.id || generateId()), item);
        for (const item of newParts) await setDoc(doc(getWorkspaceCollectionRef(STORAGE_KEYS.PARTS), item.id || generateId()), item);
        for (const item of newKB) await setDoc(doc(getWorkspaceCollectionRef(STORAGE_KEYS.KNOWLEDGE), item.id || generateId()), item);
        for (const item of newReports) await setDoc(doc(getWorkspaceCollectionRef(STORAGE_KEYS.REPORTS), item.id || generateId()), item);
        for (const item of newHistory) await setDoc(doc(getWorkspaceCollectionRef(STORAGE_KEYS.HISTORY), item.id || generateId()), item);
        for (const item of newLocations) await setDoc(doc(getWorkspaceCollectionRef(STORAGE_KEYS.LOCATIONS), item.id || generateId()), item);

        if (newNotes.length > 0) {
          notes = newNotes;
          await this.saveNotesLocally(notes);
        }
      });

      return true;
    } catch (error) {
      console.error('Error importing database:', error);
      throw error;
    }
  }

  async addPrinterLog(log: Omit<PrinterLog, 'id'>): Promise<PrinterLog> {
    return this.enqueueWrite(async () => {
      const id = generateId();
      
      // Если указаны детали для списания (массив или одиночная деталь)
      if (log.partsDeducted && log.partsDeducted.length > 0) {
        const partsList = await this.getParts();
        for (const pItem of log.partsDeducted) {
          const part = partsList.find(p => p.id === pItem.partId);
          if (part) {
            const deductQty = pItem.quantity || 1;
            const newQty = Math.max(0, part.quantity - deductQty);
            await this._update<Part>(STORAGE_KEYS.PARTS, part.id, { quantity: newQty });
            part.quantity = newQty;
          }
        }
      } else if (log.partId) {
        const deductQty = log.quantityDeducted || 1;
        const partsList = await this.getParts();
        const part = partsList.find(p => p.id === log.partId);
        if (part) {
          const newQty = Math.max(0, part.quantity - deductQty);
          await this._update<Part>(STORAGE_KEYS.PARTS, part.id, { quantity: newQty });
        }
      }

      const newLog: PrinterLog = sanitizeData({
        ...log,
        id,
        date: log.date || new Date().toISOString(),
        description: log.description || '',
      });
      await setDoc(doc(getWorkspaceCollectionRef(STORAGE_KEYS.PRINTER_LOGS), id), newLog);
      return newLog;
    });
  }

  async deletePrinterLog(logId: string): Promise<boolean> {
    return this.enqueueWrite(async () => {
      const docRef = doc(getWorkspaceCollectionRef(STORAGE_KEYS.PRINTER_LOGS), logId);
      await deleteDoc(docRef);
      return true;
    });
  }

  async getPrinterLogs(): Promise<PrinterLog[]> {
    if (!currentWorkspaceId) return [];
    try {
      const snap = await getDocs(getWorkspaceCollectionRef(STORAGE_KEYS.PRINTER_LOGS));
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as PrinterLog));
    } catch (e) {
      console.error('Error fetching printer logs:', e);
      return [];
    }
  }

  subscribeToPrinterLogs(printerId: string, callback: (logs: PrinterLog[]) => void): () => void {
    if (!currentWorkspaceId) {
      callback([]);
      return () => {};
    }
    const colRef = getWorkspaceCollectionRef(STORAGE_KEYS.PRINTER_LOGS);
    const unsub = onSnapshot(colRef, snapshot => {
      const allLogs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PrinterLog));
      const filtered = allLogs
        .filter(l => l.printerId === printerId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callback(filtered);
    }, error => {
      console.error('Error listening to printer_logs:', error);
      callback([]);
    });
    return unsub;
  }

  subscribeToPrinters(callback: (printers: Printer[]) => void): () => void {
    if (!currentWorkspaceId) {
      callback([]);
      return () => {};
    }
    const colRef = getWorkspaceCollectionRef(STORAGE_KEYS.PRINTERS);
    return onSnapshot(colRef, snapshot => {
      const printers = snapshot.docs
        .map(d => ({ ...d.data(), id: d.id } as Printer))
        .filter(p => !p.archived);
      callback(printers);
    }, error => {
      console.error('Error listening to printers:', error);
      callback([]);
    });
  }

  subscribeToArchivedPrinters(callback: (printers: Printer[]) => void): () => void {
    if (!currentWorkspaceId) {
      callback([]);
      return () => {};
    }
    const colRef = getWorkspaceCollectionRef(STORAGE_KEYS.PRINTERS);
    return onSnapshot(colRef, snapshot => {
      const printers = snapshot.docs
        .map(d => ({ ...d.data(), id: d.id } as Printer))
        .filter(p => p.archived === true);
      callback(printers);
    }, error => {
      console.error('Error listening to archived printers:', error);
      callback([]);
    });
  }
}

const storageServiceInstance = new StorageService();
export default storageServiceInstance;