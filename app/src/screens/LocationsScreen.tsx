import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import storage, { LocationItem } from '../services/storage';
import { Ionicons } from '@expo/vector-icons';
import { Part } from '../models/types';

type ScreenMode = 'list' | 'add' | 'edit';

export default function LocationsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ScreenMode>('list');
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [building, setBuilding] = useState('');
  const [room, setRoom] = useState('');

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const locationsData = await storage.getLocations();
      setLocations(locationsData.sort((a, b) => 
        a.building.localeCompare(b.building) || a.room.localeCompare(b.room)
      ));
    } catch (error) {
      console.error('Ошибка загрузки локаций:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setBuilding('');
    setRoom('');
    setEditingLocation(null);
  };

  const handleAddLocation = () => {
    resetForm();
    setMode('add');
  };

  const handleEditLocation = (location: LocationItem) => {
    setEditingLocation(location);
    setBuilding(location.building);
    setRoom(location.room);
    setMode('edit');
  };

  const handleDeleteLocation = async (location: LocationItem) => {
    try {
      // Проверяем, есть ли детали или принтеры в этом помещении
      const [partsData, printersData] = await Promise.all([
        storage.getParts(),
        storage.getPrinters(),
      ]);

      const usedByParts = partsData.some(part =>
        part.location?.building === location.building &&
        part.location?.room === location.room
      );
      const usedByPrinters = printersData.some(printer =>
        printer.location?.building === location.building &&
        printer.location?.room === location.room
      );
      const isOccupied = usedByParts || usedByPrinters;

      const doDelete = async () => {
        try {
          // Перечитываем актуальные данные (замыкание могло захватить устаревшие)
          const [freshParts, freshPrinters] = await Promise.all([
            storage.getParts(),
            storage.getPrinters(),
          ]);

          // Каскадно обнуляем location у деталей
          const partsToUnlink = freshParts.filter(part =>
            part.location?.building === location.building &&
            part.location?.room === location.room
          );
          for (const part of partsToUnlink) {
            await storage.updatePart(part.id, { location: undefined });
          }

          // Каскадно обнуляем location у принтеров
          const printersToUnlink = freshPrinters.filter(printer =>
            printer.location?.building === location.building &&
            printer.location?.room === location.room
          );
          for (const printer of printersToUnlink) {
            await storage.updatePrinter(printer.id, { location: undefined });
          }

          // Удаляем само помещение
          await storage.deleteLocation(location.id);

          // Принудительно обновляем стейт синхронно — не ждём loadLocations()
          setLocations(prev => prev.filter(loc => loc.id !== location.id));
          await loadLocations();
        } catch (error) {
          console.error('Ошибка удаления помещения:', error);
          Alert.alert(t('common.error'), 'Не удалось удалить помещение');
        }
      };

      if (isOccupied) {
        Alert.alert(
          t('locations.deleteTitle'),
          t('locations.deleteConfirm'),
          [
            { text: t('locations.keepLocation'), style: 'cancel' },
            { text: t('locations.forceDelete'), style: 'destructive', onPress: doDelete },
          ]
        );
      } else {
        await doDelete();
      }
    } catch (error) {
      console.error('Ошибка при проверке помещения:', error);
      Alert.alert(t('common.error'), 'Не удалось проверить использование помещения');
    }
  };

  const handleSaveLocation = async () => {
    if (!building.trim()) {
      Alert.alert(t('common.error'), t('locations.enterBuildingError'));
      return;
    }
    if (!room.trim()) {
      Alert.alert(t('common.error'), t('locations.enterRoomError'));
      return;
    }

    try {
      if (mode === 'add') {
        await storage.addLocation({
          building: building.trim(),
          room: room.trim(),
        });
        Alert.alert(t('common.success'), t('locations.addSuccess'));
      } else if (editingLocation) {
        const partsData = await storage.getParts();
        const partsToUpdate = partsData.filter(part => 
          part.location?.building === editingLocation.building && 
          part.location?.room === editingLocation.room
        );
        
        for (const part of partsToUpdate) {
          await storage.updatePart(part.id, { 
            location: { building: building.trim(), room: room.trim() }
          });
        }
        
        await storage.updateLocation(editingLocation.id, {
          building: building.trim(),
          room: room.trim(),
        });
        
        Alert.alert(t('common.success'), t('locations.updateSuccess'));
      }

      await loadLocations();
      setMode('list');
      resetForm();
    } catch (error) {
      console.error('Ошибка сохранения помещения:', error);
      Alert.alert(t('common.error'), 'Не удалось сохранить помещение');
    }
  };

  const handleCancel = () => {
    setMode('list');
    resetForm();
  };

  // Filter locations by search query
  const filteredLocations = locations.filter(location =>
    location.building.toLowerCase().includes(searchQuery.toLowerCase()) ||
    location.room.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>{t('common.loading')}</Text>
      </View>
    );
  }

  if (mode === 'add' || mode === 'edit') {
    return (
      <KeyboardAvoidingView 
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{mode === 'add' ? t('locations.addTitle') : t('locations.editTitle')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('locations.buildingLabel')}</Text>
            <TextInput
              style={styles.input}
              value={building}
              onChangeText={setBuilding}
              placeholder={t('locations.buildingPlaceholder')}
              placeholderTextColor="#999999"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('locations.roomLabel')}</Text>
            <TextInput
              style={styles.input}
              value={room}
              onChangeText={setRoom}
              placeholder={t('locations.roomPlaceholder')}
              placeholderTextColor="#999999"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSaveLocation}>
              <Text style={styles.saveButtonText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('locations.title')}</Text>
            <Text style={styles.totalLocations}>
              {t('locations.totalCount', { count: locations.length })}
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
          placeholder={t('locations.searchPlaceholder')}
          placeholderTextColor="#999999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {filteredLocations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery ? t('common.notFound') : t('locations.emptyList')}
          </Text>
          {!searchQuery && (
            <TouchableOpacity style={styles.centerAddButton} onPress={handleAddLocation}>
              <Text style={styles.centerAddButtonText}>{t('locations.addFirst')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredLocations}
          renderItem={({item}) => (
            <View style={styles.locationCard}>
              <View style={styles.locationInfo}>
                <Text style={styles.locationName}>{item.building}, {item.room}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => handleEditLocation(item)}
                >
                  <Text style={styles.editButtonText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDeleteLocation(item)}
                >
                  <Text style={styles.deleteButtonText}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      {locations.length > 0 && !searchQuery && (
        <TouchableOpacity style={styles.fab} onPress={handleAddLocation}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
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
  totalLocations: {
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
  locationCard: {
    backgroundColor: 'white',
    marginBottom: 10,
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
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
  editButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  deleteButtonText: {
    fontSize: 16,
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
    backgroundColor: '#2196F3',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  centerAddButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  centerAddButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});