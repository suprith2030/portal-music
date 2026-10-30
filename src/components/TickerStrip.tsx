'use client';

import React from 'react';

const TICKER_ITEMS = [
  '1 OF 1',
  'BOOT SEQUENCE INITIATED',
  'ポータル',
  'PORTAL ENTRANCE',
  'SYSTEM OS',
  'STREAM // 44.1kHz 24-BIT',
  'DIRECT S3/R2 STORAGE ACTIVE',
  'TRUE GAME CHANGING AUDIO',
  'FREQUENCY SYNCHRONIZED',
  'CYBERNETIC MATRIX ONLINE',
];

export default function TickerStrip() {
  return (
    <div className="border-t border-white bg-[#1B1464]/95 shadow-[0_-4px_20px_rgba(70,61,245,0.4)] overflow-hidden select-none">
      <div className="flex animate-ticker whitespace-nowrap">
        {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, idx) => (
          <span
            key={idx}
            className="font-space-mono inline-flex items-center border-r border-white px-4 py-1 text-[9px] sm:text-[10px] tracking-[0.25em] text-white uppercase font-bold"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
