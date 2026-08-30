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
} from 'react-native';
import storage from '../services/storage';

export default function InventoryScreen() {
  const [parts, setParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const partsData = await storage.getParts();
      setParts(partsData);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustQuantity = (partId, delta) => {
    setSelectedPart(parts.find(p => p.id === partId));
    setAdjustQuantity(delta.toString());
    setAdjustModalVisible(true);
  };

  const confirmAdjustQuantity = async () => {
    if (!selectedPart || !adjustQuantity) return;
    
    const delta = parseInt(adjustQuantity, 10);
    if (isNaN(delta)) {
      Alert.alert('Ошибка', 'Введите корректное число');
      return;
    }

    try {
      await storage.adjustPartQuantity(selectedPart.id, delta);
      await loadData();
      setAdjustModalVisible(false);
      setAdjustQuantity('');
      Alert.alert('Успех', 'Количество обновлено');
    } catch (error) {
      console.error('Ошибка обновления:', error);
      Alert.alert('Ошибка', 'Не удалось обновить количество');
    }
  };

  const groupPartsByLocation = () => {
    const grouped = {};
    parts.forEach(part => {
      const locationKey = `${part.location.building}-${part.location.room}`;
      if (!grouped[locationKey]) {
        grouped[locationKey] = {
          building: part.location.building,
          room: part.location.room,
          parts: [],
        };
      }
      grouped[locationKey].parts.push(part);
    });
    return Object.values(grouped);
  };

  const groupedData = groupPartsByLocation();

  const renderLocationGroup = ({ item: location }) => (
    <View style={styles.locationGroup}>
      <View style={styles.locationHeader}>
        <Text style={styles.locationTitle}>
          {location.building}, каб. {location.room}
        </Text>
        <Text style={styles.partsCount}>
          {location.parts.length} {location.parts.length === 1 ? 'деталь' : 
           location.parts.length < 5 ? 'детали' : 'деталей'}
        </Text>
      </View>
      {location.parts.map(part => (
        <View key={part.id} style={styles.partCard}>
          <View style={styles.partInfo}>
            <Text style={styles.partNumber}>{part.partNumber}</Text>
            <Text style={styles.partDescription} numberOfLines={2}>
              {part.description}
            </Text>
            <View style={styles.quantityRow}>
              <Text style={[
                styles.quantity,
                part.quantity <= 0 ? styles.outOfStock : 
                part.quantity < (part.minQuantity || 5) ? styles.lowStock : null
              ]}>
                {part.quantity} шт.
              </Text>
              {part.minQuantity && (
                <Text style={styles.minQuantity}>мин: {part.minQuantity}</Text>
              )}
            </View>
          </View>
          <View style={styles.adjustButtons}>
            <TouchableOpacity
              style={[styles.adjustButton, styles.decreaseButton]}
              onPress={() => handleAdjustQuantity(part.id, -1)}
            >
              <Text style={styles.adjustButtonText}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.adjustButton, styles.increaseButton]}
              onPress={() => handleAdjustQuantity(part.id, 1)}
            >
              <Text style={styles.adjustButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Склад</Text>
        <Text style={styles.totalParts}>
          Всего деталей: {parts.reduce((sum, p) => sum + p.quantity, 0)}
        </Text>
      </View>

      {groupedData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Нет деталей на складе</Text>
        </View>
      ) : (
        <FlatList
          data={groupedData}
          renderItem={renderLocationGroup}
          keyExtractor={item => `${item.building}-${item.room}`}
          contentContainerStyle={styles.list}
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={adjustModalVisible}
        onRequestClose={() => setAdjustModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Изменение количества</Text>
            {selectedPart && (
              <Text style={styles.modalPartInfo}>
                {selectedPart.partNumber} - {selectedPart.description}
              </Text>
            )}
            <TextInput
              style={styles.modalInput}
              placeholder="Введите изменение (+/-)"
              value={adjustQuantity}
              onChangeText={setAdjustQuantity}
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setAdjustModalVisible(false);
                  setAdjustQuantity('');
                }}
              >
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmAdjustQuantity}
              >
                <Text style={styles.confirmButtonText}>Подтвердить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  totalParts: {
    fontSize: 14,
    color: '#666',
  },
  list: {
    padding: 15,
  },
  locationGroup: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  partsCount: {
    fontSize: 12,
    color: '#666',
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  partCard: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  partInfo: {
    flex: 1,
  },
  partNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  partDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantity: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginRight: 8,
  },
  outOfStock: {
    color: '#F44336',
  },
  lowStock: {
    color: '#FF9800',
  },
  minQuantity: {
    fontSize: 12,
    color: '#999',
  },
  adjustButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  adjustButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  decreaseButton: {
    backgroundColor: '#FF5722',
  },
  increaseButton: {
    backgroundColor: '#4CAF50',
  },
  adjustButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  modalPartInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});