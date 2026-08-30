import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import storage from '../services/storage';
import { Ionicons } from '@expo/vector-icons';
import { KnowledgeBaseEntry, Part, PrinterModel, BrandItem } from '../models/types';
import BrandSelector from '../components/BrandSelector';

type ScreenMode = 'list' | 'add' | 'edit';
type PartEditorMode = 'none' | 'add' | 'edit';

export default function KnowledgeBaseScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterBrand, setSelectedFilterBrand] = useState('Все');
  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [models, setModels] = useState<PrinterModel[]>([]);
  const [dbBrands, setDbBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ScreenMode>('list');
  const [editingEntry, setEditingEntry] = useState<KnowledgeBaseEntry | null>(null);
  const [expandedPartId, setExpandedPartId] = useState<string | null>(null);
  
  // Part editor state
  const [partEditorMode, setPartEditorMode] = useState<PartEditorMode>('none');
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [partNumber, setPartNumber] = useState('');
  const [partDescription, setPartDescription] = useState('');
  const [partQuantity, setPartQuantity] = useState('0');
  const [selectedPartLocation, setSelectedPartLocation] = useState<{building: string; room: string} | null>(null);
  const [selectedPartModelIds, setSelectedPartModelIds] = useState<string[]>([]);
  const [showPartLocationPicker, setShowPartLocationPicker] = useState(false);
  const [showPartModelPicker, setShowPartModelPicker] = useState(false);
  const [locations, setLocations] = useState<{building: string; room: string}[]>([]);
  
  // Brand state
  const [selectedBrand, setSelectedBrand] = useState('');
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [newBrandInput, setNewBrandInput] = useState('');

  // KB Compatible Models state
  const [selectedKBModelIds, setSelectedKBModelIds] = useState<string[]>([]);
  const [showKBModelPicker, setShowKBModelPicker] = useState(false);
  const [newKBModelInput, setNewKBModelInput] = useState('');

  // Main form state (for Knowledge Base entry)
  const [errorCode, setErrorCode] = useState('');
  const [title, setTitle] = useState('');
  const [solution, setSolution] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [newStep, setNewStep] = useState('');
  
  // Parts picker state
  const [showPartsPicker, setShowPartsPicker] = useState(false);
  const [partsSearchQuery, setPartsSearchQuery] = useState('');
  
  // Saved form data for pickers
  const [savedFormData, setSavedFormData] = useState<{
    errorCode: string;
    title: string;
    solution: string;
    brand: string;
    compatibleModels: string[];
    steps: string[];
    selectedPartIds: string[];
    newStep: string;
    partNumber: string;
    partDescription: string;
    partQuantity: string;
    building: string;
    room: string;
    selectedPartModelIds: string[];
  } | null>(null);

  // State to control main modal visibility
  const [isMainModalVisible, setIsMainModalVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [entriesData, partsData, modelsData, locationsData, brandsData] = await Promise.all([
        storage.getKnowledgeBase(),
        storage.getParts(),
        storage.getModels(),
        storage.getLocations(),
        storage.getBrands(),
      ]);
      setEntries(entriesData);
      setParts(partsData as Part[]);
      setModels(modelsData as PrinterModel[]);
      setLocations(locationsData.map(loc => ({ building: loc.building, room: loc.room })));
      setDbBrands(brandsData);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableBrands = () => {
    return Array.from(new Set(dbBrands.map(b => b.name))).sort((a, b) => a.localeCompare(b));
  };

  const handleSelectBrand = (brand: string) => {
    setSelectedBrand(brand);
    setShowBrandPicker(false);
  };

  const handleCreateNewBrand = async () => {
    const trimmed = newBrandInput.trim();
    if (!trimmed) {
      Alert.alert('Ошибка', 'Введите название бренда');
      return;
    }
    const created = await storage.addBrand(trimmed);
    setDbBrands(prev => {
      if (prev.some(b => b.name.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, created];
    });
    setSelectedBrand(trimmed);
    setNewBrandInput('');
    const updatedBrands = await storage.getBrands();
    setDbBrands(updatedBrands);
    setShowBrandPicker(false);
  };

  const handleDeleteBrand = (brandName: string) => {
    Alert.alert(
      'Удалить бренд?',
      `Вы уверены, что хотите удалить бренд "${brandName}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Да',
          style: 'destructive',
          onPress: async () => {
            // Мгновенное обновление локального стейта
            setDbBrands(prev => prev.filter(b => b.name.toLowerCase() !== brandName.toLowerCase()));
            if (selectedBrand.toLowerCase() === brandName.toLowerCase()) {
              setSelectedBrand('');
            }
            if (selectedFilterBrand.toLowerCase() === brandName.toLowerCase()) {
              setSelectedFilterBrand('Все');
            }
            await storage.deleteBrand(brandName);
            const updatedBrands = await storage.getBrands();
            setDbBrands(updatedBrands);
          },
        },
      ]
    );
  };

  const getModelsForSelectedBrand = () => {
    if (!selectedBrand) return [];
    return models.filter(model => {
      if (model.brand) {
        return model.brand.toLowerCase() === selectedBrand.toLowerCase();
      }
      return model.name.toLowerCase().startsWith(selectedBrand.toLowerCase()) ||
             model.name.toLowerCase().includes(selectedBrand.toLowerCase());
    });
  };

  const handleAddNewKBModel = async () => {
    if (!newKBModelInput.trim()) {
      Alert.alert('Ошибка', 'Введите название модели');
      return;
    }
    const rawName = newKBModelInput.trim();
    const fullModelName = rawName.toLowerCase().includes(selectedBrand.toLowerCase())
      ? rawName
      : `${selectedBrand} ${rawName}`;
    try {
      const newModel = await storage.addModel({
        name: fullModelName,
        brand: selectedBrand,
      });
      setModels(prev => [...prev, newModel]);
      setSelectedKBModelIds(prev => [...prev, newModel.id]);
      setNewKBModelInput('');
      Alert.alert('Успех', `Модель "${newModel.name}" создана`);
    } catch (e) {
      console.error('Ошибка создания модели:', e);
      Alert.alert('Ошибка', 'Не удалось добавить модель');
    }
  };

  const toggleKBModelSelection = (modelId: string) => {
    setSelectedKBModelIds(prev =>
      prev.includes(modelId) ? prev.filter(id => id !== modelId) : [...prev, modelId]
    );
  };

  const resetForm = () => {
    setSelectedBrand('');
    setErrorCode('');
    setTitle('');
    setSolution('');
    setSteps([]);
    setSelectedPartIds([]);
    setSelectedKBModelIds([]);
    setNewStep('');
    setEditingEntry(null);
  };

  const handleAddEntry = () => {
    resetForm();
    setMode('add');
    setIsMainModalVisible(true);
  };

  const handleEditEntry = (entry: KnowledgeBaseEntry) => {
    setEditingEntry(entry);
    setSelectedBrand(entry.brand || '');
    setErrorCode(entry.errorCode);
    setTitle(entry.title);
    setSolution(entry.solution);
    setSteps(entry.steps || []);
    setSelectedPartIds(entry.relatedParts || []);
    setSelectedKBModelIds(entry.compatibleModels || []);
    setMode('edit');
    setIsMainModalVisible(true);
  };

  const handleDeleteEntry = (entry: KnowledgeBaseEntry) => {
    Alert.alert(
      t('kb.deleteTitle'),
      t('kb.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await storage.deleteKnowledgeEntry(entry.id);
              await loadData();
            } catch (error) {
              console.error('Ошибка удаления записи:', error);
              Alert.alert(t('common.error'), 'Не удалось удалить запись');
            }
          },
        },
      ]
    );
  };

  // Part selection
  const togglePartSelection = (partId: string) => {
    setSelectedPartIds(prev =>
      prev.includes(partId)
        ? prev.filter(id => id !== partId)
        : [...prev, partId]
    );
  };

  // Filter parts for picker: only parts matching selectedKBModelIds (or selectedBrand if no models selected) AND search query
  const filteredPartsForPicker = parts.filter(part => {
    if (!selectedBrand) return false;
    let matchesModelOrBrand = false;

    if (selectedKBModelIds.length > 0) {
      matchesModelOrBrand = part.compatibleModels.some(modelId => selectedKBModelIds.includes(modelId));
    } else {
      if (part.brand) {
        matchesModelOrBrand = part.brand.toLowerCase() === selectedBrand.toLowerCase();
      } else {
        matchesModelOrBrand = part.compatibleModels.some(modelId => {
          const m = models.find(mod => mod.id === modelId);
          return m ? (m.brand?.toLowerCase() === selectedBrand.toLowerCase() || m.name.toLowerCase().includes(selectedBrand.toLowerCase())) : false;
        });
      }
    }

    const matchesSearch =
      part.partNumber.toLowerCase().includes(partsSearchQuery.toLowerCase()) ||
      part.description.toLowerCase().includes(partsSearchQuery.toLowerCase());
    return matchesModelOrBrand && matchesSearch;
  });

  // Step management
  const addStep = () => {
    if (newStep.trim()) {
      setSteps(prev => [...prev, newStep.trim()]);
      setNewStep('');
    }
  };

  const removeStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  // Part editor functions with form save
  const handleOpenPartEditor = (part?: Part) => {
    // Сохраняем текущие данные формы Knowledge Base
    setSavedFormData({
      errorCode: errorCode,
      title: title,
      solution: solution,
      brand: selectedBrand,
      compatibleModels: [...selectedKBModelIds],
      steps: [...steps],
      selectedPartIds: [...selectedPartIds],
      newStep: newStep,
      partNumber: partNumber,
      partDescription: partDescription,
      partQuantity: partQuantity,
      building: '',
      room: '',
      selectedPartModelIds: selectedPartModelIds,
    });
    
    if (part) {
      setEditingPart(part);
      setPartNumber(part.partNumber);
      setPartDescription(part.description);
      setPartQuantity(part.quantity.toString());
      setSelectedPartLocation(part.location ? { building: part.location.building, room: part.location.room } : null);
      setSelectedPartModelIds(part.compatibleModels);
      setPartEditorMode('edit');
    } else {
      setEditingPart(null);
      setPartNumber('');
      setPartDescription('');
      setPartQuantity('0');
      setSelectedPartLocation(null);
      setSelectedPartModelIds([]);
      setPartEditorMode('add');
    }
    
    // Закрываем основную форму и открываем редактор детали
    setIsMainModalVisible(false);
  };

  const handleClosePartEditor = (overrideSelectedPartIds?: string[]) => {
    setPartEditorMode('none');
    setEditingPart(null);
    // Восстанавливаем форму Knowledge Base и данные части
    if (savedFormData) {
      setErrorCode(savedFormData.errorCode);
      setTitle(savedFormData.title);
      setSolution(savedFormData.solution);
      setSelectedBrand(savedFormData.brand);
      setSelectedKBModelIds(savedFormData.compatibleModels);
      setSteps(savedFormData.steps);
      // Если передан override — берём его, иначе берём снапшот
      setSelectedPartIds(overrideSelectedPartIds ?? savedFormData.selectedPartIds);
      setNewStep(savedFormData.newStep);
      setPartNumber(savedFormData.partNumber);
      setPartDescription(savedFormData.partDescription);
      setPartQuantity(savedFormData.partQuantity);
      setSelectedPartLocation(null);
      setSelectedPartModelIds(savedFormData.selectedPartModelIds);
      setSavedFormData(null);
    }
    // Возвращаем форму Knowledge Base
    setIsMainModalVisible(true);
  };

  const handleOpenPartsPicker = () => {
    setShowPartsPicker(true);
  };

  const handleClosePartsPicker = () => {
    setShowPartsPicker(false);
    setPartsSearchQuery('');
  };

  const handleOpenPartLocationPicker = () => {
    setShowPartLocationPicker(true);
  };

  const handleClosePartLocationPicker = () => {
    setShowPartLocationPicker(false);
  };

  const handleSelectLocation = (loc: {building: string; room: string}) => {
    setSelectedPartLocation(loc);
    setShowPartLocationPicker(false);
  };

  const handleOpenPartModelPicker = () => {
    setShowPartModelPicker(true);
  };

  const handleClosePartModelPicker = () => {
    setShowPartModelPicker(false);
  };

  const handleSavePartFromEditor = async () => {
    if (!partNumber.trim()) {
      Alert.alert('Ошибка', 'Введите парт-номер');
      return;
    }
    if (!partDescription.trim()) {
      Alert.alert('Ошибка', 'Введите наименование');
      return;
    }
    if (selectedPartModelIds.length === 0) {
      Alert.alert('Ошибка', 'Выберите хотя бы одну совместимую модель');
      return;
    }

    const qty = parseInt(partQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Ошибка', 'Введите корректное количество');
      return;
    }

    try {
      const location = selectedPartLocation
        ? { building: selectedPartLocation.building, room: selectedPartLocation.room }
        : undefined;

      const partData = {
        partNumber: partNumber.trim(),
        description: partDescription.trim(),
        brand: selectedBrand || undefined,
        compatibleModels: selectedPartModelIds,
        quantity: qty,
        location,
      };

      let newPart: Part | null = null;
      if (partEditorMode === 'add') {
        newPart = await storage.addPart(partData);
      } else if (editingPart) {
        newPart = await storage.updatePart(editingPart.id, partData);
      } else {
        return;
      }

      if (!newPart) return;
      const savedPart = newPart;

      // Сразу обновляем локальный стейт деталей — без полного перезапуска экрана
      setParts(prev => {
        const idx = prev.findIndex(p => p.id === savedPart.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = savedPart;
          return updated;
        }
        return [...prev, savedPart];
      });

      // Вычисляем обновлённый список выбранных деталей СИНХРОННО
      let updatedSelectedPartIds: string[] | undefined;
      if (mode === 'edit' || mode === 'add') {
        const currentSaved = savedFormData?.selectedPartIds ?? [];
        updatedSelectedPartIds = currentSaved.includes(newPart.id)
          ? currentSaved
          : [...currentSaved, newPart.id];
      }

      // Закрываем Part Editor, передавая обновлённый список выбранных деталей
      handleClosePartEditor(updatedSelectedPartIds);
      // Закрываем пикер деталей
      setShowPartsPicker(false);
    } catch (error) {
      console.error('Ошибка сохранения детали:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить деталь');
    }
  };

  const handleSaveEntry = async () => {
    if (!selectedBrand.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, выберите Бренд');
      return;
    }
    if (!errorCode.trim()) {
      Alert.alert('Ошибка', 'Введите код ошибки');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Ошибка', 'Введите краткое описание');
      return;
    }
    if (!solution.trim()) {
      Alert.alert('Ошибка', 'Введите решение');
      return;
    }

    try {
      const entryData = {
        errorCode: errorCode.trim(),
        title: title.trim(),
        solution: solution.trim(),
        brand: selectedBrand.trim(),
        compatibleModels: selectedKBModelIds || [],
        relatedParts: selectedPartIds || [],
        steps: steps || [],
      };

      if (mode === 'add') {
        await storage.addKnowledgeEntry(entryData);
      } else if (editingEntry) {
        await storage.updateKnowledgeEntry(editingEntry.id, entryData);
      }

      await loadData();
      setMode('list');
      setIsMainModalVisible(false);
      resetForm();
    } catch (error) {
      console.error('Ошибка сохранения записи:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить запись');
    }
  };

  const handleCancel = () => {
    setMode('list');
    setIsMainModalVisible(false);
    resetForm();
  };

  const getPartById = (partId: string) => {
    return parts.find(p => p.id === partId);
  };

  const getModelName = (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    return model ? model.name : modelId;
  };

  const getLocationName = (location: {building: string; room: string} | undefined) => {
    if (!location) return 'Не указано';
    return `${location.building}, к. ${location.room}`;
  };

  const getFilterBrandList = () => {
    const available = getAvailableBrands();
    return ['Все', ...available];
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch =
      entry.errorCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBrand =
      selectedFilterBrand === 'Все' ||
      (entry.brand && entry.brand.toLowerCase() === selectedFilterBrand.toLowerCase());
    return matchesSearch && matchesBrand;
  });

  const renderPartStatus = (partId: string) => {
    const part = getPartById(partId);
    if (!part) {
      return <Text style={styles.partNotAvailable}>Деталь не найдена</Text>;
    }

    // Находим все экземпляры этой детали в разных локациях
    const allPartInstances = parts.filter(p => p.partNumber === part.partNumber);
    const totalQuantity = allPartInstances.reduce((sum, p) => sum + p.quantity, 0);
    const isAvailable = totalQuantity > 0;
    const isExpanded = expandedPartId === partId;

    return (
      <View style={styles.partStatusContainer}>
        <TouchableOpacity
          style={styles.partHeader}
          onPress={() => setExpandedPartId(isExpanded ? null : partId)}
        >
          <View style={styles.partInfo}>
            <Text style={styles.partName}>{part.partNumber} - {part.description}</Text>
            <Text style={styles.partCompatible}>
              Совместимо: {part.compatibleModels.map(id => getModelName(id)).join(', ')}
            </Text>
          </View>
          <View style={styles.partQuantityInfo}>
            <Text style={[
              styles.partQuantity,
              isAvailable ? styles.quantityPositive : styles.quantityZero
            ]}>
              {isAvailable ? `✓ ${totalQuantity}` : `✗ 0`}
            </Text>
            <Text style={styles.partLocation}>
              {isExpanded ? '▲ Свернуть' : '▼ Подробнее'}
            </Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.locationsBreakdown}>
            <Text style={styles.locationsTitle}>Распределение по помещениям:</Text>
            {allPartInstances.length === 0 ? (
              <Text style={styles.noStockText}>Нет в наличии</Text>
            ) : (
              allPartInstances.map((instance, idx) => (
                <View key={idx} style={styles.locationRow}>
                  <Text style={styles.locationBuilding}>{instance.location?.building || 'Не указан'}</Text>
                  <Text style={styles.locationRoom}>к. {instance.location?.room || '?'}</Text>
                  <Text style={[
                    styles.locationQuantity,
                    instance.quantity > 0 ? styles.quantityPositive : styles.quantityZero
                  ]}>
                    {instance.quantity} шт.
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Main List View */}
      {mode === 'list' && (
        <>
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.title}>{t('kb.title')}</Text>
              <TouchableOpacity
                style={{ marginRight: 15, padding: 4 }}
                onPress={() => console.log('Открыть справку')}
                activeOpacity={0.7}
              >
                <Ionicons name="help-circle-outline" size={26} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('kb.searchPlaceholder')}
              placeholderTextColor="#999999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Brand Filter Chips */}
          <View style={styles.brandFilterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandChipsScroll}>
              {getFilterBrandList().map(brandName => {
                const isSelected = selectedFilterBrand === brandName;
                return (
                  <TouchableOpacity
                    key={brandName}
                    style={[
                      styles.brandFilterChip,
                      isSelected && styles.brandFilterChipSelected
                    ]}
                    onPress={() => setSelectedFilterBrand(brandName)}
                  >
                    <Text style={[
                      styles.brandFilterChipText,
                      isSelected && styles.brandFilterChipTextSelected
                    ]}>
                      {brandName === 'Все' ? t('common.all') : brandName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {filteredEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('kb.emptyList')}</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={handleAddEntry}>
                <Text style={styles.emptyButtonText}>{t('kb.addFirst')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 30 }]}>
              {filteredEntries.map(entry => (
                <View key={entry.id} style={styles.errorCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      {entry.brand ? (
                        <View style={styles.brandBadge}>
                          <Text style={styles.brandBadgeText}>{entry.brand}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.errorCode}>{entry.errorCode}</Text>
                      <Text style={styles.errorTitle}>{entry.title}</Text>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.editButton]}
                        onPress={() => handleEditEntry(entry)}
                      >
                        <Text style={styles.editButtonText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteEntry(entry)}
                      >
                        <Text style={styles.deleteButtonText}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {entry.compatibleModels && entry.compatibleModels.length > 0 && (
                    <View style={styles.solutionSection}>
                      <Text style={styles.sectionLabel}>Совместимые модели:</Text>
                      <Text style={styles.solutionText}>
                        {entry.compatibleModels.map(id => getModelName(id)).join(', ')}
                      </Text>
                    </View>
                  )}
                  
                  <View style={styles.solutionSection}>
                    <Text style={styles.sectionLabel}>Решение:</Text>
                    <Text style={styles.solutionText}>{entry.solution}</Text>
                  </View>

                  {entry.steps && entry.steps.length > 0 && (
                    <View style={styles.stepsSection}>
                      <Text style={styles.sectionLabel}>Шаги:</Text>
                      {entry.steps.map((step, index) => (
                        <Text key={index} style={styles.stepsSectionText}>
                          {index + 1}. {step}
                        </Text>
                      ))}
                    </View>
                  )}

                  <View style={styles.partsSection}>
                    <Text style={styles.sectionLabel}>Необходимые детали:</Text>
                    {(() => {
                      const validParts = (entry.relatedParts || [])
                        .map(id => parts.find(p => p.id === id))
                        .filter((p): p is Part => Boolean(p));

                      if (!entry.relatedParts || entry.relatedParts.length === 0) {
                        return <Text style={styles.noPartsText}>Не указаны</Text>;
                      }
                      if (validParts.length === 0) {
                        return <Text style={styles.noPartsText}>Связанные детали были удалены со склада</Text>;
                      }
                      return validParts.map(part => (
                        <View key={part.id}>
                          {renderPartStatus(part.id)}
                        </View>
                      ));
                    })()}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.fab} onPress={handleAddEntry}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Knowledge Base Entry Editor Modal */}
      <Modal
        visible={isMainModalVisible && (mode === 'add' || mode === 'edit')}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsMainModalVisible(false);
          setMode('list');
        }}
      >
        <KeyboardAvoidingView 
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{mode === 'add' ? t('kb.addTitle') : t('kb.editTitle')}</Text>
            </View>

            <View style={styles.form}>
              {/* 1. БРЕНД (Верх экрана) */}
              <BrandSelector
                selectedBrand={selectedBrand}
                onSelectBrand={(brand) => {
                  setSelectedBrand(brand);
                  // Очищаем выбранные модели и детали при смене бренда
                  setSelectedKBModelIds([]);
                  setSelectedPartIds([]);
                }}
              />

              {/* 2. СОВМЕСТИМЫЕ МОДЕЛИ (Второе место сразу после Бренда) */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('kb.compatibleModels')}</Text>
                {selectedKBModelIds.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {selectedKBModelIds.map(modelId => (
                      <View key={modelId} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{getModelName(modelId)}</Text>
                        <TouchableOpacity onPress={() => toggleKBModelSelection(modelId)}>
                          <Text style={styles.removeTagText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.pickerSelectButton,
                    !selectedBrand && styles.pickerButtonDisabled
                  ]}
                  disabled={!selectedBrand}
                  onPress={() => {
                    if (!selectedBrand) {
                      Alert.alert(t('common.info'), t('kb.selectBrandFirst'));
                      return;
                    }
                    setShowKBModelPicker(true);
                  }}
                >
                  <Text style={selectedBrand ? styles.pickerSelectText : styles.pickerPlaceholderText}>
                    {!selectedBrand ? t('kb.selectBrandFirstShort') : t('kb.selectCompatibleModels')}
                  </Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* 3. КОД ОШИБКИ */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('kb.errorCodeLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={errorCode}
                  onChangeText={setErrorCode}
                  placeholder={t('kb.errorCodePlaceholder')}
                  placeholderTextColor="#999999"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* 4. КРАТКОЕ ОПИСАНИЕ */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('kb.descriptionLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t('kb.descriptionPlaceholder')}
                  placeholderTextColor="#999999"
                  autoCapitalize="sentences"
                  autoCorrect={false}
                  keyboardType="default"
                />
              </View>

              {/* 5. РЕШЕНИЕ */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('kb.solutionLabel')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={solution}
                  onChangeText={setSolution}
                  placeholder={t('kb.solutionPlaceholder')}
                  placeholderTextColor="#999999"
                  multiline
                  numberOfLines={4}
                  autoCapitalize="sentences"
                  autoCorrect={false}
                  keyboardType="default"
                />
              </View>

              {/* 6. ПОШАГОВЫЕ ИНСТРУКЦИИ */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('kb.stepsLabel')}</Text>
                {steps.map((step, index) => (
                  <View key={index} style={styles.stepItem}>
                    <Text style={styles.stepNumber}>{index + 1}.</Text>
                    <Text style={styles.stepText}>{step}</Text>
                    <TouchableOpacity onPress={() => removeStep(index)}>
                      <Text style={styles.removeStepText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.addStepRow}>
                  <TextInput
                    style={[styles.input, styles.stepInput]}
                    value={newStep}
                    onChangeText={setNewStep}
                    placeholder={t('kb.addStepPlaceholder')}
                    placeholderTextColor="#999999"
                    autoCapitalize="sentences"
                    autoCorrect={false}
                    keyboardType="default"
                  />
                  <TouchableOpacity style={styles.addStepButton} onPress={addStep}>
                    <Text style={styles.addStepButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 7. СВЯЗАННЫЕ ДЕТАЛИ (Зависит от выбранных моделей/Бренда) */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('kb.relatedPartsLabel')}</Text>
                <TouchableOpacity
                  style={[
                    styles.partsSelector,
                    { borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
                    !selectedBrand && styles.partsSelectorDisabled
                  ]}
                  disabled={!selectedBrand}
                  onPress={() => {
                    if (!selectedBrand) {
                      Alert.alert(t('common.info'), t('kb.selectBrandFirst'));
                      return;
                    }
                    handleOpenPartsPicker();
                  }}
                  activeOpacity={0.7}
                >
                  {!selectedBrand ? (
                    <Text style={styles.disabledSelectorText}>{t('kb.selectBrandFirstLocked')}</Text>
                  ) : selectedPartIds.length === 0 ? (
                    <Text style={[styles.noPartsText, { color: '#999', fontStyle: 'italic' }]}>
                      {selectedKBModelIds.length > 0
                        ? 'Нажмите для выбора деталей для выбранных моделей...'
                        : `Нажмите для выбора деталей бренда ${selectedBrand}...`}
                    </Text>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {selectedPartIds.map(partId => {
                        const part = getPartById(partId);
                        if (!part) return null;
                        return (
                          <View key={partId} style={styles.selectedPartChip}>
                            <Text style={styles.selectedPartText}>
                              {part.partNumber} ({part.quantity} шт.)
                            </Text>
                            <TouchableOpacity
                              style={styles.removePartButton}
                              onPress={() => togglePartSelection(partId)}
                            >
                              <Text style={styles.removePartButtonText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSaveEntry}>
                  <Text style={styles.saveButtonText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Parts Picker Modal */}
      <Modal
        visible={showPartsPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={handleClosePartsPicker}
      >
        <TouchableWithoutFeedback onPress={handleClosePartsPicker}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                <Text style={styles.modalTitle}>
                  {t('kb.relatedPartsLabel')} {selectedBrand ? `(${selectedBrand})` : ''}
                </Text>
                <TouchableOpacity
                  style={styles.openPartEditorButton}
                  onPress={() => {
                    handleClosePartsPicker();
                    handleOpenPartEditor();
                  }}
                >
                  <Text style={styles.openPartEditorButtonText}>✏️ {t('parts.addTitle')}</Text>
                </TouchableOpacity>

                <TextInput
                  style={styles.modalSearchInput}
                  placeholder={t('parts.searchPlaceholder')}
                  placeholderTextColor="#999999"
                  value={partsSearchQuery}
                  onChangeText={setPartsSearchQuery}
                  keyboardType="default"
                />

                <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled={true}>
                  {parts.length === 0 ? (
                    <Text style={styles.modalEmptyText}>{t('common.emptyList')}</Text>
                  ) : filteredPartsForPicker.length === 0 ? (
                    <Text style={styles.modalEmptyText}>
                      {t('common.notFound')}
                    </Text>
                  ) : (
                    filteredPartsForPicker.map(part => (
                      <TouchableOpacity
                        key={part.id}
                        style={styles.modalItem}
                        onPress={() => togglePartSelection(part.id)}
                      >
                        <View style={styles.modalItemContent}>
                          <Text style={styles.modalItemText}>{part.partNumber}</Text>
                          <Text style={styles.modalItemDescription}>{part.description}</Text>
                          <Text style={styles.modalItemQuantity}>
                            {t('notes.inStockDetails', { quantity: part.quantity, models: part.compatibleModels.map(id => getModelName(id)).join(', ') })}
                          </Text>
                        </View>
                        {selectedPartIds.includes(part.id) && (
                          <Text style={styles.modalCheck}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleClosePartsPicker}
                >
                  <Text style={styles.modalCancelButtonText}>{t('common.confirm')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* KB Compatible Models Modal */}
      <Modal
        visible={showKBModelPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowKBModelPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowKBModelPicker(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                <Text style={styles.modalTitle}>{t('kb.compatibleModels')} ({selectedBrand})</Text>

                <ScrollView style={{ maxHeight: 250 }}>
                  {getModelsForSelectedBrand().length === 0 ? (
                    <Text style={styles.modalEmptyText}>{t('common.notFound')}</Text>
                  ) : (
                    getModelsForSelectedBrand().map(model => (
                      <TouchableOpacity
                        key={model.id}
                        style={styles.modalItem}
                        onPress={() => toggleKBModelSelection(model.id)}
                      >
                        <Text style={styles.modalItemText}>{model.name}</Text>
                        {selectedKBModelIds.includes(model.id) && (
                          <Text style={styles.modalCheck}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>

                <View style={styles.createBrandSection}>
                  <Text style={styles.createBrandLabel}>{t('printers.modelLabel')}:</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginRight: 8 }]}
                      placeholder={`${selectedBrand}...`}
                      placeholderTextColor="#999999"
                      value={newKBModelInput}
                      onChangeText={setNewKBModelInput}
                      autoCapitalize="words"
                    />
                    <TouchableOpacity style={styles.addStepButton} onPress={handleAddNewKBModel}>
                      <Text style={styles.addStepButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowKBModelPicker(false)}>
                  <Text style={styles.modalCloseButtonText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Part Editor Modal */}
      <Modal
        visible={partEditorMode !== 'none'}
        transparent={true}
        animationType="slide"
        onRequestClose={() => handleClosePartEditor()}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.partEditorContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {partEditorMode === 'add' ? t('parts.addTitle') : t('parts.editTitle')}
              </Text>
            </View>

            <ScrollView style={styles.partEditorScroll}>
              <View style={styles.form}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('parts.partNumberLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={partNumber}
                    onChangeText={setPartNumber}
                    placeholder={t('parts.partNumberPlaceholder')}
                    placeholderTextColor="#999999"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('parts.nameLabel')}</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={partDescription}
                    onChangeText={setPartDescription}
                    placeholder={t('parts.descriptionPlaceholder')}
                    placeholderTextColor="#999999"
                    multiline
                    numberOfLines={3}
                    autoCapitalize="sentences"
                    autoCorrect={false}
                    keyboardType="default"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('parts.quantityLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={partQuantity}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/^0+(\d)/, '$1').replace(/[^0-9]/g, '');
                      setPartQuantity(cleaned === '' ? '0' : cleaned);
                    }}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('printers.locationLabel')}</Text>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={handleOpenPartLocationPicker}
                  >
                    <Text style={styles.pickerButtonText}>
                      {selectedPartLocation
                        ? `${selectedPartLocation.building}, к. ${selectedPartLocation.room}`
                        : t('printers.selectRoom')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>{t('parts.compatibleModels')}</Text>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={handleOpenPartModelPicker}
                  >
                    <Text style={styles.pickerButtonText}>
                      {selectedPartModelIds.length > 0
                        ? t('parts.selectedModelsCount', { selected: selectedPartModelIds.length, total: models.length })
                        : t('printers.selectModel')}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.helpText}>
                    {t('parts.selectedModelsCount', { selected: selectedPartModelIds.length, total: models.length })}
                  </Text>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => handleClosePartEditor()}>
                    <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSavePartFromEditor}>
                    <Text style={styles.saveButtonText}>{t('common.save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Part Location Picker Modal */}
      <Modal
        visible={showPartLocationPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={handleClosePartLocationPicker}
      >
        <TouchableWithoutFeedback onPress={handleClosePartLocationPicker}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('printers.selectRoom')}</Text>
                {locations.length === 0 ? (
                  <Text style={styles.modalEmptyText}>{t('locations.emptyList')}</Text>
                ) : (
                  locations.map(loc => (
                    <TouchableOpacity
                      key={`${loc.building}-${loc.room}`}
                      style={styles.modalItem}
                      onPress={() => {
                        setSelectedPartLocation(loc);
                        handleClosePartLocationPicker();
                      }}
                    >
                      <Text style={styles.modalItemText}>
                        {loc.building}, к. {loc.room}
                      </Text>
                      {selectedPartLocation && 
                        selectedPartLocation.building === loc.building && 
                        selectedPartLocation.room === loc.room && (
                          <Text style={styles.modalCheck}>✓</Text>
                        )}
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleClosePartLocationPicker}
                >
                  <Text style={styles.modalCancelButtonText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Part Model Picker Modal */}
      <Modal
        visible={showPartModelPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={handleClosePartModelPicker}
      >
        <TouchableWithoutFeedback onPress={handleClosePartModelPicker}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('parts.compatibleModels')}</Text>
                {models.map(model => (
                  <TouchableOpacity
                    key={model.id}
                    style={styles.modalItem}
                    onPress={() => {
                      setSelectedPartModelIds(prev =>
                        prev.includes(model.id)
                          ? prev.filter(id => id !== model.id)
                          : [...prev, model.id]
                      );
                    }}
                  >
                    <Text style={styles.modalItemText}>{model.name}</Text>
                    {selectedPartModelIds.includes(model.id) && (
                      <Text style={styles.modalCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={handleClosePartModelPicker}
                >
                  <Text style={styles.modalCancelButtonText}>{t('common.close')}</Text>
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
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
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
    padding: 16,
  },
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    flexShrink: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalScroll: {
    flexGrow: 1,
    flexShrink: 1,
    marginVertical: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  modalItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalCheck: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  modalCancelButton: {
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Card styles
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#E3F2FD',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  editButtonText: {
    fontSize: 16,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  // Content sections
  solutionSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  solutionText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  stepsSection: {
    marginBottom: 12,
  },
  stepsSectionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
    paddingLeft: 8,
  },
  partsSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  noPartsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 12,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
    marginTop: -2,
  },
  // Error card text styles
  errorCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  // Form styles
  formScroll: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  form: {
    padding: 16,
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
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000000',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 8,
    minWidth: 24,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  removeStepText: {
    fontSize: 18,
    color: '#FF3B30',
    fontWeight: 'bold',
    padding: 4,
  },
  addStepRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  stepInput: {
    flex: 1,
  },
  addStepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addStepButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '300',
    marginTop: -2,
  },
  // Parts selector
  partsSelector: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    minHeight: 50,
    padding: 8,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  selectedPartChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedPartText: {
    fontSize: 14,
    color: '#007AFF',
    marginRight: 6,
  },
  removePartButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePartButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
    lineHeight: 12,
  },
  partsSelectorActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  addPartsButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addPartsButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  editPartsButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  editPartsButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  // Part editor
  openPartEditorButton: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  openPartEditorButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalSearchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  modalItemContent: {
    flex: 1,
    marginRight: 8,
  },
  modalItemDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalItemQuantity: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  // Part editor specific
  partEditorContent: {
    maxHeight: '85%',
    flexShrink: 1,
  },
  modalHeader: {
    marginBottom: 16,
  },
  partEditorScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Part status styles
  partStatusContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  partHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
  },
  partInfo: {
    flex: 1,
    marginRight: 8,
  },
  partName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  partCompatible: {
    fontSize: 12,
    color: '#666',
  },
  partQuantityInfo: {
    alignItems: 'flex-end',
  },
  partQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  quantityPositive: {
    color: '#4CAF50',
  },
  quantityZero: {
    color: '#F44336',
  },
  partLocation: {
    fontSize: 12,
    color: '#666',
  },
  locationsBreakdown: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  locationsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  noStockText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 8,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  locationBuilding: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  locationRoom: {
    fontSize: 13,
    color: '#666',
    marginHorizontal: 8,
  },
  locationQuantity: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'right',
  },
  partNotAvailable: {
    fontSize: 13,
    color: '#F44336',
    fontStyle: 'italic',
    padding: 8,
    textAlign: 'center',
  },
  brandBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  brandBadgeText: {
    color: '#1976D2',
    fontSize: 12,
    fontWeight: 'bold',
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
  pickerButtonDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#eee',
  },
  partsSelectorDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#eee',
    padding: 12,
  },
  disabledSelectorText: {
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 6,
  },
  tagChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  removeTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  deleteBrandIconButton: {
    padding: 6,
    marginLeft: 8,
  },
  deleteBrandIconText: {
    fontSize: 16,
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
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalCloseButton: {
    marginTop: 12,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  brandFilterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  brandChipsScroll: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  brandFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  brandFilterChipSelected: {
    backgroundColor: '#1976D2',
  },
  brandFilterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  brandFilterChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
