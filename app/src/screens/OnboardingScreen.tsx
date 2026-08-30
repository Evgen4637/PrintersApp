import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

interface Slide {
  id: string;
  icon: string;
  titleKey: string;
  textKey: string;
}

const SLIDE_DATA: Slide[] = [
  {
    id: '1',
    icon: '🚀',
    titleKey: 'onboarding.slide1Title',
    textKey: 'onboarding.slide1Text',
  },
  {
    id: '2',
    icon: '🖨️',
    titleKey: 'onboarding.slide2Title',
    textKey: 'onboarding.slide2Text',
  },
  {
    id: '3',
    icon: '⚙️',
    titleKey: 'onboarding.slide3Title',
    textKey: 'onboarding.slide3Text',
  },
  {
    id: '4',
    icon: '📚',
    titleKey: 'onboarding.slide4Title',
    textKey: 'onboarding.slide4Text',
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    if (index !== currentIndex && index >= 0 && index < SLIDE_DATA.length) {
      setCurrentIndex(index);
    }
  };

  const handleNext = () => {
    if (currentIndex < SLIDE_DATA.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  };

  const renderSlide = ({ item }: { item: Slide }) => {
    return (
      <View style={[styles.slideContainer, { width }]}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{item.icon}</Text>
        </View>
        <Text style={styles.title}>{t(item.titleKey)}</Text>
        <Text style={styles.text}>{t(item.textKey)}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
      <FlatList
        ref={flatListRef}
        data={SLIDE_DATA}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      />

      <View style={styles.footer}>
        {/* Pagination Dots */}
        <View style={styles.dotsContainer}>
          {SLIDE_DATA.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentIndex === index ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>

        {/* Action Buttons */}
        {currentIndex < SLIDE_DATA.length - 1 ? (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
            <Text style={styles.nextButtonText}>{t('onboarding.next')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.completeButton} onPress={onComplete} activeOpacity={0.8}>
            <Text style={styles.completeButtonText}>{t('onboarding.getStarted')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  slideContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#007AFF',
  },
  inactiveDot: {
    width: 8,
    backgroundColor: '#D0D0D0',
  },
  nextButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#E5F1FF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  completeButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
