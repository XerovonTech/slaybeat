
import React, { useState, useEffect, useRef } from 'react';
import { Monster, Note, PlayerStats, Weapon } from '../types';
import { CHARACTERS } from '../constants';
import { audioManager } from '../services/audioManager';

interface Props {
  monster: Monster;
  player: PlayerStats;
  onFinish: (result: 'WIN' | 'LOSE' | 'QUIT', stats: any) => void;
  weapons: Weapon[];
}

interface Projectile {
  id: number;
  icon: string;
  x: number;
  y: number;
  targetY: number;
}

interface DamageNumber {
  id: number;
  value: number;
  isCrit: boolean;
  x: number;
  y: number;
}

const LANES = [0, 1, 2, 3];
const LANE_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500'];
const HIT_THRESHOLD = 250; 
const JUDGMENT_Y = 82; 

export const GameEngine: React.FC<Props> = ({ monster, player, onFinish, weapons }) => {
  const activeWeapons = player.equipped.map(id => weapons.find(w => w.id === id)).filter(Boolean);
  const hpBonus = activeWeapons.reduce((acc, w) => acc + (w?.extraLives || 0), 0);
  
  const [mHealth, setMHealth] = useState(monster.maxHealth);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(7 + hpBonus); 
  const [notes, setNotes] = useState<Note[]>([]);
  const [started, setStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [dmgNums, setDmgNums] = useState<DamageNumber[]>([]);
  const [isShaking, setIsShaking] = useState(false);

  const requestRef = useRef<number | undefined>(undefined);
  const lastSpawnRef = useRef(0);
  const startRef = useRef(0);
  const currentMHealth = useRef(monster.maxHealth);

  const equippedChars = player.characters.equipped.map(id => CHARACTERS.find(c => c.id === id)).filter(Boolean);

  const playSFX = (type: 'hit' | 'miss' | 'crit') => {
    const urls = {
      hit: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      miss: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
      crit: 'https://assets.mixkit.co/active_storage/sfx/1110/1110-preview.mp3'
    };
    audioManager.playSound(urls[type]);
  };

  const applyDamage = (mult = 1) => {
    const wIdx = Math.floor(Math.random() * activeWeapons.length);
    const weapon = activeWeapons[wIdx];
    const isCrit = Math.random() < (weapon?.critChance || 0.1);
    const baseDamage = weapon?.damage || 100;
    const damageValue = (isCrit ? (weapon?.critMultiplier || 4.5) : 1) * baseDamage * (1 + (combo * 0.05)) * mult;
    
    currentMHealth.current = Math.max(0, currentMHealth.current - damageValue);
    setMHealth(currentMHealth.current);
    
    if (isCrit) playSFX('crit');

    setDmgNums(prev => [...prev, {
      id: Date.now() + Math.random(),
      value: Math.floor(damageValue),
      isCrit,
      x: 75 + (Math.random() * 5),
      y: 35 + (Math.random() * 15)
    }]);

    if (currentMHealth.current <= 0) {
      audioManager.stopMusic();
      onFinish('WIN', { exp: monster.expReward });
    }
    
    const charIdx = Math.floor(Math.random() * equippedChars.length);
    setProjectiles(p => [...p, { 
      id: Date.now() + Math.random(), 
      icon: weapon?.icon || '🗡️', 
      x: 15, 
      y: 15 + (charIdx * 18),
      targetY: 45 
    }]);
  };

  const gameLoop = () => {
    if (isPaused) {
        requestRef.current = requestAnimationFrame(gameLoop);
        return;
    }
    const now = Date.now();
    const elapsed = now - startRef.current;

    if (elapsed > monster.duration * 1000) {
      audioManager.stopMusic();
      return onFinish('LOSE', {});
    }

    const spawnRate = Math.max(120, 480 - (monster.level * 4));
    if (now - lastSpawnRef.current > spawnRate) {
      const burstCount = monster.level > 60 ? 3 : monster.level > 25 ? 2 : 1;
      const newNotes: Note[] = [];
      const usedLanes = new Set();
      
      for(let i=0; i < burstCount; i++) {
        let lane = Math.floor(Math.random() * 4);
        while(usedLanes.has(lane)) lane = Math.floor(Math.random() * 4);
        usedLanes.add(lane);
        newNotes.push({ id: Math.random(), lane, time: elapsed + 1500, type: 'single', hit: false, missed: false });
      }
      setNotes(prev => [...prev.filter(n => !n.hit && !n.missed), ...newNotes]);
      lastSpawnRef.current = now;
    }

    setNotes(prev => prev.map(n => {
      if (!n.hit && !n.missed && elapsed > n.time + 150) {
        setCombo(0);
        playSFX('miss');
        setLives(l => {
          if (l <= 1) {
            audioManager.stopMusic();
            onFinish('LOSE', {});
          }
          return l - 1;
        });
        return { ...n, missed: true };
      }
      return n;
    }));

    setProjectiles(prev => prev.map(p => {
        const dx = 80 - 15;
        const dy = p.targetY - p.y;
        return { ...p, x: p.x + 5, y: p.y + (dy / dx) * 5 };
    }).filter(p => p.x < 85));

    setDmgNums(prev => prev.map(d => ({ ...d, y: d.y - 0.8 })).filter(d => d.y > 0));
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const onHit = (lane: number) => {
    if (isPaused) return;
    const elapsed = Date.now() - startRef.current;
    setNotes(prev => {
      const hitIdx = prev.findIndex(n => n.lane === lane && !n.hit && !n.missed && Math.abs(n.time - elapsed) < HIT_THRESHOLD);
      if (hitIdx !== -1) {
        setCombo(c => c + 1);
        playSFX('hit');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 80);
        applyDamage(1);
        return prev.map((n, i) => i === hitIdx ? { ...n, hit: true } : n);
      }
      return prev;
    });
  };

  // Play music only on initial start
  useEffect(() => {
    if (started) {
      audioManager.playMusic(monster.songUrl, true, 0.4);
      startRef.current = Date.now();
    }
    return () => {
       // Stop music on unmount
       audioManager.stopMusic();
    };
  }, [started, monster.songUrl]);

  // Handle Pause/Resume separately to avoid restarting music
  useEffect(() => {
    if (!started) return;
    if (isPaused) {
      audioManager.pauseMusic();
    } else {
      audioManager.resumeMusic();
    }
  }, [isPaused, started]);

  useEffect(() => {
    if (started) requestRef.current = requestAnimationFrame(gameLoop);
    return () => { 
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [started, isPaused, notes]);

  if (!started) return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-950 p-6 text-center animate-in zoom-in">
      <img src={monster.image} className="w-48 h-48 drop-shadow-[0_0_30px_rgba(255,0,0,0.5)] mb-8" />
      <h2 className="bungee text-4xl text-red-500 mb-2 italic uppercase font-black">{monster.name}</h2>
      <p className="bungee text-slate-400 mb-12 text-sm tracking-widest uppercase font-black">HP: {monster.maxHealth.toLocaleString()}</p>
      <div className="flex gap-6 w-full px-4">
        <button onClick={() => { audioManager.stopMusic(); onFinish('QUIT', {}); }} className="flex-1 bg-slate-800 bungee py-5 rounded-2xl text-xl border-2 border-white/5 font-black">BACK</button>
        <button onClick={() => setStarted(true)} className="flex-[2] bg-red-600 bungee py-5 rounded-2xl text-2xl shadow-xl active:scale-95 transition-all font-black">ATTACK</button>
      </div>
    </div>
  );

  return (
    <div className="h-full relative bg-black flex flex-col overflow-hidden select-none touch-none">
      <div className="absolute top-6 left-6 z-[100] flex flex-col gap-2 pointer-events-none">
        <div className="bungee text-xs text-white/50 uppercase font-black">COMBO: {combo}</div>
      </div>

      <div className="absolute top-6 right-6 z-[100] flex gap-3">
        <button onClick={() => setIsPaused(!isPaused)} className="w-10 h-10 bg-white/10 rounded-full border-2 border-white/20 flex items-center justify-center text-white backdrop-blur-md">
          <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'} text-xs`}></i>
        </button>
        <button onClick={() => { audioManager.stopMusic(); onFinish('QUIT', {}); }} className="w-10 h-10 bg-red-600/20 rounded-full border-2 border-red-500/20 flex items-center justify-center text-white backdrop-blur-md">
          <i className="fas fa-times text-xs"></i>
        </button>
      </div>

      <div className={`h-[45%] relative bg-slate-900/30 flex items-center justify-end pr-12 border-b border-white/10 ${isShaking ? 'monster-vibrate' : ''}`}>
        <div className="absolute top-6 left-[10%] flex flex-col gap-4 z-50">
           {equippedChars.map((c, idx) => {
             const gender = player.characters.selectedGenders[c.id] || 'M';
             return <img key={idx} src={gender === 'F' ? (c.femaleImage || c.image) : c.image} className="w-12 h-12 rounded-full border-2 border-blue-500 bg-black shadow-2xl" />;
           })}
        </div>

        {projectiles.map(p => (
          <div key={p.id} className="absolute text-5xl pointer-events-none z-40 transition-transform" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <span className="drop-shadow-[0_0_15px_white]">{p.icon}</span>
          </div>
        ))}

        <img src={monster.image} className={`h-[85%] object-contain transition-all duration-300 drop-shadow-[0_0_50px_rgba(255,0,0,0.4)] ${isPaused ? 'grayscale blur-lg scale-90' : 'scale-110'}`} />
        
        <div className="absolute -bottom-10 right-12 z-[100] bungee text-2xl text-red-500 flex items-center gap-2 font-black italic">
          <i className="fas fa-heart animate-pulse"></i> {lives}
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-black/80 h-6 rounded-full border-2 border-white/10 overflow-hidden shadow-2xl">
           <div className="bg-gradient-to-r from-red-600 via-orange-400 to-red-600 h-full transition-all duration-300" style={{ width: `${(mHealth/monster.maxHealth)*100}%` }}></div>
           <div className="absolute inset-0 flex items-center justify-center bungee text-[8px] text-white tracking-widest uppercase font-black">{Math.floor(mHealth).toLocaleString()} / {monster.maxHealth.toLocaleString()}</div>
        </div>
      </div>

      <div className="h-[55%] flex bg-slate-950 relative">
        {LANES.map(l => (
          <div key={l} className="flex-1 border-r border-white/5 relative active:bg-white/10" onPointerDown={() => onHit(l)}>
            {notes.filter(n => n.lane === l && !n.hit && !n.missed).map(n => {
              const elapsed = Date.now() - startRef.current;
              const pos = ((elapsed - (n.time - 1500)) / 1500) * JUDGMENT_Y;
              return (
                <div key={n.id} className={`absolute w-16 h-16 left-1/2 -ml-8 rounded-[1.5rem] border-2 border-white/50 ${LANE_COLORS[l]} shadow-2xl flex items-center justify-center`} style={{ top: `${pos}%` }}>
                  <div className="w-6 h-6 border-4 border-white/20 rounded-full"></div>
                </div>
              );
            })}
            <div className={`absolute bottom-[18%] w-full h-1.5 bg-white/30 z-10 ${isPaused ? 'hidden' : ''} shadow-[0_0_15px_white]`}></div>
          </div>
        ))}
      </div>
    </div>
  );
};
