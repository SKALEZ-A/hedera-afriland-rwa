import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';

import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { RootStackParamList } from '../../navigation/AppNavigator';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import TextInput from '../../components/ui/TextInput';
import { showToast } from '../../utils/toast';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { colors, spacing, typography } = useTheme();
  const { login, loginWithBiometric, isLoading, biometricEnabled } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      showToast('error', 'Please fill in all fields');
      return;
    }

    try {
      await login(formData);
    } catch (error) {
      // Error is handled by the auth context
    }
  };

  const handleBiometricLogin = async () => {
    try {
      await loginWithBiometric();
    } catch (error) {
      // Error is handled by the auth context
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}>
            <Text style={[styles.logoText, { color: colors.surface }]}>GL</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }, typography.h2]}>
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in to your account
          </Text>
        </View>

        {/* Login Form */}
        <Card style={[styles.formCard, { marginHorizontal: spacing.md }]}>
          <TextInput
            label="Email"
            value={formData.email}
            onChangeText={(email) => setFormData({ ...formData, email })}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter your email"
          />

          <TextInput
            label="Password"
            value={formData.password}
            onChangeText={(password) => setFormData({ ...formData, password })}
            secureTextEntry
            placeholder="Enter your password"
            style={{ marginTop: spacing.md }}
          />

          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={isLoading}
            fullWidth
            style={{ marginTop: spacing.lg }}
          />

          {biometricEnabled && (
            <Button
              title="Use Biometric"
              onPress={handleBiometricLogin}
              variant="outline"
              fullWidth
              style={{ marginTop: spacing.md }}
            />
          )}
        </Card>

        {/* Sign Up Link */}
        <View style={styles.signUpContainer}>
          <Text style={[styles.signUpText, { color: colors.textSecondary }]}>
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={[styles.signUpLink, { color: colors.primary }]}>
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  formCard: {
    padding: 24,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  signUpText: {
    fontSize: 16,
  },
  signUpLink: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LoginScreen;