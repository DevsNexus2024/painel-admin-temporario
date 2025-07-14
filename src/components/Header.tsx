
import React from 'react';
import { Menu, User } from 'lucide-react';
import logo from '../assets/tcr-logo.png';

const Header: React.FC = () => {
  return (
    <header className="flex justify-between items-center p-4 bg-tcr-dark">
      <button className="text-white">
        <Menu size={24} />
      </button>
      
      <div className="flex items-center">
        <img 
          src="/lovable-uploads/ecc0d6af-434b-4a82-bde4-2c3bbad1abd9.png" 
          alt="TCR Logo" 
          className="h-10"
        />
        <span className="text-white text-xl ml-2 font-bold">TCR</span>
      </div>
      
      <button className="bg-gray-300 rounded-full p-2">
        <User size={24} className="text-tcr-dark" />
      </button>
    </header>
  );
};

export default Header;
