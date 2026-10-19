import React, { useState, useEffect } from 'react';
import { getActiveFestival, setFestivalOverride, FestivalConfig, FestivalId } from '../lib/festivalEngine';
import { Sparkles, X, ChevronDown, Check, Volume2 } from 'lucide-react';

export const FestiveBanner: React.FC = () => {
  const [festival, setFestival] = useState<FestivalConfig>(() => getActiveFestival());
  const [isDismissed, setIsDismissed] = useState(false);
  const [showOverrideMenu, setShowOverrideMenu] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  useEffect(() => {
    const handler = () => {
      setFestival(getActiveFestival());
    };
    window.addEventListener('vdx_festival_change', handler);
    return () => window.removeEventListener('vdx_festival_change', handler);
  }, []);

  if (festival.id === 'none' || isDismissed) {
    return (
      <div className="flex justify-end -mt-2 mb-2">
        <button
          type="button"
          onClick={() => {
            setIsDismissed(false);
            setShowOverrideMenu(!showOverrideMenu);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 transition shadow-xs"
        >
          <span>{festival.id !== 'none' ? festival.iconSymbol : '✨'}</span>
          <span>Festival Theme: {festival.shortLabel}</span>
          <ChevronDown className="w-3 h-3 ml-0.5" />
        </button>
      </div>
    );
  }

  const handleCelebrate = () => {
    setConfettiActive(true);
    setTimeout(() => setConfettiActive(false), 3000);
  };

  const handleSelectFestival = (id: FestivalId | 'auto') => {
    setFestivalOverride(id);
    setShowOverrideMenu(false);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 shadow-lg transition-all duration-300 mb-6 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900">
      {/* Decorative Gradient Overlay */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          background: festival.bannerBg,
          filter: 'blur(20px)'
        }}
      />

      {/* Subtle Festive Pattern Border Top */}
      <div
        className="h-1 w-full bg-gradient-to-r"
        style={{
          backgroundImage: `linear-gradient(to right, ${festival.primaryColor}, ${festival.secondaryColor}, ${festival.primaryColor})`
        }}
      />

      <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Festival Motif Icon & Greetings */}
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl shadow-xl shrink-0 border border-white/20 select-none animate-bounce"
            style={{
              backgroundColor: festival.primaryColor,
              boxShadow: `0 0 25px ${festival.glowColor}`
            }}
          >
            {festival.iconSymbol}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-xs"
                style={{
                  backgroundColor: `${festival.primaryColor}25`,
                  color: festival.primaryColor,
                  borderColor: `${festival.primaryColor}50`
                }}
              >
                {festival.badgeText}
              </span>
              <span className="text-xs text-slate-400 font-medium">Vedotrix Pulse Festive Edition</span>
            </div>

            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              {festival.greetingTitle}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {festival.wishMessage}
            </p>
          </div>
        </div>

        {/* Right: Actions (Shower Sparkles + Switch Festival + Dismiss) */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={handleCelebrate}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-md hover:scale-105 active:scale-95 transition flex items-center gap-1.5"
            style={{
              backgroundImage: `linear-gradient(135deg, ${festival.primaryColor}, ${festival.secondaryColor})`
            }}
          >
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>Shower Joy {festival.iconSymbol}</span>
          </button>

          {/* Festival Switcher Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOverrideMenu(!showOverrideMenu)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition"
              title="Festival Mode Options"
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            {showOverrideMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 py-1.5 overflow-hidden text-xs">
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  Festival Theme Switcher
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectFestival('auto')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 text-slate-200 flex items-center justify-between"
                >
                  <span>🔄 Auto (Live Calendar Date)</span>
                  {localStorage.getItem('vdx_festival_override') === null && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectFestival('dussehra')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 text-amber-300 flex items-center justify-between font-semibold"
                >
                  <span>🏹 Dussehra (Vijayadashami)</span>
                  {festival.id === 'dussehra' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectFestival('diwali')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 text-yellow-300 flex items-center justify-between font-semibold"
                >
                  <span>🪔 Diwali (Deepavali)</span>
                  {festival.id === 'diwali' && <Check className="w-3.5 h-3.5 text-yellow-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectFestival('newyear')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 text-sky-300 flex items-center justify-between"
                >
                  <span>🎉 New Year & Holidays</span>
                  {festival.id === 'newyear' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectFestival('none')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 text-slate-400 flex items-center justify-between"
                >
                  <span>⚡ Standard Theme (Off)</span>
                  {(festival.id as string) === 'none' && <Check className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/80 transition"
            title="Minimize Festival Banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Sparkles Confetti Overlay when Celebrate is clicked */}
      {confettiActive && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-around z-20 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="text-2xl animate-ping"
              style={{
                animationDuration: `${0.8 + (i % 5) * 0.3}s`,
                transform: `translateY(${(i % 3) * 10}px)`
              }}
            >
              {festival.sparkles[i % festival.sparkles.length]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
