
import { Weapon, Monster, Character, PlayerStats } from './types';

export const LOOTBOX_PRICES = {
  common: 1000,
  basic: 5000,
  premium: 25000,
  slayer: 75000,
  legendary: 250000,
  mythic: 500000,
  ancient: 1000000,
  rare_expert: 150000,
  elite_combo: 1500000,
  char_box: 1500
};

export const LOOTBOX_KEY_PRICES = {
  common: { type: 'common', amount: 10, icon: '🟡' },
  basic: { type: 'basic', amount: 20, icon: '🟢' },
  premium: { type: 'premium', amount: 50, icon: '🔴' },
  slayer: { type: 'premium', amount: 500, icon: '🔴' },
  legendary: { type: 'premium', amount: 200, icon: '🔴' },
  mythic: { type: 'premium', amount: 500, icon: '🔴' },
  rare_expert: { type: 'basic', amount: 200, icon: '🟢' },
  ancient: { type: 'premium', amount: 1000, icon: '🔴' },
  char_box: { type: 'common', amount: 15, icon: '🟡' },
  elite_combo: { 
    combo: true, 
    requirements: { common: 500, basic: 1500, premium: 1000 } 
  }
};

const charNames = ["Kael", "Lia", "Vax", "Sera", "Zion", "Nova", "Jax", "Rey", "Finn", "Mora", "Cyrus", "Lyra", "Eon", "Xena", "Dante", "Selene", "Ryu", "Mai", "Ken", "Chun", "Sol", "Ky", "Leo", "Ram", "I-No", "Pot", "Axl", "Zato", "Millia", "Venom"];
export const CHARACTERS: Character[] = charNames.map((name, i) => ({
  id: `c${i+1}`,
  name,
  gender: i === 0 ? 'Both' : (i % 2 === 0 ? 'M' : 'F'),
  rarity: i < 5 ? 'Common' : i < 15 ? 'Rare' : i < 25 ? 'Epic' : 'Legendary',
  fragmentsNeeded: 10,
  icon: i % 2 === 0 ? '👨‍🚀' : '👩‍🚀',
  image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}Male`,
  femaleImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}Female`
}));

const allWeaponIcons = [
  '🍴','⚔️','🛡️','🐲','🔱','⚡','🪐','🏹','💠','🔪','🗡️','🪓','🔨','⚒️','🛠️','⛏️','🔧','🪛','🔩','⚙️','🧱','⛓️','🪵','🪚','🧲','🔫','💣','🧨','🪃','🪁','🪄','🔮','🧿','💎','🧪','🌡️','🧬','🏮','🎐','🛸','☄️','💥','✨','🔥','💧','🍃','🌑','☀️','❄️','🌈','🌩️','⭐','☄️','⚡','🛡️','🏹','🗡️','🔨','⚒️','⚔️'
];

const createW = (id: string, name: string, icon: string, rarity: any, damage: number, lives: number, crit: number): Weapon => ({
  id, name, description: `Elite ${rarity} grade equipment.`, price: 0, icon, rarity, 
  damage: isNaN(damage) || damage === null ? 500 : Math.max(1, Math.floor(damage)), 
  damageMultiplier: 1, extraLives: lives, keyDropBonus: 0.05, 
  critChance: crit, critMultiplier: 4.5, expBonus: 0.1, level: 1, maxLevel: 50
});

const genPool = (rarity: string, baseDmg: number, baseLives: number, count: number, iconOffset: number) => {
  const titles = ["Edge", "Soul", "Bane", "Will", "Heart", "Fang", "Claw", "Star", "Void", "Core", "Spire", "Vortex", "Shard", "Glow", "Reach", "Depth", "Height", "Width", "Length", "Blast", "Pulse", "Wave", "Tide", "Storm", "Frost", "Flame", "Bolt", "Quake", "Gale", "Sun", "Moon", "Zenith", "Apex", "Root", "Stem", "Leaf", "Vine", "Thorn", "Rose", "Dust"];
  return Array.from({ length: count }, (_, i) => {
    const icon = allWeaponIcons[(iconOffset + i) % allWeaponIcons.length];
    const safeBaseDmg = baseDmg || 100;
    const damageValue = safeBaseDmg + (i * (safeBaseDmg * 0.1));
    return createW(`${rarity.toLowerCase()}_${i}`, `${rarity.replace('_', ' ')} ${titles[i % titles.length]} ${Math.floor(i / titles.length) + 1}`, icon, rarity as any, damageValue, baseLives + Math.floor(i / 3), 0.05 + (i * 0.005))
  });
};

export const WEAPON_INDEX = [
  ...genPool('Common', 250, 2, 15, 0),
  ...genPool('Basic', 2500, 5, 15, 15),
  ...genPool('Premium', 15000, 10, 15, 30),
  ...genPool('Rare_Expert', 85000, 15, 15, 45),
  ...genPool('Slayer', 350000, 20, 15, 0),
  ...genPool('Legendary', 1500000, 30, 15, 15),
  ...genPool('Mythic', 12000000, 45, 15, 30),
  ...genPool('Ancient', 60000000, 60, 15, 45)
];

export const INITIAL_PLAYER_STATS: PlayerStats = {
  username: "NewFighter",
  exp: 0, expNeeded: 500, level: 1, powerLevel: 100, lives: 30,
  inventory: [],
  characters: {
    unlocked: ['c1'],
    fragments: { 'c1': 5 },
    equipped: ['c1'],
    selectedGenders: { 'c1': 'M' }
  },
  equipped: [],
  coins: 50000, stagePoints: 0, unlockedLevel: 1, lastDailyReward: 0,
  keys: { common: 100, basic: 50, premium: 20 },
  settings: { musicEnabled: true, soundEnabled: true }
};

export const MONSTERS: Monster[] = Array.from({ length: 100 }, (_, i) => ({
  id: `m${i+1}`,
  name: `Titan Stage ${i+1}`,
  level: i + 1,
  maxHealth: Math.floor(12000 * Math.pow(1.35, i)), 
  currentHealth: Math.floor(12000 * Math.pow(1.35, i)),
  image: `https://api.dicebear.com/7.x/bottts/svg?seed=monster${i+1}&backgroundColor=b6e3f4`,
  powerRequired: (i + 1) * 80,
  expReward: 400 * (i + 1),
  songUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(i % 15) + 1}.mp3`,
  duration: 60 + (i * 2)
}));

export const DAILY_CARDS = [
  { coins: 10000, common: 20, basic: 10, premium: 5 },
  { coins: 25000, common: 50, basic: 25, premium: 10 },
  { coins: 15000, common: 30, basic: 15, premium: 7 },
  { coins: 50000, common: 100, basic: 50, premium: 20 },
  { coins: 12000, common: 40, basic: 12, premium: 6 },
  { coins: 100000, common: 250, basic: 125, premium: 60 }
];
