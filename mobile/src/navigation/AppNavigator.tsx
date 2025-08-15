import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';

// Main App Navigation
import MainTabNavigator from './MainTabNavigator';
import LoadingScreen from '../screens/LoadingScreen';

// Modal Screens
import PropertyDetailScreen from '../screens/properties/PropertyDetailScreen';
import InvestmentScreen from '../screens/investment/InvestmentScreen';
import PaymentScreen from '../screens/payment/PaymentScreen';
import NotificationScreen from '../screens/notifications/NotificationScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import KYCScreen from '../screens/kyc/KYCScreen';

export type RootStackParamList = {
  // Auth
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  
  // Main App
  MainTabs: undefined;
  
  // Modals
  PropertyDetail: { propertyId: string };
  Investment: { propertyId: string };
  Payment: { 
    propertyId: string; 
    tokenAmount: number; 
    totalAmount: number; 
  };
  Notification: undefined;
  Settings: undefined;
  Profile: undefined;
  KYC: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        cardStyleInterpolator: ({ current, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
      }}
    >
      {!isAuthenticated ? (
        // Auth Stack
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      ) : (
        // Main App Stack
        <>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          
          {/* Modal Screens */}
          <Stack.Screen
            name="PropertyDetail"
            component={PropertyDetailScreen}
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Property Details',
              headerBackTitle: 'Back',
            }}
          />
          
          <Stack.Screen
            name="Investment"
            component={InvestmentScreen}
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Make Investment',
              headerBackTitle: 'Back',
            }}
          />
          
          <Stack.Screen
            name="Payment"
            component={PaymentScreen}
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Payment',
              headerBackTitle: 'Back',
            }}
          />
          
          <Stack.Screen
            name="Notification"
            component={NotificationScreen}
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Notifications',
              headerBackTitle: 'Back',
            }}
          />
          
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              headerShown: true,
              headerTitle: 'Settings',
              headerBackTitle: 'Back',
            }}
          />
          
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              headerShown: true,
              headerTitle: 'Profile',
              headerBackTitle: 'Back',
            }}
          />
          
          <Stack.Screen
            name="KYC"
            component={KYCScreen}
            options={{
              headerShown: true,
              headerTitle: 'Identity Verification',
              headerBackTitle: 'Back',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;