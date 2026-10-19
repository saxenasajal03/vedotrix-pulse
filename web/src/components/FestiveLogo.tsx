import React, { useEffect, useState } from 'react';
import { getActiveFestival, FestivalConfig, updateBrowserFavicon } from '../lib/festivalEngine';

interface FestiveLogoProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBadge?: boolean;
}

export const FestiveLogo: React.FC<FestiveLogoProps> = ({
  src,
  alt,
  size = 'md',
  className = '',
  showBadge = true
}) => {
  const [festival, setFestival] = useState<FestivalConfig>(() => getActiveFestival());

  useEffect(() => {
    // Sync browser favicon
    updateBrowserFavicon(festival);

    // Listen for manual festival preview changes
    const handler = () => {
      const current = getActiveFestival();
      setFestival(current);
      updateBrowserFavicon(current);
    };

    window.addEventListener('vdx_festival_change', handler);
    return () => window.removeEventListener('vdx_festival_change', handler);
  }, [festival]);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  const badgeSizeClasses = {
    sm: 'w-4 h-4 text-[9px] -top-1 -right-1',
    md: 'w-5 h-5 text-[11px] -top-1.5 -right-1.5',
    lg: 'w-6 h-6 text-[13px] -top-2 -right-2',
    xl: 'w-8 h-8 text-base -top-2.5 -right-2.5'
  };

  const isFestive = festival.id !== 'none';

  // Automatically switch logo to the decorated festival image
  const effectiveSrc = React.useMemo(() => {
    if (!src || src === '/vedotrix-logo.png' || src.includes('vedotrix-logo')) {
      if (festival.id === 'dussehra') return '/vedotrix-logo-dussehra.png';
      if (festival.id === 'diwali') return '/vedotrix-logo-diwali.png';
      return '/vedotrix-logo.png';
    }
    return src;
  }, [src, festival.id]);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses[size]} ${className}`}
      title={isFestive ? `${festival.name} • Vedotrix Pulse` : alt}
    >
      {/* Outer Festive Glowing Ring */}
      <div
        className={`w-full h-full rounded-xl overflow-hidden p-1 flex items-center justify-center transition-all duration-300 ${
          isFestive
            ? 'bg-slate-900 border-2 shadow-lg'
            : 'bg-slate-900 border border-slate-700/80 shadow-md'
        }`}
        style={
          isFestive
            ? {
                borderColor: festival.primaryColor,
                boxShadow: `0 0 16px ${festival.glowColor}`
              }
            : undefined
        }
      >
        <img
          src={effectiveSrc}
          alt={alt}
          className="w-full h-full object-cover rounded-lg select-none"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/vedotrix-logo.png';
          }}
        />
      </div>

      {/* Floating Festive Corner Emblem */}
      {isFestive && showBadge && (
        <span
          className={`absolute ${badgeSizeClasses[size]} rounded-full flex items-center justify-center shadow-md animate-pulse z-10 border border-white/20 select-none`}
          style={{
            backgroundColor: festival.primaryColor,
            boxShadow: `0 0 10px ${festival.glowColor}`
          }}
        >
          {festival.iconSymbol}
        </span>
      )}
    </div>
  );
};
