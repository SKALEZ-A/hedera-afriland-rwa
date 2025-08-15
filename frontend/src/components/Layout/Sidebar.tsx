import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  HomeIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  UserIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Portfolio', href: '/dashboard/portfolio', icon: ChartBarIcon },
    { name: 'Trading', href: '/dashboard/trading', icon: CurrencyDollarIcon },
    { name: 'Profile', href: '/dashboard/profile', icon: UserIcon },
    { name: 'Settings', href: '/dashboard/settings', icon: CogIcon },
  ];

  const propertyManagerNavigation = [
    { name: 'Dashboard', href: '/property-manager', icon: HomeIcon },
    { name: 'Properties', href: '/property-manager/properties', icon: BuildingOfficeIcon },
  ];

  const currentNavigation = location.pathname.startsWith('/property-manager') 
    ? propertyManagerNavigation 
    : navigation;

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
        <div className="flex flex-shrink-0 items-center px-4">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">GL</span>
          </div>
          <span className="ml-3 text-white font-semibold">GlobalLand</span>
        </div>
        <nav className="mt-8 flex-1 space-y-1 px-2">
          {currentNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md'
                )}
              >
                <item.icon
                  className={clsx(
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-white',
                    'mr-3 flex-shrink-0 h-6 w-6'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex flex-shrink-0 bg-gray-800 p-4">
        <div className="flex items-center">
          <div className="ml-3">
            <p className="text-sm font-medium text-white">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs font-medium text-gray-400">
              {user?.roles?.includes('property_manager') ? 'Property Manager' : 'Investor'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;