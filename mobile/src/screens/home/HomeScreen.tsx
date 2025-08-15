import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { LineChart } from 'react-native-chart-kit';

import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { RootStackParamList } from '../../navigation/AppNavigator';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const { width: screenWidth } = Dimensions.get('window');

interface PortfolioSummary {
  totalValue: number;
  totalReturns: number;
  totalReturnPercent: number;
  monthlyDividends: number;
  propertiesCount: number;
}

interface RecentActivity {
  id: string;
  type: 'investment' | 'dividend' | 'trade';
  title: string;
  subtitle: string;
  amount: number;
  date: string;
  icon: string;
  color: string;
}

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { colors, spacing, typography } = useTheme();
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    totalValue: 12450,
    totalReturns: 2450,
    totalReturnPercent: 24.5,
    monthlyDividends: 156,
    propertiesCount: 8,
  });

  const [recentActivity] = useState<RecentActivity[]>([
    {
      id: '1',
      type: 'dividend',
      title: 'Dividend Payment',
      subtitle: 'Lagos Luxury Apartments',
      amount: 125.50,
      date: '2024-01-15',
      icon: 'cash-outline',
      color: colors.success,
    },
    {
      id: '2',
      type: 'investment',
      title: 'Investment Purchase',
      subtitle: 'Nairobi Office Complex',
      amount: -2500,
      date: '2024-01-12',
      icon: 'business-outline',
      color: colors.primary,
    },
    {
      id: '3',
      type: 'trade',
      title: 'Token Sale',
      subtitle: 'Cape Town Residential',
      amount: 1800,
      date: '2024-01-10',
      icon: 'trending-up-outline',
      color: colors.accent,
    },
  ]);

  // Mock chart data
  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        data: [10000, 10500, 11200, 10800, 11800, 12450],
        color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      // TODO: Load actual data from API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'invest':
        navigation.navigate('Properties');
        break;
      case 'portfolio':
        navigation.navigate('Portfolio');
        break;
      case 'trade':
        navigation.navigate('Trading');
        break;
      case 'notifications':
        navigation.navigate('Notification');
        break;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <LoadingSpinner size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.xl }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            Good morning,
          </Text>
          <Text style={[styles.userName, { color: colors.text }, typography.h3]}>
            {user?.firstName} {user?.lastName}
          </Text>
        </View>
        
        <TouchableOpacity
          onPress={() => handleQuickAction('notifications')}
          style={styles.notificationButton}
        >
          <Icon name="notifications-outline" size={24} color={colors.text} />
          <View style={[styles.notificationBadge, { backgroundColor: colors.error }]}>
            <Text style={[styles.notificationBadgeText, { color: colors.surface }]}>
              3
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Portfolio Summary */}
      <Card style={[styles.portfolioCard, { marginHorizontal: spacing.md }]}>
        <Text style={[styles.portfolioTitle, { color: colors.textSecondary }, typography.body2]}>
          Total Portfolio Value
        </Text>
        <Text style={[styles.portfolioValue, { color: colors.text }, typography.h1]}>
          {formatCurrency(portfolioSummary.totalValue)}
        </Text>
        <View style={styles.portfolioStats}>
          <View style={styles.portfolioStat}>
            <Text style={[styles.portfolioStatValue, { color: colors.success }]}>
              +{formatCurrency(portfolioSummary.totalReturns)}
            </Text>
            <Text style={[styles.portfolioStatLabel, { color: colors.textSecondary }]}>
              Total Returns ({formatPercentage(portfolioSummary.totalReturnPercent)})
            </Text>
          </View>
        </View>
      </Card>

      {/* Portfolio Chart */}
      <Card style={[styles.chartCard, { marginHorizontal: spacing.md, marginTop: spacing.md }]}>
        <Text style={[styles.chartTitle, { color: colors.text }, typography.h4]}>
          Portfolio Performance
        </Text>
        <LineChart
          data={chartData}
          width={screenWidth - spacing.md * 4}
          height={200}
          chartConfig={{
            backgroundColor: colors.surface,
            backgroundGradientFrom: colors.surface,
            backgroundGradientTo: colors.surface,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
            labelColor: (opacity = 1) => colors.textSecondary,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: colors.primary,
            },
          }}
          bezier
          style={styles.chart}
        />
      </Card>

      {/* Quick Actions */}
      <View style={[styles.quickActions, { marginHorizontal: spacing.md, marginTop: spacing.md }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }, typography.h4]}>
          Quick Actions
        </Text>
        <View style={styles.quickActionGrid}>
          <TouchableOpacity
            style={[styles.quickActionItem, { backgroundColor: colors.surface }]}
            onPress={() => handleQuickAction('invest')}
          >
            <Icon name="add-circle-outline" size={32} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.text }]}>
              Invest
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickActionItem, { backgroundColor: colors.surface }]}
            onPress={() => handleQuickAction('portfolio')}
          >
            <Icon name="pie-chart-outline" size={32} color={colors.secondary} />
            <Text style={[styles.quickActionText, { color: colors.text }]}>
              Portfolio
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickActionItem, { backgroundColor: colors.surface }]}
            onPress={() => handleQuickAction('trade')}
          >
            <Icon name="trending-up-outline" size={32} color={colors.accent} />
            <Text style={[styles.quickActionText, { color: colors.text }]}>
              Trade
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickActionItem, { backgroundColor: colors.surface }]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Icon name="settings-outline" size={32} color={colors.textSecondary} />
            <Text style={[styles.quickActionText, { color: colors.text }]}>
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={[styles.recentActivity, { marginHorizontal: spacing.md, marginTop: spacing.md }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }, typography.h4]}>
            Recent Activity
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Portfolio')}>
            <Text style={[styles.seeAllText, { color: colors.primary }]}>
              See All
            </Text>
          </TouchableOpacity>
        </View>
        
        {recentActivity.map((activity) => (
          <View
            key={activity.id}
            style={[styles.activityItem, { backgroundColor: colors.surface }]}
          >
            <View style={[styles.activityIcon, { backgroundColor: `${activity.color}20` }]}>
              <Icon name={activity.icon} size={20} color={activity.color} />
            </View>
            <View style={styles.activityContent}>
              <Text style={[styles.activityTitle, { color: colors.text }]}>
                {activity.title}
              </Text>
              <Text style={[styles.activitySubtitle, { color: colors.textSecondary }]}>
                {activity.subtitle}
              </Text>
            </View>
            <View style={styles.activityAmount}>
              <Text
                style={[
                  styles.activityAmountText,
                  {
                    color: activity.amount > 0 ? colors.success : colors.text,
                  },
                ]}
              >
                {activity.amount > 0 ? '+' : ''}{formatCurrency(Math.abs(activity.amount))}
              </Text>
              <Text style={[styles.activityDate, { color: colors.textSecondary }]}>
                {new Date(activity.date).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Bottom Spacing */}
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 14,
  },
  userName: {
    marginTop: 4,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  portfolioCard: {
    padding: 20,
  },
  portfolioTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  portfolioValue: {
    marginBottom: 16,
  },
  portfolioStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  portfolioStat: {
    flex: 1,
  },
  portfolioStatValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  portfolioStatLabel: {
    fontSize: 12,
  },
  chartCard: {
    padding: 16,
  },
  chartTitle: {
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  quickActions: {},
  sectionTitle: {
    marginBottom: 16,
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionItem: {
    width: '48%',
    aspectRatio: 1.5,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  recentActivity: {},
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 14,
  },
  activityAmount: {
    alignItems: 'flex-end',
  },
  activityAmountText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  activityDate: {
    fontSize: 12,
  },
});

export default HomeScreen;