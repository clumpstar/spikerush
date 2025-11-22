"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

// --- CONFIGURATION ---
const INITIAL_SPEED = 3;
const SPEED_INCREMENT = 0.5;
const SPEED_INCREASE_THRESHOLD = 10;
const BLOCK_SIZE = 40;
const CANV_WIDTH = 400;
const CANV_HEIGHT = 600;
const MOVEMENT_SMOOTHING = 0.2; 

// --- TYPES ---
type GameState = "START" | "COUNTDOWN" | "PLAYING" | "GAME_OVER";
type PlayerState = "CENTER" | "LEFT" | "RIGHT" | "SPLIT";

interface Obstacle {
  y: number;
  type: 1 | 2 | 3 | 4;
  passed: boolean;
}

// --- ANIMATION & CSS STYLES ---
const animationStyles = `
  /* Hide Scrollbar */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }

  @keyframes keyPress {
    0%, 100% { transform: translateY(0); border-bottom-width: 4px; }
    50% { transform: translateY(3px); border-bottom-width: 1px; }
  }
  .animate-key-press {
    animation: keyPress 1.5s infinite ease-in-out;
  }

  @keyframes moveLeft {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(-40px); }
  }
  @keyframes moveRight {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(40px); }
  }
  
  .animate-blocks-left > div { animation: moveLeft 1.5s infinite ease-in-out; }
  .animate-blocks-right > div { animation: moveRight 1.5s infinite ease-in-out; }
  .animate-blocks-split > div:first-child { animation: moveLeft 1.5s infinite ease-in-out; }
  .animate-blocks-split > div:last-child { animation: moveRight 1.5s infinite ease-in-out; }
`;

// --- SUB-COMPONENTS FOR TUTORIAL ---
const KeyCap = ({ label, pressed }: { label: string, pressed?: boolean }) => (
  <div className={`w-8 h-8 bg-gray-800 border-2 border-gray-600 border-b-4 rounded text-center leading-6 text-xs font-bold text-cyan-300 ${pressed ? 'animate-key-press border-cyan-700 bg-gray-900' : ''}`}>
    {label}
  </div>
);

const DemoBlockContainer = ({ animationClass }: { animationClass?: string }) => (
  <div className={`flex gap-2 justify-center h-8 mb-2 ${animationClass}`}>
    <div className="w-6 h-6 bg-cyan-400 rounded-lg shadow-[0_0_10px_#00ffcc]"></div>
    <div className="w-6 h-6 bg-cyan-400 rounded-lg shadow-[0_0_10px_#00ffcc]"></div>
  </div>
);

const InstructionCard = ({ title, spikeType, keys, animationClass }: { title: string, spikeType: string, keys: React.ReactNode, animationClass?: string }) => (
  <div className="bg-gray-800/80 border border-gray-700 p-2.5 rounded-lg flex flex-col items-center w-full backdrop-blur-sm">
    {/* Spike Visualization Header */}
    <div className="w-full h-3 bg-red-900/30 mb-2 relative overflow-hidden rounded">
      {spikeType === "center" && <div className="absolute inset-x-1/4 h-full bg-red-600"></div>}
      {spikeType === "sides" && <><div className="absolute left-0 w-1/4 h-full bg-red-600"></div><div className="absolute right-0 w-1/4 h-full bg-red-600"></div></>}
      {spikeType === "right" && <div className="absolute right-0 w-3/4 h-full bg-red-600"></div>}
      {spikeType === "left" && <div className="absolute left-0 w-3/4 h-full bg-red-600"></div>}
    </div>
    
    <div className="flex justify-between items-center w-full">
        <div className="flex flex-col">
            <h3 className="text-cyan-400 font-bold text-xs">{title}</h3>
            <div className="flex gap-2 mt-1 items-center text-gray-400 text-[10px]">
                {keys}
            </div>
        </div>
        <div className="w-16">
            <DemoBlockContainer animationClass={animationClass} />
        </div>
    </div>
  </div>
);


// --- MAIN GAME COMPONENT ---
export default function SpikeRushGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // UI States
  const [uiState, setUiState] = useState<GameState>("START");
  const [showTutorial, setShowTutorial] = useState(false); 
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0); 
  const [countdown, setCountdown] = useState(3);

  // Mutable Game Refs
  const gameStateRef = useRef<GameState>("START"); 
  const frameRef = useRef<number>(0);
  const speedRef = useRef(INITIAL_SPEED);
  const scoreRef = useRef(0);
  const highScoreRef = useRef(0); 
  const obstaclesRef = useRef<Obstacle[]>([]);
  const keysPressed = useRef<Set<string>>(new Set());
  
  const playerPosRef = useRef({ 
    b1: CANV_WIDTH / 2 - BLOCK_SIZE, 
    b2: CANV_WIDTH / 2 
  });

  // --- INITIALIZATION ---
  useEffect(() => {
    const storedHigh = localStorage.getItem("spikerush_highscore");
    if (storedHigh) {
      const parsed = parseInt(storedHigh);
      setHighScore(parsed);
      highScoreRef.current = parsed; 
    }
  }, []);

  // --- INPUT HANDLING ---
  const triggerStartSequence = useCallback(() => {
    if (gameStateRef.current === "PLAYING" || gameStateRef.current === "COUNTDOWN") return;
    
    setUiState("COUNTDOWN");
    gameStateRef.current = "COUNTDOWN";
    setCountdown(3);
    setShowTutorial(false); 
    
    playerPosRef.current = { 
        b1: CANV_WIDTH / 2 - BLOCK_SIZE, 
        b2: CANV_WIDTH / 2 
    };
    
    let count = 3;
    const timer = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(timer);
        startGameLoop();
      }
    }, 1000);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase());
      if (e.key === "Enter" && !showTutorial) triggerStartSequence();
      if (e.key === "Escape") setShowTutorial(false);
    };
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key.toLowerCase());

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [triggerStartSequence, showTutorial]);

  // --- GAME LOOP ---
  const startGameLoop = () => {
    gameStateRef.current = "PLAYING";
    setUiState("PLAYING");
    scoreRef.current = 0;
    setScore(0);
    speedRef.current = INITIAL_SPEED;
    obstaclesRef.current = [];
    
    playerPosRef.current = { 
        b1: CANV_WIDTH / 2 - BLOCK_SIZE, 
        b2: CANV_WIDTH / 2 
    };
    
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    loop();
  };

  const loop = () => {
    if (gameStateRef.current !== "PLAYING") return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const crashed = updatePhysics();
    draw(ctx);

    if (!crashed) {
      frameRef.current = requestAnimationFrame(loop);
    }
  };

  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

  const updatePhysics = (): boolean => {
    const left = keysPressed.current.has("arrowleft") || keysPressed.current.has("a");
    const right = keysPressed.current.has("arrowright") || keysPressed.current.has("d");
    
    let targetB1 = CANV_WIDTH / 2 - BLOCK_SIZE; 
    let targetB2 = CANV_WIDTH / 2;              
    let playerState: PlayerState = "CENTER";

    if (left && right) { // SPLIT
      targetB1 = 20;
      targetB2 = CANV_WIDTH - 20 - BLOCK_SIZE;
      playerState = "SPLIT";
    } else if (left) { // LEFT
      targetB1 = 20;
      targetB2 = 20 + BLOCK_SIZE;
      playerState = "LEFT";
    } else if (right) { // RIGHT
      targetB1 = CANV_WIDTH - 20 - BLOCK_SIZE * 2;
      targetB2 = CANV_WIDTH - 20 - BLOCK_SIZE;
      playerState = "RIGHT";
    }

    playerPosRef.current.b1 = lerp(playerPosRef.current.b1, targetB1, MOVEMENT_SMOOTHING);
    playerPosRef.current.b2 = lerp(playerPosRef.current.b2, targetB2, MOVEMENT_SMOOTHING);

    const lastObstacle = obstaclesRef.current[obstaclesRef.current.length - 1];
    const gap = 300 + (speedRef.current * 10); 
    
    if (!lastObstacle || lastObstacle.y > gap) {
       spawnObstacle();
    }

    for (const obs of obstaclesRef.current) {
      obs.y += speedRef.current;
      
      if (!obs.passed && obs.y > CANV_HEIGHT - 80) {
        obs.passed = true;
        scoreRef.current += 1;
        setScore(scoreRef.current);

        if (scoreRef.current > 0 && scoreRef.current % SPEED_INCREASE_THRESHOLD === 0) {
          speedRef.current += SPEED_INCREMENT;
        }
      }
    }

    if (obstaclesRef.current.length > 0 && obstaclesRef.current[0].y > CANV_HEIGHT) {
      obstaclesRef.current.shift();
    }

    if (checkCollision(playerState)) {
      handleGameOver();
      return true;
    }

    return false;
  };

  const spawnObstacle = () => {
    const type = Math.floor(Math.random() * 4) + 1 as 1 | 2 | 3 | 4;
    obstaclesRef.current.push({ y: -100, type, passed: false });
  };

  const checkCollision = (playerState: PlayerState): boolean => {
    const playerY = CANV_HEIGHT - 100; 
    
    for (const obs of obstaclesRef.current) {
      const obsHitY = obs.y + 30; 
      
      if (obsHitY >= playerY && obs.y < playerY + BLOCK_SIZE) {
        let crash = false;

        switch (obs.type) {
          case 1: if (playerState === "CENTER") crash = true; break;
          case 2: if (playerState !== "CENTER") crash = true; break;
          case 3: if (playerState !== "LEFT") crash = true; break;
          case 4: if (playerState !== "RIGHT") crash = true; break;
        }

        if (crash) return true;
      }
    }
    return false;
  };

  const handleGameOver = () => {
    gameStateRef.current = "GAME_OVER";
    setUiState("GAME_OVER");
    
    if (scoreRef.current > highScoreRef.current) {
      highScoreRef.current = scoreRef.current; 
      setHighScore(scoreRef.current);          
      localStorage.setItem("spikerush_highscore", scoreRef.current.toString());
    }
  };

  // --- DRAWING ---
  
  // Helper to draw rounded rects
  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  };

  const drawSpikes = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.fillStyle = "#ff0055"; 
    
    const spikeWidth = 20; 
    const numSpikes = w / spikeWidth;
    
    ctx.moveTo(x, y); 
    
    for (let i = 0; i < numSpikes; i++) {
        const spikeBaseX = x + (i * spikeWidth);
        ctx.lineTo(spikeBaseX + (spikeWidth / 2), y + h); 
        ctx.lineTo(spikeBaseX + spikeWidth, y); 
    }
    
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ff0055";
    ctx.stroke(); 
    ctx.shadowBlur = 0;
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#111111"; // Slightly darker background for canvas
    ctx.fillRect(0, 0, CANV_WIDTH, CANV_HEIGHT);

    const playerY = CANV_HEIGHT - 100;

    // Player Styling
    ctx.fillStyle = "#00ffcc";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00ffcc";
    
    // VISUAL ADJUSTMENT: Draw blocks slightly smaller than physics to create the gap
    const visualGap = 3; 
    const visualSize = BLOCK_SIZE - (visualGap * 2);

    // Draw Rounded Blocks with Gap
    roundRect(ctx, playerPosRef.current.b1 + visualGap, playerY + visualGap, visualSize, visualSize, 8);
    roundRect(ctx, playerPosRef.current.b2 + visualGap, playerY + visualGap, visualSize, visualSize, 8);
    
    ctx.shadowBlur = 0;

    // Obstacles
    obstaclesRef.current.forEach(obs => {
      const h = 30; 
      
      if (obs.type === 1) { 
        drawSpikes(ctx, CANV_WIDTH/2 - 50, obs.y, 100, h);
      } 
      else if (obs.type === 2) { 
        drawSpikes(ctx, 0, obs.y, CANV_WIDTH/2 - 40, h);
        drawSpikes(ctx, CANV_WIDTH/2 + 40, obs.y, CANV_WIDTH/2 - 40, h);
      }
      else if (obs.type === 3) { 
        drawSpikes(ctx, 100, obs.y, CANV_WIDTH - 100, h);
      }
      else if (obs.type === 4) { 
        drawSpikes(ctx, 0, obs.y, CANV_WIDTH - 100, h);
      }
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white font-mono overflow-hidden relative">
      <style>{animationStyles}</style>

      {/* IMPRINTED BACKGROUND */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden select-none">
        <h1 className="text-[12rem] md:text-[20rem] font-black text-gray-800 opacity-50 transform -rotate-12 whitespace-nowrap blur-sm">
          SPIKE RUSH
        </h1>
      </div>

      {/* GAME WRAPPER */}
      <div className="relative z-10 flex flex-col items-center">
        
        {/* HOW TO PLAY BUTTON (ABOVE GAME) */}
        <div className="w-full flex justify-end mb-2">
            <button 
                onClick={() => setShowTutorial(true)}
                className="text-xs font-bold text-cyan-400/80 hover:text-cyan-300 border border-cyan-900 hover:border-cyan-400 bg-black/50 px-4 py-1.5 rounded-full transition-all flex items-center gap-2 backdrop-blur-md"
            >
                <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">?</span>
                HOW TO PLAY
            </button>
        </div>
      
        {/* GAME CANVAS CONTAINER */}
        <div className="relative border-4 border-gray-800 rounded-xl overflow-hidden shadow-2xl shadow-purple-900/50 w-[400px] h-[600px] bg-gray-900">
            <canvas 
            ref={canvasRef} 
            width={CANV_WIDTH} 
            height={CANV_HEIGHT}
            className="block w-full h-full"
            />

            {/* START SCREEN */}
            {uiState === "START" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20">
                <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-6 tracking-tighter">SPIKE RUSH</h2>
                <button 
                onClick={triggerStartSequence}
                className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded shadow-[0_0_20px_rgba(8,145,178,0.5)] transition-all transform hover:scale-105"
                >
                START GAME
                </button>
                <p className="mt-6 text-xs text-gray-500 font-mono">Press ENTER to Start</p>
            </div>
            )}

            {/* COUNTDOWN OVERLAY */}
            {uiState === "COUNTDOWN" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/95 z-30">
                <div className="text-9xl font-black text-white animate-ping">
                {countdown}
                </div>
            </div>
            )}

            {/* GAME OVER SCREEN */}
            {uiState === "GAME_OVER" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/90 z-20 backdrop-blur-sm">
                <h2 className="text-4xl font-black mb-2 tracking-widest text-white drop-shadow-lg">CRASHED</h2>
                <div className="text-center mb-8 bg-black/20 p-4 rounded-lg w-48 border border-white/10">
                <p className="text-xs text-gray-300 uppercase tracking-wider mb-1">Score</p>
                <p className="text-3xl font-bold text-white mb-2">{score}</p>
                <div className="h-px bg-white/20 w-full my-2"></div>
                <p className="text-xs text-gray-300 uppercase tracking-wider mb-1">Best</p>
                <p className="text-xl font-bold text-yellow-400">{highScore}</p>
                </div>
                <button 
                onClick={triggerStartSequence}
                className="px-8 py-3 bg-white text-red-900 font-bold rounded hover:bg-gray-100 shadow-xl transition-transform transform hover:scale-105"
                >
                RETRY
                </button>
                <p className="mt-4 text-xs text-red-200/70">Press ENTER to Retry</p>
            </div>
            )}

            {/* HUD */}
            {uiState === "PLAYING" && (
            <div className="absolute top-4 left-4 text-xl font-black text-white drop-shadow-lg z-10 italic">
                {score}
            </div>
            )}

            {/* HOW TO PLAY MODAL OVERLAY */}
            {showTutorial && (
                <div className="absolute inset-0 bg-black/95 z-50 flex flex-col p-4 overflow-y-auto backdrop-blur-xl no-scrollbar">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold text-cyan-300 tracking-wider">TUTORIAL</h2>
                            <p className="text-[10px] text-gray-500">Controls: A/D or Arrow Keys</p>
                        </div>
                        <button 
                            onClick={() => setShowTutorial(false)}
                            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-800 rounded"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    <div className="space-y-3 flex-grow">
                        <InstructionCard 
                            title="Center Spike"
                            spikeType="center"
                            animationClass="animate-blocks-split"
                            keys={<><KeyCap label="A" pressed/><KeyCap label="D" pressed/> <span className="ml-1 text-[10px] text-gray-500">(or Arrows)</span></>}
                        />
                        <InstructionCard 
                            title="Side Spikes"
                            spikeType="sides"
                            keys={<><KeyCap label="None" /> <span className="ml-1 text-[10px] text-gray-500">(Center)</span></>}
                        />
                        <InstructionCard 
                            title="Right Spike"
                            spikeType="right"
                            animationClass="animate-blocks-left"
                            keys={<><KeyCap label="A" pressed/> <span className="ml-1 text-[10px] text-gray-500">(or Left Arrow)</span></>}
                        />
                        <InstructionCard 
                            title="Left Spike"
                            spikeType="left"
                            animationClass="animate-blocks-right"
                            keys={<><KeyCap label="D" pressed/> <span className="ml-1 text-[10px] text-gray-500">(or Right Arrow)</span></>}
                        />
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}