export type ObjectType = 'door' | 'key' | 'cat' | 'prop';
export type InteractionType = 'pickup' | 'exit' | 'ambient';

export interface Vec3Config {
  x: number;
  y: number;
  z: number;
}

export interface ColliderConfig {
  isCollidable: boolean;
  halfX: number;
  halfZ: number;
}

export interface InteractionConfig {
  type: InteractionType;
  pickupRadius?: number;
  touchRadius?: number;
  itemId?: string;
}

export interface LevelObjectConfig {
  id: string;
  type: ObjectType;
  assetUrl?: string;
  textureUrl?: string;
  transform: {
    position: Vec3Config;
    rotationY: number;
    scale: number;
  };
  collision?: ColliderConfig;
  interaction?: InteractionConfig;
}

export interface LightingConfig {
  ambientIntensity: number;
  directional: Array<{
    color: number;
    intensity: number;
    position: Vec3Config;
  }>;
}

export interface EnvironmentConfig {
  roomHalf: number;
  wallHeight: number;
  wallColor: number;
  wallOpacity: number;
  floorColor: number;
  visibleWalls: {
    left: boolean;
    back: boolean;
    right: boolean;
    front: boolean;
  };
  lighting: LightingConfig;
}

export interface PlayerSetupConfig {
  spawn: { x: number; z: number };
  rotationY: number;
  speed: number;
  radius: number;
}

export interface WinConditionConfig {
  doorObjectId: string;
  keysRequired: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  environment: EnvironmentConfig;
  player: PlayerSetupConfig;
  winCondition: WinConditionConfig;
  objects: LevelObjectConfig[];
  custom?: {
    catMeowUrl?: string;
    catMeowChance?: number;
  };
}

const assetUrl = (path: string): string => new URL(`../../../assets/${path}`, import.meta.url).href;

export const LEVELS: LevelConfig[] = [
  {
    id: 'level-1',
    name: 'Level 1',
    environment: {
      roomHalf: 5,
      wallHeight: 5,
      wallColor: 0x4a617f,
      wallOpacity: 0.24,
      floorColor: 0x263142,
      visibleWalls: {
        left: true,
        back: true,
        right: false,
        front: false
      },
      lighting: {
        ambientIntensity: 0.72,
        directional: [
          { color: 0xffffff, intensity: 0.75, position: { x: 7, y: 10, z: 4 } },
          { color: 0x7aa7ff, intensity: 0.35, position: { x: -8, y: 6, z: -6 } }
        ]
      }
    },
    player: {
      spawn: { x: -4, z: -4 },
      rotationY: 0,
      speed: 3.1,
      radius: 0.38
    },
    winCondition: {
      doorObjectId: 'door.exit',
      keysRequired: 1
    },
    objects: [
      {
        id: 'door.exit',
        type: 'door',
        transform: {
          position: { x: 0, y: 0, z: -4.9 },
          rotationY: 0,
          scale: 1
        },
        collision: {
          isCollidable: true,
          halfX: 0.95,
          halfZ: 0.42
        },
        interaction: {
          type: 'exit',
          touchRadius: 1.05
        }
      },
      {
        id: 'key.main',
        type: 'key',
        transform: {
          position: { x: 4, y: 0.65, z: -4 },
          rotationY: 0,
          scale: 1
        },
        interaction: {
          type: 'pickup',
          pickupRadius: 0.75,
          itemId: 'key.main'
        }
      },
      {
        id: 'cat.pet',
        type: 'cat',
        assetUrl: assetUrl('models/lowpolycat/cat.obj'),
        transform: {
          position: { x: -2.2, y: 0, z: 1.6 },
          rotationY: Math.PI * 0.35,
          scale: 0.75
        },
        interaction: {
          type: 'ambient',
          touchRadius: 0.85
        }
      }
    ],
    custom: {
      catMeowUrl: assetUrl('audio/cat-meow.wav'),
      catMeowChance: 0.5
    }
  },
  {
    id: 'level-2',
    name: 'Level 2',
    environment: {
      roomHalf: 5,
      wallHeight: 5,
      wallColor: 0x4a617f,
      wallOpacity: 0.24,
      floorColor: 0x263142,
      visibleWalls: {
        left: true,
        back: true,
        right: false,
        front: false
      },
      lighting: {
        ambientIntensity: 0.72,
        directional: [
          { color: 0xffffff, intensity: 0.75, position: { x: 7, y: 10, z: 4 } },
          { color: 0x7aa7ff, intensity: 0.35, position: { x: -8, y: 6, z: -6 } }
        ]
      }
    },
    player: {
      spawn: { x: -1.2, z: 3.3 },
      rotationY: 0,
      speed: 3.1,
      radius: 0.38
    },
    winCondition: {
      doorObjectId: 'door.exit',
      keysRequired: 1
    },
    objects: [
      {
        id: 'door.exit',
        type: 'door',
        transform: {
          position: { x: 0, y: 0, z: -4.9 },
          rotationY: 0,
          scale: 1
        },
        collision: {
          isCollidable: true,
          halfX: 0.95,
          halfZ: 0.42
        },
        interaction: {
          type: 'exit',
          touchRadius: 1.05
        }
      }
    ]
  },
  {
    id: 'level-3',
    name: 'Level 3',
    environment: {
      roomHalf: 5,
      wallHeight: 5,
      wallColor: 0x4a617f,
      wallOpacity: 0.24,
      floorColor: 0x263142,
      visibleWalls: {
        left: true,
        back: true,
        right: false,
        front: false
      },
      lighting: {
        ambientIntensity: 0.72,
        directional: [
          { color: 0xffffff, intensity: 0.75, position: { x: 7, y: 10, z: 4 } },
          { color: 0x7aa7ff, intensity: 0.35, position: { x: -8, y: 6, z: -6 } }
        ]
      }
    },
    player: {
      spawn: { x: 0, z: 3.6 },
      rotationY: 0,
      speed: 3.1,
      radius: 0.38
    },
    winCondition: {
      doorObjectId: 'door.exit',
      keysRequired: 1
    },
    objects: [
      {
        id: 'door.exit',
        type: 'door',
        transform: {
          position: { x: 0, y: 0, z: -4.9 },
          rotationY: 0,
          scale: 1
        },
        collision: {
          isCollidable: true,
          halfX: 0.95,
          halfZ: 0.42
        },
        interaction: {
          type: 'exit',
          touchRadius: 1.05
        }
      }
    ]
  }
];

export const collectLevelAssetUrls = (levels: LevelConfig[]): string[] => {
  const urls = new Set<string>();
  for (const level of levels) {
    for (const object of level.objects) {
      if (object.assetUrl) {
        urls.add(object.assetUrl);
      }
      if (object.textureUrl) {
        urls.add(object.textureUrl);
      }
    }
    if (level.custom?.catMeowUrl) {
      urls.add(level.custom.catMeowUrl);
    }
  }
  return [...urls];
};
