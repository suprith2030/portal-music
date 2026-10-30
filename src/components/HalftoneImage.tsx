'use client';

import React from 'react';

interface HalftoneImageProps {
  src: string;
  alt: string;
  className?: string;
}

export default function HalftoneImage({
  src,
  alt,
  className = '',
}: HalftoneImageProps) {
  return (
    <div className={`relative overflow-hidden bg-[#3A30D8] ${className}`}>
      {/* Base image with high-contrast monochrome conversion and screen blend */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover select-none"
        style={{
          filter: 'grayscale(100%) contrast(160%) brightness(120%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Primary Halftone Dot Matrix Pattern */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255, 255, 255, 0.75) 1px, transparent 1.2px)',
          backgroundSize: '4px 4px',
          mixBlendMode: 'overlay',
          opacity: 0.55,
        }}
      />

      {/* Secondary Indigo Stipple Grid Shadow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(70, 61, 245, 0.9) 1px, transparent 1.5px)',
          backgroundSize: '6px 6px',
          mixBlendMode: 'multiply',
          opacity: 0.65,
        }}
      />

      {/* Deep Electric Indigo Duotone Tint */}
      <div
        className="pointer-events-none absolute inset-0 bg-[#463DF5]/30"
        style={{ mixBlendMode: 'color' }}
      />
    </div>
  );
}
