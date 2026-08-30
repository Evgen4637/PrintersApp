import './src/i18n';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as NavigationBar from 'expo-navigation-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './src/firebase';
import storage, { setWorkspaceId as setStorageWorkspaceId } from './src/services/storage';
import DashboardScreen from './src/screens/Dashboard';
import KnowledgeBaseScreen from './src/screens/KnowledgeBaseScreen';
import DailyReportScreen from './src/screens/DailyReportScreen';
import NotesScreen from './src/screens/NotesScreen';
import LocationsScreen from './src/screens/LocationsScreen';
import PartsScreen from './src/screens/PartsScreen';
import PrintersScreen from './src/screens/PrintersScreen';
import AuthScreen from './src/screens/AuthScreen';
import WorkspaceScreen from './src/screens/WorkspaceScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';

type ScreenName = 'Dashboard' | 'KnowledgeBase' | 'Locations' | 'Parts' | 'DailyReport' | 'Notes' | 'Printers';

function MainApp() {
  const [navigation, setNavigation] = useState<{ screen: ScreenName; params?: any }>({
    screen: 'Dashboard',
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isSessionActive, setIsSessionActive] = useState<boolean | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);

  const navigate = (screen: ScreenName, params?: any) => {
    setNavigation({ screen, params });
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await NavigationBar.setVisibilityAsync("hidden");
        await NavigationBar.setBehaviorAsync("overlay-swipe");
        
        const onboarded = await AsyncStorage.getItem('@onboarding_complete');
        setHasSeenOnboarding(onboarded === 'true');

        const sessionFlag = await AsyncStorage.getItem('@is_logged_in');
        setIsSessionActive(sessionFlag === 'true');

        setIsInitialized(true);
      } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
        setHasSeenOnboarding(false);
        setIsSessionActive(false);
        setIsInitialized(true);
      }
    };
    initializeApp();
  }, []);

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem('@onboarding_complete', 'true');
      setHasSeenOnboarding(true);
    } catch (error) {
      console.error('Error saving onboarding state:', error);
      setHasSeenOnboarding(true);
    }
  };

  const handleWorkspaceSet = async (id: string | null) => {
    setStorageWorkspaceId(id);
    setWorkspaceId(id);
    if (id) {
      await storage.initialize();
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        setIsSessionActive(true);
        await AsyncStorage.setItem('@is_logged_in', 'true');
        try {
          const userDoc = await getDoc(doc(db, 'users', authUser.uid));
          const wId = userDoc.exists() && userDoc.data()?.workspaceId ? userDoc.data().workspaceId : null;
          if (wId) {
            await handleWorkspaceSet(wId);
          } else {
            await handleWorkspaceSet(null);
          }
        } catch (error) {
          console.error('Error fetching user workspace:', error);
          await handleWorkspaceSet(null);
        }
      } else {
        setUser(null);
        setIsSessionActive(false);
        await AsyncStorage.removeItem('@is_logged_in');
        await handleWorkspaceSet(null);
      }
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  if (initializing || !isInitialized || hasSeenOnboarding === null || isSessionActive === null) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // AuthStack: if user is not authenticated or session flag is not active
  if (!user || !isSessionActive) {
    return (
      <SafeAreaProvider>
        <AuthScreen />
      </SafeAreaProvider>
    );
  }

  // Workspace setup
  if (!workspaceId) {
    return (
      <SafeAreaProvider>
        <WorkspaceScreen onWorkspaceSet={(id) => handleWorkspaceSet(id)} />
      </SafeAreaProvider>
    );
  }

  // Onboarding setup
  if (!hasSeenOnboarding) {
    return (
      <SafeAreaProvider>
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </SafeAreaProvider>
    );
  }

  const renderScreen = () => {
    switch (navigation.screen) {
      case 'Dashboard':
        return (
          <DashboardScreen
            workspaceId={workspaceId}
            onLeaveWorkspace={() => handleWorkspaceSet(null)}
            onNavigate={navigate}
          />
        );
      case 'KnowledgeBase':
        return <KnowledgeBaseScreen />;
      case 'Locations':
        return <LocationsScreen />;
      case 'Parts':
        return <PartsScreen initialPartId={navigation.params?.partId} />;
      case 'DailyReport':
        return <DailyReportScreen />;
      case 'Notes':
        return <NotesScreen />;
      case 'Printers':
        return <PrintersScreen initialPrinterId={navigation.params?.printerId} />;
      default:
        return (
          <DashboardScreen
            workspaceId={workspaceId}
            onLeaveWorkspace={() => handleWorkspaceSet(null)}
            onNavigate={navigate}
          />
        );
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <View style={styles.content}>
          {renderScreen()}
        </View>
        <BottomNav currentScreen={navigation.screen} onNavigate={navigate} />
      </View>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function BottomNav({ currentScreen, onNavigate }: { currentScreen: ScreenName; onNavigate: (screen: ScreenName) => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const renderTabLabel = (label: string, isFocused: boolean) => (
    <Text
      style={[
        styles.navLabel,
        isFocused && styles.navLabelActiveText,
      ]}
      numberOfLines={2}
      adjustsFontSizeToFit={true}
    >
      {label}
    </Text>
  );

  return (
    <View style={[styles.bottomNav, { minHeight: 65, paddingBottom: Math.max(insets.bottom, 10) }]}>
      <TouchableOpacity 
        style={[styles.navButton, currentScreen === 'Dashboard' && styles.navButtonActive]}
        onPress={() => onNavigate('Dashboard')}
      >
        <Text style={styles.navIcon}>📊</Text>
        {renderTabLabel(t('tabs.dashboard'), currentScreen === 'Dashboard')}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.navButton, currentScreen === 'Printers' && styles.navButtonActive]}
        onPress={() => onNavigate('Printers')}
      >
        <Text style={styles.navIcon}>🖨️</Text>
        {renderTabLabel(t('tabs.printers'), currentScreen === 'Printers')}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.navButton, currentScreen === 'KnowledgeBase' && styles.navButtonActive]}
        onPress={() => onNavigate('KnowledgeBase')}
      >
        <Text style={styles.navIcon}>📚</Text>
        {renderTabLabel(t('tabs.kb'), currentScreen === 'KnowledgeBase')}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.navButton, currentScreen === 'Locations' && styles.navButtonActive]}
        onPress={() => onNavigate('Locations')}
      >
        <Text style={styles.navIcon}>🏢</Text>
        {renderTabLabel(t('tabs.locations'), currentScreen === 'Locations')}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.navButton, currentScreen === 'Parts' && styles.navButtonActive]}
        onPress={() => onNavigate('Parts')}
      >
        <Text style={styles.navIcon}>🔧</Text>
        {renderTabLabel(t('tabs.parts'), currentScreen === 'Parts')}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.navButton, currentScreen === 'DailyReport' && styles.navButtonActive]}
        onPress={() => onNavigate('DailyReport')}
      >
        <Text style={styles.navIcon}>📋</Text>
        {renderTabLabel(t('tabs.dailyReport'), currentScreen === 'DailyReport')}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.navButton, currentScreen === 'Notes' && styles.navButtonActive]}
        onPress={() => onNavigate('Notes')}
      >
        <Text style={styles.navIcon}>📝</Text>
        {renderTabLabel(t('tabs.notes'), currentScreen === 'Notes')}
      </TouchableOpacity>
    </View>
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
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    minHeight: 65,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  navButtonActive: {
    backgroundColor: '#E3F2FD',
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navLabel: {
    width: '100%',
    flexWrap: 'wrap',
    fontSize: 10,
    lineHeight: 12,
    color: '#333',
    textAlign: 'center',
  },
  navLabelActiveText: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
});