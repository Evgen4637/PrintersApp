import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';

interface WorkspaceScreenProps {
  onWorkspaceSet: (workspaceId: string) => void;
}

export default function WorkspaceScreen({ onWorkspaceSet }: WorkspaceScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const generateWorkspaceCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let p1 = '';
    let p2 = '';
    for (let i = 0; i < 3; i++) {
      p1 += chars.charAt(Math.floor(Math.random() * chars.length));
      p2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${p1}-${p2}`;
  };

  const handleCreateWorkspace = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert(t('common.error'), t('workspace.unauthorizedError'));
      return;
    }

    setCreating(true);
    try {
      const code = generateWorkspaceCode();
      const workspaceRef = doc(db, 'workspaces', code);
      
      await setDoc(workspaceRef, {
        code,
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
      });

      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { workspaceId: code }, { merge: true });

      onWorkspaceSet(code);
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      Alert.alert(t('common.error'), error?.message || t('workspace.createError'));
    } finally {
      setCreating(false);
    }
  };

  const handleJoinWorkspace = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert(t('common.error'), t('workspace.unauthorizedError'));
      return;
    }

    const trimmedCode = joinCode.trim().toUpperCase();
    if (!trimmedCode) {
      Alert.alert(t('common.error'), t('workspace.enterCodeError'));
      return;
    }

    setJoining(true);
    try {
      const workspaceRef = doc(db, 'workspaces', trimmedCode);
      const docSnap = await getDoc(workspaceRef);

      if (!docSnap.exists()) {
        Alert.alert(t('common.error'), t('workspace.notFoundError'));
        return;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { workspaceId: trimmedCode }, { merge: true });

      onWorkspaceSet(trimmedCode);
    } catch (error: any) {
      console.error('Error joining workspace:', error);
      Alert.alert(t('common.error'), error?.message || t('workspace.joinError'));
    } finally {
      setJoining(false);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>{t('workspace.title')}</Text>
          <Text style={styles.subtitle}>
            {t('workspace.subtitle')}
          </Text>
        </View>

        {/* Section A: Create New Workspace */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('workspace.createTitle')}</Text>
          <Text style={styles.cardDescription}>
            {t('workspace.createDesc')}
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.createButton, creating && styles.disabledButton]}
            onPress={handleCreateWorkspace}
            disabled={creating || joining}
          >
            {creating ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.createButtonText}>{t('workspace.createButton')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Section B: Join Workspace by Code */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('workspace.joinTitle')}</Text>
          <Text style={styles.cardDescription}>
            {t('workspace.joinDesc')}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t('workspace.joinPlaceholder')}
            placeholderTextColor="#999"
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.button, styles.joinButton, joining && styles.disabledButton]}
            onPress={handleJoinWorkspace}
            disabled={creating || joining}
          >
            {joining ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.joinButtonText}>{t('workspace.joinButton')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>{t('workspace.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  joinButton: {
    backgroundColor: '#34C759',
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  signOutButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },
});
