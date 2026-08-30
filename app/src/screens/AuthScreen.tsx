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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { auth } from '../firebase';
import { changeAppLanguage } from '../i18n';

export default function AuthScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const currentLanguage = i18n.language || 'ru';

  const handleLanguageChange = async (lang: 'ru' | 'en') => {
    await changeAppLanguage(lang);
  };

  const getErrorMessage = (error: any) => {
    const code = error?.code || '';
    switch (code) {
      case 'auth/invalid-email':
        return t('auth.errors.invalidEmail');
      case 'auth/user-disabled':
        return t('auth.errors.userDisabled');
      case 'auth/user-not-found':
        return t('auth.errors.userNotFound');
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return t('auth.errors.wrongPassword');
      case 'auth/email-already-in-use':
        return t('auth.errors.emailInUse');
      case 'auth/weak-password':
        return t('auth.errors.weakPassword');
      default:
        return error?.message || t('auth.errors.unknownError');
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert(t('auth.errorTitle'), t('auth.fillFields'));
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await AsyncStorage.setItem('@is_logged_in', 'true');
    } catch (error: any) {
      Alert.alert(t('auth.loginError'), getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      Alert.alert(t('auth.errorTitle'), t('auth.fillFields'));
      return;
    }
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      await AsyncStorage.setItem('@is_logged_in', 'true');
    } catch (error: any) {
      Alert.alert(t('auth.signUpError'), getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Language Switcher UI */}
        <View style={styles.languageToggleContainer}>
          <TouchableOpacity
            style={[
              styles.langButton,
              currentLanguage.startsWith('ru') && styles.langButtonActive,
            ]}
            onPress={() => handleLanguageChange('ru')}
          >
            <Text
              style={[
                styles.langButtonText,
                currentLanguage.startsWith('ru') && styles.langButtonTextActive,
              ]}
            >
              RU
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.langButton,
              currentLanguage.startsWith('en') && styles.langButtonActive,
            ]}
            onPress={() => handleLanguageChange('en')}
          >
            <Text
              style={[
                styles.langButtonText,
                currentLanguage.startsWith('en') && styles.langButtonTextActive,
              ]}
            >
              EN
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerContainer}>
          <Text style={styles.title}>{t('auth.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('auth.emailLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, loading && styles.disabledButton]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>{t('auth.login')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, loading && styles.disabledButton]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>{t('auth.signUp')}</Text>
          </TouchableOpacity>
        </View>
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
    justifyContent: 'center',
    padding: 20,
  },
  languageToggleContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    marginBottom: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    padding: 2,
  },
  langButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
  },
  langButtonActive: {
    backgroundColor: '#007AFF',
  },
  langButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  },
  langButtonTextActive: {
    color: '#ffffff',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000000',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
