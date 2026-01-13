
export enum GameView {
  START = 'START',
  LEVEL_SELECT = 'LEVEL_SELECT',
  BATTLE = 'BATTLE',
  SHOP = 'SHOP',
  INVENTORY = 'INVENTORY',
  LEADERBOARD = 'LEADERBOARD',
  SETTINGS = 'SETTINGS',
  BONUS_GAME = 'BONUS_GAME',
  TEAM = 'TEAM'
}

export interface Character {
  id: string;
  name: string;
  gender: 'M' | 'F' | 'Both';
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  fragmentsNeeded: number;
  icon: string;
  image: string;
  femaleImage?: string;
}

export interface Weapon {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  rarity: 'Common' | 'Basic' | 'Premium' | 'Slayer' | 'Legendary' | 'Mythic' | 'Ancient' | 'Elite' | 'Rare_Expert';
  damage: number;
  damageMultiplier: number;
  extraLives: number;
  keyDropBonus: number;
  critChance: number;
  critMultiplier: number;
  expBonus: number;
  level: number;
  maxLevel: number;
}

export interface PlayerStats {
  username: string;
  exp: number;
  expNeeded: number;
  level: number;
  powerLevel: number;
  lives: number;
  inventory: Weapon[];
  characters: {
    unlocked: string[];
    fragments: Record<string, number>;
    equipped: string[];
    selectedGenders: Record<string, 'M' | 'F'>;
  };
  equipped: string[];
  coins: number;
  stagePoints: number;
  unlockedLevel: number;
  lastDailyReward?: number;
  keys: {
    common: number;
    basic: number;
    premium: number;
  };
  settings: {
    musicEnabled: boolean;
    soundEnabled: boolean;
  };
}

export interface Monster {
  id: string;
  name: string;
  level: number;
  maxHealth: number;
  currentHealth: number;
  image: string;
  powerRequired: number;
  expReward: number;
  songUrl: string;
  duration: number;
}

export interface Note {
  id: number;
  lane: number;
  time: number;
  type: 'single' | 'hold';
  duration?: number;
  keyType?: 'common' | 'basic' | 'premium';
  hit: boolean;
  missed: boolean;
}

export interface GameState {
  view: GameView;
  player: PlayerStats;
  currentLevel: Monster | null;
}
