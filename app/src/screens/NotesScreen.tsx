import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import storage from '../services/storage';
import { Ionicons } from '@expo/vector-icons';
import { Note, Part, Printer, PrinterModel } from '../models/types';

let draftNoteTitle = '';
let draftNoteContent = '';

export default function NotesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteTitle, setNewNoteTitleState] = useState(draftNoteTitle);
  const [newNoteContent, setNewNoteContentState] = useState(draftNoteContent);

  const setNewNoteTitle = (text: string) => {
    draftNoteTitle = text;
    setNewNoteTitleState(text);
  };

  const setNewNoteContent = (text: string) => {
    draftNoteContent = text;
    setNewNoteContentState(text);
  };

  const [parts, setParts] = useState<Part[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [models, setModels] = useState<PrinterModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedPartNumber, setSelectedPartNumber] = useState('');
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [partQuantity, setPartQuantity] = useState('1');
  const [showPrinterPicker, setShowPrinterPicker] = useState(false);
  const [showPartsPicker, setShowPartsPicker] = useState(false);
  const [partsSearchQuery, setPartsSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [notesData, partsData, printersData, modelsData] = await Promise.all([
        storage.getNotes(),
        storage.getParts(),
        storage.getPrinters(),
        storage.getModels(),
      ]);
      const sortedNotes = [...notesData].sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
      setNotes(sortedNotes);
      setParts(partsData);
      setPrinters(printersData);
      setModels(modelsData as PrinterModel[]);
    } catch (error: any) {
      console.error('[NotesScreen] Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  // Получаем модель принтера из selectedPrinterId
  const getSelectedPrinterModel = () => {
    if (!selectedPrinterId) return null;
    const printer = printers.find(p => p.id === selectedPrinterId);
    return printer?.modelId || null;
  };

  // Сортируем детали: сначала совместимые с моделью принтера, потом остальные
  const getSortedParts = () => {
    const printerModel = getSelectedPrinterModel();
    
    if (!printerModel) {
      // Если модель не определена, возвращаем все детали в алфавитном порядке
      return [...parts].sort((a, b) => a.partNumber.localeCompare(b.partNumber));
    }

    // Разделяем на совместимые и остальные
    const compatibleParts = parts.filter(p => 
      p.compatibleModels.includes(printerModel)
    );
    const otherParts = parts.filter(p => 
      !p.compatibleModels.includes(printerModel)
    );

    // Сортируем каждую группу
    compatibleParts.sort((a, b) => a.partNumber.localeCompare(b.partNumber));
    otherParts.sort((a, b) => a.partNumber.localeCompare(b.partNumber));

    return [...compatibleParts, ...otherParts];
  };

  const handleAddNote = async () => {
    if (isProcessing) return;
    const titleToAdd = (newNoteTitle || draftNoteTitle || '').trim();
    const contentToAdd = (newNoteContent || draftNoteContent || '').trim();

    if (!titleToAdd) {
      Alert.alert(t('common.error'), t('notes.enterTitleError'));
      return;
    }

    setIsProcessing(true);
    try {
      console.log('[NotesScreen] Начинаем добавление задачи...');
      await storage.addNote({
        title: titleToAdd,
        content: contentToAdd,
        completed: false,
      });
      draftNoteTitle = '';
      draftNoteContent = '';
      setNewNoteTitleState('');
      setNewNoteContentState('');
      await loadData();
      console.log('[NotesScreen] Задача успешно добавлена!');
    } catch (error: any) {
      console.error('[NotesScreen] Ошибка добавления заметки:', error);
      Alert.alert(t('common.error'), error?.message || 'Не удалось добавить заметку');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLongPress = (note: Note) => {
    if (isProcessing) return;
    Alert.alert(
      t('notes.deleteConfirmTitle'),
      t('notes.deleteConfirmText'),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => {} },
        {
          text: t('common.yes'),
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              console.log('[NotesScreen] Deleting note:', note.id);
              if (note && note.completed) {
                console.log('[NotesScreen] Note is completed, cancelling completion first...');
                await storage.cancelNoteCompletion(note.id, note.title);
              }
              await storage.deleteNote(note.id);
              await loadData();
              console.log('[NotesScreen] Note deleted successfully!');
            } catch (error: any) {
              console.error('[NotesScreen] Error deleting note:', error);
              Alert.alert(t('common.error'), error?.message || 'Сбой при удалении');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleToggleComplete = async (note: Note) => {
    if (isProcessing) return;
    if (note.completed) {
      setIsProcessing(true);
      try {
        console.log('[NotesScreen] Cancelling completion for note:', note.id, note.title);
        await storage.cancelNoteCompletion(note.id, note.title);
        await loadData();
        console.log('[NotesScreen] Note completion cancelled successfully');
      } catch (error: any) {
        console.error('[NotesScreen] Error cancelling completion:', error);
        Alert.alert(t('common.error'), error?.message || 'Не удалось отменить выполнение заметки');
      } finally {
        setIsProcessing(false);
      }
    } else {
      setSelectedNote(note);
      setSelectedPartNumber('');
      setSelectedPrinterId(null);
      setPartQuantity('1');
      setModalVisible(true);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    Alert.alert(
      t('notes.deleteTitle'),
      t('notes.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await storage.deleteNote(noteId);
              loadData();
            } catch (error) {
              console.error('Ошибка удаления заметки:', error);
            }
          },
        },
      ]
    );
  };

  const handleConfirmWriteOff = async () => {
    if (!selectedNote || isProcessing) return;

    // 1. Валидация выбора принтера (Обязательное поле при списании)
    if (!selectedPrinterId) {
      Alert.alert(t('common.error'), 'Пожалуйста, выберите принтер для списания');
      return;
    }

    // 2. Валидация выбора детали
    if (!selectedPartNumber) {
      Alert.alert(t('common.error'), 'Пожалуйста, выберите деталь для списания из списка');
      return;
    }

    // 3. Валидация количества
    const deductQty = parseInt(partQuantity, 10);
    if (isNaN(deductQty) || deductQty < 1) {
      Alert.alert(t('common.error'), 'Укажите количество для списания (минимум 1)');
      return;
    }

    // 4. Поиск детали на складе
    const selectedPart = parts.find(
      p => p.partNumber.toLowerCase() === selectedPartNumber.toLowerCase()
    );
    if (!selectedPart) {
      Alert.alert(t('common.error'), 'Деталь не найдена на складе. Выберите деталь из списка.');
      return;
    }

    if (deductQty > selectedPart.quantity) {
      Alert.alert(t('common.error'), 'Недостаточно деталей на складе');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('[NotesScreen] Начинаем списание детали...');
      const newQuantity = selectedPart.quantity - deductQty;
      await storage.updatePart(selectedPart.id, { quantity: newQuantity });

      await storage.addPrinterLog({
        noteId: selectedNote.id,
        printerId: selectedPrinterId,
        date: new Date().toISOString(),
        description: selectedNote.title,
        partId: selectedPart.id,
        partName: `${selectedPart.partNumber} - ${selectedPart.description}`,
        quantityDeducted: deductQty,
      });

      await storage.updateNote(selectedNote.id, { completed: true });
      Alert.alert(t('common.success'), 'Деталь успешно списана, задача выполнена!');
      setModalVisible(false);
      setSelectedNote(null);
      setSelectedPartNumber('');
      setSelectedPrinterId(null);
      setPartQuantity('1');
      await loadData();
    } catch (error: any) {
      console.error('[NotesScreen] Ошибка при списании детали:', error);
      Alert.alert(t('common.error'), error?.message || 'Не удалось выполнить списание');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderSelectedPrinterText = () => {
    if (!selectedPrinterId) {
      return <Text style={styles.printerPickerButtonText}>{t('notes.selectPrinter')}</Text>;
    }
    const selPrinter = printers.find(p => p.id === selectedPrinterId);
    if (!selPrinter) {
      return <Text style={styles.printerPickerButtonText}>{t('notes.selectPrinter')}</Text>;
    }
    const selModel = models.find(m => m.id === selPrinter.modelId);
    const modelName = selModel ? selModel.name : '';
    const roomName = selPrinter.location ? `${selPrinter.location.building}, к. ${selPrinter.location.room}` : '';
    const detailsArr = [modelName, roomName].filter(Boolean);
    const detailsStr = detailsArr.length > 0 ? detailsArr.join(', ') : '';

    return (
      <Text style={styles.printerPickerButtonText} numberOfLines={1}>
        {selPrinter.name}
        {detailsStr ? (
          <Text style={{ color: '#007AFF', fontSize: 12, fontWeight: 'normal' }}>
            {` (${detailsStr})`}
          </Text>
        ) : null}
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Text style={styles.title}>{t('notes.title')}</Text>
          <TouchableOpacity
            style={{ marginRight: 15, padding: 4 }}
            onPress={() => console.log('Открыть справку')}
            activeOpacity={0.7}
          >
            <Ionicons name="help-circle-outline" size={26} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.addNoteSection}>
        <TextInput
          style={styles.input}
          placeholder={t('notes.titlePlaceholder')}
          placeholderTextColor="#999999"
          value={newNoteTitle}
          onChangeText={(text) => {
            setNewNoteTitle(text);
            draftNoteTitle = text;
          }}
          autoCapitalize="sentences"
          autoCorrect={false}
          keyboardType="default"
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={t('notes.contentPlaceholder')}
          placeholderTextColor="#999999"
          value={newNoteContent}
          onChangeText={(text) => {
            setNewNoteContent(text);
            draftNoteContent = text;
          }}
          multiline
          numberOfLines={3}
          autoCapitalize="sentences"
          autoCorrect={false}
          keyboardType="default"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddNote}>
          <Text style={styles.addButtonText}>{t('notes.addButton')}</Text>
        </TouchableOpacity>
      </View>

      {notes.length === 0 ? null : (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}>
          {notes.map((note) => (
            <TouchableOpacity 
              key={note.id}
              style={[styles.noteCard, note.completed && styles.noteCardCompleted]}
              onPress={() => handleToggleComplete(note)}
              disabled={isProcessing}
            >
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => handleToggleComplete(note)}
                disabled={isProcessing}
              >
                <Text style={styles.checkboxIcon}>
                  {note.completed ? '☑' : '☐'}
                </Text>
              </TouchableOpacity>
              <View style={styles.noteContent}>
                <Text style={[styles.noteTitle, note.completed && styles.textCompleted]}>
                  {note.title}
                </Text>
                {note.content ? <Text style={styles.noteText}>{note.content}</Text> : null}
                <Text style={styles.noteDate}>
                  {new Date(note.createdAt).toLocaleDateString('ru-RU')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteNote(note.id)}
              >
                <Text style={styles.deleteButtonText}>🗑</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Completion Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <KeyboardAvoidingView 
                style={{ width: '100%', alignItems: 'center' }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              >
                <View style={styles.modalContent}>
                  <ScrollView style={{ flexShrink: 1, width: '100%' }} contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
                    <Text style={styles.modalTitle}>{t('notes.completeModalTitle')}</Text>
                    <Text style={styles.modalSubtitle}>{t('notes.noteLabel', { title: selectedNote?.title })}</Text>

                    {/* 1. ПРИНТЕР (Перемещен на 1-е место сверху) */}
                    <Text style={styles.inputLabel}>{t('notes.printerLabel')}</Text>
                    <TouchableOpacity
                      style={styles.printerPickerButton}
                      onPress={() => setShowPrinterPicker(true)}
                    >
                      {renderSelectedPrinterText()}
                    </TouchableOpacity>

                    {/* 2. ДЕТАЛЬ */}
                    <Text style={styles.inputLabel}>{t('notes.partNumberLabel')}</Text>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={() => setShowPartsPicker(true)}
                    >
                      <Text style={styles.pickerButtonText}>
                        {selectedPartNumber || t('notes.selectPart')}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.helpText}>
                      {t('notes.clickToSelectPart')}
                    </Text>

                    {/* 3. КОЛИЧЕСТВО */}
                    <Text style={styles.inputLabel}>{t('notes.quantityLabel')}</Text>
                    <TextInput
                      style={styles.quantityInput}
                      value={partQuantity}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9]/g, '');
                        setPartQuantity(cleaned);
                      }}
                      placeholder="1"
                      placeholderTextColor="#999999"
                      keyboardType="numeric"
                    />
                  </ScrollView>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.cancelButton]}
                      disabled={isProcessing}
                      onPress={() => {
                        setModalVisible(false);
                        setSelectedNote(null);
                        setSelectedPartNumber('');
                        setSelectedPrinterId(null);
                        setPartQuantity('1');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.completeWithoutWriteOffButton, isProcessing && { opacity: 0.6 }]}
                      disabled={isProcessing}
                      onPress={async () => {
                        if (!selectedNote || isProcessing) return;
                        setIsProcessing(true);
                        try {
                          await storage.addPrinterLog({
                            noteId: selectedNote.id,
                            printerId: selectedPrinterId || '',
                            date: new Date().toISOString(),
                            description: selectedNote.title,
                          });
                          await storage.updateNote(selectedNote.id, { completed: true });
                          Alert.alert(t('common.success'), 'Задача выполнена и добавлена в отчет');
                          setModalVisible(false);
                          setSelectedNote(null);
                          setSelectedPartNumber('');
                          setSelectedPrinterId(null);
                          setPartQuantity('1');
                          await loadData();
                        } catch (error: any) {
                          console.error('[NotesScreen] Ошибка обновления заметки:', error);
                          Alert.alert(t('common.error'), error?.message || 'Не удалось обновить заметку');
                        } finally {
                          setIsProcessing(false);
                        }
                      }}
                    >
                      <Text style={styles.completeWithoutWriteOffButtonText}>
                        {isProcessing ? t('common.processing') : t('notes.completeWithoutWriteOff')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.confirmButton, isProcessing && { opacity: 0.6 }]}
                      disabled={isProcessing}
                      onPress={handleConfirmWriteOff}
                    >
                      <Text style={styles.confirmButtonText}>
                        {isProcessing ? t('common.processing') : t('notes.deductAndComplete')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Printer Picker Modal */}
      <Modal
        visible={showPrinterPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPrinterPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPrinterPicker(false)}>
          <View style={styles.printerModalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.printerModalContent}>
                <Text style={styles.printerModalTitle}>{t('notes.selectPrinterModalTitle')}</Text>
                <ScrollView>
                  {(() => {
                    const selectedPartObj = parts.find(
                      p => p.partNumber.toLowerCase() === selectedPartNumber.toLowerCase()
                    );
                    const filteredPrintersForTask = printers.filter(printer => {
                      if (!selectedPartObj || !selectedPartObj.compatibleModels || selectedPartObj.compatibleModels.length === 0) {
                        return true;
                      }
                      return selectedPartObj.compatibleModels.includes(printer.modelId);
                    });

                    if (filteredPrintersForTask.length === 0) {
                      return (
                        <Text style={{ textAlign: 'center', color: '#888', marginVertical: 20 }}>
                          {t('notes.noCompatiblePrinters')}
                        </Text>
                      );
                    }

                    return filteredPrintersForTask.map(printer => {
                      const selModel = models.find(m => m.id === printer.modelId);
                      const modelName = selModel ? selModel.name : '';
                      const roomName = printer.location ? `${printer.location.building}, к. ${printer.location.room}` : '';
                      const detailsArr = [modelName, roomName].filter(Boolean);
                      const detailsStr = detailsArr.length > 0 ? detailsArr.join(', ') : '';

                      return (
                        <TouchableOpacity
                          key={printer.id}
                          style={styles.printerModalItem}
                          onPress={() => {
                            setSelectedPrinterId(printer.id);
                            setShowPrinterPicker(false);
                          }}
                        >
                          <Text style={styles.printerModalItemText} numberOfLines={1}>
                            {printer.name}
                            {detailsStr ? (
                              <Text style={{ color: '#007AFF', fontSize: 12, fontWeight: 'normal' }}>
                                {` (${detailsStr})`}
                              </Text>
                            ) : null}
                          </Text>
                          {selectedPrinterId === printer.id && (
                            <Text style={styles.printerModalCheck}>✓</Text>
                          )}
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </ScrollView>
                <TouchableOpacity
                  style={styles.printerModalCancelButton}
                  onPress={() => setShowPrinterPicker(false)}
                >
                  <Text style={styles.printerModalCancelText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Parts Picker Modal */}
      <Modal
        visible={showPartsPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => { setShowPartsPicker(false); setPartsSearchQuery(''); }}
      >
        <TouchableWithoutFeedback onPress={() => { setShowPartsPicker(false); setPartsSearchQuery(''); }}>
          <View style={styles.printerModalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.printerModalContent}>
                <Text style={styles.printerModalTitle}>{t('notes.selectPartModalTitle')}</Text>
                <TextInput
                  style={styles.partsSearchInput}
                  placeholder={t('notes.searchPartsPlaceholder')}
                  placeholderTextColor="#999999"
                  value={partsSearchQuery}
                  onChangeText={setPartsSearchQuery}
                  autoCorrect={false}
                />
                <ScrollView style={{ maxHeight: 300 }}>
                  {getSortedParts()
                    .filter(part => {
                      // Каскадная фильтрация: если выбран принтер, выводим только детали, совместимые с моделью принтера
                      if (selectedPrinterId) {
                        const selPrinter = printers.find(p => p.id === selectedPrinterId);
                        if (selPrinter && selPrinter.modelId) {
                          if (part.compatibleModels && part.compatibleModels.length > 0) {
                            if (!part.compatibleModels.includes(selPrinter.modelId)) {
                              return false;
                            }
                          }
                        }
                      }
                      const query = partsSearchQuery.trim().toLowerCase();
                      if (query === '') {
                        return part.quantity > 0;
                      }
                      return (
                        part.partNumber.toLowerCase().includes(query) ||
                        part.description.toLowerCase().includes(query)
                      );
                    })
                    .map(part => (
                      <TouchableOpacity
                        key={part.id}
                        style={styles.printerModalItem}
                        onPress={() => {
                          setSelectedPartNumber(part.partNumber);
                          setShowPartsPicker(false);
                          setPartsSearchQuery('');
                        }}
                      >
                        <View style={styles.modalItemContent}>
                          <Text style={styles.printerModalItemText}>{part.partNumber}</Text>
                          <Text style={styles.modalItemDescription}>{part.description}</Text>
                          <Text style={styles.modalItemQuantity}>
                            {t('notes.inStockDetails', { quantity: part.quantity, models: part.compatibleModels.map(id => models.find(m => m.id === id)?.name || id).join(', ') })}
                          </Text>
                        </View>
                        {selectedPartNumber === part.partNumber && (
                          <Text style={styles.printerModalCheck}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.printerModalCancelButton}
                  onPress={() => { setShowPartsPicker(false); setPartsSearchQuery(''); }}
                >
                  <Text style={styles.printerModalCancelText}>{t('common.close')}</Text>
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
    padding: 20,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  addNoteSection: {
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
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
  noteCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginBottom: 10,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'flex-start',
  },
  noteCardCompleted: {
    backgroundColor: '#f0f0f0',
    opacity: 0.8,
  },
  checkbox: {
    marginRight: 12,
    paddingTop: 2,
  },
  checkboxIcon: {
    fontSize: 24,
  },
  noteContent: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  textCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  noteText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  noteDate: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    marginLeft: 10,
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    width: '95%',
    maxWidth: 400,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 10,
  },
  helpText: {
    fontSize: 11,
    color: '#888',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#ffffff',
    marginTop: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 15,
    backgroundColor: '#fff',
    gap: 5,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  completeWithoutWriteOffButton: {
    backgroundColor: '#4CAF50',
  },
  completeWithoutWriteOffButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#FF5722',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
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
  printerPickerButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
  },
  printerPickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  printerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  printerModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  printerModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    padding: 20,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  printerModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  printerModalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  modalItemQuantity: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  printerModalCheck: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  printerModalCancelButton: {
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginTop: 10,
  },
  printerModalCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  partsSearchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#000000',
    marginHorizontal: 15,
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
});