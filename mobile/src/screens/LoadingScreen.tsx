import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const LoadingScreen: React.FC = () => {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.logoContainer}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Text style={[styles.logoText, { color: colors.surface }]}>GL</Text>
        </View>
        <Text style={[styles.appName, { color: colors.text }, typography.h3]}>
          GlobalLand
        </Text>
      </View>
      
      <LoadingSpinner 
        size="large" 
        color={colors.primary}
        text="Loading..."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  appName: {
    marginTop: 8,
  },
});

export default LoadingScreen;