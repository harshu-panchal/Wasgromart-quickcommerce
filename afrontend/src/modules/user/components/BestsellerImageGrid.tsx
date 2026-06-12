import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BestsellerImageGridProps {
  images: string[];
}

const BestsellerImageGrid = memo(({ images }: BestsellerImageGridProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Group images into chunks of 4
  const chunks = [];
  for (let i = 0; i < images.length; i += 4) {
    chunks.push(images.slice(i, i + 4));
  }

  useEffect(() => {
    if (chunks.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % chunks.length);
    }, 3500); // swipe every 3.5 seconds

    return () => clearInterval(interval);
  }, [chunks.length]);

  if (images.length === 0) return null;

  const currentChunk = chunks[currentIndex] || [];

  return (
    <div className="relative w-full h-full overflow-hidden">
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 w-full h-full grid grid-cols-2"
        >
          {currentChunk.map((img, idx) =>
            img ? (
              <img
                key={idx}
                src={img}
                alt=""
                className="w-full h-full object-cover bg-white rounded-sm"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div
                key={idx}
                className="w-full h-full bg-neutral-200 rounded-sm flex items-center justify-center text-xs text-neutral-400">
                {idx + 1}
              </div>
            )
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

BestsellerImageGrid.displayName = 'BestsellerImageGrid';

export default BestsellerImageGrid;
