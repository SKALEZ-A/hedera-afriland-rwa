import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const toastConfig = {
  success: ({ text1, text2 }: any) => (
    <View style={[styles.container, styles.successContainer]}>
      <Icon name="checkmark-circle" size={24} color="#10b981" />
      <View style={styles.textContainer}>
        <Text style={[styles.text1, styles.successText]}>{text1}</Text>
        {text2 && <Text style={[styles.text2, styles.successText]}>{text2}</Text>}
      </View>
    </View>
  ),
  
  error: ({ text1, text2 }: any) => (
    <View style={[styles.container, styles.errorContainer]}>
      <Icon name="close-circle" size={24} color="#ef4444" />
      <View style={styles.textContainer}>
        <Text style={[styles.text1, styles.errorText]}>{text1}</Text>
        {text2 && <Text style={[styles.text2, styles.errorText]}>{text2}</Text>}
      </View>
    </View>
  ),
  
  info: ({ text1, text2 }: any) => (
    <View style={[styles.container, styles.infoContainer]}>
      <Icon name="information-circle" size={24} color="#3b82f6" />
      <View style={styles.textContainer}>
        <Text style={[styles.text1, styles.infoText]}>{text1}</Text>
        {text2 && <Text style={[styles.text2, styles.infoText]}>{text2}</Text>}
      </View>
    </View>
  ),
  
  warning: ({ text1, text2 }: any) => (
    <View style={[styles.container, styles.warningContainer]}>
      <Icon name="warning" size={24} color="#f59e0b" />
      <View style={styles.textContainer}>
        <Text style={[styles.text1, styles.warningText]}>{text1}</Text>
        {text2 && <Text style={[styles.text2, styles.warningText]}>{text2}</Text>}
      </View>
    </View>
  ),
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  text1: {
    fontSize: 16,
    fontWeight: '600',
  },
  text2: {
    fontSize: 14,
    marginTop: 2,
  },
  successContainer: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  successText: {
    color: '#065f46',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    color: '#991b1b',
  },
  infoContainer: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoText: {
    color: '#1e40af',
  },
  warningContainer: {
    backgroundColor: '#fffbeb',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningText: {
    color: '#92400e',
  },
});

export { toastConfig };