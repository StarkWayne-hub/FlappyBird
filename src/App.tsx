/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw } from 'lucide-react';

// Constants
const GRAVITY = 0.4;
const JUMP_STRENGTH = -7;
const BASE_PIPE_SPEED = 3;
const PIPE_SPAWN_RATE = 100; // frames
const PIPE_WIDTH = 60;
const BASE_PIPE_GAP = 160;
const MIN_PIPE_GAP = 110;
const BIRD_SIZE = 34;

interface Pipe {
  x: number;
  topHeight: number;
  passed: boolean;
}

interface Cloud {
  x: number;
  y: number;
  speed: number;
  scale: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('flappy-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Difficulty scaling derived from score
  const currentPipeSpeed = BASE_PIPE_SPEED + Math.floor(score / 5) * 0.25;
  const currentPipeGap = Math.max(MIN_PIPE_GAP, BASE_PIPE_GAP - Math.floor(score / 5) * 4);

  // Game state refs for the loop
  const birdY = useRef(300);
  const birdVelocity = useRef(0);
  const pipes = useRef<Pipe[]>([]);
  const clouds = useRef<Cloud[]>([]);
  const frameCount = useRef(0);
  const animationFrameId = useRef<number>(0);

  // Sound Effects Generator
  const initAudio = () => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playSound = (type: 'jump' | 'score' | 'collision') => {
    if (!audioCtx.current) return;
    const ctx = audioCtx.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'jump') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'score') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'collision') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  };

  const resetGame = () => {
    birdY.current = 300;
    birdVelocity.current = 0;
    pipes.current = [];
    frameCount.current = 0;
    setScore(0);
    setGameState('PLAYING');
  };

  // Initialize clouds
  useEffect(() => {
    const initialClouds: Cloud[] = [];
    for (let i = 0; i < 5; i++) {
      initialClouds.push({
        x: Math.random() * 400,
        y: Math.random() * 300,
        speed: 0.5 + Math.random() * 0.5,
        scale: 0.5 + Math.random() * 0.5,
      });
    }
    clouds.current = initialClouds;
  }, []);

  const handleAction = () => {
    initAudio();
    if (gameState === 'START') {
      resetGame();
      playSound('jump');
    } else if (gameState === 'PLAYING') {
      birdVelocity.current = JUMP_STRENGTH;
      playSound('jump');
    } else if (gameState === 'GAME_OVER') {
      resetGame();
      playSound('jump');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleAction();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const update = () => {
      if (gameState === 'PLAYING') {
        // Bird Physics
        birdVelocity.current += GRAVITY;
        birdY.current += birdVelocity.current;

        // Pipe Logic
        frameCount.current++;
        if (frameCount.current % PIPE_SPAWN_RATE === 0) {
          const minHeight = 50;
          const maxHeight = canvas.height - currentPipeGap - minHeight;
          const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
          pipes.current.push({ x: canvas.width, topHeight, passed: false });
        }

        pipes.current.forEach((pipe) => {
          pipe.x -= currentPipeSpeed;

          // Collision Detection
          const birdRect = {
            left: 100 - BIRD_SIZE / 2 + 5,
            right: 100 + BIRD_SIZE / 2 - 5,
            top: birdY.current - BIRD_SIZE / 2 + 5,
            bottom: birdY.current + BIRD_SIZE / 2 - 5,
          };

          const topPipeRect = {
            left: pipe.x,
            right: pipe.x + PIPE_WIDTH,
            top: 0,
            bottom: pipe.topHeight,
          };

          const bottomPipeRect = {
            left: pipe.x,
            right: pipe.x + PIPE_WIDTH,
            top: pipe.topHeight + currentPipeGap,
            bottom: canvas.height,
          };

          // Check collisions
          if (
            (birdRect.right > topPipeRect.left &&
              birdRect.left < topPipeRect.right &&
              birdRect.top < topPipeRect.bottom) ||
            (birdRect.right > bottomPipeRect.left &&
              birdRect.left < bottomPipeRect.right &&
              birdRect.bottom > bottomPipeRect.top) ||
            birdY.current + BIRD_SIZE / 2 > canvas.height ||
            birdY.current - BIRD_SIZE / 2 < 0
          ) {
            setGameState('GAME_OVER');
            playSound('collision');
          }

          // Score tracking
          if (!pipe.passed && pipe.x + PIPE_WIDTH < 100) {
            pipe.passed = true;
            setScore((s) => s + 1);
            playSound('score');
          }
        });

        // Remove off-screen pipes
        pipes.current = pipes.current.filter((p) => p.x + PIPE_WIDTH > 0);
      }

      // Cloud Logic (always update for background feel)
      clouds.current.forEach((cloud) => {
        cloud.x -= cloud.speed;
        if (cloud.x + 100 * cloud.scale < 0) {
          cloud.x = canvas.width;
          cloud.y = Math.random() * 300;
        }
      });

      // Draw
      draw(ctx, canvas);
      animationFrameId.current = requestAnimationFrame(update);
    };

    const draw = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = '#70c5ce';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      clouds.current.forEach((cloud) => {
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, 20 * cloud.scale, 0, Math.PI * 2);
        ctx.arc(cloud.x + 20 * cloud.scale, cloud.y - 10 * cloud.scale, 25 * cloud.scale, 0, Math.PI * 2);
        ctx.arc(cloud.x + 45 * cloud.scale, cloud.y, 20 * cloud.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      // Pipes
      pipes.current.forEach((pipe) => {
        ctx.fillStyle = '#73bf2e';
        ctx.strokeStyle = '#558022';
        ctx.lineWidth = 3;

        // Top Pipe
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);

        // Bottom Pipe
        ctx.fillRect(pipe.x, pipe.topHeight + currentPipeGap, PIPE_WIDTH, canvas.height - (pipe.topHeight + currentPipeGap));
        ctx.strokeRect(pipe.x, pipe.topHeight + currentPipeGap, PIPE_WIDTH, canvas.height - (pipe.topHeight + currentPipeGap));
      });

      // Bird
      ctx.save();
      ctx.translate(100, birdY.current);
      const rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, birdVelocity.current * 0.1));
      ctx.rotate(rotation);
      
      // Bird Body
      ctx.fillStyle = '#f7d308';
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(8, -4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(10, -4, 2, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#f75d10';
      ctx.beginPath();
      ctx.moveTo(12, 2);
      ctx.lineTo(22, 6);
      ctx.lineTo(12, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    };

    animationFrameId.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [gameState, currentPipeSpeed, currentPipeGap]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('flappy-high-score', score.toString());
    }
  }, [score, highScore]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 font-sans text-white overflow-hidden select-none">
      <div className="relative w-full max-w-[400px] aspect-[9/16] bg-sky-400 rounded-2xl shadow-2xl overflow-hidden border-4 border-zinc-800" onClick={handleAction}>
        <canvas
          ref={canvasRef}
          width={400}
          height={711}
          className="w-full h-full block"
        />

        {/* Score Display */}
        {gameState === 'PLAYING' && (
          <>
            <div className="absolute top-12 left-0 right-0 text-center pointer-events-none">
              <span className="text-6xl font-black drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]">
                {score}
              </span>
            </div>
            <div className="absolute top-4 right-4 text-right pointer-events-none">
              <div className="flex items-center gap-1 text-yellow-400 font-black text-lg drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">
                <Trophy size={18} /> {highScore}
              </div>
            </div>
            {score > 0 && score % 5 === 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                key={`difficulty-${Math.floor(score/5)}`}
                className="absolute top-32 left-0 right-0 text-center pointer-events-none"
              >
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/60 bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
                  Difficulty Increased!
                </span>
              </motion.div>
            )}
          </>
        )}

        {/* Overlays */}
        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="mb-8"
              >
                <div className="w-20 h-20 bg-yellow-400 rounded-full border-4 border-black flex items-center justify-center shadow-xl">
                  <div className="w-4 h-4 bg-white rounded-full border-2 border-black translate-x-3 -translate-y-2" />
                </div>
              </motion.div>
              <h1 className="text-4xl font-black mb-1 tracking-tighter uppercase italic">
                Infinite<br />Flappy
              </h1>
              <div className="flex items-center gap-2 mb-8 text-yellow-400 font-bold">
                <Trophy size={16} /> Best: {highScore}
              </div>
              <p className="text-sm opacity-80 mb-8 uppercase tracking-widest font-bold">
                Tap or Space to Jump
              </p>
              <button
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-full font-black text-xl shadow-[0_6px_0_rgb(194,65,12)] active:translate-y-1 active:shadow-none transition-all flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction();
                }}
              >
                <Play fill="currentColor" /> PLAY
              </button>
            </motion.div>
          )}

          {gameState === 'GAME_OVER' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-8 text-center"
            >
              <h2 className="text-5xl font-black mb-2 text-red-500 italic uppercase">Game Over</h2>
              
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 w-full mb-8">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold opacity-60 uppercase tracking-wider">Score</span>
                  <span className="text-3xl font-black">{score}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold opacity-60 uppercase tracking-wider flex items-center gap-1">
                    <Trophy size={14} className="text-yellow-400" /> Best
                  </span>
                  <span className="text-3xl font-black text-yellow-400">{highScore}</span>
                </div>
              </div>

              <button
                className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full font-black text-xl shadow-[0_6px_0_rgb(21,128,61)] active:translate-y-1 active:shadow-none transition-all flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction();
                }}
              >
                <RotateCcw /> RESTART
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop Instructions */}
      <div className="mt-8 hidden md:flex flex-col items-center gap-2 opacity-40">
        <div className="flex gap-2">
          <kbd className="px-3 py-1 bg-zinc-800 rounded border border-zinc-700 text-xs font-mono">SPACE</kbd>
          <span className="text-xs uppercase font-bold">to jump</span>
        </div>
      </div>
    </div>
  );
}

