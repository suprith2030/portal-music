'use client';

import React from 'react';

interface WindowFrameProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  onClose?: () => void;
}

export default function WindowFrame({
  title,
  children,
  className = '',
  noPadding = false,
  onClose,
}: WindowFrameProps) {
  return (
    <div
      className={`relative border border-white bg-[#3A30D8]/90 backdrop-blur-md shadow-2xl ${className}`}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-white/30 bg-[#2A1FA8]/70 px-3 py-1.5 select-none">
        <div className="flex items-center gap-2">
          {/* Three retro OS square window controls */}
          <div className="flex gap-1.5">
            <span className="inline-block h-2.5 w-2.5 border border-white/80 bg-white/10 hover:bg-white/30 transition-colors" />
            <span className="inline-block h-2.5 w-2.5 border border-white/80 bg-white/10 hover:bg-white/30 transition-colors" />
            <span className="inline-block h-2.5 w-2.5 border border-white/80 bg-white/10 hover:bg-white/30 transition-colors" />
          </div>
          {title && (
            <div className="flex items-center gap-1.5 ml-1.5">
              <img
                src="/logo.png"
                alt="Logo icon"
                className="h-3.5 w-3.5 rounded-full border border-white/40 object-cover"
              />
              <span className="font-orbitron text-[10px] tracking-[0.25em] text-white/90 uppercase font-semibold">
                {title}
              </span>
            </div>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="font-space-mono text-[10px] text-white/60 hover:text-white px-1 border border-transparent hover:border-white/40 transition-colors"
            title="Close Window"
          >
            [X]
          </button>
        )}
      </div>

      {/* Window Content */}
      <div className={noPadding ? '' : 'p-4'}>{children}</div>
    </div>
  );
}
