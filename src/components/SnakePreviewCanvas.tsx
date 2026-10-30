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

    const segCount = compact ? 8 : 15;
    const segRadius = compact ? 7.5 : 11.5;
    const spacing = segRadius * 0.78;

    const render = (now: number) => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const t = now * 0.0038;
      const headX = width * (compact ? 0.72 : 0.75);
      const centerY = height * 0.5;
      const waveAmp = compact ? 7 : 13;

      const segments: Point2D[] = [];
      for (let i = 0; i < segCount; i++) {
        const sx = headX - i * spacing;
        const sy = centerY + Math.sin(t - i * 0.42) * waveAmp * (1 - i * 0.015);
        segments.push({ x: sx, y: sy });
      }

      const headSlope = Math.cos(t) * (waveAmp * 0.045);
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
      className="block select-none pointer-events-none"
    />
  );
};
