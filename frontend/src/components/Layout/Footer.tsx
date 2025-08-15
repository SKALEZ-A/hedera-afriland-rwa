import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900">
      <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
        <div className="flex justify-center space-x-6 md:order-2">
          <Link to="/about" className="text-gray-400 hover:text-gray-300">
            About
          </Link>
          <Link to="/contact" className="text-gray-400 hover:text-gray-300">
            Contact
          </Link>
          <Link to="/privacy" className="text-gray-400 hover:text-gray-300">
            Privacy
          </Link>
          <Link to="/terms" className="text-gray-400 hover:text-gray-300">
            Terms
          </Link>
        </div>
        <div className="mt-8 md:order-1 md:mt-0">
          <p className="text-center text-xs leading-5 text-gray-400">
            &copy; 2024 GlobalLand. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;