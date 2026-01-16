
import React, { useState, useEffect } from 'react';
import { GameView, GameState, PlayerStats, Weapon, Monster, Character } from './types';
import { 
  INITIAL_PLAYER_STATS, 
  MONSTERS, 
  LOOTBOX_PRICES, 
  LOOTBOX_KEY_PRICES, 
  WEAPON_INDEX, 
  CHARACTERS, 
  DAILY_CARDS 
} from './constants';
import { GameEngine } from './components/GameEngine';
import { BonusGame } from './components/BonusGame';
import { firebaseService, LeaderboardEntry } from './services/firebaseService';
import { audioManager } from './services/audioManager';

const GlobalHUD: React.FC<{ player: PlayerStats }> = ({ player }) => (
  <div className="flex flex-col items-end gap-2 pointer-events-none relative z-50">
    <div className="bg-slate-900/95 px-4 py-2 rounded-2xl border-2 border-white/10 bungee text-yellow-500 text-sm shadow-xl flex items-center gap-2 backdrop-blur-md">
      <span className="text-lg">💰</span>
      <span>{player.coins.toLocaleString()}</span>
    </div>
    <div className="flex gap-2 bg-slate-900/95 p-2 rounded-2xl border-2 border-white/10 bungee text-xs shadow-xl backdrop-blur-sm">
      <span className="text-yellow-400">🟡 {player.keys.common}</span>
      <span className="text-green-400">🟢 {player.keys.basic}</span>
      <span className="text-red-400">🔴 {player.keys.premium}</span>
    </div>
  </div>
);

const RANK_CYCLE_HOURS = 7;
const RANK_CYCLE_MS = RANK_CYCLE_HOURS * 60 * 60 * 1000;

const TIPS = [
  "💡 TIP: Buy new weapons from lootboxes to increase power!",
  "💡 TIP: Upgrade weapons in the Armory for massive damage!",
  "💡 TIP: Perfect combos grant bonus damage multiplier!",
  "💡 TIP: Daily Vault rewards reset every 12 hours!",
  "💡 TIP: Recruit more characters to unlock team bonuses!",
  "💡 TIP: Hold notes deal 3x damage over time!"
];

type NotificationType = 'success' | 'error' | 'info';
interface Notification {
  message: string;
  type: NotificationType;
  id: number;
}

const App: React.FC = () => {
  const [isGameStarted, setIsGameStarted] = useState(false);
  
  // Custom Notification State
  const [notification, setNotification] = useState<Notification | null>(null);

  const showNotification = (message: string, type: NotificationType = 'info') => {
    setNotification({ message, type, id: Date.now() });
    
    // SFX for notifications
    if (type === 'error') {
       audioManager.playSound('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3', 0.5);
    } else if (type === 'success') {
       audioManager.playSound('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3', 0.5);
    }

    setTimeout(() => {
      setNotification(prev => prev && prev.message === message ? null : prev);
    }, 3000);
  };

  const [state, setState] = useState<GameState>(() => {
    const saved = localStorage.getItem('slay-beat-v220');
    let parsed = saved ? JSON.parse(saved) : { view: GameView.START, player: { ...INITIAL_PLAYER_STATS, lives: 30 }, currentLevel: null };
    
    // SANITIZATION: Fix NaN weapons on load
    if (parsed.player && Array.isArray(parsed.player.inventory)) {
      parsed.player.inventory = parsed.player.inventory.map((w: any) => {
         let dmg = w.damage;
         // Check if damage is broken (NaN, null, undefined, or not finite)
         if (typeof dmg !== 'number' || isNaN(dmg) || !isFinite(dmg)) {
            // Attempt to restore from catalog based on name
            const catalogItem = WEAPON_INDEX.find(ci => ci.name === w.name);
            if (catalogItem) {
               dmg = catalogItem.damage;
               // Re-apply level scaling if weapon was leveled up
               if ((w.level || 1) > 1) {
                  dmg = Math.floor(dmg * Math.pow(1.15, (w.level || 1) - 1));
               }
            } else {
               dmg = 500; // Fallback only if not found in catalog
            }
         }
         return { 
           ...w, 
           damage: dmg, 
           level: (typeof w.level !== 'number' || isNaN(w.level)) ? 1 : w.level 
         };
      });
    }
    return parsed;
  });

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rankTab, setRankTab] = useState<'points' | 'coins' | 'level'>('points');
  const [showDaily, setShowDaily] = useState(false);
  const [revealedDaily, setRevealedDaily] = useState<number | null>(null);
  const [showWeaponIndex, setShowWeaponIndex] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showRewardInfo, setShowRewardInfo] = useState(false);
  const [shopTab, setShopTab] = useState<'lootboxes' | 'characters'>('lootboxes');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(state.player.username);
  const [weaponToDelete, setWeaponToDelete] = useState<Weapon | null>(null);
  const [tipIndex, setTipIndex] = useState(0);

  const [lastClaimedCycle, setLastClaimedCycle] = useState<number>(() => {
    const saved = localStorage.getItem('last_rank_cycle_claim');
    return saved ? parseInt(saved) : 0;
  });

  const [time, setTime] = useState(Date.now());

  useEffect(() => {
    audioManager.setSettings(state.player.settings.musicEnabled, state.player.settings.soundEnabled);
    if (!isGameStarted || state.view === GameView.START) {
      audioManager.playMusic('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', true, 0.25);
    }
    if (state.view === GameView.LEADERBOARD) {
      firebaseService.getTopScores().then(setLeaderboard);
    }
  }, [state.view, isGameStarted]);

  useEffect(() => {
    const timer = setInterval(() => setTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const tipTimer = setInterval(() => {
      setTipIndex(prev => (prev + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(tipTimer);
  }, []);

  useEffect(() => {
    localStorage.setItem('slay-beat-v220', JSON.stringify(state));
    firebaseService.submitScore({
      username: state.player.username,
      score: state.player.stagePoints,
      level: state.player.level,
      coins: state.player.coins
    });
  }, [state.player]);

  const updatePlayer = (updates: Partial<PlayerStats>) => {
    setState(prev => {
      let nextPlayer = { ...prev.player, ...updates };
      while (nextPlayer.exp >= nextPlayer.expNeeded) {
        nextPlayer.exp -= nextPlayer.expNeeded;
        nextPlayer.level += 1;
        nextPlayer.expNeeded = Math.floor(nextPlayer.expNeeded * 1.12);
      }
      return { ...prev, player: nextPlayer };
    });
  };

  const saveName = () => {
    if (tempName.trim().length < 3) return showNotification("Name too short!", 'error');
    updatePlayer({ username: tempName });
    setIsEditingName(false);
    showNotification("Username updated!", 'success');
  };

  const upgradeWeapon = (weaponId: string) => {
    const weapon = state.player.inventory.find(w => w.id === weaponId);
    if (!weapon || (weapon.level || 1) >= 50) return showNotification("Max level reached!", 'error');
    const cost = (weapon.level || 1) * 2500;
    if (state.player.coins < cost) return showNotification(`Need ${cost.toLocaleString()} coins!`, 'error');

    audioManager.playSound('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
    updatePlayer({
      coins: state.player.coins - cost,
      inventory: state.player.inventory.map(w => 
        w.id === weaponId 
          ? { ...w, level: (w.level || 1) + 1, damage: Math.floor(w.damage * 1.15) } 
          : w
      )
    });
    showNotification("Weapon Upgraded!", 'success');
  };

  const deleteWeaponPermanently = () => {
    if (!weaponToDelete) return;
    if (state.player.equipped.includes(weaponToDelete.id)) {
      showNotification("Cannot delete an equipped weapon!", 'error');
      setWeaponToDelete(null);
      return;
    }
    updatePlayer({ inventory: state.player.inventory.filter(w => w.id !== weaponToDelete.id) });
    setWeaponToDelete(null);
    audioManager.playSound('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3');
    showNotification("Weapon Dismantled", 'info');
  };

  const openBox = (tier: string) => {
    const p = state.player;
    const price = (LOOTBOX_PRICES as any)[tier];
    const kReq = (LOOTBOX_KEY_PRICES as any)[tier];

    if (p.coins < price) return showNotification("Insufficient coins!", 'error');

    if (kReq.combo) {
      if (p.keys.common < kReq.requirements.common || p.keys.basic < kReq.requirements.basic || p.keys.premium < kReq.requirements.premium) {
        return showNotification(`Need: ${kReq.requirements.common}🟡 ${kReq.requirements.basic}🟢 ${kReq.requirements.premium}🔴`, 'error');
      }
    } else if (kReq.amount && (p.keys as any)[kReq.type] < kReq.amount) {
      return showNotification(`Need ${kReq.amount} ${kReq.icon} Keys!`, 'error');
    }

    let newKeys = { ...p.keys };
    if (kReq.combo) {
      newKeys.common -= kReq.requirements.common;
      newKeys.basic -= kReq.requirements.basic;
      newKeys.premium -= kReq.requirements.premium;
    } else if (kReq.amount) {
      (newKeys as any)[kReq.type] -= kReq.amount;
    }

    audioManager.playSound('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
    
    if (tier === 'char_box') {
      const success = Math.random() < 0.6;
      if (!success) {
        updatePlayer({ coins: p.coins - price, keys: newKeys });
        return showNotification("Recruitment failed!", 'error');
      }
      const char = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
      const currentFrags = p.characters.fragments[char.id] || 0;
      const newFrags = Math.min(10, currentFrags + 1);
      const unlockedNow = newFrags === 10 && !p.characters.unlocked.includes(char.id);

      updatePlayer({
        coins: p.coins - price,
        keys: newKeys,
        characters: {
          ...p.characters,
          unlocked: unlockedNow ? Array.from(new Set([...p.characters.unlocked, char.id])) : p.characters.unlocked,
          fragments: { ...p.characters.fragments, [char.id]: newFrags }
        }
      });
      showNotification(`Fragment: ${char.name} (${newFrags}/10)`, 'success');
    } else {
      const pool = WEAPON_INDEX.filter(w => w.rarity.toLowerCase() === tier.replace('_', '').toLowerCase());
      const reward = pool[Math.floor(Math.random() * pool.length)];
      // Ensure new weapon has valid damage
      const safeReward = { ...reward, damage: isNaN(reward.damage) ? 500 : reward.damage };
      
      updatePlayer({ coins: p.coins - price, keys: newKeys, inventory: [...p.inventory, { ...safeReward, id: Date.now().toString(), level: 1 }] });
      showNotification(`UNBOXED: ${reward.name}`, 'success');
    }
  };

  const getCurrentCycleId = () => Math.floor(Date.now() / RANK_CYCLE_MS);
  const getNextCycleTime = () => (getCurrentCycleId() + 1) * RANK_CYCLE_MS;
  const canClaimRank = () => getCurrentCycleId() > lastClaimedCycle;

  const getRankRewards = (rank: number) => {
    if (rank === 1) return { coins: 5000000, keys: { common: 500, basic: 250, premium: 100 } };
    if (rank <= 3) return { coins: 2500000, keys: { common: 300, basic: 150, premium: 50 } };
    if (rank <= 10) return { coins: 1000000, keys: { common: 150, basic: 75, premium: 25 } };
    if (rank <= 50) return { coins: 500000, keys: { common: 100, basic: 50, premium: 10 } };
    return { coins: 100000, keys: { common: 50, basic: 10, premium: 0 } };
  };

  const claimRankReward = () => {
    if (!canClaimRank()) return showNotification("Wait for cycle reset!", 'error');
    
    const sorted = [...leaderboard].sort((a,b) => {
       const valA = (a as any)[rankTab === 'points' ? 'score' : rankTab] || 0;
       const valB = (b as any)[rankTab === 'points' ? 'score' : rankTab] || 0;
       return valB - valA;
    });

    const myRankIndex = sorted.findIndex(e => e.username === state.player.username);
    if (myRankIndex === -1) return showNotification("Play a stage to get ranked!", 'error');
    
    const rank = myRankIndex + 1;
    const rewards = getRankRewards(rank);

    updatePlayer({
      coins: state.player.coins + rewards.coins,
      keys: {
        common: state.player.keys.common + rewards.keys.common,
        basic: state.player.keys.basic + rewards.keys.basic,
        premium: state.player.keys.premium + rewards.keys.premium
      }
    });

    const currentCycle = getCurrentCycleId();
    setLastClaimedCycle(currentCycle);
    localStorage.setItem('last_rank_cycle_claim', currentCycle.toString());

    audioManager.playSound('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
    showNotification(`CLAIMED RANK #${rank} REWARDS!`, 'success');
  };

  const getCountdownString = () => {
    const diff = getNextCycleTime() - time;
    if (diff < 0) return "00:00:00";
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  // RENDER HELPERS
  const renderNotification = () => {
    if (!notification) return null;
    return (
      <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border-2 backdrop-blur-md animate-in slide-in-from-top fade-in duration-300 ${
        notification.type === 'error' ? 'bg-red-950/90 border-red-500 text-red-100' :
        notification.type === 'success' ? 'bg-green-950/90 border-green-500 text-green-100' :
        'bg-slate-800/90 border-blue-500 text-blue-100'
      }`}>
        <i className={`fas ${
          notification.type === 'error' ? 'fa-exclamation-triangle' :
          notification.type === 'success' ? 'fa-check-circle' :
          'fa-info-circle'
        } text-xl`}></i>
        <span className="bungee text-xs font-black tracking-wide uppercase">{notification.message}</span>
      </div>
    );
  };

  if (!isGameStarted) {
    return (
      <div className="h-screen w-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
        <div className="mb-12 relative">
          <h1 className="text-8xl bungee three-d-text italic tracking-tighter leading-none animate-bounce">SLAY<br/><span className="text-red-600">BEAT</span></h1>
          <div className="absolute -top-10 -right-10 text-4xl rotate-12">⚔️</div>
          <div className="absolute -bottom-5 -left-10 text-4xl -rotate-12">🎧</div>
        </div>
        <button 
          onClick={() => { setIsGameStarted(true); audioManager.playSound('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'); }}
          className="bg-red-600 bungee text-5xl px-16 py-8 rounded-[3rem] shadow-[0_12px_0_rgb(153,27,27)] active:translate-y-2 border-b-2 border-white/20 font-black hover:bg-red-500 transition-all"
        >
          START GAME
        </button>
        <p className="mt-12 bungee text-xs text-slate-500 uppercase tracking-widest font-black animate-pulse">Touch to enter the arena</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-[#020617] text-white overflow-hidden flex justify-center items-center font-['Inter'] touch-none">
      <div className="w-full h-full max-w-md flex flex-col relative overflow-hidden bg-slate-950 shadow-2xl border-x border-white/10">
        
        {renderNotification()}

        {state.view === GameView.START && (
          <div className="flex flex-col h-full p-4 animate-in fade-in relative">
            <div className="flex justify-between items-start z-20 mb-6 h-20 shrink-0">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-xl border border-white/10 bungee text-[10px]">
                   {isEditingName ? (
                     <div className="flex items-center gap-2">
                       <input autoFocus className="bg-slate-800 border-none outline-none text-white px-1 w-24 rounded font-black" value={tempName} onChange={(e) => setTempName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName()} />
                       <button onClick={saveName} className="text-green-400"><i className="fas fa-check"></i></button>
                     </div>
                   ) : (
                     <div className="flex items-center gap-2">
                       <span className="text-blue-400 font-black">@{state.player.username}</span>
                       <button onClick={() => { setIsEditingName(true); setTempName(state.player.username); }} className="text-white/30 hover:text-white transition-colors"><i className="fas fa-edit text-[8px]"></i></button>
                     </div>
                   )}
                </div>
                <div className="bungee text-[9px] text-white/50 uppercase px-2 font-black">LVL {state.player.level}</div>
              </div>
              <div className="flex flex-col items-center gap-2">
                 <button onClick={() => setShowDaily(true)} className="bg-yellow-500 text-black bungee px-4 py-2 rounded-full text-[11px] animate-bounce shadow-xl font-black">DAILY VAULT</button>
              </div>
              <GlobalHUD player={state.player} />
            </div>

            <div className="flex-grow flex flex-col items-center justify-center -mt-10">
              <h1 className="text-8xl bungee three-d-text italic tracking-tighter text-center leading-none">SLAY<br/><span className="text-red-600">BEAT</span></h1>
              
              {/* Rotating Tips */}
              <div className="mt-8 px-6 py-2 bg-white/5 rounded-full border border-white/10 animate-fade-in key-{tipIndex}">
                 <p className="bungee text-[9px] text-slate-300 text-center font-black uppercase tracking-wider">{TIPS[tipIndex]}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 w-full px-4 mt-8">
                <button onClick={() => setState(p => ({ ...p, view: GameView.LEVEL_SELECT }))} className="bg-red-600 bungee text-5xl py-8 rounded-[3rem] shadow-[0_12px_0_rgb(153,27,27)] active:translate-y-2 border-b-2 border-white/20 font-black">ATTACK</button>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setState(p => ({ ...p, view: GameView.TEAM }))} className="bg-slate-900 py-5 rounded-2xl border-2 border-white/5 bungee text-sm hover:bg-slate-800 font-black">TEAM</button>
                  <button onClick={() => setState(p => ({ ...p, view: GameView.SHOP }))} className="bg-slate-900 py-5 rounded-2xl border-2 border-white/5 bungee text-sm hover:bg-slate-800 font-black">MARKET</button>
                  <button onClick={() => setState(p => ({ ...p, view: GameView.INVENTORY }))} className="bg-slate-900 py-5 rounded-2xl border-2 border-white/5 bungee text-sm hover:bg-slate-800 font-black">ARMORY</button>
                  <button onClick={() => setState(p => ({ ...p, view: GameView.LEADERBOARD }))} className="bg-slate-900 py-5 rounded-2xl border-2 border-white/5 bungee text-sm hover:bg-slate-800 font-black">RANKING</button>
                </div>
                <button onClick={() => setShowHowToPlay(true)} className="bungee text-[10px] text-white/40 hover:text-white uppercase tracking-widest mt-4">How to Play</button>
              </div>
            </div>
          </div>
        )}

        {state.view === GameView.INVENTORY && (
          <div className="h-full flex flex-col p-4 bg-slate-950 overflow-hidden animate-in slide-in-from-right">
             <div className="flex justify-between items-center mb-6 shrink-0">
               <button onClick={() => setState(p => ({ ...p, view: GameView.START }))} className="bungee text-xs bg-slate-800 px-6 py-3 rounded-xl border-2 border-white/10 font-black">BACK</button>
               <button onClick={() => setShowWeaponIndex(true)} className="bungee text-[10px] bg-red-600 px-5 py-3 rounded-xl shadow-lg font-black uppercase">Weapon Index</button>
               <GlobalHUD player={state.player} />
             </div>
             <div className="flex-grow overflow-y-auto custom-scrollbar grid grid-cols-2 gap-4 pb-32 pr-1">
               {state.player.inventory.length > 0 ? state.player.inventory.map(w => {
                 const equippedIdx = state.player.equipped.indexOf(w.id);
                 const upgradeCost = (w.level || 1) * 2500;
                 return (
                   <div key={w.id} className={`p-5 rounded-[2.5rem] border-2 flex flex-col items-center bg-slate-900/40 shadow-xl transition-all relative ${equippedIdx !== -1 ? 'border-red-600' : 'border-white/5'}`}>
                      <button 
                        onClick={() => setWeaponToDelete(w)}
                        className={`absolute top-4 right-4 text-xs ${equippedIdx !== -1 ? 'text-slate-700 cursor-not-allowed opacity-20' : 'text-slate-500 hover:text-red-500'} transition-colors`}
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                      <div className="text-4xl mb-3">{w.icon}</div>
                      <div className="bungee text-[10px] text-white truncate text-center mb-1 font-black uppercase">{w.name}</div>
                      <div className="bungee text-[7px] text-slate-500 mb-0.5 font-black uppercase tracking-tighter">Damage: {Math.floor(w.damage).toLocaleString()}</div>
                      <div className="bungee text-[7px] text-yellow-400 mb-0.5 font-black uppercase tracking-tighter">Crit: {Math.floor(w.critChance * 100)}%</div>
                      <div className="bungee text-[7px] text-red-400 mb-3 font-black uppercase tracking-tighter">HP: +{w.extraLives}</div>
                      <div className="bungee text-[7px] text-blue-400 mb-3 font-black uppercase">LVL: {w.level || 1}/50</div>
                      <button onClick={() => upgradeWeapon(w.id)} className="w-full py-2 mb-2 bg-green-600/20 text-green-400 border border-green-500/30 rounded-lg bungee text-[7px] uppercase font-black">Upgrade ({upgradeCost.toLocaleString()}💰)</button>
                      <button onClick={() => {
                        const current = [...state.player.equipped];
                        if (equippedIdx !== -1) current.splice(equippedIdx, 1);
                        else if (current.length < 4) current.push(w.id);
                        updatePlayer({ equipped: current });
                      }} className={`w-full py-3 rounded-xl bungee text-[8px] font-black ${equippedIdx !== -1 ? 'bg-red-600' : 'bg-blue-600'}`}>{equippedIdx !== -1 ? 'REMOVE' : 'EQUIP'}</button>
                   </div>
                 );
               }) : <div className="col-span-2 text-center py-20"><p className="bungee text-xs text-white/20 uppercase font-black">No weapons found.<br/>Visit the market!</p></div>}
             </div>
          </div>
        )}

        {state.view === GameView.TEAM && (
          <div className="h-full flex flex-col p-4 bg-slate-950 overflow-hidden animate-in slide-in-from-right">
             <div className="flex justify-between items-center mb-6 shrink-0">
               <button onClick={() => setState(p => ({ ...p, view: GameView.START }))} className="bungee text-xs bg-slate-800 px-6 py-3 rounded-xl border-2 border-white/10 font-black">BACK</button>
               <h2 className="bungee text-2xl text-blue-400 italic font-black uppercase">TEAM</h2>
               <GlobalHUD player={state.player} />
             </div>
             <div className="flex-grow overflow-y-auto custom-scrollbar grid grid-cols-2 gap-4 pb-32 pr-1">
               {CHARACTERS.map(c => {
                 const fragments = state.player.characters.fragments[c.id] || 0;
                 const isUnlocked = state.player.characters.unlocked.includes(c.id);
                 const equippedIdx = state.player.characters.equipped.indexOf(c.id);
                 const selectedGender = state.player.characters.selectedGenders[c.id] || 'M';
                 
                 return (
                   <div key={c.id} className={`p-4 rounded-[2.5rem] border-2 transition-all flex flex-col items-center relative ${isUnlocked ? (equippedIdx !== -1 ? 'border-blue-500 bg-blue-900/20' : 'border-white/10 bg-slate-900/40') : 'border-white/5 opacity-50 grayscale'}`}>
                      <img src={selectedGender === 'M' ? c.image : (c.femaleImage || c.image)} className="w-16 h-16 rounded-full mb-2 bg-slate-800 border border-white/10" />
                      <div className="bungee text-[10px] text-white text-center mb-1 font-black uppercase">{c.name}</div>
                      <div className="bungee text-[7px] text-blue-400 mb-2 font-black">{fragments}/10 SHARDS</div>
                      
                      {isUnlocked && (
                        <div className="flex gap-2 mb-3">
                           <button onClick={() => updatePlayer({ characters: { ...state.player.characters, selectedGenders: { ...state.player.characters.selectedGenders, [c.id]: 'M' } } })} className={`px-2 py-0.5 rounded bungee text-[7px] font-black ${selectedGender === 'M' ? 'bg-blue-600' : 'bg-slate-800'}`}>MALE</button>
                           <button onClick={() => updatePlayer({ characters: { ...state.player.characters, selectedGenders: { ...state.player.characters.selectedGenders, [c.id]: 'F' } } })} className={`px-2 py-0.5 rounded bungee text-[7px] font-black ${selectedGender === 'F' ? 'bg-pink-600' : 'bg-slate-800'}`}>FEMALE</button>
                        </div>
                      )}

                      {isUnlocked ? (
                        <button onClick={() => {
                          const current = [...state.player.characters.equipped];
                          if (equippedIdx !== -1) current.splice(equippedIdx, 1);
                          else if (current.length < 4) current.push(c.id);
                          updatePlayer({ characters: { ...state.player.characters, equipped: current } });
                        }} className={`w-full py-2 rounded-xl bungee text-[8px] font-black ${equippedIdx !== -1 ? 'bg-red-600' : 'bg-blue-600'}`}>
                          {equippedIdx !== -1 ? 'REMOVE' : 'EQUIP'}
                        </button>
                      ) : (
                        <div className="w-full py-2 bg-slate-800 rounded-xl bungee text-[7px] text-center uppercase font-black">LOCKED</div>
                      )}
                   </div>
                 );
               })}
             </div>
          </div>
        )}

        {/* MODAL: PERMANENT WEAPON DISMANTLE */}
        {weaponToDelete && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in">
            <div className="bg-slate-950 border-2 border-red-600/50 p-10 rounded-[4rem] w-full max-w-sm text-center shadow-[0_0_50px_rgba(220,38,38,0.3)]">
              <div className="text-7xl mb-6 animate-bounce">{weaponToDelete.icon}</div>
              <h2 className="bungee text-3xl text-red-600 mb-4 font-black uppercase">DISMANTLE?</h2>
              <p className="bungee text-[10px] text-white/40 mb-10 uppercase font-black leading-relaxed">
                Delete <span className="text-white">{weaponToDelete.name}</span> permanently?<br/>This weapon will be gone forever.
              </p>
              <div className="flex flex-col gap-4">
                <button 
                  onClick={deleteWeaponPermanently} 
                  className="bg-red-600 text-white bungee py-6 rounded-3xl text-2xl font-black shadow-xl active:scale-95 transition-all hover:bg-red-500"
                >
                  YES, DESTROY
                </button>
                <button 
                  onClick={() => setWeaponToDelete(null)} 
                  className="bg-slate-800 text-white/50 bungee py-6 rounded-3xl text-sm font-black hover:text-white transition-colors"
                >
                  NO, KEEP IT
                </button>
              </div>
            </div>
          </div>
        )}

        {showWeaponIndex && (
          <div className="fixed inset-0 z-[2000] bg-black/98 p-6 animate-in fade-in flex flex-col">
             <div className="flex justify-between items-center mb-6">
                <h2 className="bungee text-3xl text-red-500 italic font-black uppercase">Weapon Catalog</h2>
                <button onClick={() => setShowWeaponIndex(false)} className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white"><i className="fas fa-times"></i></button>
             </div>
             <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-8 pb-20">
                {['Common', 'Basic', 'Premium', 'Rare_Expert', 'Slayer', 'Legendary', 'Mythic', 'Ancient'].map(rarity => (
                  <div key={rarity} className="space-y-4">
                    <h3 className="bungee text-sm text-white/40 border-b border-white/5 pb-2 font-black uppercase tracking-widest">{rarity.replace('_', ' ')} TIER</h3>
                    <div className="grid grid-cols-2 gap-4">
                       {WEAPON_INDEX.filter(w => w.rarity === rarity).map((w, idx) => {
                         const isOwned = state.player.inventory.some(invW => invW.name === w.name);
                         return (
                           <div key={idx} className={`bg-slate-900/60 p-4 rounded-3xl border flex flex-col items-center text-center transition-all ${isOwned ? 'border-blue-500/50 grayscale-0 opacity-100 shadow-lg shadow-blue-500/10' : 'border-white/5 grayscale opacity-30 shadow-inner'}`}>
                              <div className="text-3xl mb-2">{w.icon}</div>
                              <div className="bungee text-[9px] text-white font-black truncate w-full uppercase">{w.name}</div>
                              <div className="bungee text-[7px] text-blue-400 font-black">BASE DMG: {w.damage.toLocaleString()}</div>
                           </div>
                         );
                       })}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}
        
        {/* REWARD INFO MODAL */}
        {showRewardInfo && (
           <div className="fixed inset-0 z-[4000] bg-black/95 backdrop-blur-2xl p-8 flex flex-col animate-in fade-in items-center justify-center">
             <div className="bg-slate-900 w-full max-w-sm rounded-[3rem] border-2 border-purple-500/30 p-8 shadow-2xl relative">
                <button onClick={() => setShowRewardInfo(false)} className="absolute top-6 right-6 text-white/50 hover:text-white"><i className="fas fa-times text-xl"></i></button>
                <h2 className="bungee text-2xl text-purple-400 mb-6 text-center font-black uppercase">PRIZE POOL</h2>
                <div className="space-y-4">
                   <div className="bg-purple-900/20 p-4 rounded-2xl border border-purple-500/30">
                      <div className="bungee text-yellow-400 text-lg font-black">RANK #1</div>
                      <div className="bungee text-white text-xs">5,000,000 💰</div>
                      <div className="text-[10px] text-white/60">500🟡 250🟢 100🔴</div>
                   </div>
                   <div className="bg-slate-800 p-3 rounded-2xl border border-white/5">
                      <div className="bungee text-white text-sm font-black">RANK #2 - #3</div>
                      <div className="bungee text-white/80 text-[10px]">2,500,000 💰</div>
                   </div>
                   <div className="bg-slate-800 p-3 rounded-2xl border border-white/5">
                      <div className="bungee text-white text-sm font-black">RANK #4 - #10</div>
                      <div className="bungee text-white/80 text-[10px]">1,000,000 💰</div>
                   </div>
                   <div className="bg-slate-800 p-3 rounded-2xl border border-white/5">
                      <div className="bungee text-white text-sm font-black">RANK #11+</div>
                      <div className="bungee text-white/80 text-[10px]">500,000 - 100,000 💰</div>
                   </div>
                </div>
                <div className="mt-6 text-center bungee text-[8px] text-white/30 uppercase">Resets every 7 hours</div>
             </div>
           </div>
        )}

        {showHowToPlay && (
          <div className="fixed inset-0 z-[4000] bg-black/95 backdrop-blur-2xl p-8 flex flex-col animate-in fade-in">
             <div className="flex justify-between items-center mb-8">
                <h2 className="bungee text-3xl text-red-500 italic font-black uppercase">How to Play</h2>
                <button onClick={() => setShowHowToPlay(false)} className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white"><i className="fas fa-times"></i></button>
             </div>
             <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-12">
                <section>
                   <h3 className="bungee text-xl text-white mb-4 flex items-center gap-3">⚔️ <span className="underline">Battle Titans</span></h3>
                   <p className="bungee text-sm text-white leading-relaxed font-black">Tap the lanes in rhythm with the falling notes to attack. Your characters will linearly throw weapons at the monster. Each hit deals damage based on your armory power! Hold notes deal 3x damage.</p>
                </section>
                <section>
                   <h3 className="bungee text-xl text-white mb-4 flex items-center gap-3">🌌 <span className="underline">The Void</span></h3>
                   <p className="bungee text-sm text-white leading-relaxed font-black">After every victory, you enter the Void. Tap the 🟡, 🟢, and 🔴 keys escaping the black hole. Avoid the 💣 at all costs or you lose your collected keys!</p>
                </section>
                <section>
                   <h3 className="bungee text-xl text-white mb-4 flex items-center gap-3">📦 <span className="underline">Armory & Market</span></h3>
                   <p className="bungee text-sm text-white leading-relaxed font-black">Collect keys to open tiered crates. Use "Armory" to upgrade weapons up to Level 50. Weapons also grant extra HP and Crit chances.</p>
                </section>
             </div>
             <button onClick={() => setShowHowToPlay(false)} className="mt-8 bg-red-600 bungee py-6 rounded-3xl text-2xl font-black uppercase shadow-xl">LET'S GO!</button>
          </div>
        )}

        {state.view === GameView.LEADERBOARD && (
          <div className="h-full flex flex-col p-4 bg-slate-950 animate-in slide-in-from-right overflow-hidden">
             <div className="flex justify-between items-center mb-4 shrink-0 px-2 pt-2">
                <button onClick={() => setState(p => ({ ...p, view: GameView.START }))} className="bungee text-[10px] bg-slate-800 px-4 py-2 rounded-xl border-2 border-white/10 font-black">BACK</button>
                <h2 className="bungee text-xl text-purple-500 italic font-black uppercase">RANKS</h2>
                <div className="scale-75 origin-right">
                    <GlobalHUD player={state.player} />
                </div>
             </div>
             <div className="flex gap-1 mb-2 bg-black/40 p-1 rounded-2xl border border-white/5 shrink-0 mx-2">
                {(['points', 'coins', 'level'] as const).map(t => (
                  <button key={t} onClick={() => setRankTab(t)} className={`flex-1 py-3 bungee text-[9px] rounded-xl transition-all font-black uppercase ${rankTab === t ? 'bg-purple-600 text-white' : 'text-white/30'}`}>{t}</button>
                ))}
             </div>
             <div className="bg-slate-900/60 p-4 rounded-3xl border border-purple-500/20 mb-2 relative overflow-hidden shrink-0 mx-2">
                <div className="flex justify-between items-center relative z-10 gap-2">
                   <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                         <span className="bungee text-[8px] text-white/40 uppercase">Next Reset In</span>
                         <button onClick={() => setShowRewardInfo(true)} className="text-purple-400 bg-purple-900/40 w-4 h-4 rounded-full flex items-center justify-center text-[8px] border border-purple-500/50">i</button>
                      </div>
                      <span className="bungee text-lg sm:text-xl text-white font-black tracking-widest font-mono whitespace-nowrap">{getCountdownString()}</span>
                   </div>
                   <button 
                     onClick={claimRankReward} 
                     disabled={!canClaimRank()}
                     className={`px-4 py-3 sm:px-6 sm:py-4 bungee text-[9px] sm:text-[10px] rounded-xl font-black transition-all whitespace-nowrap ${canClaimRank() ? 'bg-green-600 shadow-[0_0_20px_rgba(22,163,74,0.4)] animate-pulse text-white' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
                   >
                     {canClaimRank() ? 'REDEEM PRIZES' : 'LOCKED'}
                   </button>
                </div>
             </div>
             <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 space-y-2 pb-24 px-2">
                {leaderboard.length > 0 ? leaderboard.sort((a,b) => (b as any)[rankTab === 'points' ? 'score' : rankTab] - (a as any)[rankTab === 'points' ? 'score' : rankTab]).map((entry, i) => (
                  <div key={i} className={`flex justify-between items-center p-4 rounded-2xl border-2 ${entry.username === state.player.username ? 'border-purple-500 bg-purple-900/20 shadow-lg' : 'border-white/5 bg-slate-900/40'}`}>
                    <div className="flex items-center gap-4">
                      <span className="bungee text-lg text-white/20 font-black w-8">#{i+1}</span>
                      <span className="bungee text-xs text-white font-black truncate max-w-[120px] uppercase">@{entry.username}</span>
                    </div>
                    <span className="bungee text-xs text-purple-400 font-black">
                      {rankTab === 'points' ? entry.score.toLocaleString() : rankTab === 'coins' ? `💰${entry.coins.toLocaleString()}` : `LVL ${entry.level}`}
                    </span>
                  </div>
                )) : <div className="text-center py-20 opacity-20 bungee text-xs uppercase font-black">Searching...</div>}
             </div>
          </div>
        )}

        {state.view === GameView.SHOP && (
          <div className="h-full flex flex-col p-4 bg-slate-950 overflow-hidden animate-in slide-in-from-right">
             <div className="flex justify-between items-center mb-6 shrink-0">
               <button onClick={() => setState(p => ({ ...p, view: GameView.START }))} className="bungee text-xs bg-slate-800 px-6 py-3 rounded-xl border-2 border-white/10 font-black">BACK</button>
               <h2 className="bungee text-2xl text-yellow-500 italic uppercase font-black">Market</h2>
               <GlobalHUD player={state.player} />
             </div>
             <div className="flex gap-2 mb-6 shrink-0">
                <button onClick={() => setShopTab('lootboxes')} className={`flex-1 py-4 bungee text-[10px] rounded-2xl border-2 transition-all font-black ${shopTab === 'lootboxes' ? 'bg-yellow-600 border-white' : 'bg-slate-900 border-white/5 opacity-50'}`}>WEAPON CRATES</button>
                <button onClick={() => setShopTab('characters')} className={`flex-1 py-4 bungee text-[10px] rounded-2xl border-2 transition-all font-black ${shopTab === 'characters' ? 'bg-blue-600 border-white' : 'bg-slate-900 border-white/5 opacity-50'}`}>CHARACTERS</button>
             </div>
             <div className="flex-grow overflow-y-auto custom-scrollbar grid grid-cols-2 gap-4 pb-32 pr-1">
               {shopTab === 'lootboxes' && Object.entries(LOOTBOX_PRICES).map(([tier, price]) => {
                  if (tier === 'char_box') return null;
                  const kReq = (LOOTBOX_KEY_PRICES as any)[tier];
                  return (
                    <div key={tier} className="bg-slate-800/60 p-5 rounded-[3.1rem] border-2 border-white/5 text-center flex flex-col items-center shadow-xl">
                       <div className="text-5xl mb-4">📦</div>
                       <div className="bungee text-[9px] mb-1 truncate w-full uppercase font-black">{tier.replace('_', ' ')} BOX</div>
                       <div className="bungee text-yellow-400 text-xs mb-4 font-black">{price.toLocaleString()} 💰</div>
                       <button onClick={() => openBox(tier)} className="w-full py-3 bg-black/60 rounded-xl bungee text-[8px] border border-white/10 hover:bg-white hover:text-black transition-colors font-black uppercase">
                          {kReq.combo ? <span>🟡{kReq.requirements.common} 🟢{kReq.requirements.basic} 🔴{kReq.requirements.premium}</span> : <span>{kReq.icon} x{kReq.amount}</span>}
                       </button>
                    </div>
                  );
               })}
               {shopTab === 'characters' && (
                  <div className="col-span-2 space-y-4 pb-12">
                    <div className="bg-blue-900/20 p-8 rounded-[3rem] border border-blue-500/30 text-center shadow-2xl">
                       <h3 className="bungee text-lg text-blue-400 mb-2 font-black uppercase tracking-tighter">Fragment Recruitment</h3>
                       <p className="bungee text-[9px] text-white/40 mb-8 uppercase font-black">60% chance for a random shard!</p>
                       <button onClick={() => openBox('char_box')} className="w-full bg-blue-600 py-6 rounded-3xl bungee text-2xl shadow-xl hover:bg-blue-500 transition-all font-black uppercase">
                          1.5K 💰 + 15🟡
                       </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       {CHARACTERS.map(c => (
                          <div key={c.id} className="bg-slate-900/60 p-5 rounded-[2.5rem] border-2 border-white/5 text-center shadow-xl flex flex-col items-center">
                             <img src={c.image} className="w-12 h-12 rounded-full border-2 border-blue-500 mb-2 bg-black" />
                             <div className="bungee text-[9px] text-white truncate font-black uppercase">{c.name}</div>
                             <div className="bungee text-[7px] text-blue-400 font-black">{(state.player.characters.fragments[c.id] || 0)}/10 FRAGS</div>
                          </div>
                       ))}
                    </div>
                  </div>
               )}
             </div>
          </div>
        )}

        {state.view === GameView.LEVEL_SELECT && (
          <div className="h-full flex flex-col p-4 bg-slate-950 animate-in slide-in-from-bottom overflow-hidden">
            <div className="flex justify-between items-center mb-8 shrink-0">
              <button onClick={() => setState(p => ({ ...p, view: GameView.START }))} className="bungee text-xs bg-slate-800 px-6 py-3 rounded-xl border-2 border-white/10 font-black">BACK</button>
              <h2 className="bungee text-2xl text-red-500 italic uppercase font-black">TITAN MAP</h2>
              <GlobalHUD player={state.player} />
            </div>
            <div className="grid grid-cols-4 gap-3 overflow-y-auto custom-scrollbar flex-grow pb-32">
              {MONSTERS.map(m => (
                <button key={m.id} disabled={m.level > state.player.unlockedLevel} onClick={() => {
                   // Auto-equip logic: if player has nothing equipped but has weapons, equip the first one.
                   let nextPlayer = { ...state.player };
                   if (nextPlayer.equipped.length === 0 && nextPlayer.inventory.length > 0) {
                      nextPlayer.equipped = [nextPlayer.inventory[0].id];
                      // We must update state here carefully to reflect the equipped item instantly
                   }
                   setState(p => ({ 
                      ...p, 
                      player: nextPlayer,
                      view: GameView.BATTLE, 
                      currentLevel: m 
                   }));
                }} className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center group relative ${m.level > state.player.unlockedLevel ? 'bg-slate-900 border-white/5 opacity-20' : 'bg-slate-800 border-red-500/50 hover:bg-red-900/40 shadow-2xl'}`}>
                  <img src={m.image} className="w-14 h-14 mb-2 transition-transform group-hover:scale-110" />
                  <div className="bungee text-[10px] text-white font-black">STAGE {m.level}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {state.view === GameView.BATTLE && state.currentLevel && (
          <GameEngine monster={state.currentLevel} player={state.player} weapons={state.player.inventory} onFinish={(res, stats) => {
              if (res === 'WIN') {
                updatePlayer({ exp: state.player.exp + stats.exp, stagePoints: state.player.stagePoints + (state.currentLevel?.level || 1) * 1000, unlockedLevel: Math.max(state.player.unlockedLevel, (state.currentLevel?.level || 0) + 1), coins: state.player.coins + (state.currentLevel?.level || 1) * 200 });
                setState(p => ({ ...p, view: GameView.BONUS_GAME }));
              } else { setState(p => ({ ...p, view: GameView.START, currentLevel: null })); }
            }}
          />
        )}

        {state.view === GameView.BONUS_GAME && <BonusGame onFinish={(keys) => { 
            updatePlayer({ keys: { common: state.player.keys.common + keys.common, basic: state.player.keys.basic + keys.basic, premium: state.player.keys.premium + keys.premium } }); 
            setState(p => ({ ...p, view: GameView.START, currentLevel: null })); 
        }} />}

        {showDaily && <div className="fixed inset-0 z-[1100] bg-black/98 flex items-center justify-center p-6 backdrop-blur-3xl animate-in zoom-in"><div className="bg-slate-900 border-2 border-yellow-500/20 p-10 rounded-[5rem] w-full text-center max-w-sm shadow-2xl"><h2 className="bungee text-4xl text-yellow-500 mb-2 italic uppercase font-black">Vault</h2><p className="bungee text-[10px] text-slate-500 mb-10 uppercase tracking-widest font-black">PICK 1 CARD EVERY 12H</p><div className="grid grid-cols-3 gap-4 mb-10">{Array.from({ length: 6 }).map((_, i) => (<div key={i} onClick={() => { if (revealedDaily !== null) return; const canClaim = Date.now() - (state.player.lastDailyReward || 0) >= 12 * 3600000; if (!canClaim) return showNotification("VAULT LOCKED!", 'error'); setRevealedDaily(i); }} className={`aspect-[2/3] rounded-2xl border-2 flex items-center justify-center transition-all cursor-pointer ${revealedDaily !== null ? (revealedDaily === i ? 'bg-white scale-110 shadow-[0_0_30px_white]' : 'bg-slate-800 border-white/5 opacity-50') : 'bg-slate-800 border-white/5 hover:border-yellow-500/50'}`}>{revealedDaily !== null ? (<div className={`bungee text-[8px] flex flex-col gap-1 font-black ${revealedDaily === i ? 'text-black' : 'text-white/40'}`}><div className="truncate text-[7px]">💰{DAILY_CARDS[i % 6].coins.toLocaleString()}</div><div className="text-[7px]">🟡{DAILY_CARDS[i % 6].common}</div><div className="text-[7px]">🟢{DAILY_CARDS[i % 6].basic}</div><div className="text-[7px]">🔴{DAILY_CARDS[i % 6].premium}</div></div>) : <span className="text-5xl">🃏</span>}</div>))}</div>{revealedDaily !== null && (<button onClick={() => { const r = DAILY_CARDS[revealedDaily % 6]; updatePlayer({ coins: state.player.coins + r.coins, keys: { common: state.player.keys.common + r.common, basic: state.player.keys.basic + r.basic, premium: state.player.keys.premium + r.premium }, lastDailyReward: Date.now() }); setShowDaily(false); setRevealedDaily(null); }} className="w-full bg-yellow-500 text-black bungee py-6 rounded-3xl text-3xl font-black">REDEEM</button>)}<button onClick={() => { setShowDaily(false); setRevealedDaily(null); }} className="mt-8 bungee text-[10px] text-white/20 font-black uppercase">Close</button></div></div>}
      </div>
    </div>
  );
};

export default App;
