import React from 'react';

const PropertiesPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Available Properties</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Property cards will be implemented here */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-2">Lagos Luxury Apartments</h3>
          <p className="text-gray-600 mb-4">Premium residential complex in Victoria Island</p>
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-blue-600">$100/token</span>
            <span className="text-sm text-gray-500">12.5% yield</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertiesPage;