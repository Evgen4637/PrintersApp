import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import storage from '../services/storage';

export default function DashboardScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const printersData = await storage.getPrinters();
      setPrinters(printersData);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPrinters = printers.filter(printer =>
    printer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    printer.location.room.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNavigation = (screen) => {
    // Навигация через bottom tabs
    console.log('Navigate to:', screen);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Учет обслуживания принтеров</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск принтеров (AKK-PRN001, кабинет)..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.knowledgeButton]}
          onPress={() => handleNavigation('KnowledgeBase')}
        >
          <Text style={styles.buttonIcon}>📚</Text>
          <Text style={styles.buttonText}>База знаний</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.notesButton]}
          onPress={() => handleNavigation('Notes')}
        >
          <Text style={styles.buttonIcon}>📝</Text>
          <Text style={styles.buttonText}>Заметки</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.inventoryButton]}
          onPress={() => handleNavigation('Inventory')}
        >
          <Text style={styles.buttonIcon}>📦</Text>
          <Text style={styles.buttonText}>Склад</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.dailyReportButton}
        onPress={() => handleNavigation('DailyReport')}
      >
        <Text style={styles.dailyReportIcon}>📋</Text>
        <Text style={styles.dailyReportText}>ОТЧЕТ ДНЯ</Text>
      </TouchableOpacity>

      <View style={styles.printersSection}>
        <Text style={styles.sectionTitle}>Принтеры ({filteredPrinters.length})</Text>
        {filteredPrinters.map(printer => (
          <View key={printer.id} style={styles.printerCard}>
            <Text style={styles.printerName}>{printer.name}</Text>
            <Text style={styles.printerModel}>Модель: {printer.modelId}</Text>
            <Text style={styles.printerLocation}>
              Локация: {printer.location.building}, каб. {printer.location.room}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
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
    fontSize: 16,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
  actionButton: {
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    width: '30%',
  },
  knowledgeButton: {
    backgroundColor: '#E3F2FD',
  },
  notesButton: {
    backgroundColor: '#FFF3E0',
  },
  inventoryButton: {
    backgroundColor: '#E8F5E9',
  },
  buttonIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  buttonText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  dailyReportButton: {
    backgroundColor: '#FF5722',
    margin: 10,
    padding: 25,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  dailyReportIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  dailyReportText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  printersSection: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  printerCard: {
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  printerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  printerModel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  printerLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});