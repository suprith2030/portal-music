'use client';

import React, { useState, useEffect } from 'react';

/**
 * Retro-futuristic live clock widget showing date, time, month, and day name.
 * Updates every second. Styled to match the Y2K cyber-terminal aesthetic.
 */
export default function CyberClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) {
    return (
      <div className="font-space-mono text-[10px] text-white/40 tracking-[0.15em]">
        --:--:--
      </div>
    );
  }

  const hours = now.getHours();
  const mins = now.getMinutes();
  const secs = now.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;

  const timeStr = `${h12.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const monthNames = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ];

  const dayName = dayNames[now.getDay()];
  const month = monthNames[now.getMonth()];
  const date = now.getDate();
  const year = now.getFullYear();

  return (
    <div className="flex items-center gap-3 border border-white/30 bg-[#1B1464]/80 backdrop-blur-xs px-3 py-1.5 select-none">
      {/* Blinking dot */}
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping bg-cyan-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 bg-cyan-300" />
      </span>

      {/* Time */}
      <div className="font-space-mono text-sm sm:text-base font-bold tracking-[0.2em] text-white tabular-nums">
        {timeStr}
        <span className="ml-1 text-[8px] font-normal text-cyan-300/80 tracking-[0.1em]">
          {ampm}
        </span>
      </div>

      {/* Separator */}
      <span className="text-white/30 text-[10px]">│</span>

      {/* Date */}
      <div className="font-space-mono text-[9px] tracking-[0.15em] text-white/70 uppercase">
        <span className="text-white/90 font-bold">{dayName}</span>
        {' // '}
        <span className="text-cyan-200/80">{month} {date}</span>
        {' // '}
        <span className="text-white/50">{year}</span>
      </div>
    </div>
  );
}
