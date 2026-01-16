
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
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  progress: number; // 0 to 1
  damage: number;
  isCrit: boolean;
  trajectory: 'linear' | 'arc' | 'swirl';
  amplitude: number;
  frequency: number;
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
const HIT_THRESHOLD = 300; 

// Projectile settings
const PROJECTILE_SPEED = 0.08; // Progress per frame (approx 12 frames to hit)

export const GameEngine: React.FC<Props> = ({ monster, player, onFinish, weapons }) => {
  const activeWeapons = player.equipped.map(id => weapons.find(w => w.id === id)).filter(Boolean);
  const hpBonus = activeWeapons.reduce((acc, w) => acc + (w?.extraLives || 0), 0);
  
  // Dynamic Difficulty
  const fallDuration = Math.max(1.2, 5.0 - (monster.level * 0.08));
  const travelTime = fallDuration * 1000 * 0.46; 

  const [mHealth, setMHealth] = useState(monster.maxHealth);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(7 + hpBonus); 
  const [started, setStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // Render-specific state
  const [notesRender, setNotesRender] = useState<Note[]>([]); 
  const [dmgNums, setDmgNums] = useState<DamageNumber[]>([]);
  const [projectilesRender, setProjectilesRender] = useState<Projectile[]>([]);

  const notesRef = useRef<Note[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
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

  // 1. Calculate damage but don't apply yet
  // 2. Spawn projectile
  // 3. Apply damage on impact
  const spawnProjectile = (mult = 1) => {
    // 1. Select Character (Source) - Fallback to first char if empty (shouldn't happen but safe)
    const safeChars = equippedChars.length > 0 ? equippedChars : [CHARACTERS[0]];
    const charIndex = Math.floor(Math.random() * safeChars.length);
    const startX = 12; // 12% from left
    const startY = 15 + (charIndex * 12); // ~15% from top + offset per char

    // 2. Select Weapon & Calculate Stats
    let icon = '👊';
    let damageValue = 50;
    let isCrit = false;

    if (activeWeapons.length > 0) {
      const wIdx = Math.floor(Math.random() * activeWeapons.length);
      const weapon = activeWeapons[wIdx];
      if (weapon) {
        icon = weapon.icon || '⚔️';
        isCrit = Math.random() < (weapon.critChance || 0.1);
        
        let baseDamage = weapon.damage;
        if (typeof baseDamage !== 'number' || isNaN(baseDamage)) baseDamage = 100;
        
        damageValue = (isCrit ? (weapon.critMultiplier || 4.5) : 1) * baseDamage * (1 + (combo * 0.05)) * mult;
      }
    } else {
      // Fallback damage if no weapon equipped
      damageValue = 50 * (1 + (combo * 0.05)) * mult;
      isCrit = Math.random() < 0.05;
    }

    // 3. Determine Trajectory & Target
    const trajectoryTypes: Array<'linear' | 'arc' | 'swirl'> = ['linear', 'linear', 'arc', 'swirl'];
    const trajectory = trajectoryTypes[Math.floor(Math.random() * trajectoryTypes.length)];
    
    // Randomize target location on monster (approximate bounds)
    // Monster is usually right-aligned. Image is tall.
    // X: 65% - 85%
    // Y: 15% - 50%
    const targetX = 65 + Math.random() * 20;
    const targetY = 15 + Math.random() * 35;

    const amplitude = 5 + Math.random() * 10; // 5-15% height variation
    const frequency = 5 + Math.random() * 10; // For swirl

    const newProj: Projectile = {
        id: Math.random(),
        icon,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        targetX,
        targetY,
        progress: 0,
        damage: Math.floor(damageValue),
        isCrit,
        trajectory,
        amplitude,
        frequency
    };

    projectilesRef.current.push(newProj);
  };

  const triggerDamage = (damage: number, isCrit: boolean, x: number, y: number) => {
    currentMHealth.current = Math.max(0, currentMHealth.current - damage);
    setMHealth(currentMHealth.current);
    
    if (isCrit) playSFX('crit');

    setDmgNums(prev => [...prev, {
      id: Date.now() + Math.random(),
      value: damage,
      isCrit,
      x,
      y
    }]);

    setTimeout(() => {
        setDmgNums(prev => prev.slice(1));
    }, 1000);

    if (currentMHealth.current <= 0) {
      audioManager.stopMusic();
      onFinish('WIN', { exp: monster.expReward });
    }
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

    // --- Spawn Notes ---
    const spawnRate = Math.max(250, 1000 - (monster.level * 15));
    if (now - lastSpawnRef.current > spawnRate) {
      const burstCount = monster.level > 60 ? 3 : monster.level > 25 ? 2 : 1;
      const newNotes: Note[] = [];
      const usedLanes = new Set();
      for(let i=0; i < burstCount; i++) {
        let lane = Math.floor(Math.random() * 4);
        while(usedLanes.has(lane)) lane = Math.floor(Math.random() * 4);
        usedLanes.add(lane);
        newNotes.push({ 
            id: Math.random(), 
            lane, 
            time: elapsed + travelTime, 
            type: 'single', 
            hit: false, 
            missed: false 
        });
      }
      notesRef.current = [...notesRef.current, ...newNotes];
      setNotesRender([...notesRef.current]);
      lastSpawnRef.current = now;
    }

    // --- Update Projectiles ---
    const activeProjs: Projectile[] = [];
    projectilesRef.current.forEach(p => {
        p.progress += PROJECTILE_SPEED;
        
        // Base Linear Position
        const linearX = p.startX + ((p.targetX - p.startX) * p.progress);
        const linearY = p.startY + ((p.targetY - p.startY) * p.progress);
        
        if (p.trajectory === 'linear') {
            p.currentX = linearX;
            p.currentY = linearY;
        } else if (p.trajectory === 'arc') {
            // Parabolic Arc: Peaks at 0.5 progress
            // Offset goes UP (negative Y)
            const arcOffset = p.amplitude * 4 * p.progress * (1 - p.progress);
            p.currentX = linearX;
            p.currentY = linearY - arcOffset;
        } else if (p.trajectory === 'swirl') {
            // Sine wave perpendicular to travel (mostly Y axis modification)
            const swirlOffset = p.amplitude * Math.sin(p.progress * p.frequency);
            p.currentX = linearX;
            p.currentY = linearY + swirlOffset;
        }

        if (p.progress >= 1) {
            // Impact!
            triggerDamage(p.damage, p.isCrit, p.targetX, p.targetY);
        } else {
            activeProjs.push(p);
        }
    });
    projectilesRef.current = activeProjs;
    if (projectilesRef.current.length > 0 || projectilesRender.length > 0) {
        setProjectilesRender([...activeProjs]);
    }

    // --- Check Misses ---
    let stateChanged = false;
    notesRef.current.forEach(n => {
       if (!n.hit && !n.missed && elapsed > n.time + HIT_THRESHOLD) {
          n.missed = true;
          setCombo(0);
          playSFX('miss');
          setLives(l => {
             const newL = l - 1;
             if (newL <= 0) {
               audioManager.stopMusic();
               onFinish('LOSE', {});
             }
             return newL;
          });
          stateChanged = true;
       }
    });

    if (stateChanged) {
        setNotesRender(notesRef.current.filter(n => !n.hit));
        notesRef.current = notesRef.current.filter(n => elapsed < n.time + 1000); 
        setNotesRender([...notesRef.current]);
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const onHit = (lane: number) => {
    if (isPaused || !started) return;
    const elapsed = Date.now() - startRef.current;
    
    const hitNoteIndex = notesRef.current.findIndex(n => 
        n.lane === lane && 
        !n.hit && 
        !n.missed && 
        Math.abs(n.time - elapsed) < HIT_THRESHOLD
    );

    if (hitNoteIndex !== -1) {
       notesRef.current[hitNoteIndex].hit = true;
       setCombo(c => c + 1);
       playSFX('hit');
       
       // Trigger the visual projectile instead of instant damage
       spawnProjectile(1);
       
       setNotesRender([...notesRef.current]);
    }
  };

  useEffect(() => {
    if (started) {
      audioManager.playMusic(monster.songUrl, true, 0.4);
      startRef.current = Date.now();
      requestRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
       audioManager.stopMusic();
       if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [started]);

  useEffect(() => {
    if (!started) return;
    if (isPaused) audioManager.pauseMusic();
    else audioManager.resumeMusic();
  }, [isPaused, started]);

  if (!started) return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-950 p-6 text-center animate-in zoom-in">
      <div className="relative w-48 h-48 mb-8">
        <img 
            src={monster.image} 
            className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(255,0,0,0.5)]" 
            onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${monster.name}&background=random&color=fff&size=256`;
            }}
        />
      </div>
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
      <div className="absolute top-6 left-6 z-[100] flex flex-col gap-1 pointer-events-none">
        <div className="bungee text-4xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-600 italic font-black drop-shadow-lg">
          {combo > 1 ? `${combo}x` : ''}
        </div>
        {combo > 1 && <div className="bungee text-[10px] text-white/50 uppercase font-black tracking-widest pl-1">COMBO STREAK</div>}
      </div>

      <div className="absolute top-6 right-6 z-[100] flex gap-3">
        <button onClick={() => setIsPaused(!isPaused)} className="w-10 h-10 bg-white/10 rounded-full border-2 border-white/20 flex items-center justify-center text-white backdrop-blur-md">
          <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'} text-xs`}></i>
        </button>
        <button onClick={() => { audioManager.stopMusic(); onFinish('QUIT', {}); }} className="w-10 h-10 bg-red-600/20 rounded-full border-2 border-red-500/20 flex items-center justify-center text-white backdrop-blur-md">
          <i className="fas fa-times text-xs"></i>
        </button>
      </div>

      {/* Battle Arena */}
      <div className="h-[45%] relative bg-slate-900/30 flex items-center justify-end pr-12 border-b border-white/10 overflow-visible">
        
        {/* Equipped Team Members (Left Side) */}
        <div className="absolute top-6 left-[10%] flex flex-col gap-4 z-40">
           {equippedChars.map((c, idx) => {
             const gender = player.characters.selectedGenders[c.id] || 'M';
             return (
               <div key={idx} className="relative group">
                 <img src={gender === 'F' ? (c.femaleImage || c.image) : c.image} className="w-12 h-12 rounded-full border-2 border-blue-500 bg-black shadow-2xl relative z-10" />
                 {/* Shadow */}
                 <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/50 blur-sm rounded-full"></div>
               </div>
             );
           })}
        </div>

        {/* Projectiles */}
        {projectilesRender.map(p => (
            <div 
                key={p.id} 
                className="absolute z-50 text-2xl drop-shadow-lg transition-transform"
                style={{ 
                    left: `${p.currentX}%`, 
                    top: `${p.currentY}%`,
                    // Rotate projectile as it flies
                    transform: `rotate(${p.progress * 720}deg)`
                }}
            >
                {p.icon}
            </div>
        ))}

        {/* Damage Numbers (3D Text Effect) */}
        {dmgNums.map(d => (
          <div key={d.id} className="absolute pointer-events-none z-[60]" style={{ left: `${d.x}%`, top: `${d.y}%`, animation: 'float-up 0.8s ease-out forwards' }}>
            <span 
                className={`bungee text-4xl font-black italic tracking-tighter ${d.isCrit ? 'text-yellow-400' : 'text-white'}`}
                style={{
                    // Custom 3D text shadow stack
                    textShadow: d.isCrit 
                        ? '1px 1px 0px #b45309, 2px 2px 0px #b45309, 3px 3px 0px #78350f, 4px 4px 5px rgba(0,0,0,0.5)' 
                        : '1px 1px 0px #9ca3af, 2px 2px 0px #4b5563, 3px 3px 0px #1f2937, 4px 4px 5px rgba(0,0,0,0.5)'
                }}
            >
                {d.value.toLocaleString()}
            </span>
            {d.isCrit && <div className="bungee text-xs text-yellow-200 absolute -top-4 left-0 w-full text-center animate-bounce font-black">CRITICAL!</div>}
          </div>
        ))}

        {/* Monster */}
        <div className="relative z-10 h-full flex items-center justify-center w-1/2 ml-auto">
            <img 
                src={monster.image} 
                className={`h-[85%] w-auto max-w-full object-contain transition-all duration-300 drop-shadow-[0_0_50px_rgba(255,0,0,0.4)] ${isPaused ? 'grayscale blur-lg scale-90' : 'scale-110'}`} 
                onError={(e) => {
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${monster.name}&background=random&color=fff&size=512`;
                }}
            />
        </div>
        
        <div className="absolute -bottom-10 right-12 z-[100] bungee text-2xl text-red-500 flex items-center gap-2 font-black italic">
          <i className="fas fa-heart animate-pulse"></i> {lives}
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-black/80 h-6 rounded-full border-2 border-white/10 overflow-hidden shadow-2xl z-50">
           <div className="bg-gradient-to-r from-red-600 via-orange-400 to-red-600 h-full transition-all duration-300" style={{ width: `${(mHealth/monster.maxHealth)*100}%` }}></div>
           <div className="absolute inset-0 flex items-center justify-center bungee text-[8px] text-white tracking-widest uppercase font-black">{Math.floor(mHealth).toLocaleString()} / {monster.maxHealth.toLocaleString()}</div>
        </div>
      </div>

      {/* Lanes Area */}
      <div className="h-[55%] flex bg-slate-950 relative">
        {LANES.map(l => (
          <div key={l} className="flex-1 border-r border-white/5 relative active:bg-white/10 touch-manipulation" onPointerDown={(e) => { e.preventDefault(); onHit(l); }}>
            {notesRender.filter(n => n.lane === l && !n.hit).map(n => (
                <div 
                    key={n.id} 
                    className={`absolute w-16 h-16 left-1/2 -ml-8 rounded-[1.5rem] border-2 border-white/50 ${LANE_COLORS[l]} shadow-2xl flex items-center justify-center`} 
                    style={{ 
                        animation: `fall ${fallDuration}s linear forwards`, 
                        animationPlayState: isPaused ? 'paused' : 'running'
                    }}
                >
                  <div className="w-6 h-6 border-4 border-white/20 rounded-full"></div>
                </div>
            ))}
            <div className={`absolute bottom-[18%] w-full h-1.5 bg-white/30 z-10 ${isPaused ? 'hidden' : ''} shadow-[0_0_15px_white]`}></div>
          </div>
        ))}
      </div>
    </div>
  );
};
