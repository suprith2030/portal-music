'use client';

import React, { useRef, useEffect, useCallback } from 'react';

interface SineWaveVisualizerProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
}

export default function SineWaveVisualizer({
  analyserNode,
  isPlaying,
}: SineWaveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      animationFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    // Work in virtual pixels
    ctx.save();
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear transparent
    ctx.clearRect(0, 0, width, height);

    // Sine line style
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowBlur = 8;
    ctx.beginPath();

    if (analyserNode && isPlaying) {
      // Live audio time-domain data
      const bufferLength = analyserNode.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      analyserNode.getByteTimeDomainData(dataArray);

      // Check if data is active (not all silence/128)
      let sumDelta = 0;
      for (let i = 0; i < bufferLength; i += 8) {
        sumDelta += Math.abs(dataArray[i] - 128);
      }

      if (sumDelta > 20) {
        // Active audio undulation
        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0; // 0.0 to 2.0 (1.0 is center)
          // Amplify response for visual impact
          const offset = (v - 1.0) * 1.6;
          const y = (height / 2) + offset * (height / 2);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
      } else {
        // Gentle transition wave if audio signal is quiet
        timeRef.current += 0.03;
        const t = timeRef.current;
        const amplitude = height * 0.12;
        const segments = 120;

        for (let i = 0; i <= segments; i++) {
          const x = (i / segments) * width;
          const norm = (i / segments) * Math.PI * 3;
          const y = height / 2 + amplitude * Math.sin(norm + t) * Math.cos(norm * 0.5 + t * 0.5);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
    } else {
      // Idle animated sine wave when paused
      timeRef.current += 0.02;
      const t = timeRef.current;
      const amplitude = height * 0.09;
      const segments = 100;

      for (let i = 0; i <= segments; i++) {
        const x = (i / segments) * width;
        const norm = (i / segments) * Math.PI * 2.5;
        const y =
          height / 2 +
          amplitude *
            Math.sin(norm + t) *
            Math.sin(norm * 0.4 + t * 0.8);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    }

    ctx.stroke();
    ctx.restore();

    animationFrameRef.current = requestAnimationFrame(draw);
  }, [analyserNode, isPlaying]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none h-full w-full block"
      style={{ background: 'transparent' }}
    />
  );
}
