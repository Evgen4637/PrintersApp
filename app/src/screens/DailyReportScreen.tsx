import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import storage from '../services/storage';
import { DailyReportEntry, DailyAction, ReportsHistory } from '../models/types';

type TabType = 'current' | 'history';

export default function DailyReportScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const todayStr = new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState<TabType>('current');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [currentReport, setCurrentReport] = useState<Map<string, DailyReportEntry[]>>(new Map());
  const [history, setHistory] = useState<ReportsHistory[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<ReportsHistory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      loadPeriodReport(startDate, endDate);
    }
  }, [startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const historyData = await storage.getReportsHistory();
      setHistory(historyData);
      setFilteredHistory(historyData);
      await loadPeriodReport(startDate, endDate);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPeriodReport = async (start: string, end: string) => {
    try {
      const dates: string[] = [];
      const curr = new Date(start);
      const last = new Date(end);

      if (isNaN(curr.getTime()) || isNaN(last.getTime()) || curr > last) {
        dates.push(start);
      } else {
        const temp = new Date(curr);
        while (temp <= last) {
          dates.push(temp.toISOString().split('T')[0]);
          temp.setDate(temp.getDate() + 1);
        }
      }

      const combinedGrouped = new Map<string, DailyReportEntry[]>();

      for (const d of dates) {
        const dayGrouped = await storage.getDailyReportGroupedByPrinter(d);
        for (const [printerName, entries] of dayGrouped.entries()) {
          const existing = combinedGrouped.get(printerName) || [];
          existing.push(...entries);
          combinedGrouped.set(printerName, existing);
        }
      }

      setCurrentReport(combinedGrouped);
    } catch (error) {
      console.error('Ошибка загрузки отчета за период:', error);
    }
  };

  const handleExportPDF = async () => {
    try {
      if (currentReport.size === 0) {
        Alert.alert(t('common.info'), t('dailyReport.noDataForPdf'));
        return;
      }

      const [allPrinters, allModels] = await Promise.all([
        storage.getPrinters(),
        storage.getModels(),
      ]);

      let rowsHtml = '';
      let totalActionsCount = 0;

      currentReport.forEach((entries, printerName) => {
        const printer = allPrinters.find(p => p.name.toLowerCase() === printerName.toLowerCase());
        const model = printer ? allModels.find(m => m.id === printer.modelId) : null;
        const modelName = model ? model.name : '—';

        entries.forEach(entry => {
          entry.actions.forEach(action => {
            totalActionsCount++;
            const isTaskEntry = Boolean(
              action.description &&
              action.description.trim() &&
              action.description !== 'Обслуживание'
            );
            const titleText = isTaskEntry ? action.description!.trim() : 'Обслуживание';
            const isWriteOff = action.quantity > 0 && action.partName && action.partName !== 'без списания';
            const formattedDateStr = action.timestamp
              ? new Date(action.timestamp).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            rowsHtml += `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${formattedDateStr}</td>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${printerName}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${modelName}</td>
                <td style="padding: 8px; border: 1px solid #ddd; color: #D97706; font-weight: bold;">${titleText}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${isWriteOff ? `${action.partName} (x${action.quantity})` : 'без списания'}</td>
              </tr>
            `;
          });
        });
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Отчет по обслуживанию техники</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
              h1 { color: #007AFF; font-size: 22px; margin-bottom: 5px; }
              .period { font-size: 14px; color: #666; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th { background-color: #007AFF; color: white; padding: 10px; border: 1px solid #007AFF; text-align: left; font-size: 13px; }
              td { font-size: 12px; }
              tr:nth-child(even) { background-color: #f9f9f9; }
              .footer { margin-top: 20px; font-size: 12px; color: #888; text-align: right; }
            </style>
          </head>
          <body>
            <h1>Отчет по обслуживанию техники</h1>
            <div class="period">
              <strong>Период:</strong> с ${startDate} по ${endDate} | 
              <strong>Всего записей:</strong> ${totalActionsCount}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Дата / Время</th>
                  <th>Имя принтера</th>
                  <th>Модель</th>
                  <th>Выполненные работы</th>
                  <th>Детали / Списание</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            <div class="footer">
              Сформировано: ${new Date().toLocaleString('ru-RU')}
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Экспорт отчета в PDF',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(t('common.success'), t('dailyReport.pdfSuccess', { uri }));
      }
    } catch (error: any) {
      console.error('Ошибка при экспорте PDF:', error);
      Alert.alert(t('common.error'), t('dailyReport.pdfExportError'));
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredHistory(history);
    } else {
      const filtered = history.filter(historyItem =>
        historyItem.report.entries.some(entry =>
          entry.printerName.toLowerCase().includes(query.toLowerCase())
        )
      );
      setFilteredHistory(filtered);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleDeleteAction = (printerName: string, action: DailyAction) => {
    Alert.alert(
      t('notes.deleteConfirmTitle'),
      t('notes.deleteConfirmText'),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => {} },
        {
          text: t('common.yes'),
          style: 'destructive',
          onPress: async () => {
            try {
              const actionId = action.id || action.timestamp;
              console.log('[DailyReportScreen] Deleting daily action with actionId:', actionId);
              const actionDate = action.timestamp 
                ? new Date(action.timestamp).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0];
              const pName = printerName && printerName !== 'Не указан' ? printerName : (action.printerName || 'Не указан');

              await storage.deleteDailyAction(actionDate, pName, actionId);
              await loadData();
              console.log('[DailyReportScreen] Daily action deleted successfully!');
            } catch (error: any) {
              console.error('[DailyReportScreen] Ошибка удаления записи:', error);
              Alert.alert(t('common.error'), error?.message || 'Не удалось удалить запись');
            }
          },
        },
      ]
    );
  };

  const renderAction = (action: DailyAction, actionIndex: number, printerName: string) => {
    const isWriteOff = action.quantity > 0 && action.partName && action.partName !== 'без списания';
    const displayPrinter = printerName && printerName !== 'Не указан' ? printerName : (action.printerName || 'Не указан');

    const isTaskEntry = Boolean(
      action.description &&
      action.description.trim() &&
      action.description !== 'Обслуживание'
    );
    const titleText = isTaskEntry ? action.description!.trim() : 'Обслуживание';

    return (
      <View key={action.timestamp || actionIndex} style={styles.actionItem}>
        <View style={styles.actionHeader}>
          <Text style={styles.actionType}>{titleText}</Text>
          <View style={styles.actionRightHeader}>
            <Text style={styles.actionTime}>
              {new Date(action.timestamp).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {activeTab === 'current' && (
              <TouchableOpacity
                style={styles.deleteActionBtn}
                onPress={() => handleDeleteAction(printerName, action)}
              >
                <Text style={styles.deleteActionText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.actionPrinter}>
          {t('dailyReport.printerLabel', { printer: displayPrinter })}
        </Text>
        <Text style={styles.actionPart}>
          {t('dailyReport.partLabel', { part: isWriteOff ? `${action.partName} (x${action.quantity})` : t('dailyReport.noWriteOff') })}
        </Text>
      </View>
    );
  };

  const renderPrinterGroup = (printerName: string, entries: DailyReportEntry[]) => {
    const allActionsWithIndices: { action: DailyAction; originalIndex: number }[] = [];
    entries.forEach(entry => {
      entry.actions.forEach((action, idx) => {
        allActionsWithIndices.push({ action, originalIndex: idx });
      });
    });

    allActionsWithIndices.sort((a, b) => new Date(b.action.timestamp).getTime() - new Date(a.action.timestamp).getTime());

    return (
      <View key={printerName} style={styles.printerGroup}>
        <View style={styles.printerGroupHeader}>
          <Text style={styles.printerGroupName}>{printerName}</Text>
          <Text style={styles.actionsCount}>{t('dailyReport.actionsCount', { count: allActionsWithIndices.length })}</Text>
        </View>
        {allActionsWithIndices.map(({ action, originalIndex }) =>
          renderAction(action, originalIndex, printerName)
        )}
      </View>
    );
  };

  const renderCurrentTab = () => {
    const totalActions = Array.from(currentReport.values())
      .reduce((sum, entries) => sum + entries.reduce((entrySum, entry) => entrySum + entry.actions.length, 0), 0);

    return (
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <View style={styles.periodCard}>
          <Text style={styles.periodTitle}>{t('dailyReport.periodTitle')}</Text>
          <View style={styles.periodRow}>
            <View style={styles.periodField}>
              <Text style={styles.periodLabel}>{t('dailyReport.fromLabel')}</Text>
              <TextInput
                style={styles.periodInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={styles.periodField}>
              <Text style={styles.periodLabel}>{t('dailyReport.toLabel')}</Text>
              <TextInput
                style={styles.periodInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
          <TouchableOpacity style={styles.pdfButton} onPress={handleExportPDF}>
            <Text style={styles.pdfButtonText}>{t('dailyReport.exportPdfButton')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('dailyReport.summaryTitle')}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('dailyReport.printersCountLabel')}</Text>
            <Text style={styles.summaryValue}>{currentReport.size}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('dailyReport.totalActionsLabel')}</Text>
            <Text style={styles.summaryValue}>{totalActions}</Text>
          </View>
        </View>

        {currentReport.size === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('common.emptyList')}</Text>
          </View>
        ) : (
          Array.from(currentReport.entries()).map(([printerName, entries]) =>
            renderPrinterGroup(printerName, entries)
          )
        )}
      </ScrollView>
    );
  };

  const renderHistoryTab = () => {
    const uniqueDates = [...new Set(filteredHistory.map(h => h.date))].sort().reverse();

    const handleDateSelect = (date: string) => {
      if (selectedHistoryDate === date) {
        setSelectedHistoryDate(null);
      } else {
        setSelectedHistoryDate(date);
      }
    };

    const renderHistoryDate = (date: string) => {
      const dayHistory = filteredHistory.filter(h => h.date === date);
      const totalActions = dayHistory.reduce(
        (sum, h) => sum + h.report.entries.reduce((entrySum, entry) => entrySum + entry.actions.length, 0),
        0
      );

      return (
        <View key={date} style={styles.historyDateGroup}>
          <TouchableOpacity
            style={[
              styles.historyDateHeader,
              selectedHistoryDate === date && styles.historyDateHeaderSelected,
            ]}
            onPress={() => handleDateSelect(date)}
          >
            <View>
              <Text style={styles.historyDateText}>{formatDate(date)}</Text>
              <Text style={styles.historyDateSubtext}>
                {t('dailyReport.historySubtext', { entries: dayHistory.length, actions: totalActions })}
              </Text>
            </View>
            <Text style={styles.historyArrow}>
              {selectedHistoryDate === date ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {selectedHistoryDate === date && (
            <View style={styles.historyDetails}>
              {dayHistory.map(historyItem => (
                <View key={historyItem.id} style={styles.historyItem}>
                  <Text style={styles.historyItemTitle}>
                    Завершено: {new Date(historyItem.completedAt).toLocaleTimeString('ru-RU')}
                  </Text>
                  {historyItem.report.entries.map(entry => (
                    <View key={entry.printerName} style={styles.historyPrinterEntry}>
                      <Text style={styles.historyPrinterName}>{entry.printerName}</Text>
                      {entry.actions.map((action, idx) => (
                        <View key={idx} style={styles.historyActionItem}>
                          <Text style={styles.historyActionText}>
                            {action.description || 'Обслуживание'} ({action.partName && action.partName !== 'без списания' ? `${action.partName} x${action.quantity}` : t('dailyReport.noWriteOff')})
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      );
    };

    return (
      <>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('dailyReport.searchPlaceholder')}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>

        {filteredHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {searchQuery ? t('common.notFound') : t('dailyReport.historyEmpty')}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.historyList, { paddingBottom: 100 }]}>
            {uniqueDates.map(date => renderHistoryDate(date))}
          </ScrollView>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>{t('dailyReport.title')}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'current' && styles.tabActive]}
          onPress={() => setActiveTab('current')}
        >
          <Text style={[styles.tabText, activeTab === 'current' && styles.tabTextActive]}>
            {t('dailyReport.currentTab')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            {t('dailyReport.historyTab')}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'current' ? renderCurrentTab() : renderHistoryTab()}
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
    backgroundColor: '#FF5722',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    margin: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  tabActive: {
    backgroundColor: '#FF5722',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: 'white',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
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
  finishButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 10,
    marginBottom: 10,
  },
  finishButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  periodCard: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  periodField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  periodLabel: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  periodInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  pdfButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  pdfButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
  summaryCard: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  printerGroup: {
    backgroundColor: 'white',
    margin: 10,
    marginTop: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  printerGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
  },
  printerGroupName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  actionsCount: {
    fontSize: 12,
    color: '#666',
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  actionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionRightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteActionBtn: {
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#FFEBEE',
    borderRadius: 4,
  },
  deleteActionText: {
    color: '#D32F2F',
    fontWeight: 'bold',
    fontSize: 14,
  },
  actionType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9500',
    flex: 1,
  },
  actionTime: {
    fontSize: 12,
    color: '#999',
  },
  actionDescription: {
    fontSize: 14,
    color: '#444',
    marginBottom: 4,
  },
  actionPrinter: {
    fontSize: 13,
    color: '#1565C0',
    fontWeight: '500',
    marginBottom: 2,
  },
  actionPart: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
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
  },
  historyList: {
    padding: 15,
  },
  historyDateGroup: {
    backgroundColor: 'white',
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  historyDateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#E3F2FD',
  },
  historyDateHeaderSelected: {
    backgroundColor: '#BBDEFB',
  },
  historyDateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  historyDateSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  historyArrow: {
    fontSize: 16,
    color: '#1976D2',
    fontWeight: 'bold',
  },
  historyDetails: {
    padding: 15,
  },
  historyItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyItemTitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  historyPrinterEntry: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  historyPrinterName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  historyActionItem: {
    marginLeft: 8,
    marginTop: 4,
  },
  historyActionText: {
    fontSize: 13,
    color: '#555',
  },
});