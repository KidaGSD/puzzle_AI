import React from 'react';
import { motion } from 'framer-motion';

export const Mascot: React.FC = () => {
  return (
    <div className="absolute bottom-8 left-8 z-40 flex items-center space-x-4">
      <motion.div
        className="relative w-20 h-20 flex-shrink-0"
        animate={{
          y: [0, -8, 0],
          rotate: [0, 2, -2, 0]
        }}
        transition={{
          repeat: Infinity,
          duration: 5,
          ease: "easeInOut"
        }}
      >
        {/* Mascot SVG */}
        <img
          src="/mascot-design.svg"
          alt="Puzzle AI Mascot"
          className="w-full h-full object-contain drop-shadow-lg relative z-10"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-[#FFB5FA] text-[#1C1C1C] px-4 py-3 rounded-lg shadow-lg border border-[#1C1C1C]/10 max-w-xs"
      >
        <p className="text-sm font-semibold leading-relaxed">
          Looks like you're paused. If something feels stuck, click me for some directions.
        </p>
      </motion.div>
    </div>
  );
};
