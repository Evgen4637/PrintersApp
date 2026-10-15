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
import { ensureImmersiveMode } from '../utils/useImmersiveMode';
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
  const [selectedParts, setSelectedParts] = useState<Array<{ part: Part; quantity: number }>>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [workDescription, setWorkDescription] = useState('');
  const [showPrinterPicker, setShowPrinterPicker] = useState(false);
  const [printerSearchQuery, setPrinterSearchQuery] = useState('');
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
      Alert.alert(t('common.error'), error?.message || t('notes.addNoteError'));
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
              Alert.alert(t('common.error'), error?.message || t('notes.deleteNoteError'));
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
        Alert.alert(t('common.error'), error?.message || t('notes.cancelCompletionError'));
      } finally {
        setIsProcessing(false);
      }
    } else {
      setSelectedNote(note);
      setSelectedParts([]);
      setSelectedPrinterId(note.relatedPrinterId || null);
      setWorkDescription('');
      setPrinterSearchQuery('');
      setPartsSearchQuery('');
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
      Alert.alert(t('common.error'), t('notes.selectPrinterForWriteOffError'));
      return;
    }

    // 2. Валидация выбора деталей (хотя бы одна деталь)
    if (selectedParts.length === 0) {
      Alert.alert(t('common.error'), t('notes.selectAtLeastOnePartError'));
      return;
    }

    // 3. Валидация доступного количества на складе для каждой детали
    for (const item of selectedParts) {
      const currentPart = parts.find(p => p.id === item.part.id);
      const stock = currentPart ? currentPart.quantity : item.part.quantity;
      if (item.quantity < 1 || item.quantity > stock) {
        Alert.alert(
          t('common.error'),
          t('notes.partQuantityExceedsStockError', {
            partNumber: item.part.partNumber,
            stock: stock,
          })
        );
        return;
      }
    }

    setIsProcessing(true);
    try {
      console.log('[NotesScreen] Начинаем списание деталей...');
      const partsDeducted = selectedParts.map(item => ({
        partId: item.part.id,
        partName: `${item.part.partNumber} - ${item.part.description}`,
        quantity: item.quantity,
      }));

      const desc = workDescription.trim() || selectedNote.title;

      await storage.addPrinterLog({
        noteId: selectedNote.id,
        printerId: selectedPrinterId,
        date: new Date().toISOString(),
        description: desc,
        partsDeducted,
        partId: partsDeducted.length === 1 ? partsDeducted[0].partId : undefined,
        partName: partsDeducted.length === 1 ? partsDeducted[0].partName : undefined,
        quantityDeducted: partsDeducted.length === 1 ? partsDeducted[0].quantity : undefined,
      });

      await storage.updateNote(selectedNote.id, { completed: true });
      Alert.alert(t('common.success'), t('notes.writeOffSuccess'));
      setModalVisible(false);
      setSelectedNote(null);
      setSelectedParts([]);
      setSelectedPrinterId(null);
      setWorkDescription('');
      setPrinterSearchQuery('');
      setPartsSearchQuery('');
      await loadData();
    } catch (error: any) {
      console.error('[NotesScreen] Ошибка при списании деталей:', error);
      Alert.alert(t('common.error'), error?.message || t('notes.writeOffError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteWithoutWriteOff = async () => {
    if (!selectedNote || isProcessing) return;
    setIsProcessing(true);
    try {
      const desc = workDescription.trim() || selectedNote.title;
      if (selectedPrinterId) {
        await storage.addPrinterLog({
          noteId: selectedNote.id,
          printerId: selectedPrinterId,
          date: new Date().toISOString(),
          description: desc,
        });
      }
      await storage.updateNote(selectedNote.id, { completed: true });
      Alert.alert(t('common.success'), t('notes.completeWithoutWriteOffSuccess'));
      setModalVisible(false);
      setSelectedNote(null);
      setSelectedParts([]);
      setSelectedPrinterId(null);
      setWorkDescription('');
      setPrinterSearchQuery('');
      setPartsSearchQuery('');
      await loadData();
    } catch (error: any) {
      console.error('[NotesScreen] Ошибка обновления заметки:', error);
      Alert.alert(t('common.error'), error?.message || t('notes.updateNoteError'));
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
    const roomName = selPrinter.location ? `${selPrinter.location.building}, ${selPrinter.location.room}` : '';
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
            onPress={() =>
              Alert.alert(
                t('tabHelp.tasks.title'),
                t('tabHelp.tasks.message'),
                [{ text: t('tabHelp.button'), style: 'default' }]
              )
            }
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
        statusBarTranslucent={true}
        onShow={ensureImmersiveMode}
        onRequestClose={() => {
          setModalVisible(false);
          ensureImmersiveMode();
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoidingView}
            pointerEvents="box-none"
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('notes.completeModalTitle')}</Text>
              <Text style={styles.modalSubtitle}>{t('notes.noteLabel', { title: selectedNote?.title })}</Text>

              <ScrollView 
                style={{ flex: 1, width: '100%' }} 
                contentContainerStyle={{ paddingBottom: 20 }} 
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                    {/* 1. ПРИНТЕР */}
                    <Text style={[styles.inputLabel, { marginTop: 0 }]}>{t('notes.printerLabel')}</Text>
                    <TouchableOpacity
                      style={styles.printerPickerButton}
                      onPress={() => setShowPrinterPicker(true)}
                    >
                      {renderSelectedPrinterText()}
                    </TouchableOpacity>

                    {/* 2. ДЕТАЛИ ДЛЯ СПИСАНИЯ */}
                    <View style={styles.partsHeaderRow}>
                      <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 0 }]}>
                        {t('notes.partsToWriteOff')}
                      </Text>
                      <TouchableOpacity
                        style={styles.addPartButton}
                        onPress={() => setShowPartsPicker(true)}
                      >
                        <Text style={styles.addPartButtonText}>+ {t('notes.addPart')}</Text>
                      </TouchableOpacity>
                    </View>

                    {selectedParts.length === 0 ? (
                      <View style={styles.emptyPartsContainer}>
                        <Text style={styles.emptyPartsText}>
                          {t('notes.noPartsSelected')}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.selectedPartsList}>
                        {selectedParts.map((item, index) => {
                          const currentPart = parts.find(p => p.id === item.part.id) || item.part;
                          return (
                            <View key={item.part.id} style={styles.selectedPartCard}>
                              <View style={styles.selectedPartInfo}>
                                <Text style={styles.selectedPartNumber} numberOfLines={1}>
                                  {item.part.partNumber}
                                </Text>
                                <Text style={styles.selectedPartDesc} numberOfLines={1}>
                                  {item.part.description}
                                </Text>
                                <Text style={styles.selectedPartStock}>
                                  {t('notes.inStockCount', { count: currentPart.quantity })}
                                </Text>
                              </View>

                              <View style={styles.selectedPartControls}>
                                <TouchableOpacity
                                  style={styles.quantityStepBtn}
                                  onPress={() => {
                                    setSelectedParts(prev =>
                                      prev.map((p, i) =>
                                        i === index ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p
                                      )
                                    );
                                  }}
                                >
                                  <Text style={styles.quantityStepBtnText}>-</Text>
                                </TouchableOpacity>

                                <TextInput
                                  style={styles.partQtyInput}
                                  value={String(item.quantity)}
                                  keyboardType="numeric"
                                  onChangeText={val => {
                                    const cleaned = val.replace(/[^0-9]/g, '');
                                    if (cleaned === '') {
                                      setSelectedParts(prev =>
                                        prev.map((p, i) => (i === index ? { ...p, quantity: 1 } : p))
                                      );
                                    } else {
                                      const num = parseInt(cleaned, 10);
                                      const clamped = Math.max(1, Math.min(currentPart.quantity, num));
                                      setSelectedParts(prev =>
                                        prev.map((p, i) => (i === index ? { ...p, quantity: clamped } : p))
                                      );
                                    }
                                  }}
                                />

                                <TouchableOpacity
                                  style={styles.quantityStepBtn}
                                  onPress={() => {
                                    if (item.quantity >= currentPart.quantity) {
                                      Alert.alert(
                                        t('common.warning'),
                                        t('notes.partAlreadyAtMaxStock', {
                                          partNumber: item.part.partNumber,
                                          max: currentPart.quantity,
                                        })
                                      );
                                      return;
                                    }
                                    setSelectedParts(prev =>
                                      prev.map((p, i) =>
                                        i === index ? { ...p, quantity: Math.min(currentPart.quantity, p.quantity + 1) } : p
                                      )
                                    );
                                  }}
                                >
                                  <Text style={styles.quantityStepBtnText}>+</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={styles.removePartButton}
                                  onPress={() => {
                                    setSelectedParts(prev => prev.filter((_, i) => i !== index));
                                  }}
                                >
                                  <Text style={styles.removePartButtonText}>🗑</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* 3. ВЫПОЛНЕННЫЕ РАБОТЫ / КОММЕНТАРИЙ */}
                    <Text style={styles.inputLabel}>{t('notes.workDescriptionLabel')}</Text>
                    <TextInput
                      style={styles.workDescriptionInput}
                      value={workDescription}
                      onChangeText={setWorkDescription}
                      placeholder={t('notes.workDescriptionPlaceholder')}
                      placeholderTextColor="#999999"
                      multiline={true}
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </ScrollView>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.cancelButton]}
                      disabled={isProcessing}
                      onPress={() => {
                        setModalVisible(false);
                        setSelectedNote(null);
                        setSelectedParts([]);
                        setSelectedPrinterId(null);
                        setWorkDescription('');
                        setPrinterSearchQuery('');
                        setPartsSearchQuery('');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.completeWithoutWriteOffButton, isProcessing && { opacity: 0.6 }]}
                      disabled={isProcessing}
                      onPress={handleCompleteWithoutWriteOff}
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
            </View>
          </Modal>

      {/* Printer Picker Modal */}
      <Modal
        visible={showPrinterPicker}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onShow={ensureImmersiveMode}
        onRequestClose={() => {
          setShowPrinterPicker(false);
          setPrinterSearchQuery('');
          ensureImmersiveMode();
        }}
      >
        <TouchableWithoutFeedback onPress={() => { setShowPrinterPicker(false); setPrinterSearchQuery(''); }}>
          <View style={styles.printerModalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.printerModalContent}>
                <Text style={styles.printerModalTitle}>{t('notes.selectPrinterModalTitle')}</Text>

                <View style={styles.modalSearchContainer}>
                  <Ionicons name="search" size={18} color="#888" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder={t('notes.searchPrintersPlaceholder')}
                    placeholderTextColor="#999999"
                    value={printerSearchQuery}
                    onChangeText={setPrinterSearchQuery}
                    autoCorrect={false}
                  />
                  {printerSearchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setPrinterSearchQuery('')}
                      style={{ padding: 4 }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#888" />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView style={{ maxHeight: 350 }}>
                  {(() => {
                    const query = printerSearchQuery.trim().toLowerCase();
                    const filteredPrinters = printers
                      .filter(printer => {
                        if (!query) return true;
                        const selModel = models.find(m => m.id === printer.modelId);
                        const modelName = selModel ? selModel.name.toLowerCase() : '';
                        const printerName = printer.name.toLowerCase();
                        const building = printer.location?.building?.toLowerCase() || '';
                        const room = printer.location?.room?.toLowerCase() || '';
                        const locationStr = `${building} ${room}`;

                        return (
                          printerName.includes(query) ||
                          modelName.includes(query) ||
                          locationStr.includes(query)
                        );
                      })
                      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));

                    if (filteredPrinters.length === 0) {
                      return (
                        <Text style={styles.modalEmptyText}>
                          {printerSearchQuery ? t('common.notFound') : t('notes.noPrintersFound')}
                        </Text>
                      );
                    }

                    return filteredPrinters.map(printer => {
                      const selModel = models.find(m => m.id === printer.modelId);
                      const modelName = selModel ? selModel.name : '';
                      const roomName = printer.location ? `${printer.location.building}, ${printer.location.room}` : '';
                      const detailsArr = [modelName, roomName].filter(Boolean);
                      const detailsStr = detailsArr.length > 0 ? detailsArr.join(', ') : '';

                      return (
                        <TouchableOpacity
                          key={printer.id}
                          style={styles.printerModalItem}
                          onPress={() => {
                            setSelectedPrinterId(printer.id);
                            setShowPrinterPicker(false);
                            setPrinterSearchQuery('');
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
                  onPress={() => {
                    setShowPrinterPicker(false);
                    setPrinterSearchQuery('');
                  }}
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
        statusBarTranslucent={true}
        onShow={ensureImmersiveMode}
        onRequestClose={() => {
          setShowPartsPicker(false);
          setPartsSearchQuery('');
          ensureImmersiveMode();
        }}
      >
        <TouchableWithoutFeedback onPress={() => { setShowPartsPicker(false); setPartsSearchQuery(''); }}>
          <View style={styles.printerModalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.printerModalContent}>
                <Text style={styles.printerModalTitle}>{t('notes.selectPartModalTitle')}</Text>
                <View style={styles.modalSearchContainer}>
                  <Ionicons name="search" size={18} color="#888" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder={t('notes.searchPartsPlaceholder')}
                    placeholderTextColor="#999999"
                    value={partsSearchQuery}
                    onChangeText={setPartsSearchQuery}
                    autoCorrect={false}
                  />
                  {partsSearchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setPartsSearchQuery('')}
                      style={{ padding: 4 }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#888" />
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView style={{ maxHeight: 350 }}>
                  {(() => {
                    const query = partsSearchQuery.trim().toLowerCase();
                    const availableParts = parts.filter(p => p.quantity > 0);

                    const filteredParts = availableParts.filter(part => {
                      if (!query) return true;
                      return (
                        part.partNumber.toLowerCase().includes(query) ||
                        part.description.toLowerCase().includes(query)
                      );
                    });

                    const selPrinter = selectedPrinterId ? printers.find(p => p.id === selectedPrinterId) : null;
                    const modelId = selPrinter?.modelId;

                    filteredParts.sort((a, b) => {
                      if (modelId) {
                        const aCompat = a.compatibleModels && a.compatibleModels.includes(modelId) ? 1 : 0;
                        const bCompat = b.compatibleModels && b.compatibleModels.includes(modelId) ? 1 : 0;
                        if (aCompat !== bCompat) return bCompat - aCompat;
                      }
                      return a.partNumber.localeCompare(b.partNumber);
                    });

                    if (filteredParts.length === 0) {
                      return (
                        <Text style={styles.modalEmptyText}>
                          {partsSearchQuery ? t('common.notFound') : t('notes.noPartsInStock')}
                        </Text>
                      );
                    }

                    return filteredParts.map(part => {
                      const selectedItem = selectedParts.find(p => p.part.id === part.id);
                      return (
                        <TouchableOpacity
                          key={part.id}
                          style={styles.printerModalItem}
                          onPress={() => {
                            if (selectedItem) {
                              if (selectedItem.quantity < part.quantity) {
                                setSelectedParts(prev =>
                                  prev.map(p =>
                                    p.part.id === part.id ? { ...p, quantity: p.quantity + 1 } : p
                                  )
                                );
                                Alert.alert(
                                  t('common.info'),
                                  t('notes.partQuantityIncremented', {
                                    partNumber: part.partNumber,
                                    quantity: selectedItem.quantity + 1,
                                  })
                                );
                              } else {
                                Alert.alert(
                                  t('common.warning'),
                                  t('notes.partAlreadyAtMaxStock', {
                                    partNumber: part.partNumber,
                                    max: part.quantity,
                                  })
                                );
                              }
                            } else {
                              setSelectedParts(prev => [...prev, { part, quantity: 1 }]);
                            }
                            setShowPartsPicker(false);
                            setPartsSearchQuery('');
                          }}
                        >
                          <View style={styles.modalItemContent}>
                            <Text style={styles.printerModalItemText}>{part.partNumber}</Text>
                            <Text style={styles.modalItemDescription}>{part.description}</Text>
                            <Text style={styles.modalItemQuantity}>
                              {t('notes.inStockCount', { count: part.quantity })}
                            </Text>
                          </View>
                          {selectedItem && (
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={styles.printerModalCheck}>✓</Text>
                              <Text style={{ fontSize: 11, color: '#4CAF50', fontWeight: '600' }}>
                                {selectedItem.quantity} {t('common.pcs')}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </ScrollView>
                <TouchableOpacity
                  style={styles.printerModalCancelButton}
                  onPress={() => {
                    setShowPartsPicker(false);
                    setPartsSearchQuery('');
                  }}
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
  keyboardAvoidingView: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    width: '94%',
    height: '82%',
    alignSelf: 'center',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalScroll: {
    flex: 1,
    width: '100%',
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 14,
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
  workDescriptionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: '#000000',
    backgroundColor: '#ffffff',
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 6,
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
  partsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  addPartButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  addPartButtonText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  emptyPartsContainer: {
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyPartsText: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
  },
  selectedPartsList: {
    marginBottom: 10,
  },
  selectedPartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
  },
  selectedPartInfo: {
    flex: 1,
    marginRight: 8,
  },
  selectedPartNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedPartDesc: {
    fontSize: 12,
    color: '#666',
    marginTop: 1,
  },
  selectedPartStock: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  selectedPartControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quantityStepBtn: {
    width: 28,
    height: 28,
    backgroundColor: '#e8e8e8',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityStepBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  partQtyInput: {
    minWidth: 34,
    height: 28,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    backgroundColor: '#fff',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    padding: 0,
  },
  removePartButton: {
    padding: 6,
    marginLeft: 4,
  },
  removePartButtonText: {
    fontSize: 16,
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    marginHorizontal: 15,
    marginVertical: 10,
    backgroundColor: '#f9f9f9',
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    padding: 0,
  },
  modalEmptyText: {
    textAlign: 'center',
    color: '#888',
    marginVertical: 20,
    fontSize: 14,
  },
});