import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import storage from '../services/storage';
import { BrandItem } from '../models/types';

interface BrandSelectorProps {
  label?: string;
  selectedBrand: string;
  onSelectBrand: (brand: string) => void;
  additionalBrands?: string[];
  placeholder?: string;
}

export default function BrandSelector({
  label,
  selectedBrand,
  onSelectBrand,
  additionalBrands = [],
  placeholder,
}: BrandSelectorProps) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [dbBrands, setDbBrands] = useState<BrandItem[]>([]);
  const [newBrandInput, setNewBrandInput] = useState('');

  const displayLabel = label ?? t('brandSelector.defaultLabel');
  const displayPlaceholder = placeholder ?? t('brandSelector.placeholder');

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      const data = await storage.getBrands();
      setDbBrands(data);
    } catch (error) {
      console.error('Error loading brands in BrandSelector:', error);
    }
  };

  const getAvailableBrands = (): string[] => {
    const dbNames = dbBrands.map(b => b.name);
    const combined = Array.from(new Set([...dbNames, ...additionalBrands].filter(Boolean)));
    return combined.sort((a, b) => a.localeCompare(b, 'ru'));
  };

  const handleSelectBrand = (brandName: string) => {
    onSelectBrand(brandName);
    setShowModal(false);
  };

  const handleCreateNewBrand = async () => {
    const trimmed = newBrandInput.trim();
    if (!trimmed) return;
    try {
      await storage.addBrand(trimmed);
      await loadBrands();
      onSelectBrand(trimmed);
      setNewBrandInput('');
      setShowModal(false);
    } catch (error) {
      console.error('Error creating brand in BrandSelector:', error);
      Alert.alert(t('common.error'), t('brandSelector.createError'));
    }
  };

  const handleDeleteBrand = (brandName: string) => {
    Alert.alert(
      t('brandSelector.deleteTitle'),
      t('brandSelector.deleteConfirm', { brand: brandName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await storage.deleteBrand(brandName);
              await loadBrands();
              if (selectedBrand.toLowerCase() === brandName.toLowerCase()) {
                onSelectBrand('');
              }
            } catch (error) {
              console.error('Error deleting brand:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {Boolean(displayLabel) && <Text style={styles.label}>{displayLabel}</Text>}
      <TouchableOpacity
        style={styles.pickerSelectButton}
        onPress={() => {
          loadBrands();
          setShowModal(true);
        }}
        activeOpacity={0.7}
      >
        <Text style={selectedBrand ? styles.pickerSelectText : styles.pickerPlaceholderText}>
          {selectedBrand ? `${t('brandSelector.defaultLabel').replace(' *', '')}: ${selectedBrand}` : displayPlaceholder}
        </Text>
        <Text style={styles.pickerArrow}>▼</Text>
      </TouchableOpacity>

      {/* Brand Picker Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                <Text style={styles.modalTitle}>{t('brandSelector.modalTitle')}</Text>

                <ScrollView style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled">
                  {getAvailableBrands().length === 0 ? (
                    <Text style={styles.modalEmptyText}>{t('brandSelector.emptyText')}</Text>
                  ) : (
                    getAvailableBrands().map(brandName => (
                      <View
                        key={brandName}
                        style={[
                          styles.brandItem,
                          selectedBrand.toLowerCase() === brandName.toLowerCase() && styles.brandItemSelected,
                        ]}
                      >
                        <TouchableOpacity
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                          onPress={() => handleSelectBrand(brandName)}
                        >
                          <Text
                            style={[
                              styles.brandItemText,
                              selectedBrand.toLowerCase() === brandName.toLowerCase() && styles.brandItemTextSelected,
                            ]}
                          >
                            {brandName}
                          </Text>
                          {selectedBrand.toLowerCase() === brandName.toLowerCase() && (
                            <Text style={styles.modalCheck}>✓</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteBrandIconButton}
                          onPress={() => handleDeleteBrand(brandName)}
                        >
                          <Text style={styles.deleteBrandIconText}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </ScrollView>

                <View style={styles.createBrandSection}>
                  <Text style={styles.createBrandLabel}>{t('brandSelector.createLabel')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginRight: 8 }]}
                      placeholder={t('brandSelector.createPlaceholder')}
                      placeholderTextColor="#999999"
                      value={newBrandInput}
                      onChangeText={setNewBrandInput}
                      autoCapitalize="words"
                    />
                    <TouchableOpacity style={styles.addBrandButton} onPress={handleCreateNewBrand}>
                      <Text style={styles.addBrandButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowModal(false)}>
                  <Text style={styles.modalCloseButtonText}>{t('common.close')}</Text>
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
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 20,
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
  modalCheck: {
    fontSize: 18,
    color: '#1976D2',
    fontWeight: 'bold',
    marginLeft: 8,
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#000000',
    backgroundColor: '#fff',
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
});
