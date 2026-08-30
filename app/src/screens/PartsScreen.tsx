import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import storage from '../services/storage';
import { Ionicons } from '@expo/vector-icons';
import { Part, PrinterModel, InventoryLocation, BrandItem } from '../models/types';
import BrandSelector from '../components/BrandSelector';

type ScreenMode = 'list' | 'add' | 'edit';

export default function PartsScreen({ initialPartId }: { initialPartId?: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [parts, setParts] = useState<Part[]>([]);
  const [models, setModels] = useState<PrinterModel[]>([]);
  const [dbBrands, setDbBrands] = useState<BrandItem[]>([]);
  const [locations, setLocations] = useState<{building: string; room: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ScreenMode>('list');
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterBrand, setSelectedFilterBrand] = useState('Все');

  // Form state
  const [selectedBrand, setSelectedBrand] = useState('');
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [newBrandInput, setNewBrandInput] = useState('');

  const [partNumber, setPartNumber] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [selectedLocation, setSelectedLocation] = useState<{building: string; room: string} | null>(null);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialPartId && parts.length > 0) {
      const part = parts.find(p => p.id === initialPartId);
      if (part) {
        handleEditPart(part);
      }
    }
  }, [initialPartId, parts]);

  const loadData = async () => {
    try {
      const [partsData, modelsData, locationsData, brandsData] = await Promise.all([
        storage.getParts(),
        storage.getModels(),
        storage.getLocations(),
        storage.getBrands(),
      ]);
      setParts(partsData);
      setModels(modelsData as PrinterModel[]);
      const uniqueLocations = locationsData.map(loc => ({ building: loc.building, room: loc.room }));
      setLocations(uniqueLocations);
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

  const getFilterBrandList = () => {
    const available = getAvailableBrands();
    return ['Все', ...available];
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

  const loadLocations = async () => {
    try {
      const locationsData = await storage.getLocations();
      setLocations(locationsData.map(loc => ({ building: loc.building, room: loc.room })));
    } catch (error) {
      console.error('Ошибка загрузки помещений:', error);
    }
  };

  const loadModels = async () => {
    try {
      const modelsData = await storage.getModels();
      setModels(modelsData as PrinterModel[]);
    } catch (error) {
      console.error('Ошибка загрузки моделей:', error);
    }
  };

  const resetForm = () => {
    setSelectedBrand('');
    setPartNumber('');
    setDescription('');
    setQuantity('0');
    setSelectedLocation(null);
    setSelectedModelIds([]);
    setEditingPart(null);
  };

  const handleAddPart = () => {
    resetForm();
    setMode('add');
  };

  const handleEditPart = (part: Part) => {
    setEditingPart(part);
    setSelectedBrand(part.brand || '');
    setPartNumber(part.partNumber);
    setDescription(part.description);
    setQuantity(part.quantity.toString());
    setSelectedLocation(part.location ? { building: part.location.building, room: part.location.room } : null);
    // Нормализация: если в старых данных хранятся имена моделей вместо ID — маппим обратно на ID
    const normalizedModelIds = (part.compatibleModels || []).map(idOrName => {
      // Если это уже валидный ID (есть в списке моделей) — оставляем
      if (models.find(m => m.id === idOrName)) return idOrName;
      // Иначе пробуем найти по имени
      const byName = models.find(m => m.name === idOrName);
      return byName ? byName.id : idOrName;
    });
    setSelectedModelIds(normalizedModelIds);
    setMode('edit');
  };

  const handleDeletePart = (part: Part) => {
    Alert.alert(
      t('parts.deleteTitle'),
      t('parts.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await storage.deletePart(part.id);
              await loadData();
            } catch (error) {
              console.error('Ошибка удаления детали:', error);
              Alert.alert(t('common.error'), 'Не удалось удалить деталь');
            }
          },
        },
      ]
    );
  };

  const toggleModelSelection = (modelId: string) => {
    setSelectedModelIds(prev =>
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };

  const handleSavePart = async () => {
    console.log('=== handleSavePart called ===');
    console.log('Mode:', mode, 'EditingPart ID:', editingPart?.id);
    console.log('Form values:', { selectedBrand, partNumber, description, quantity, selectedLocation, selectedModelIds });
    
    if (!selectedBrand.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, выберите Бренд');
      console.log('Validation failed: selectedBrand empty');
      return;
    }
    if (!partNumber.trim()) {
      Alert.alert('Ошибка', 'Введите парт-номер');
      console.log('Validation failed: partNumber empty');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Ошибка', 'Введите наименование');
      console.log('Validation failed: description empty');
      return;
    }
    if (selectedModelIds.length === 0) {
      Alert.alert('Ошибка', 'Выберите хотя бы одну совместимую модель');
      console.log('Validation failed: no models selected');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Ошибка', 'Введите корректное количество');
      console.log('Validation failed: invalid quantity');
      return;
    }

    try {
      const location: InventoryLocation = selectedLocation
        ? { building: selectedLocation.building, room: selectedLocation.room }
        : { building: 'Не указан', room: 'Не указан' };

      const partData = {
        partNumber: partNumber.trim(),
        description: description.trim(),
        brand: selectedBrand.trim(),
        compatibleModels: selectedModelIds,
        quantity: qty,
        location,
      };

      if (mode === 'add') {
        await storage.addPart(partData);
      } else if (editingPart) {
        await storage.updatePart(editingPart.id, partData);
      }

      await loadData();
      setMode('list');
      resetForm();
      Alert.alert('Успех', 'Деталь сохранена');
    } catch (error) {
      console.error('Save failed:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить деталь: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleCancel = () => {
    setMode('list');
    resetForm();
  };

  const getModelNames = (modelIds: string[]) => {
    return modelIds.map(id => models.find(m => m.id === id)?.name || id).join(', ');
  };

  const getLocationName = (location: {building: string; room: string} | undefined) => {
    if (!location) return 'Не указано';
    return `${location.building}, к. ${location.room}`;
  };

  const filteredParts = parts.filter(part => {
    const matchesSearch =
      part.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (part.brand && part.brand.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesBrand =
      selectedFilterBrand === 'Все' ||
      (part.brand && part.brand.toLowerCase() === selectedFilterBrand.toLowerCase());
    return matchesSearch && matchesBrand;
  });
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  if (mode === 'add' || mode === 'edit') {
    return (
      <KeyboardAvoidingView 
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{mode === 'add' ? t('parts.addTitle') : t('parts.editTitle')}</Text>
          </View>

          <View style={styles.form}>
            <BrandSelector
              selectedBrand={selectedBrand}
              onSelectBrand={(brand) => {
                setSelectedBrand(brand);
                if (brand) {
                  setSelectedModelIds(prev =>
                    prev.filter(mId => {
                      const found = models.find(m => m.id === mId);
                      const foundBrand = (found?.brand || (found as any)?.brandId || '').toLowerCase();
                      const isMatch = foundBrand
                        ? foundBrand === brand.toLowerCase()
                        : found?.name.toLowerCase().startsWith(brand.toLowerCase());
                      return isMatch;
                    })
                  );
                }
              }}
            />

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
                value={description}
                onChangeText={setDescription}
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
                value={quantity}
                onChangeText={(text) => {
                  const cleaned = text.replace(/^0+(\d)/, '$1').replace(/[^0-9]/g, '');
                  setQuantity(cleaned === '' ? '0' : cleaned);
                }}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('printers.locationLabel')}</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => {
                  loadLocations();
                  setShowLocationPicker(true);
                }}
              >
                <Text style={styles.pickerButtonText}>
                  {selectedLocation
                    ? `${selectedLocation.building}, к. ${selectedLocation.room}`
                    : t('printers.selectRoom')}
                </Text>
              </TouchableOpacity>
              <Text style={styles.helpText}>
                {t('printers.locationHelp')}
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('parts.compatibleModels')}</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => {
                  loadModels();
                  setShowModelPicker(true);
                }}
              >
                <Text style={styles.pickerButtonText}>
                  {selectedModelIds.length > 0
                    ? t('parts.selectedModelsCount', { selected: selectedModelIds.length, total: models.length })
                    : t('printers.selectModel')}
                </Text>
              </TouchableOpacity>
              <Text style={styles.helpText}>
                {t('parts.selectedModelsCount', { selected: selectedModelIds.length, total: models.length })}
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSavePart}>
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Location Picker Modal */}
        <Modal
          visible={showLocationPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowLocationPicker(false)}
          hardwareAccelerated={true}
        >
          <TouchableWithoutFeedback onPress={() => setShowLocationPicker(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Выберите помещение</Text>
                  <ScrollView style={{ maxHeight: 300 }}>
                    {locations.length === 0 ? (
                      <Text style={styles.modalEmptyText}>Нет доступных помещений</Text>
                    ) : (
                      locations.map(loc => (
                        <TouchableOpacity
                          key={`${loc.building}-${loc.room}`}
                          style={styles.modalItem}
                          onPress={() => {
                            setSelectedLocation(loc);
                            setShowLocationPicker(false);
                          }}
                        >
                          <Text style={styles.modalItemText}>
                            {loc.building}, к. {loc.room}
                          </Text>
                          {selectedLocation && 
                           selectedLocation.building === loc.building && 
                           selectedLocation.room === loc.room && (
                            <Text style={styles.modalCheck}>✓</Text>
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setShowLocationPicker(false)}
                  >
                    <Text style={styles.modalCancelText}>Отмена</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Model Picker Modal */}
        <Modal
          visible={showModelPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowModelPicker(false)}
          hardwareAccelerated={true}
        >
          <TouchableWithoutFeedback onPress={() => setShowModelPicker(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>
                    {selectedBrand
                      ? `Выберите модели (${selectedBrand})`
                      : 'Выберите совместимые модели'}
                  </Text>
                  <ScrollView style={{ maxHeight: 300 }}>
                    {(() => {
                      if (!selectedBrand) {
                        return (
                          <Text style={styles.modalEmptyText}>
                            Пожалуйста, сначала выберите бренд в форме.
                          </Text>
                        );
                      }

                      const filteredModels = models.filter(m => {
                        const mBrand = (m.brand || (m as any).brandId || '').toLowerCase();
                        const selBrand = selectedBrand.toLowerCase();
                        if (mBrand) {
                          return mBrand === selBrand;
                        }
                        return m.name.toLowerCase().startsWith(selBrand);
                      });

                      if (filteredModels.length === 0) {
                        return (
                          <Text style={styles.modalEmptyText}>
                            {`Нет доступных моделей для бренда "${selectedBrand}"`}
                          </Text>
                        );
                      }

                      return filteredModels.map(model => (
                        <TouchableOpacity
                          key={model.id}
                          style={styles.modalItem}
                          onPress={() => toggleModelSelection(model.id)}
                        >
                          <Text style={styles.modalItemText}>{model.name}</Text>
                          {selectedModelIds.includes(model.id) && (
                            <Text style={styles.modalCheck}>✓</Text>
                          )}
                        </TouchableOpacity>
                      ));
                    })()}
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setShowModelPicker(false)}
                  >
                    <Text style={styles.modalCancelText}>Готово</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('parts.title')}</Text>
            <Text style={styles.totalParts}>
              {t('parts.totalCount', { count: parts.reduce((sum, p) => sum + p.quantity, 0) })}
            </Text>
          </View>
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
          placeholder={t('parts.searchPlaceholder')}
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

      {filteredParts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('common.emptyList')}</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleAddPart}>
            <Text style={styles.emptyButtonText}>{t('common.addFirst')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredParts}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 30 }]}
          renderItem={({item}) => (
            <View style={styles.partCard}>
              <View style={styles.partInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  {item.brand ? (
                    <View style={styles.brandBadge}>
                      <Text style={styles.brandBadgeText}>{item.brand}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.partNumber}>{item.partNumber}</Text>
                </View>
                <Text style={styles.partDescription} numberOfLines={2}>
                  {item.description}
                </Text>
                <Text style={styles.compatibleModels}>
                  {t('parts.compatible', { models: getModelNames(item.compatibleModels) })}
                </Text>
                <View style={styles.detailsRow}>
                  <Text style={styles.quantityText}>
                    {t('parts.quantityText', { count: item.quantity })}
                  </Text>
                  {item.minQuantity && (
                    <Text style={styles.minQuantityText}>{t('parts.minQuantityText', { min: item.minQuantity })}</Text>
                  )}
                </View>
                <Text style={styles.locationText}>
                  {t('parts.locationText', { location: getLocationName(item.location) })}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => handleEditPart(item)}
                >
                  <Text style={styles.editButtonText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDeletePart(item)}
                >
                  <Text style={styles.deleteButtonText}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {filteredParts.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={handleAddPart}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}





      {/* 2. Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
        hardwareAccelerated={true}
      >
        <TouchableWithoutFeedback onPress={() => setShowLocationPicker(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Выберите помещение</Text>
                <ScrollView style={{ maxHeight: 300 }}>
                  {locations.length === 0 ? (
                    <Text style={styles.modalEmptyText}>Нет доступных помещений</Text>
                  ) : (
                    locations.map(loc => (
                      <TouchableOpacity
                        key={`${loc.building}-${loc.room}`}
                        style={styles.modalItem}
                        onPress={() => {
                          setSelectedLocation(loc);
                          setShowLocationPicker(false);
                        }}
                      >
                        <Text style={styles.modalItemText}>
                          {loc.building}, к. {loc.room}
                        </Text>
                        {selectedLocation && 
                         selectedLocation.building === loc.building && 
                         selectedLocation.room === loc.room && (
                          <Text style={styles.modalCheck}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowLocationPicker(false)}
                >
                  <Text style={styles.modalCancelText}>Отмена</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 3. Model Picker Modal */}
      <Modal
        visible={showModelPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModelPicker(false)}
        hardwareAccelerated={true}
      >
        <TouchableWithoutFeedback onPress={() => setShowModelPicker(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {selectedBrand
                    ? `Выберите модели (${selectedBrand})`
                    : 'Выберите совместимые модели'}
                </Text>
                <ScrollView style={{ maxHeight: 300 }}>
                  {(() => {
                    if (!selectedBrand) {
                      return (
                        <Text style={styles.modalEmptyText}>
                          Пожалуйста, сначала выберите бренд в форме.
                        </Text>
                      );
                    }

                    const filteredModels = models.filter(m => {
                      const mBrand = (m.brand || (m as any).brandId || '').toLowerCase();
                      const selBrand = selectedBrand.toLowerCase();
                      if (mBrand) {
                        return mBrand === selBrand;
                      }
                      return m.name.toLowerCase().startsWith(selBrand);
                    });
                    
                    if (filteredModels.length === 0) {
                      return (
                        <Text style={styles.modalEmptyText}>
                          {`Нет доступных моделей для бренда "${selectedBrand}"`}
                        </Text>
                      );
                    }

                    return filteredModels.map(model => (
                      <TouchableOpacity
                        key={model.id}
                        style={styles.modalItem}
                        onPress={() => toggleModelSelection(model.id)}
                      >
                        <Text style={styles.modalItemText}>{model.name}</Text>
                        {selectedModelIds.includes(model.id) && (
                          <Text style={styles.modalCheck}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ));
                  })()}
                </ScrollView>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowModelPicker(false)}
                >
                  <Text style={styles.modalCancelText}>Готово</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  totalParts: {
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
  list: {
    padding: 15,
  },
  partCard: {
    backgroundColor: 'white',
    marginBottom: 10,
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  partInfo: {
    flex: 1,
  },
  partNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  partDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  compatibleModels: {
    fontSize: 12,
    color: '#9C27B0',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  quantityText: {
    fontSize: 14,
    color: '#333',
    marginRight: 10,
  },
  quantityValue: {
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  minQuantityText: {
    fontSize: 12,
    color: '#999',
  },
  locationText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 10,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#E3F2FD',
  },
  editButtonText: {
    fontSize: 18,
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  deleteButtonText: {
    fontSize: 18,
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
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
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
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  helpText: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
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
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    maxHeight: '80%',
    flexShrink: 1,
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
  modalScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 15,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemText: {
    fontSize: 14,
    color: '#333',
  },
  modalCheck: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  modalCancelButton: {
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginTop: 10,
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
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