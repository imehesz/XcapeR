import { resolvePlayerMovement, type Aabb2, type RoomCollisionConfig, type Vec2 } from '../../shared/CollisionMath';

export class CollisionSystem {
  private config: RoomCollisionConfig;

  constructor(config: RoomCollisionConfig) {
    this.config = config;
  }

  updateConfig(config: RoomCollisionConfig): void {
    this.config = config;
  }

  resolve(nextPosition: Vec2, previousPosition: Vec2, isDoorOpen: boolean): Vec2 {
    return resolvePlayerMovement(nextPosition, previousPosition, isDoorOpen, this.config);
  }

  static toAabb(centerX: number, centerZ: number, halfX: number, halfZ: number): Aabb2 {
    return {
      minX: centerX - halfX,
      maxX: centerX + halfX,
      minZ: centerZ - halfZ,
      maxZ: centerZ + halfZ
    };
  }
}
