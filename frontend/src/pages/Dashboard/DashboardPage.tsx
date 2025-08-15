import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's an overview of your investment portfolio
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Portfolio Value</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">$12,450</p>
          <p className="text-sm text-green-600 mt-1">+5.2% from last month</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Returns</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">$2,450</p>
          <p className="text-sm text-green-600 mt-1">+12.5% overall</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Properties Owned</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">8</p>
          <p className="text-sm text-gray-600 mt-1">Across 3 countries</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Monthly Dividends</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">$156</p>
          <p className="text-sm text-blue-600 mt-1">Next payment in 5 days</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Investments</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Lagos Luxury Apartments</p>
                <p className="text-sm text-gray-500">50 tokens purchased</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900">$5,000</p>
                <p className="text-sm text-green-600">+8.2%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Performance</h2>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Chart will be implemented here
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;