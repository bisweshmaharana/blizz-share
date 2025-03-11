import React from 'react';

const BlizzShareLogo: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      {/* Logo container with background element for visibility on dark backgrounds */}
      <div className="relative inline-flex items-center">
        {/* Semi-transparent background pill for better visibility */}
        <div className="relative">
          <div className="absolute inset-0 bg-gray-800/40 rounded-full -mx-2 py-1 px-3"></div>
          <div className="relative z-10 flex items-center">
            <div className="flex items-baseline">
              <span className="font-bold text-3xl text-white mr-1">blizz</span>
            </div>
            
            {/* Blue dot accent */}
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full mr-1.5 mb-3"></div>
            
            <div className="flex items-baseline">
              <span className="font-normal text-3xl text-gray-300">share</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlizzShareLogo;
