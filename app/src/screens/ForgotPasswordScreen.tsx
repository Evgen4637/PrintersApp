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
import { sendPasswordResetEmail } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { auth } from '../firebase';
import { changeAppLanguage } from '../i18n';

interface ForgotPasswordScreenProps {
  onBackToAuth?: () => void;
}

export default function ForgotPasswordScreen({ onBackToAuth }: ForgotPasswordScreenProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const currentLanguage = i18n.language || 'ru';

  const handleLanguageChange = async (lang: 'ru' | 'en') => {
    await changeAppLanguage(lang);
  };

  const getErrorMessage = (error: any) => {
    const code = error?.code || '';
    switch (code) {
      case 'auth/invalid-email':
      case 'auth/missing-email':
        return t('auth.errors.invalidEmail', 'Некорректный адрес электронной почты.');
      case 'auth/user-not-found':
        return t('auth.errors.userNotFound', 'Пользователь с таким email не найден.');
      case 'auth/user-disabled':
        return t('auth.errors.userDisabled', 'Учетная запись отключена.');
      default:
        return error?.message || t('auth.errors.unknownError', 'Произошла ошибка при отправке инструкций.');
    }
  };

  const validateEmail = (text: string): boolean => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    // Basic validation checking for '@' and symbols around it
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(trimmed);
  };

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert(
        t('auth.errorTitle', 'Ошибка'),
        t('auth.fillEmail', 'Пожалуйста, введите Email.')
      );
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      Alert.alert(
        t('auth.errorTitle', 'Ошибка'),
        t('auth.invalidEmailFormat', 'Пожалуйста, введите корректный адрес электронной почты.')
      );
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      Alert.alert(
        t('auth.resetEmailSentTitle', 'Письмо отправлено'),
        t('auth.resetEmailSent', 'Инструкции по сбросу пароля успешно отправлены на указанный Email.'),
        [
          {
            text: 'OK',
            onPress: () => {
              if (onBackToAuth) {
                onBackToAuth();
              }
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        t('auth.errorTitle', 'Ошибка'),
        getErrorMessage(error)
      );
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
          <Text style={styles.title}>{t('auth.forgotPasswordTitle', 'Сброс пароля')}</Text>
          <Text style={styles.subtitle}>
            {t(
              'auth.forgotPasswordSubtitle',
              'Введите адрес электронной почты для получения инструкций по сбросу пароля'
            )}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('auth.emailLabel', 'Email')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.emailPlaceholder', 'example@mail.com')}
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, loading && styles.disabledButton]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {t('auth.sendInstructions', 'Отправить инструкции')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, loading && styles.disabledButton]}
            onPress={onBackToAuth}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>
              {t('auth.backToLogin', 'Назад к авторизации')}
            </Text>
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
