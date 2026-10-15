import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import storage from '../services/storage';
import { Ionicons } from '@expo/vector-icons';
import { ensureImmersiveMode } from '../utils/useImmersiveMode';
import { Printer, PrinterModel, PrinterLog, Part, BrandItem } from '../models/types';
import BrandSelector from '../components/BrandSelector';

type ScreenMode = 'list' | 'add' | 'edit';
type ModelManagerMode = 'list' | 'add' | 'edit';

export default function PrintersScreen({ initialPrinterId }: { initialPrinterId?: string }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const [printers, setPrinters] = useState<Printer[]>([]);
  const [archivedPrinters, setArchivedPrinters] = useState<Printer[]>([]);
  const [isArchiveMode, setIsArchiveMode] = useState<boolean>(false);
  const [models, setModels] = useState<PrinterModel[]>([]);
  const [locations, setLocations] = useState<{building: string; room: string}[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ScreenMode>('list');
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [expandedBuildingsInModal, setExpandedBuildingsInModal] = useState<Record<string, boolean>>({});
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [showModelManager, setShowModelManager] = useState(false);
  const [modelManagerMode, setModelManagerMode] = useState<ModelManagerMode>('list');
  const [editingModel, setEditingModel] = useState<PrinterModel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedFormData, setSavedFormData] = useState<{
    name: string;
    serialNumber: string;
    macAddress: string;
    ipAddress: string;
  } | null>(null);

  // Maintenance History state
  const [selectedHistoryPrinter, setSelectedHistoryPrinter] = useState<Printer | null>(null);
  const [historyLogs, setHistoryLogs] = useState<PrinterLog[]>([]);
  const [allPrinterLogs, setAllPrinterLogs] = useState<PrinterLog[]>([]);
  const [showAddLogForm, setShowAddLogForm] = useState(false);
  const [logDescription, setLogDescription] = useState('');
  const [savingLog, setSavingLog] = useState(false);
  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [selectedPartsForLog, setSelectedPartsForLog] = useState<Array<{ part: Part; quantity: number }>>([]);
  const [showLogPartPicker, setShowLogPartPicker] = useState(false);
  const [partSearchQuery, setPartSearchQuery] = useState('');

  // Form state for printer
  const [name, setName] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{building: string; room: string} | null>(null);
  const [isClosedNetwork, setIsClosedNetwork] = useState(false);

  // Form state for model manager
  const [modelName, setModelName] = useState('');
  const [modelDescription, setModelDescription] = useState('');

  useEffect(() => {
    if (!selectedHistoryPrinter) {
      setHistoryLogs([]);
      setShowAddLogForm(false);
      setLogDescription('');
      setSelectedPartsForLog([]);
      setShowLogPartPicker(false);
      return;
    }
    storage.getParts().then(setAvailableParts);
    const unsub = storage.subscribeToPrinterLogs(selectedHistoryPrinter.id, (logs) => {
      setHistoryLogs(logs);
    });
    return () => unsub();
  }, [selectedHistoryPrinter]);

  useEffect(() => {
    loadData();
    const unsubActive = storage.subscribeToPrinters((data) => setPrinters(data));
    const unsubArchived = storage.subscribeToArchivedPrinters((data) => setArchivedPrinters(data));
    return () => {
      unsubActive();
      unsubArchived();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [printersData, archivedData, modelsData, locationsData, brandsData, logsData] = await Promise.all([
        storage.getPrinters(),
        storage.getArchivedPrinters(),
        storage.getModels(),
        storage.getLocations(),
        storage.getBrands(),
        storage.getPrinterLogs(),
      ]);
      setPrinters(printersData);
      setArchivedPrinters(archivedData);
      setModels(modelsData as PrinterModel[]);
      setLocations(locationsData.map(l => ({ building: l.building, room: l.room })));
      setDbBrands(brandsData as BrandItem[]);
      setAllPrinterLogs(logsData);
    } catch (error) {
      console.error('Ошибка загрузки данных в Принтерах:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDeductedPartsCountForPrinter = (printerId: string): number => {
    const pLogs = allPrinterLogs.filter(l => l.printerId === printerId);
    let total = 0;
    for (const log of pLogs) {
      if (log.partsDeducted && log.partsDeducted.length > 0) {
        for (const item of log.partsDeducted) {
          total += (item.quantity || 1);
        }
      } else if (log.partId || log.partName) {
        total += (log.quantityDeducted || 1);
      }
    }
    return total;
  };

  useEffect(() => {
    if (initialPrinterId && printers.length > 0) {
      const printer = printers.find(p => p.id === initialPrinterId);
      if (printer) {
        handleEditPrinter(printer);
      }
    }
  }, [initialPrinterId, printers]);

  const [dbBrands, setDbBrands] = useState<BrandItem[]>([]);
  const [newBrandInput, setNewBrandInput] = useState('');

  const getAvailableBrands = (): string[] => {
    const dbBrandNames = dbBrands.map(b => b.name);
    const printerBrandNames = printers.map(p => p.brand).filter(Boolean) as string[];
    const combined = Array.from(new Set([...dbBrandNames, ...printerBrandNames]));
    return combined.sort((a, b) => a.localeCompare(b, 'ru'));
  };

  const handleSelectBrand = (brandName: string) => {
    setSelectedBrand(brandName);
    setShowBrandPicker(false);
  };

  const handleCreateNewBrand = async () => {
    if (!newBrandInput.trim()) return;
    const brandName = newBrandInput.trim();
    try {
      await storage.addBrand(brandName);
      const updated = await storage.getBrands();
      setDbBrands(updated as BrandItem[]);
      setSelectedBrand(brandName);
      setNewBrandInput('');
      setShowBrandPicker(false);
    } catch (e) {
      console.error('Error adding brand:', e);
    }
  };

  const handleDeleteBrand = async (brandName: string) => {
    try {
      await storage.deleteBrand(brandName);
      const updated = await storage.getBrands();
      setDbBrands(updated as BrandItem[]);
      if (selectedBrand === brandName) {
        setSelectedBrand('');
      }
    } catch (e) {
      console.error('Error deleting brand:', e);
    }
  };

  const resetPrinterForm = () => {
    setName('');
    const available = getAvailableBrands();
    setSelectedBrand(available.length > 0 ? available[0] : '');
    setSelectedModelId(models.length > 0 ? models[0].id : '');
    setSerialNumber('');
    setMacAddress('');
    setIpAddress('');
    setSelectedLocation(null);
    setIsClosedNetwork(false);
    setEditingPrinter(null);
  };

  const resetModelForm = () => {
    setModelName('');
    setModelDescription('');
    setEditingModel(null);
  };

  const handleAddPrinter = () => {
    resetPrinterForm();
    setMode('add');
  };

  const handleEditPrinter = (printer: Printer) => {
    setEditingPrinter(printer);
    setName(printer.name);
    setSelectedBrand(printer.brand || (brands.length > 0 ? brands[0].name : ''));
    setSelectedModelId(printer.modelId);
    setSerialNumber(printer.serialNumber || '');
    setMacAddress(printer.macAddress || '');
    setIpAddress(printer.ipAddress || '');
    setSelectedLocation(printer.location ? { building: printer.location.building, room: printer.location.room } : null);
    setIsClosedNetwork(!!printer.isClosedNetwork);
    setMode('edit');
  };

  const handleDeletePrinter = (printer: Printer) => {
    Alert.alert(
      t('printers.deleteTitle'),
      t('printers.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await storage.deletePrinter(printer.id);
              await loadData();
            } catch (error) {
              console.error('Ошибка удаления принтера:', error);
              Alert.alert(t('common.error'), t('printers.deletePrinterError'));
            }
          },
        },
      ]
    );
  };

  const handleSavePrinter = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('printers.enterPrinterNameError'));
      return;
    }
    if (!selectedBrand) {
      Alert.alert(t('common.error'), t('printers.selectBrandError'));
      return;
    }
    if (!selectedModelId) {
      Alert.alert(t('common.error'), t('printers.selectModelError'));
      return;
    }

    try {
      const location = selectedLocation
        ? { building: selectedLocation.building, room: selectedLocation.room }
        : undefined;

      const printerData = {
        name: name.trim(),
        brand: selectedBrand,
        modelId: selectedModelId,
        serialNumber: serialNumber.trim() || '',
        macAddress: macAddress.trim() || '',
        ipAddress: ipAddress.trim() || '',
        isClosedNetwork,
        ...(selectedLocation ? { location: { building: selectedLocation.building, room: selectedLocation.room } } : {}),
      };

      if (mode === 'add') {
        await storage.addPrinter(printerData);
      } else if (editingPrinter) {
        await storage.updatePrinter(editingPrinter.id, printerData);
      }

      await loadData();
      setMode('list');
      resetPrinterForm();
    } catch (error) {
      console.error('Ошибка сохранения принтера:', error);
      Alert.alert(t('common.error'), t('printers.savePrinterError'));
    }
  };

  const handleCancel = () => {
    setMode('list');
    resetPrinterForm();
  };

  const handleOpenModelPicker = () => {
    Keyboard.dismiss();
    setShowModelPicker(true);
  };

  const handleOpenLocationPicker = () => {
    Keyboard.dismiss();
    setShowLocationPicker(true);
  };

  const handleCloseModelPicker = () => {
    Keyboard.dismiss();
    setShowModelPicker(false);
  };

  const handleCloseLocationPicker = () => {
    Keyboard.dismiss();
    setShowLocationPicker(false);
    ensureImmersiveMode();
  };

  const toggleBuildingInModal = (buildingKey: string) => {
    setExpandedBuildingsInModal(prev => ({
      ...prev,
      [buildingKey]: !prev[buildingKey],
    }));
  };

  const groupedLocations = useMemo(() => {
    const map = new Map<string, Array<{ building: string; room: string }>>();
    for (const loc of locations) {
      const b = loc.building?.trim() || '';
      if (!map.has(b)) {
        map.set(b, []);
      }
      map.get(b)!.push(loc);
    }

    const entries = Array.from(map.entries()).sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b, 'ru');
    });

    return entries.map(([building, items]) => ({
      building,
      items: items.sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true })),
    }));
  }, [locations]);

  const getModelName = (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    return model ? model.name : modelId;
  };

  const getLocationName = (location: {building: string; room: string} | undefined) => {
    if (!location) return t('common.notSpecified');
    return `${location.building}, ${location.room}`;
  };

  // Filter printers by search query
  const currentPrinterList = isArchiveMode ? archivedPrinters : printers;

  const filteredPrinters = currentPrinterList.filter(printer =>
    printer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    printer.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    printer.macAddress?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    printer.ipAddress?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Model Manager functions
  const handleOpenModelManager = () => {
    Keyboard.dismiss();
    resetModelForm();
    setModelManagerMode('list');
    setShowModelManager(true);
  };

  const handleAddModel = () => {
    resetModelForm();
    setModelManagerMode('add');
  };

  const handleEditModel = (model: PrinterModel) => {
    setEditingModel(model);
    setModelName(model.name);
    setModelDescription(model.description || '');
    setModelManagerMode('edit');
  };

  const handleDeleteModel = (model: PrinterModel) => {
    Alert.alert(
      t('printers.deleteModelTitle'),
      t('printers.deleteModelConfirm', { name: model.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await storage.deleteModel(model.id);
              await loadData();
            } catch (error) {
              console.error('Ошибка удаления модели:', error);
              Alert.alert(t('common.error'), t('printers.deleteModelError'));
            }
          },
        },
      ]
    );
  };

  const handleSaveLog = async () => {
    if (!selectedHistoryPrinter) return;
    try {
      setSavingLog(true);
      const partsDeducted = selectedPartsForLog.map(item => ({
        partId: item.part.id,
        partName: `${item.part.partNumber} - ${item.part.description}`,
        quantity: item.quantity,
      }));

      const desc = logDescription.trim() || (partsDeducted.length > 0 ? 'Списание деталей' : 'Обслуживание');

      await storage.addPrinterLog({
        printerId: selectedHistoryPrinter.id,
        date: new Date().toISOString(),
        description: desc,
        partsDeducted: partsDeducted.length > 0 ? partsDeducted : undefined,
        partId: partsDeducted.length === 1 ? partsDeducted[0].partId : undefined,
        partName: partsDeducted.length === 1 ? partsDeducted[0].partName : undefined,
        quantityDeducted: partsDeducted.length === 1 ? partsDeducted[0].quantity : undefined,
      });
      setLogDescription('');
      setSelectedPartsForLog([]);
      setShowAddLogForm(false);

      const [updatedLogs, updatedParts] = await Promise.all([
        storage.getPrinterLogs(),
        storage.getParts(),
      ]);
      setAllPrinterLogs(updatedLogs);
      setAvailableParts(updatedParts);
    } catch (error) {
      console.error('Ошибка сохранения записи:', error);
      Alert.alert(t('common.error'), t('printers.saveLogError'));
    } finally {
      setSavingLog(false);
    }
  };

  const handleDeleteLog = (log: PrinterLog) => {
    Alert.alert(
      t('printers.deleteLogTitle'),
      t('printers.deleteLogConfirmText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await storage.deletePrinterLog(log.id, log);
              const [updatedLogs, updatedParts] = await Promise.all([
                storage.getPrinterLogs(),
                storage.getParts(),
              ]);
              setAllPrinterLogs(updatedLogs);
              setAvailableParts(updatedParts);
            } catch (error) {
              console.error('Ошибка удаления записи:', error);
              Alert.alert(t('common.error'), t('printers.deleteLogError'));
            }
          },
        },
      ]
    );
  };

  const handleSaveModel = async () => {
    if (!modelName.trim()) {
      Alert.alert(t('common.error'), t('printers.enterModelNameError'));
      return;
    }

    try {
      const modelData = {
        name: modelName.trim(),
        description: modelDescription.trim() || '',
      };

      if (modelManagerMode === 'add') {
        await storage.addModel(modelData);
      } else if (editingModel) {
        await storage.updateModel(editingModel.id, modelData);
      }

      await loadData();
      setModelManagerMode('list');
      resetModelForm();
    } catch (error) {
      console.error('Ошибка сохранения модели:', error);
      Alert.alert(t('common.error'), t('printers.saveModelError'));
    }
  };

  const handleCancelModel = () => {
    Keyboard.dismiss();
    setModelManagerMode('list');
    resetModelForm();
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text>{t('common.loading')}</Text>
      </View>
    );
  }

  if (mode === 'add' || mode === 'edit') {
    return (
      <KeyboardAvoidingView 
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{mode === 'add' ? t('printers.addTitle') : t('printers.editTitle')}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('printers.nameLabel')}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="PRN001"
                placeholderTextColor="#999999"
              />
            </View>

            <BrandSelector
              selectedBrand={selectedBrand}
              onSelectBrand={setSelectedBrand}
            />

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('printers.modelLabel')}</Text>
              <View style={styles.pickerRow}>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={handleOpenModelPicker}
                >
                  <Text style={styles.pickerButtonText}>
                    {models.find(m => m.id === selectedModelId)?.name || t('printers.selectModel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.manageModelsButton}
                  onPress={handleOpenModelManager}
                >
                  <Text style={styles.manageModelsButtonText}>✏️</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('printers.serialLabel')}</Text>
              <TextInput
                style={styles.input}
                value={serialNumber}
                onChangeText={setSerialNumber}
                placeholder={t('common.optional')}
                placeholderTextColor="#999999"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('printers.macLabel')}</Text>
              <TextInput
                style={styles.input}
                value={macAddress}
                onChangeText={setMacAddress}
                placeholder={t('common.optional')}
                placeholderTextColor="#999999"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('printers.ipLabel')}</Text>
              <TextInput
                style={styles.input}
                value={ipAddress}
                onChangeText={setIpAddress}
                placeholder={t('common.optional')}
                placeholderTextColor="#999999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('printers.locationLabel')}</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={handleOpenLocationPicker}
              >
                <Text style={styles.pickerButtonText}>
                  {selectedLocation
                    ? `${selectedLocation.building}, ${selectedLocation.room}`
                    : t('printers.selectRoom')}
                </Text>
              </TouchableOpacity>
              <Text style={styles.helpText}>
                {t('printers.locationHelp')}
              </Text>
            </View>

            <View style={[styles.formGroup, styles.switchRow]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.label, { marginBottom: 2 }]}>{t('printers.closedNetwork')}</Text>
                <Text style={[styles.helpText, { marginTop: 0 }]}>
                  {isClosedNetwork ? t('printers.closedNetwork') : t('printers.openNetwork')}
                </Text>
              </View>
              <Switch
                value={isClosedNetwork}
                onValueChange={setIsClosedNetwork}
                trackColor={{ false: '#e0e0e0', true: '#90CAF9' }}
                thumbColor={isClosedNetwork ? '#1976D2' : '#f4f3f4'}
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSavePrinter}>
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>



        {/* Model Picker Modal (внутри формы) */}
        <Modal
          visible={showModelPicker}
          transparent={true}
          animationType="slide"
          statusBarTranslucent={true}
          onRequestClose={() => {
            handleCloseModelPicker();
            ensureImmersiveMode();
          }}
          onShow={() => {
            Keyboard.dismiss();
            ensureImmersiveMode();
          }}
        >
          <TouchableWithoutFeedback onPress={handleCloseModelPicker}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ width: '100%', justifyContent: 'flex-end' }}
              >
                <TouchableWithoutFeedback onPress={() => {}}>
                  <View style={[styles.modalContent, styles.modelPickerContent]}>
                    <View style={styles.modalHeader}>
                      <Text style={[styles.modalTitle, { marginBottom: 0 }]}>{t('printers.selectModel')}</Text>
                    </View>
                    <ScrollView
                      style={styles.modelPickerScroll}
                      contentContainerStyle={{ flexGrow: 0 }}
                      keyboardShouldPersistTaps="handled"
                      scrollEnabled={models.length > 6}
                    >
                      {models.length === 0 ? (
                        <Text style={styles.modalEmptyText}>{t('printers.noModelsAvailable')}</Text>
                      ) : (
                        models.map(model => (
                          <TouchableOpacity
                            key={model.id}
                            style={styles.modalItem}
                            onPress={() => {
                              setSelectedModelId(model.id);
                              handleCloseModelPicker();
                            }}
                          >
                            <Text style={styles.modalItemText}>{model.name}</Text>
                            {selectedModelId === model.id && (
                              <Text style={styles.modalCheck}>✓</Text>
                            )}
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                    <TouchableOpacity
                      style={[styles.modalCancelButton, { paddingBottom: Math.max(insets.bottom, 16) }]}
                      onPress={handleCloseModelPicker}
                    >
                      <Text style={styles.modalCancelText}>{t('common.close')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Location Picker Modal (внутри формы) */}
        <Modal
          visible={showLocationPicker}
          transparent={true}
          animationType="slide"
          statusBarTranslucent={true}
          onRequestClose={() => {
            handleCloseLocationPicker();
            ensureImmersiveMode();
          }}
          onShow={() => {
            Keyboard.dismiss();
            ensureImmersiveMode();
          }}
        >
          <TouchableWithoutFeedback onPress={handleCloseLocationPicker}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ width: '100%', justifyContent: 'flex-end' }}
              >
                <TouchableWithoutFeedback onPress={() => {}}>
                  <View style={styles.modalContent}>
                    <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                      <Text style={styles.modalTitle}>{t('printers.selectRoom')}</Text>
                      {locations.length === 0 ? (
                        <Text style={styles.modalEmptyText}>{t('printers.noRoomsAvailable')}</Text>
                      ) : (
                        groupedLocations.map(group => (
                          <View key={group.building || 'no-building'} style={styles.locationGroup}>
                            <TouchableOpacity
                              style={styles.locationGroupHeader}
                              onPress={() => toggleBuildingInModal(group.building)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.locationGroupTitle}>
                                🏢 {group.building ? group.building : t('printers.noBuilding')}
                              </Text>
                              <View style={styles.sectionRightRow}>
                                <View style={styles.locationGroupBadge}>
                                  <Text style={styles.locationGroupBadgeText}>{group.items.length}</Text>
                                </View>
                                <Ionicons
                                  name={expandedBuildingsInModal[group.building] ? 'chevron-up' : 'chevron-down'}
                                  size={18}
                                  color="#666"
                                  style={{ marginLeft: 6 }}
                                />
                              </View>
                            </TouchableOpacity>
                            {expandedBuildingsInModal[group.building] &&
                              group.items.map(loc => (
                                <TouchableOpacity
                                  key={`${loc.building}-${loc.room}`}
                                  style={styles.modalItem}
                                  onPress={() => {
                                    setSelectedLocation(loc);
                                    handleCloseLocationPicker();
                                  }}
                                >
                                  <Text style={styles.modalItemText}>{loc.room}</Text>
                                  {selectedLocation &&
                                    selectedLocation.building === loc.building &&
                                    selectedLocation.room === loc.room && (
                                      <Text style={styles.modalCheck}>✓</Text>
                                  )}
                                </TouchableOpacity>
                              ))}
                          </View>
                        ))
                      )}
                    </ScrollView>
                    <TouchableOpacity
                      style={[styles.modalCancelButton, { paddingBottom: Math.max(insets.bottom, 16) }]}
                      onPress={handleCloseLocationPicker}
                    >
                      <Text style={styles.modalCancelText}>{t('common.close')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Model Manager Modal (доступен из формы) */}
        <Modal
          visible={showModelManager}
          transparent={true}
          animationType="slide"
          statusBarTranslucent={true}
          onRequestClose={() => {
            Keyboard.dismiss();
            setShowModelManager(false);
            setModelManagerMode('list');
            resetModelForm();
            ensureImmersiveMode();
          }}
          onShow={() => {
            Keyboard.dismiss();
            ensureImmersiveMode();
          }}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ width: '100%', maxHeight: '90%', justifyContent: 'flex-end' }}
            >
              <View style={[styles.modalContent, styles.modelManagerContent]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('printers.modelsManagerTitle')}</Text>
                  {modelManagerMode === 'list' && (
                    <TouchableOpacity style={styles.addModelButton} onPress={handleAddModel}>
                      <Text style={styles.addModelButtonText}>{t('printers.addModelButton')}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {modelManagerMode === 'list' ? (
                  models.length === 0 ? (
                    <Text style={styles.modalEmptyText}>{t('printers.noModels')}</Text>
                  ) : (
                    <ScrollView
                      style={styles.modalScroll}
                      contentContainerStyle={{ flexGrow: 0 }}
                      scrollEnabled={models.length > 6}
                      keyboardShouldPersistTaps="handled"
                    >
                      {models.map(model => (
                        <TouchableOpacity
                          key={model.id}
                          style={styles.modalItem}
                          onPress={() => handleEditModel(model)}
                        >
                          <View style={styles.modalItemContent}>
                            <Text style={styles.modalItemText}>{model.name}</Text>
                            {model.description && (
                              <Text style={styles.modalItemDescription}>{model.description}</Text>
                            )}
                          </View>
                          <View style={styles.modalItemActions}>
                            <TouchableOpacity
                              style={styles.editModelButton}
                              onPress={() => handleEditModel(model)}
                            >
                              <Text style={styles.editModelButtonText}>✏️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.deleteModelButton}
                              onPress={() => handleDeleteModel(model)}
                            >
                              <Text style={styles.deleteModelButtonText}>🗑</Text>
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )
                ) : (
                  <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flexShrink: 1 }}
                  >
                    <ScrollView 
                      style={styles.modalScroll} 
                      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 140 }}
                      keyboardShouldPersistTaps="handled"
                    >
                      <View style={styles.modelForm}>
                        <View style={styles.formGroup}>
                          <Text style={styles.label}>{t('printers.modelNameLabel')}</Text>
                          <TextInput
                            style={styles.input}
                            value={modelName}
                            onChangeText={setModelName}
                            placeholder={t('printers.modelNamePlaceholder')}
                            placeholderTextColor="#999999"
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.label}>{t('printers.modelDescriptionLabel')}</Text>
                          <TextInput
                            style={[styles.input, styles.textArea]}
                            value={modelDescription}
                            onChangeText={setModelDescription}
                            placeholder={t('printers.modelDescriptionPlaceholder')}
                            placeholderTextColor="#999999"
                            multiline
                            numberOfLines={3}
                            autoCapitalize="sentences"
                            autoCorrect={false}
                          />
                        </View>

                        <View style={[styles.buttonRow, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancelModel}>
                            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSaveModel}>
                            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </ScrollView>
                  </KeyboardAvoidingView>
                )}

                {modelManagerMode === 'list' && (
                  <TouchableOpacity
                    style={[styles.modalCancelButton, { paddingBottom: Math.max(insets.bottom, 16) }]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowModelManager(false);
                    }}
                  >
                    <Text style={styles.modalCancelText}>{t('common.close')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{isArchiveMode ? t('printers.archiveTitle') : t('printers.title')}</Text>
            <Text style={styles.subtitle}>
              {isArchiveMode
                ? t('printers.inArchive', { count: archivedPrinters.length })
                : t('printers.totalCount', { count: printers.length })}
            </Text>
          </View>
          <TouchableOpacity
            style={{ marginRight: 15, padding: 4 }}
            onPress={() =>
              Alert.alert(
                t('tabHelp.printers.title'),
                t('tabHelp.printers.message'),
                [{ text: t('tabHelp.button'), style: 'default' }]
              )
            }
            activeOpacity={0.7}
          >
            <Ionicons name="help-circle-outline" size={26} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('printers.searchPlaceholder')}
          placeholderTextColor="#999999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {(archivedPrinters.length > 0 || isArchiveMode) && (
        <TouchableOpacity
          style={styles.archiveToggleButton}
          onPress={() => setIsArchiveMode(!isArchiveMode)}
        >
          <Text style={styles.archiveToggleButtonText}>
            {isArchiveMode ? t('printers.backToActive') : t('printers.archiveModeButton')}
          </Text>
        </TouchableOpacity>
      )}

      {filteredPrinters.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {isArchiveMode ? t('printers.noPrintersInArchive') : t('common.emptyList')}
          </Text>
          {!isArchiveMode && (
            <TouchableOpacity style={styles.emptyButton} onPress={handleAddPrinter}>
              <Text style={styles.emptyButtonText}>{t('common.addFirst')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 30 }]}>
          {filteredPrinters.map(printer => (
            <View key={printer.id} style={styles.printerCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.printerName}>{printer.name}</Text>
                  {printer.brand ? (
                    <Text style={{ fontSize: 12, color: '#007AFF', fontWeight: '600', marginTop: 2 }}>{printer.brand}</Text>
                  ) : null}
                </View>
                <Text style={styles.modelName}>{getModelName(printer.modelId)}</Text>
              </View>

              {printer.serialNumber && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('printers.serialLabelShort')}</Text>
                  <Text style={styles.infoValue}>{printer.serialNumber}</Text>
                </View>
              )}

              {printer.macAddress && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('printers.macLabelShort')}</Text>
                  <Text style={styles.infoValue}>{printer.macAddress}</Text>
                </View>
              )}

              {printer.ipAddress && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('printers.ipLabelShort')}</Text>
                  <Text style={styles.infoValue}>{printer.ipAddress}</Text>
                </View>
              )}

              {printer.location && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('printers.locationLabelShort')}</Text>
                  <Text style={styles.infoValue}>
                    {getLocationName(printer.location)}
                  </Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('printers.networkType')}:</Text>
                <View style={[
                  styles.networkBadge,
                  printer.isClosedNetwork ? styles.networkBadgeClosed : styles.networkBadgeOpen
                ]}>
                  <Ionicons
                    name={printer.isClosedNetwork ? "lock-closed" : "globe-outline"}
                    size={12}
                    color={printer.isClosedNetwork ? "#1565C0" : "#2E7D32"}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[
                    styles.networkBadgeText,
                    printer.isClosedNetwork ? styles.networkBadgeTextClosed : styles.networkBadgeTextOpen
                  ]}>
                    {printer.isClosedNetwork ? t('printers.closedNetwork') : t('printers.openNetwork')}
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.historyButton]}
                  onPress={() => setSelectedHistoryPrinter(printer)}
                >
                  <Text style={styles.historyButtonText}>
                    {t('printers.history')} ({getDeductedPartsCountForPrinter(printer.id)})
                  </Text>
                </TouchableOpacity>

                {isArchiveMode ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.restoreButton]}
                    onPress={async () => {
                      try {
                        await storage.restorePrinter(printer.id);
                        await loadData();
                      } catch (err) {
                        Alert.alert(t('common.error'), t('printers.restorePrinterError'));
                      }
                    }}
                  >
                    <Text style={styles.restoreButtonText}>{t('printers.restore')}</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => handleEditPrinter(printer)}
                    >
                      <Text style={styles.editButtonText}>{t('common.edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeletePrinter(printer)}
                    >
                      <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {!isArchiveMode && printers.length > 0 && !searchQuery && (
        <TouchableOpacity style={styles.fab} onPress={handleAddPrinter}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}



      {/* Model Manager Modal */}
      <Modal
        visible={showModelManager}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowModelManager(false);
          setModelManagerMode('list');
          resetModelForm();
          ensureImmersiveMode();
        }}
        onShow={() => {
          Keyboard.dismiss();
          ensureImmersiveMode();
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', maxHeight: '90%', justifyContent: 'flex-end' }}
          >
            <View style={[styles.modalContent, styles.modelManagerContent]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('printers.modelsManagerTitle')}</Text>
                {modelManagerMode === 'list' && (
                  <TouchableOpacity style={styles.addModelButton} onPress={handleAddModel}>
                    <Text style={styles.addModelButtonText}>{t('printers.addModelButton')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {modelManagerMode === 'list' ? (
                models.length === 0 ? (
                  <Text style={styles.modalEmptyText}>{t('printers.noModels')}</Text>
                ) : (
                  <ScrollView
                    style={styles.modalScroll}
                    contentContainerStyle={{ flexGrow: 0 }}
                    scrollEnabled={models.length > 6}
                    keyboardShouldPersistTaps="handled"
                  >
                    {models.map(model => (
                      <TouchableOpacity
                        key={model.id}
                        style={styles.modalItem}
                        onPress={() => handleEditModel(model)}
                      >
                        <View style={styles.modalItemContent}>
                          <Text style={styles.modalItemText}>{model.name}</Text>
                          {model.description && (
                            <Text style={styles.modalItemDescription}>{model.description}</Text>
                          )}
                        </View>
                        <View style={styles.modalItemActions}>
                          <TouchableOpacity
                            style={styles.editModelButton}
                            onPress={() => handleEditModel(model)}
                          >
                            <Text style={styles.editModelButtonText}>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteModelButton}
                            onPress={() => handleDeleteModel(model)}
                          >
                            <Text style={styles.deleteModelButtonText}>🗑</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )
              ) : (
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                  style={{ flexShrink: 1 }}
                >
                  <ScrollView 
                    style={styles.modalScroll} 
                    contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 140 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View style={styles.modelForm}>
                      <View style={styles.formGroup}>
                        <Text style={styles.label}>{t('printers.modelNameLabel')}</Text>
                        <TextInput
                          style={styles.input}
                          value={modelName}
                          onChangeText={setModelName}
                          placeholder={t('printers.modelNamePlaceholder')}
                          placeholderTextColor="#999999"
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.label}>{t('printers.modelDescriptionLabel')}</Text>
                        <TextInput
                          style={[styles.input, styles.textArea]}
                          value={modelDescription}
                          onChangeText={setModelDescription}
                          placeholder={t('printers.modelDescriptionPlaceholder')}
                          placeholderTextColor="#999999"
                          multiline
                          numberOfLines={3}
                          autoCapitalize="sentences"
                          autoCorrect={false}
                        />
                      </View>

                      <View style={[styles.buttonRow, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancelModel}>
                          <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSaveModel}>
                          <Text style={styles.saveButtonText}>{t('common.save')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </ScrollView>
                </KeyboardAvoidingView>
              )}

              {modelManagerMode === 'list' && (
                <TouchableOpacity
                  style={[styles.modalCancelButton, { paddingBottom: Math.max(insets.bottom, 16) }]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowModelManager(false);
                  }}
                >
                  <Text style={styles.modalCancelText}>{t('common.close')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Maintenance History Modal */}
      <Modal
        visible={selectedHistoryPrinter !== null}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onShow={ensureImmersiveMode}
        onRequestClose={() => {
          setSelectedHistoryPrinter(null);
          ensureImmersiveMode();
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setSelectedHistoryPrinter(null)}>
            <View style={styles.modalBackdropTouch} />
          </TouchableWithoutFeedback>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.historyModalContainer}
          >
            <View style={styles.historyModalContent}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle} numberOfLines={1}>
                  {t('printers.historyTitle', { name: selectedHistoryPrinter?.name })}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelectedHistoryPrinter(null)}
                >
                  <Text style={styles.closeButtonText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.addLogToggleButton}
                onPress={() => setShowAddLogForm(prev => !prev)}
              >
                <Text style={styles.addLogToggleText}>
                  {showAddLogForm ? t('printers.hideForm') : t('printers.addLog')}
                </Text>
              </TouchableOpacity>

              {showAddLogForm && (
                <View style={styles.logFormContainer}>
                  <TextInput
                    style={styles.logInput}
                    placeholder={t('printers.workDescriptionPlaceholder')}
                    placeholderTextColor="#999999"
                    value={logDescription}
                    onChangeText={setLogDescription}
                    multiline
                    numberOfLines={3}
                  />

                  <View style={styles.logPartSection}>
                    <Text style={styles.formSectionLabel}>{t('printers.writeOffPartsTitle')}</Text>
                    {selectedPartsForLog.length > 0 && (
                      <View style={{ marginBottom: 8 }}>
                        {selectedPartsForLog.map((item, index) => (
                          <View key={item.part.id} style={[styles.selectedPartBadgeRow, { marginBottom: 6 }]}>
                            <Text style={[styles.selectedPartBadgeText, { flex: 1 }]}>
                              🔧 {item.part.partNumber} — {item.part.description} ({item.quantity} {t('common.pcs')})
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <TouchableOpacity
                                style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#eee', borderRadius: 4 }}
                                onPress={() => {
                                  setSelectedPartsForLog(prev => prev.map((p, i) => i === index ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p));
                                }}
                              >
                                <Text style={{ fontSize: 13, fontWeight: 'bold' }}>-</Text>
                              </TouchableOpacity>
                              <Text style={{ fontSize: 13, fontWeight: 'bold', minWidth: 16, textAlign: 'center' }}>{item.quantity}</Text>
                              <TouchableOpacity
                                style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#eee', borderRadius: 4 }}
                                onPress={() => {
                                  setSelectedPartsForLog(prev => prev.map((p, i) => i === index ? { ...p, quantity: Math.min(p.part.quantity, p.quantity + 1) } : p));
                                }}
                              >
                                <Text style={{ fontSize: 13, fontWeight: 'bold' }}>+</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.clearPartBtn}
                                onPress={() => {
                                  setSelectedPartsForLog(prev => prev.filter((_, i) => i !== index));
                                }}
                              >
                                <Text style={styles.clearPartText}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.selectPartBtn}
                      onPress={() => setShowLogPartPicker(true)}
                    >
                      <Text style={styles.selectPartBtnText}>{t('printers.addPartsForWriteOff')}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.logFormButtons}>
                    <TouchableOpacity
                      style={styles.logCancelButton}
                      onPress={() => {
                        setShowAddLogForm(false);
                        setLogDescription('');
                        setSelectedPartsForLog([]);
                      }}
                    >
                      <Text style={styles.logCancelButtonText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.logSaveButton, savingLog && { opacity: 0.6 }]}
                      onPress={handleSaveLog}
                      disabled={savingLog}
                    >
                      <Text style={styles.logSaveButtonText}>
                        {savingLog ? t('common.saving') : t('common.save')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <ScrollView 
                style={styles.historyListScroll} 
                contentContainerStyle={styles.historyListContent}
                showsVerticalScrollIndicator={true}
              >
                {historyLogs.length === 0 ? (
                  <Text style={styles.noLogsText}>{t('printers.emptyHistory')}</Text>
                ) : (
                  historyLogs.map(item => {
                    const formattedDate = new Date(item.date).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <View key={item.id} style={styles.logCard}>
                        <View style={styles.logCardHeader}>
                          <Text style={styles.logDate}>{formattedDate}</Text>
                          <TouchableOpacity
                            style={styles.deleteLogBtn}
                            onPress={() => handleDeleteLog(item)}
                          >
                            <Text style={styles.deleteLogText}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.logDescription}>{item.description}</Text>
                        {item.partsDeducted && item.partsDeducted.length > 0 ? (
                          <View style={styles.partBadgeContainer}>
                            {item.partsDeducted.map((pDeduct, pIdx) => (
                              <Text key={pIdx} style={styles.partBadgeText}>
                                {t('printers.deductedWithQty', { name: pDeduct.partName, qty: pDeduct.quantity })}
                              </Text>
                            ))}
                          </View>
                        ) : item.partName ? (
                          <View style={styles.partBadgeContainer}>
                            <Text style={styles.partBadgeText}>
                              {item.quantityDeducted
                                ? t('printers.deductedWithQty', { name: item.partName, qty: item.quantityDeducted })
                                : t('printers.deducted', { name: item.partName })}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Log Part Picker Modal */}
      <Modal
        visible={showLogPartPicker}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onShow={ensureImmersiveMode}
        onRequestClose={() => {
          setShowLogPartPicker(false);
          setPartSearchQuery('');
          ensureImmersiveMode();
        }}
      >
        <TouchableWithoutFeedback onPress={() => { setShowLogPartPicker(false); setPartSearchQuery(''); ensureImmersiveMode(); }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('printers.selectPartsModalTitle')}</Text>

                <TextInput
                  style={styles.input}
                  value={partSearchQuery}
                  onChangeText={setPartSearchQuery}
                  placeholder={t('parts.searchPlaceholder')}
                  placeholderTextColor="#999999"
                />

                <ScrollView style={styles.modalScroll}>
                  {(() => {
                    const filteredLogParts = availableParts.filter(part => {
                      const isCompatible = selectedHistoryPrinter
                        ? part.compatibleModels && part.compatibleModels.includes(selectedHistoryPrinter.modelId)
                        : true;
                      if (!isCompatible) return false;

                      if (!partSearchQuery.trim()) return true;
                      const q = partSearchQuery.toLowerCase().trim();
                      return (
                        part.partNumber.toLowerCase().includes(q) ||
                        part.description.toLowerCase().includes(q)
                      );
                    });

                    if (filteredLogParts.length === 0) {
                      return (
                        <Text style={styles.modalEmptyText}>
                          {partSearchQuery ? t('common.notFound') : t('printers.noCompatiblePartsInStock')}
                        </Text>
                      );
                    }

                    return filteredLogParts.map(part => {
                      const isSelected = selectedPartsForLog.some(p => p.part.id === part.id);
                      return (
                        <TouchableOpacity
                          key={part.id}
                          style={styles.modalItem}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedPartsForLog(prev => prev.filter(p => p.part.id !== part.id));
                            } else {
                              setSelectedPartsForLog(prev => [...prev, { part, quantity: 1 }]);
                            }
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.modalItemText}>
                              {part.partNumber} — {part.description}
                            </Text>
                            <Text style={styles.modalItemDescription}>
                              {t('printers.inStockCount', { count: part.quantity })}
                            </Text>
                          </View>
                          {isSelected && <Text style={styles.modalCheck}>✓</Text>}
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </ScrollView>

                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowLogPartPicker(false);
                    setPartSearchQuery('');
                    ensureImmersiveMode();
                  }}
                >
                  <Text style={styles.modalCancelText}>{t('common.done')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Brand Picker Modal */}
      <Modal
        visible={showBrandPicker}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onShow={ensureImmersiveMode}
        onRequestClose={() => {
          setShowBrandPicker(false);
          ensureImmersiveMode();
        }}
      >
        <TouchableWithoutFeedback onPress={() => setShowBrandPicker(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('printers.selectBrand')}</Text>
                <ScrollView style={styles.modalScroll}>
                  {brands.length === 0 ? (
                    <Text style={styles.modalEmptyText}>{t('printers.noBrandsAvailable')}</Text>
                  ) : (
                    brands.map(b => (
                      <TouchableOpacity
                        key={b.id || b.name}
                        style={styles.modalItem}
                        onPress={() => {
                          setSelectedBrand(b.name);
                          setShowBrandPicker(false);
                        }}
                      >
                        <Text style={styles.modalItemText}>{b.name}</Text>
                        {selectedBrand === b.name && (
                          <Text style={styles.modalCheck}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowBrandPicker(false)}
                >
                  <Text style={styles.modalCancelText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#007AFF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  searchContainer: {
    padding: 15,
    backgroundColor: 'white',
    margin: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    color: '#000000',
    backgroundColor: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    padding: 15,
  },
  printerCard: {
    backgroundColor: 'white',
    marginBottom: 10,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  printerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modelName: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    width: 120,
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  networkBadgeClosed: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  networkBadgeOpen: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  networkBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  networkBadgeTextClosed: {
    color: '#1565C0',
  },
  networkBadgeTextOpen: {
    color: '#2E7D32',
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    justifyContent: 'space-between',
    gap: 6,
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyButton: {
    backgroundColor: '#E8F5E9',
  },
  historyButtonText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#E3F2FD',
  },
  editButtonText: {
    color: '#1976D2',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  deleteButtonText: {
    color: '#C62828',
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdropTouch: {
    flex: 1,
    width: '100%',
  },
  historyModalContainer: {
    width: '100%',
    height: '85%',
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  historyModalContent: {
    flex: 1,
    width: '100%',
    padding: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#eee',
    borderRadius: 6,
  },
  closeButtonText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  addLogToggleButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  addLogToggleText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logFormContainer: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  formSectionLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 6,
  },
  logPartSection: {
    marginBottom: 10,
  },
  selectedPartBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  selectedPartBadgeText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
  },
  clearPartBtn: {
    padding: 4,
  },
  clearPartText: {
    fontSize: 14,
    color: '#C62828',
    fontWeight: 'bold',
  },
  selectPartBtn: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  selectPartBtnText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '600',
  },
  logInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#000000',
    marginBottom: 10,
    textAlignVertical: 'top',
  },
  logFormButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  logSaveButton: {
    backgroundColor: '#34C759',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  logSaveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  logCancelButton: {
    backgroundColor: '#eee',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  logCancelButtonText: {
    color: '#333',
    fontSize: 13,
  },
  historyListScroll: {
    flex: 1,
    width: '100%',
  },
  historyListContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  logCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  deleteLogBtn: {
    padding: 4,
  },
  deleteLogText: {
    fontSize: 14,
  },
  logDate: {
    fontSize: 11,
    color: '#888',
  },
  logDescription: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  partBadgeContainer: {
    marginTop: 6,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  partBadgeText: {
    fontSize: 11,
    color: '#2E7D32',
    fontWeight: '600',
  },
  noLogsText: {
    textAlign: 'center',
    color: '#888',
    marginVertical: 20,
    fontSize: 14,
  },
  formScroll: {
    flex: 1,
  },
  form: {
    padding: 15,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    flex: 1,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  manageModelsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manageModelsButtonText: {
    fontSize: 20,
  },
  helpText: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  locationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  locationInput: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#673AB7',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#673AB7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    fontSize: 30,
    color: 'white',
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.8,
  },
  modelPickerContent: {
    maxHeight: Dimensions.get('window').height * 0.8,
  },
  modelPickerScroll: {
    maxHeight: Dimensions.get('window').height * 0.65,
  },
  modelManagerContent: {
    maxHeight: Dimensions.get('window').height * 0.85,
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  addModelButton: {
    backgroundColor: '#673AB7',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  addModelButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  locationGroup: {
    marginBottom: 8,
  },
  locationGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F3F5',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E9ECEF',
  },
  sectionRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#495057',
    letterSpacing: 0.3,
  },
  locationGroupBadge: {
    backgroundColor: '#E2E6EA',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  locationGroupBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6C757D',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  modalItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editModelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModelButtonText: {
    fontSize: 16,
  },
  deleteModelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModelButtonText: {
    fontSize: 16,
  },
  modalCheck: {
    fontSize: 20,
    color: '#673AB7',
    fontWeight: 'bold',
  },
  modalCancelButton: {
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
  modelForm: {
    padding: 15,
  },
  modalScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  archiveToggleButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-end',
    marginRight: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  archiveToggleButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  restoreButton: {
    backgroundColor: '#E8F5E9',
  },
  restoreButtonText: {
    color: '#2E7D32',
    fontWeight: 'bold',
    fontSize: 13,
  },
  pickerSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerSelectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  pickerPlaceholderText: {
    fontSize: 14,
    color: '#999',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#666',
  },
  brandItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  brandItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  brandItemText: {
    fontSize: 15,
    color: '#333',
  },
  brandItemTextSelected: {
    fontWeight: 'bold',
    color: '#1976D2',
  },
  createBrandSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  createBrandLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  addBrandButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBrandButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    marginTop: 12,
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  deleteBrandIconButton: {
    padding: 6,
    marginLeft: 8,
  },
  deleteBrandIconText: {
    fontSize: 16,
  },
});
