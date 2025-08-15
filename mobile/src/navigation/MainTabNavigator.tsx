import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';

// Tab Screens
import HomeScreen from '../screens/home/HomeScreen';
import PropertiesScreen from '../screens/properties/PropertiesScreen';
import PortfolioScreen from '../screens/portfolio/PortfolioScreen';
import TradingScreen from '../screens/trading/TradingScreen';
import MoreScreen from '../screens/more/MoreScreen';

export type MainTabParamList = {
  Home: undefined;
  Properties: undefined;
  Portfolio: undefined;
  Trading: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator: React.FC = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Properties':
              iconName = focused ? 'business' : 'business-outline';
              break;
            case 'Portfolio':
              iconName = focused ? 'pie-chart' : 'pie-chart-outline';
              break;
            case 'Trading':
              iconName = focused ? 'trending-up' : 'trending-up-outline';
              break;
            case 'More':
              iconName = focused ? 'menu' : 'menu-outline';
              break;
            default:
              iconName = 'circle-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      
      <Tab.Screen
        name="Properties"
        component={PropertiesScreen}
        options={{
          tabBarLabel: 'Properties',
        }}
      />
      
      <Tab.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={{
          tabBarLabel: 'Portfolio',
        }}
      />
      
      <Tab.Screen
        name="Trading"
        component={TradingScreen}
        options={{
          tabBarLabel: 'Trading',
        }}
      />
      
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarLabel: 'More',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;