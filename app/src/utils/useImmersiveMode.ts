import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

/**
 * Restores Android immersive / overlay-swipe mode.
 * Call this in Modal's onShow and onRequestClose to prevent the system
 * navigation bar from reappearing when a modal opens or closes.
 * Safe to call on iOS (no-op).
 */
export function ensureImmersiveMode(): void {
  if (Platform.OS === 'android') {
    NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
    setTimeout(() => {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
    }, 100);
  }
}
