import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductImageCarouselProps {
  images: string[];
  productName: string;
  className?: string;
  fallbackText?: string;
}

const ProductImageCarousel = memo(({
  images,
  productName,
  className = "w-full h-full object-cover",
  fallbackText = "?"
}: ProductImageCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hasError, setHasError] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (images.length <= 1 || isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000); // swipe every 3 seconds

    return () => clearInterval(interval);
  }, [images.length, isHovered]);

  if (images.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl fallback-icon">
        {fallbackText}
      </div>
    );
  }

  if (images.length === 1) {
    return hasError[0] ? (
      <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl fallback-icon">
        {fallbackText}
      </div>
    ) : (
      <img
        src={images[0]}
        alt={productName}
        className={className}
        referrerPolicy="no-referrer"
        onError={() => setHasError(prev => ({ ...prev, 0: true }))}
      />
    );
  }

  // Handle case where all images have errors
  const allFailed = images.every((_, idx) => hasError[idx]);
  if (allFailed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl fallback-icon">
        {fallbackText}
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden group/carousel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence initial={false} mode="wait">
        {hasError[currentIndex] ? (
          <div key={`fallback-${currentIndex}`} className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl fallback-icon">
            {fallbackText}
          </div>
        ) : (
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            alt={`${productName} - image ${currentIndex + 1}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={className}
            referrerPolicy="no-referrer"
            onError={() => setHasError(prev => ({ ...prev, [currentIndex]: true }))}
          />
        )}
      </AnimatePresence>

      {/* Dots Indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10 bg-black/20 backdrop-blur-[2px] px-1.5 py-0.5 rounded-full">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCurrentIndex(idx);
            }}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              idx === currentIndex ? 'bg-white w-3' : 'bg-white/40 hover:bg-white/70'
            }`}
            aria-label={`Go to image ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
});

ProductImageCarousel.displayName = 'ProductImageCarousel';

export default ProductImageCarousel;
