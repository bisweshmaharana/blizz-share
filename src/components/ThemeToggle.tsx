import React from 'react';
import { motion } from 'framer-motion';
import { FiSun, FiMoon } from 'react-icons/fi';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, toggleTheme }) => {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="p-2 rounded-full bg-white dark:bg-dark-100 shadow-md hover:shadow-lg transition-all duration-300"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <FiSun className="w-5 h-5 text-yellow-500" />
      ) : (
        <FiMoon className="w-5 h-5 text-blue-700" />
      )}
    </motion.button>
  );
};

export default ThemeToggle;
