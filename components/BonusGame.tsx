
import React, { useState, useEffect, useRef } from 'react';
import { audioManager } from '../services/audioManager';

interface BonusItem {
  id: number;
  angle: number;
  distance: number;
  speed: number;
  type: 'common' | 'basic' | 'premium' | 'bomb';
  scale: number;
}

interface Props {
  onFinish: (keys: { common: number, basic: number, premium: number }) => void;
}

export const BonusGame: React.FC<Props> = ({ onFinish }) => {
  const [items, setItems] = useState<BonusItem[]>([]);
  const [collected, setCollected] = useState({ common: 0, basic: 0, premium: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const requestRef = useRef<number | undefined>(undefined);
  const lastSpawnRef = useRef<number>(0);

  const spawnItem = (time: number) => {
    const roll = Math.random();
    let type: BonusItem['type'] = 'bomb';
    
    if (roll < 0.40) type = 'common';
    else if (roll < 0.65) type = 'basic';
    else if (roll < 0.75) type = 'premium';
    else type = 'bomb';

    setItems(prev => [...prev, {
      id: Math.random(),
      angle: Math.random() * Math.PI * 2,
      distance: 0,
      speed: 2.5 + Math.random() * 4.5,
      type,
      scale: 1.5 + Math.random() * 0.5
    }]);
    lastSpawnRef.current = time;
  };

  const update = (time: number) => {
    if (gameOver) return;

    if (time - lastSpawnRef.current > 250) {
      spawnItem(time);
    }

    setItems(prev => prev.filter(item => item.distance < 600).map(item => ({
      ...item,
      distance: item.distance + item.speed,
      angle: item.angle + 0.015
    })));

    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    audioManager.playMusic('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', true, 0.3);
    requestRef.current = requestAnimationFrame(update);
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      clearInterval(timer);
      audioManager.stopMusic();
    };
  }, [gameOver]);

  const handleCatch = (id: number, type: BonusItem['type']) => {
    if (gameOver) return;
    if (type === 'bomb') {
      setGameOver(true);
      audioManager.playSound('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3');
    } else {
      setCollected(c => ({ ...c, [type]: c[type] + 1 }));
      setItems(prev => prev.filter(i => i.id !== id));
      audioManager.playSound('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
    }
  };

  return (
    <div className="h-full w-full bg-[#020617] relative overflow-hidden flex items-center justify-center select-none touch-action-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1e1b4b_0%,_transparent_70%)] opacity-40"></div>
      
      <div className="absolute top-16 text-center z-50">
        <h2 className="bungee text-5xl text-red-500 animate-pulse tracking-tighter drop-shadow-[0_0_20px_red] font-black italic">VOID RUSH</h2>
        <div className="bungee text-7xl text-white mt-2 drop-shadow-lg font-black">{timeLeft}s</div>
      </div>

      <div className="w-48 h-48 bg-red-900 rounded-full shadow-[0_0_180px_80px_red] animate-pulse absolute z-0 opacity-40"></div>
      <div className="w-32 h-32 bg-black rounded-full z-10 border-4 border-red-500/50 shadow-inner flex items-center justify-center">
         <div className="w-full h-full rounded-full animate-spin border-t-4 border-white/40"></div>
      </div>

      {items.map(item => {
        const x = Math.cos(item.angle) * item.distance;
        const y = Math.sin(item.angle) * item.distance;
        const icon = item.type === 'common' ? '🟡' : item.type === 'basic' ? '🟢' : item.type === 'premium' ? '🔴' : '💣';
        return (
          <div
            key={item.id}
            onPointerDown={() => handleCatch(item.id, item.type)}
            className="absolute cursor-pointer transition-transform hover:scale-150 z-20 flex items-center justify-center group"
            style={{ 
              transform: `translate(${x}px, ${y}px) scale(${item.scale})`,
              fontSize: '5rem' 
            }}
          >
            <span className="drop-shadow-[0_0_25px_rgba(255,255,255,0.8)] group-active:scale-90 transition-transform">{icon}</span>
          </div>
        );
      })}

      {gameOver && (
        <div className="absolute inset-0 bg-black/98 z-[200] flex flex-col items-center justify-center p-8 animate-in zoom-in backdrop-blur-3xl">
          <h2 className="bungee text-6xl text-red-500 mb-2 italic tracking-tighter drop-shadow-[0_0_15px_red] font-black">VOID SECURED</h2>
          <p className="bungee text-slate-500 text-[10px] mb-12 tracking-widest uppercase font-black">LOOT TRANSFERRED TO INVENTORY</p>
          
          <div className="grid grid-cols-3 gap-10 mb-16">
            <div className="flex flex-col items-center">
              <div className="text-7xl mb-4 drop-shadow-[0_0_15px_yellow]">🟡</div>
              <div className="bungee text-4xl text-white font-black">{collected.common}</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-7xl mb-4 drop-shadow-[0_0_15px_green]">🟢</div>
              <div className="bungee text-4xl text-white font-black">{collected.basic}</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-7xl mb-4 drop-shadow-[0_0_15px_red]">🔴</div>
              <div className="bungee text-4xl text-white font-black">{collected.premium}</div>
            </div>
          </div>

          <button 
            onClick={() => onFinish(collected)} 
            className="bg-red-600 text-white bungee px-16 py-6 rounded-[3rem] text-4xl shadow-2xl active:scale-95 transition-all hover:bg-red-500 border-b-8 border-red-800 font-black"
          >
            GET REWARDS
          </button>
        </div>
      )}
    </div>
  );
};
