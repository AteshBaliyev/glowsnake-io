'use client';

import React, { useEffect, useRef } from 'react';
import { drawSnakeSegments } from '@/engine/renderer';
import { Point2D, SnakeTypeSpec } from '@/types/game';

interface SnakePreviewCanvasProps {
  snake: SnakeTypeSpec;
  width?: number;
  height?: number;
  compact?: boolean;
}

export const SnakePreviewCanvas: React.FC<SnakePreviewCanvasProps> = ({
  snake,
  width = 240,
  height = 84,
  compact = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    // Dynamically proportion snake so head and tail ALWAYS fit with generous padding
    const segCount = compact ? 8 : 12;
    const segRadius = Math.min(10, Math.max(6, height * 0.22));
    const maxSpacing = (width - segRadius * 4) / (segCount - 1);
    const spacing = Math.min(segRadius * 0.85, maxSpacing);
    const totalSpan = (segCount - 1) * spacing;

    const render = (now: number) => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const t = now * 0.0035;
      // Head centered toward right, tail stays inside with at least (segRadius + 4)px left margin
      const headX = (width + totalSpan) * 0.5 - segRadius * 0.2;
      const centerY = height * 0.5;
      const waveAmp = Math.min(height * 0.18, 8);

      const segments: Point2D[] = [];
      for (let i = 0; i < segCount; i++) {
        const sx = headX - i * spacing;
        const sy = centerY + Math.sin(t - i * 0.45) * waveAmp * (1 - i * 0.02);
        segments.push({ x: sx, y: sy });
      }

      const headSlope = Math.cos(t) * (waveAmp * 0.05);
      const headAngle = Math.atan2(headSlope, 1);

      drawSnakeSegments(ctx, snake, segments, segRadius, headAngle, now);

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [snake, width, height, compact]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="block select-none pointer-events-none mx-auto"
    />
  );
};
