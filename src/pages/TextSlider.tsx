import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

const crmFeatures = [
  'One-tap secure login',
  'Agent performance tracking',
  'Encrypted lead management',
  'Meeting & task scheduling',
  'Real-time notifications',
  'Smart analytics dashboard',
];

const TextSlider = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent(prev => (prev + 1) % crmFeatures.length);
    }, 3000); // Change feature every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-10 mb-8 overflow-hidden text-xl font-medium text-gray-800 dark:text-white">
      <AnimatePresence mode="wait">
        <motion.div
          key={crmFeatures[current]}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="absolute w-full text-center"
        >
          {crmFeatures[current]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default TextSlider;
