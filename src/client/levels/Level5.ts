import * as THREE from 'three';
import { BaseLevel, type LevelDependencies } from './BaseLevel';
import { type LevelConfig } from '../game/levels';

const COLORS = [
  0xff0000, // Red
  0x00ff00, // Green
  0x0000ff, // Blue
  0xffff00, // Yellow
  0x00ffff, // Cyan
  0xff00ff, // Magenta
  0xff8800, // Orange
  0x8800ff  // Purple
];

const CORNERS = [
  { x: -4, z: -4, angleToCenterIndex: 1 }, // Top-Left
  { x: 4, z: -4, angleToCenterIndex: 3 },  // Top-Right
  { x: -4, z: 4, angleToCenterIndex: 7 },  // Bottom-Left
  { x: 4, z: 4, angleToCenterIndex: 5 }    // Bottom-Right
];

const ROTATION_TIME = 0.15;
const TOUCH_RADIUS = 1.35;
const TIMER_MAX = 20;
const CENTER_BOX_SIZE = 1.8;
const COLUMN_COLLISION_RADIUS = 0.85;
const COLUMN_HEIGHT = 1.25;

interface OctagonColumn {
  group: any;
  faces: any[];
  colors: number[];
  rotationSteps: number;
  centerAngleIndex: number;
  beam: any;
  isRotating: boolean;
  rotationProgress: number;
  startRotationY: number;
  targetRotationY: number;
  wasTouched: boolean;
}

export class Level5 extends BaseLevel {
  private columns: OctagonColumn[] = [];
  private currentTargetColor: number = 0;
  
  private targetBoxGroup: any = new THREE.Group();
  private targetBoxEdges!: any;
  
  private timer: number = TIMER_MAX;
  private screenBar!: any;
  private isSolved: boolean = false;

  constructor(config: LevelConfig, deps: LevelDependencies) {
    super(config, deps);
  }

  override initialize(): void {
    // 1. Let BaseLevel build the room, spawn the door, and the center key
    super.initialize();

    // Reset Level 5 specific state
    this.columns = [];
    this.isSolved = false;
    this.timer = TIMER_MAX;
    this.targetBoxGroup = new THREE.Group();
    this.worldRoot.add(this.targetBoxGroup);

    // 2. Setup Center Box (Protects the key)
    this.currentTargetColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const boxGeo = new THREE.BoxGeometry(CENTER_BOX_SIZE, CENTER_BOX_SIZE, CENTER_BOX_SIZE);
    
    const boxMat = new THREE.MeshStandardMaterial({ 
      color: 0x000000, transparent: true, opacity: 0.1 
    });
    const centerBox = new THREE.Mesh(boxGeo, boxMat);
    centerBox.position.y = CENTER_BOX_SIZE * 0.5;
    this.targetBoxGroup.add(centerBox);

    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    this.targetBoxEdges = new THREE.LineSegments(
      edgesGeo, 
      new THREE.LineBasicMaterial({ color: this.currentTargetColor, linewidth: 2 })
    );
    this.targetBoxEdges.position.y = CENTER_BOX_SIZE * 0.5;
    this.targetBoxGroup.add(this.targetBoxEdges);

    // 3. Setup Timer Screen and Columns
    this.createTimerScreen();
    CORNERS.forEach(corner => this.createColumn(corner));

    // 4. Ensure no auto-win on start
    this.scrambleColumnsToPreventAutoWin();
    this.updateAllDimLines();
  }

  protected override updateCustom(_ts: number, dt: number): void {
    if (this.isSolved) return;

    this.targetBoxGroup.rotation.y -= 0.5 * dt;

    // 1. Update Timer
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = TIMER_MAX;
      this.pickNewTargetColor();
    }
    // Scale the screen bar based on remaining time
    this.screenBar.scale.y = Math.max(0.001, this.timer / TIMER_MAX);

    // 2. Handle Player Interactions and Rotations
    // We use this.virtualPlayer which is protected and provided by BaseLevel
    for (const col of this.columns) {
      const dx = this.virtualPlayer.x - col.group.position.x;
      const dz = this.virtualPlayer.z - col.group.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < TOUCH_RADIUS) {
        if (!col.wasTouched && !col.isRotating) {
          col.wasTouched = true;
          col.isRotating = true;
          col.rotationProgress = 0;
          col.startRotationY = col.group.rotation.y;
          col.targetRotationY = col.startRotationY + (Math.PI / 4);
          col.rotationSteps = (col.rotationSteps + 1) % 8;
        }
      } else {
        col.wasTouched = false; 
      }

      if (col.isRotating) {
        col.rotationProgress += dt;
        const t = Math.min(col.rotationProgress / ROTATION_TIME, 1);
        
        col.group.rotation.y = col.startRotationY + (col.targetRotationY - col.startRotationY) * t;

        if (t >= 1) {
          col.isRotating = false;
          col.group.rotation.y = col.targetRotationY; 
          this.updateAllDimLines();
          this.checkWinCondition();
        }
      }
    }
  }

  protected override resolveCustomCollisions(): void {
    const playerRadius = this.config.player.radius;
    const roomHalf = this.config.environment.roomHalf;
    const roomMin = -roomHalf + 0.1 + playerRadius;
    const roomMax = roomHalf - 0.1 - playerRadius;

    const pushOutCircle = (cx: number, cz: number, obstacleRadius: number): void => {
      const dx = this.virtualPlayer.x - cx;
      const dz = this.virtualPlayer.z - cz;
      const distSq = (dx * dx) + (dz * dz);
      const minDist = obstacleRadius + playerRadius;
      const minDistSq = minDist * minDist;
      if (distSq >= minDistSq) {
        return;
      }

      const dist = Math.sqrt(distSq);
      if (dist < 0.0001) {
        this.virtualPlayer.x = cx + minDist;
        this.virtualPlayer.z = cz;
        return;
      }

      const nx = dx / dist;
      const nz = dz / dist;
      this.virtualPlayer.x = cx + (nx * minDist);
      this.virtualPlayer.z = cz + (nz * minDist);
    };

    for (let i = 0; i < 3; i += 1) {
      if (!this.isSolved) {
        // Keep player outside the center box while puzzle is active.
        pushOutCircle(0, 0, (CENTER_BOX_SIZE * 0.5) + 0.08);
      }
      for (const col of this.columns) {
        pushOutCircle(col.group.position.x, col.group.position.z, COLUMN_COLLISION_RADIUS);
      }
      this.virtualPlayer.x = Math.max(roomMin, Math.min(roomMax, this.virtualPlayer.x));
      this.virtualPlayer.z = Math.max(roomMin, Math.min(roomMax, this.virtualPlayer.z));
    }

    this.worldRoot.position.set(-this.virtualPlayer.x, 0, -this.virtualPlayer.z);
  }

  override teardown(): void {
    super.teardown();
    // BaseLevel.disposeObjectTree(this.worldRoot) handles most of this,
    // but we can ensure arrays are cleared.
    this.columns.length = 0;
  }

  private createTimerScreen(): void {
    const screenPos = { x: 6.5, y: 5.5, z: 0 };
    const screenRotY = Math.PI / 2;
    const screenHeight = 2;
    const screenDepth = 0.5;

    const frameGeo = new THREE.BoxGeometry(0.2, 1.45, 1.45);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.82 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(screenPos.x, screenPos.y, screenPos.z);
    frame.rotation.y = screenRotY;
    //this.worldRoot.add(frame);

    const bgGeo = new THREE.BoxGeometry(0.14, screenHeight, screenDepth);
    const bgMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.position.set(screenPos.x, screenPos.y, screenPos.z);
    bg.rotation.y = screenRotY;
    this.worldRoot.add(bg);

    const barGeo = new THREE.BoxGeometry(0.15, screenHeight, screenDepth);
    barGeo.translate(0, screenHeight * 0.5, 0); 
    this.screenBar = new THREE.Mesh(
      barGeo,
      new THREE.MeshStandardMaterial({ 
        color: this.currentTargetColor, 
        emissive: this.currentTargetColor, 
        emissiveIntensity: 0.5 
      })
    );
    this.screenBar.position.set(screenPos.x, screenPos.y - (screenHeight * 0.5), screenPos.z);
    this.screenBar.rotation.y = screenRotY;
    this.worldRoot.add(this.screenBar);
  }

  private createColumn(corner: {x: number, z: number, angleToCenterIndex: number}): void {
    const group = new THREE.Group();
    group.position.set(corner.x, 0, corner.z);
    
    const colColors = [...COLORS].sort(() => Math.random() - 0.5);
    const radius = 0.6;
    const faces: any[] = [];

    for (let i = 0; i < 8; i++) {
      const faceGeo = new THREE.BoxGeometry(0.5, COLUMN_HEIGHT, 0.1);
      const faceMat = new THREE.MeshStandardMaterial({ color: colColors[i] });
      const face = new THREE.Mesh(faceGeo, faceMat);
      
      const angle = i * (Math.PI / 4);
      face.position.set(Math.cos(angle) * radius, COLUMN_HEIGHT * 0.5, Math.sin(angle) * radius);
      face.rotation.y = -angle + (Math.PI / 2);
      group.add(face);
      faces.push(face);
    }

    const start = new THREE.Vector3(corner.x, 0.1, corner.z);
    const end = new THREE.Vector3(0, 0.1, 0);
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    const beamGeo = new THREE.CylinderGeometry(0.055, 0.055, length, 12, 1, true);
    const beamMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.6,
      roughness: 0.25,
      metalness: 0.05
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    beam.position.copy(mid);
    const up = new THREE.Vector3(0, 1, 0);
    beam.quaternion.setFromUnitVectors(up, dir.clone().normalize());

    this.worldRoot.add(group);
    this.worldRoot.add(beam);

    this.columns.push({
      group,
      faces,
      colors: colColors,
      rotationSteps: 0,
      centerAngleIndex: corner.angleToCenterIndex,
      beam,
      isRotating: false,
      rotationProgress: 0,
      startRotationY: 0,
      targetRotationY: 0,
      wasTouched: false
    });
  }

  private scrambleColumnsToPreventAutoWin(): void {
    let allMatch = true;
    while (allMatch) {
      allMatch = true;
      for (const col of this.columns) {
        col.rotationSteps = Math.floor(Math.random() * 8);
        col.group.rotation.y = col.rotationSteps * (Math.PI / 4);
        
        if (this.getFacingColor(col) !== this.currentTargetColor) {
          allMatch = false;
        }
      }
    }
  }

  private getFacingColor(col: OctagonColumn): number {
    const roomCenter = new THREE.Vector3(0, 0, 0);
    const worldPos = new THREE.Vector3();
    const roomLocalPos = new THREE.Vector3();
    let minDistSq = Number.POSITIVE_INFINITY;
    let closestIndex = 0;

    for (let i = 0; i < col.faces.length; i += 1) {
      col.faces[i].getWorldPosition(worldPos);
      // The whole room is translated by worldRoot to simulate player movement.
      // Convert face position back into room-local coordinates before measuring
      // distance to the true room center.
      roomLocalPos.copy(worldPos).sub(this.worldRoot.position);
      const distSq = roomLocalPos.distanceToSquared(roomCenter);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closestIndex = i;
      }
    }

    return col.colors[closestIndex];
  }

  private updateAllDimLines(): void {
    for (const col of this.columns) {
      const color = this.getFacingColor(col);
      col.beam.material.color.setHex(color);
      col.beam.material.emissive.setHex(color);
    }
  }

  private pickNewTargetColor(): void {
    let newColor;
    do {
      newColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    } while (newColor === this.currentTargetColor);

    this.currentTargetColor = newColor;
    
    this.targetBoxEdges.material.color.setHex(this.currentTargetColor);
    this.screenBar.material.color.setHex(this.currentTargetColor);
    this.screenBar.material.emissive.setHex(this.currentTargetColor);
  }

  private checkWinCondition(): void {
    let matchedCount = 0;
    for (const col of this.columns) {
      if (this.getFacingColor(col) === this.currentTargetColor) {
        matchedCount++;
      }
    }

    if (matchedCount === 4) {
      this.isSolved = true;
      this.worldRoot.remove(this.targetBoxGroup);
      
      this.screenBar.scale.y = 1;
      this.screenBar.material.color.setHex(0x00ff00); 
      this.screenBar.material.emissive.setHex(0x00ff00);
      
      this.deps.ui.setStatus('Colors matched! The barrier is down. Grab the key.', 'good');
    }
  }
}
