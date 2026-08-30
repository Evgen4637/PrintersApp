import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import storage from '../services/storage';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Printer, Part } from '../models/types';

const APP_VERSION = '1.0.0';

interface DashboardProps {
  workspaceId?: string | null;
  onLeaveWorkspace?: () => void;
  onNavigate: (
    screen: 'Dashboard' | 'KnowledgeBase' | 'Locations' | 'Parts' | 'DailyReport' | 'Notes' | 'Printers',
    params?: Record<string, unknown>
  ) => void;
  navigation?: any;
}

export default function DashboardScreen({ workspaceId, onLeaveWorkspace, onNavigate, navigation }: DashboardProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printersCount, setPrintersCount] = useState(0);
  const [partsCount, setPartsCount] = useState(0);
  const [activeNotesCount, setActiveNotesCount] = useState(0);
  const [lowStockParts, setLowStockParts] = useState<Part[]>([]);
  const [recentPrinters, setRecentPrinters] = useState<Printer[]>([]);

  const loadDashboardData = useCallback(async () => {
    try {
      const [printers, parts, notes] = await Promise.all([
        storage.getPrinters(),
        storage.getParts(),
        storage.getNotes(),
      ]);
      setPrintersCount(printers.length);
      setPartsCount(parts.reduce((sum, p) => sum + p.quantity, 0));
      setActiveNotesCount(notes.filter(n => !n.completed).length);
      
      // Отбираем комплектующие с низким остатком
      const lowStock = parts.filter(p => p.quantity <= (p.minQuantity || 2));
      setLowStockParts(lowStock.slice(0, 3));
      
      // Показываем последние 3 добавленных принтера
      setRecentPrinters(printers.slice(-3).reverse());
    } catch (error) {
      console.error('Ошибка загрузки данных дашборда:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('@is_logged_in');
      await signOut(auth);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const handleLeaveWorkspace = () => {
    Alert.alert(
      t('dashboard.switchAlertTitle'),
      t('dashboard.switchAlertText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('dashboard.leave'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (auth.currentUser) {
                await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                  workspaceId: null,
                });
              }
              if (onLeaveWorkspace) {
                onLeaveWorkspace();
              }
            } catch (error: any) {
              console.error('Error leaving workspace:', error);
              Alert.alert(t('common.error'), t('dashboard.leaveWorkspaceError'));
            }
          },
        },
      ]
    );
  };

  const handleExportDB = async () => {
    try {
      await storage.exportDatabase();
    } catch (error) {
      console.error('Ошибка экспорта базы данных:', error);
      Alert.alert(t('common.error'), t('dashboard.exportDbError'));
    }
  };

  const handleImportDB = async () => {
    try {
      const success = await storage.importDatabase();
      if (success) {
        Alert.alert(t('dashboard.dbRestored'));
      }
    } catch (error) {
      console.error('Ошибка импорта базы данных:', error);
      Alert.alert(t('common.error'), t('dashboard.importDbError'));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.title}>{t('dashboard.title')}</Text>
          <Text style={styles.subtitle}>
            {t('dashboard.workshopCode', { code: workspaceId || '—' })}
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

      {/* Сводные показатели (Stats Cards) */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🖨️</Text>
          <Text style={styles.statValue}>{printersCount}</Text>
          <Text style={styles.statLabel}>{t('dashboard.printersStat')}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🔧</Text>
          <Text style={styles.statValue}>{partsCount}</Text>
          <Text style={styles.statLabel}>{t('dashboard.partsStat')}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📝</Text>
          <Text style={styles.statValue}>{activeNotesCount}</Text>
          <Text style={styles.statLabel}>{t('dashboard.notesStat')}</Text>
        </View>
      </View>

      {/* Перемещенные кнопки управления мастерской и сессией */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 10, marginBottom: 5, paddingHorizontal: 15 }}>
        <TouchableOpacity style={styles.switchButton} onPress={handleLeaveWorkspace}>
          <Text style={styles.switchButtonText}>{t('dashboard.switchDatabase')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>{t('dashboard.logout')}</Text>
        </TouchableOpacity>
      </View>

      {/* Резервное копирование */}
      <Text style={styles.sectionTitle}>{t('dashboard.databaseSection')}</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleExportDB}
        >
          <Text style={styles.buttonIcon}>📤</Text>
          <Text style={styles.buttonText}>{t('dashboard.exportDb')}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleImportDB}
        >
          <Text style={styles.buttonIcon}>📥</Text>
          <Text style={styles.buttonText}>{t('dashboard.importDb')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.dailyReportButton}
        onPress={() => onNavigate('DailyReport')}
      >
        <Text style={styles.dailyReportIcon}>📋</Text>
        <View style={styles.dailyReportTextContainer}>
          <Text style={styles.dailyReportText}>{t('dashboard.dailyReportTitle')}</Text>
          <Text style={styles.dailyReportSubtext}>{t('dashboard.dailyReportSubtext')}</Text>
        </View>
      </TouchableOpacity>

      {/* Виджет: Критические остатки */}
      {lowStockParts.length > 0 && (
        <View style={styles.widgetCard}>
          <Text style={[styles.widgetTitle, { color: '#D32F2F' }]}>{t('dashboard.lowStockTitle')}</Text>
          {lowStockParts.map(part => (
            <TouchableOpacity 
              key={part.id} 
              style={styles.widgetItem}
              onPress={() => onNavigate('Parts', { partId: part.id })}
            >
              <View>
                <Text style={styles.widgetItemName}>{part.partNumber}</Text>
                <Text style={styles.widgetItemDesc} numberOfLines={1}>{part.description}</Text>
              </View>
              <Text style={styles.widgetItemAlert}>
                {t('dashboard.stockRemaining', { count: part.quantity, min: part.minQuantity || 2 })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Виджет: Недавние принтеры */}
      {recentPrinters.length > 0 && (
        <View style={styles.widgetCard}>
          <Text style={styles.widgetTitle}>{t('dashboard.recentPrintersTitle')}</Text>
          {recentPrinters.map(printer => (
            <TouchableOpacity 
              key={printer.id} 
              style={styles.widgetItem}
              onPress={() => onNavigate('Printers', { printerId: printer.id })}
            >
              <View>
                <Text style={styles.widgetItemName}>{printer.name}</Text>
                <Text style={styles.widgetItemDesc}>
                  {printer.location ? `${printer.location.building}, к. ${printer.location.room}` : t('dashboard.noLocation')}
                </Text>
              </View>
              <Text style={styles.widgetItemDetails}>{t('dashboard.details')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>
          {t('common.version', { version: APP_VERSION })}
        </Text>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerTitleContainer: {
    flex: 1,
    marginRight: 10,
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
  logoutButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#007AFF',
  },
  logoutButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#007AFF',
  },
  switchButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: -12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    fontSize: 18,
    marginBottom: 3,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 16,
    marginTop: 10,
    marginBottom: 8,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    width: '48%',
    backgroundColor: 'white',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  buttonText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
    color: '#333',
  },
  dailyReportButton: {
    flexDirection: 'row',
    backgroundColor: '#FF5722',
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  dailyReportIcon: {
    fontSize: 26,
    marginRight: 10,
  },
  dailyReportTextContainer: {
    flex: 1,
  },
  dailyReportText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  dailyReportSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  widgetCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  widgetTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  widgetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  widgetItemName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  widgetItemDesc: {
    fontSize: 11,
    color: '#777',
    maxWidth: 160,
    marginTop: 1,
  },
  widgetItemAlert: {
    fontSize: 12,
    color: '#D32F2F',
  },
  widgetItemDetails: {
    fontSize: 12,
    color: '#007AFF',
  },
  bold: {
    fontWeight: 'bold',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  versionText: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
  },
  spacer: {
    height: 15,
  },
});