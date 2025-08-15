import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from 'react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import SplashScreen from 'react-native-splash-screen';

import { AuthProvider } from './src/contexts/AuthContext';
import { WebSocketProvider } from './src/contexts/WebSocketContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import AppNavigator from './src/navigation/AppNavigator';
import { toastConfig } from './src/config/toastConfig';
import { initializeApp } from './src/utils/appInitializer';

// Ignore specific warnings
LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
    'Remote debugger is in a background tab',
]);

// Create React Query client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
        },
        mutations: {
            retry: 1,
        },
    },
});

const App: React.FC = () => {
    useEffect(() => {
        const initApp = async () => {
            try {
                await initializeApp();
            } catch (error) {
                console.error('App initialization failed:', error);
            } finally {
                // Hide splash screen after initialization
                SplashScreen.hide();
            }
        };

        initApp();
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <AuthProvider>
                        <WebSocketProvider>
                            <NotificationProvider>
                                <NavigationContainer>
                                    <StatusBar
                                        barStyle="dark-content"
                                        backgroundColor="transparent"
                                        translucent
                                    />
                                    <AppNavigator />
                                    <Toast config={toastConfig} />
                                </NavigationContainer>
                            </NotificationProvider>
                        </WebSocketProvider>
                    </AuthProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </GestureHandlerRootView>
    );
};

export default App;