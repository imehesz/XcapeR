export interface LevelConfig {
  playerStart: { x: number; z: number };
  keyPosition: { x: number; z: number };
}

export const LEVELS: LevelConfig[] = [
  {
    playerStart: { x: -4, z: -4 },
    keyPosition: { x: 4, z: -4 }
  },
  {
    playerStart: { x: -4, z: 3.3 },
    keyPosition: { x: 3.6, z: -3.7 }
  }
];
