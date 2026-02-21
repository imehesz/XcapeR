export interface Vec2 {
  x: number;
  z: number;
}

export interface Aabb2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RoomCollisionConfig {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  playerRadius: number;
  closedDoorBounds?: Aabb2;
  obstacleBounds?: Aabb2[];
}

const intersectsAabb = (a: Aabb2, b: Aabb2): boolean => {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
};

export const playerAabb = (position: Vec2, radius: number): Aabb2 => ({
  minX: position.x - radius,
  maxX: position.x + radius,
  minZ: position.z - radius,
  maxZ: position.z + radius
});

export const clampInsideRoom = (position: Vec2, config: RoomCollisionConfig): Vec2 => ({
  x: Math.min(config.maxX - config.playerRadius, Math.max(config.minX + config.playerRadius, position.x)),
  z: Math.min(config.maxZ - config.playerRadius, Math.max(config.minZ + config.playerRadius, position.z))
});

export const resolvePlayerMovement = (
  nextPosition: Vec2,
  previousPosition: Vec2,
  isDoorOpen: boolean,
  config: RoomCollisionConfig
): Vec2 => {
  const clamped = clampInsideRoom(nextPosition, config);

  const nextAabb = playerAabb(clamped, config.playerRadius);

  if (!isDoorOpen && config.closedDoorBounds && intersectsAabb(nextAabb, config.closedDoorBounds)) {
    return previousPosition;
  }

  if (config.obstacleBounds) {
    for (const obstacle of config.obstacleBounds) {
      if (intersectsAabb(nextAabb, obstacle)) {
        return previousPosition;
      }
    }
  }

  return clamped;
};
