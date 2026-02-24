import * as THREE from 'three';
import { BaseLevel, type LevelDependencies } from './BaseLevel';
import { type LevelConfig } from '../game/levels';

// Hardcoded invisible walls for the maze { center X, center Z, width, depth }
const MAZE_WALLS = [
  { cx: -2.5, cz: 2, w: 3, d: 0.5 },
  { cx: 2.5, cz: 2, w: 3, d: 0.5 },
  { cx: -2.5, cz: -2, w: 0.5, d: 4 },
  { cx: 2.5, cz: -2, w: 0.5, d: 4 },
  { cx: 0, cz: -1.5, w: 3, d: 0.5 },
  { cx: 0, cz: 3.5, w: 0.5, d: 2 },
];

const CAT_SPAWN_POINTS = [
  { x: -4, z: 4 },
  { x: 4, z: 4 },
  { x: -4, z: -4 },
  { x: 4, z: -4 }
];

export class Level6 extends BaseLevel {
  private wallMeshes: THREE.Mesh[] = [];
  private wallMaterial!: THREE.MeshStandardMaterial;
  
  private glitchTimer: number = 2.0;
  private isGlitching: boolean = false;
  
  private kittyMesh: any | null = null;
  private wasTouchingCat: boolean = false;

  constructor(config: LevelConfig, deps: LevelDependencies) {
    super(config, deps);
  }

  override initialize(): void {
    super.initialize();
    
    this.wallMeshes = [];
    this.isGlitching = false;
    this.glitchTimer = Math.random() * 2 + 1;

    // 1. Build the Invisible Walls
    // We use wireframe to give it a cool digital/CRT look when it glitches
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffff, // Neon Cyan
      emissive: 0x00ffff,
      emissiveIntensity: 1.5,
      wireframe: true,
      transparent: true,
      opacity: 0 // Start completely invisible
    });

    for (const wall of MAZE_WALLS) {
      const geo = new THREE.BoxGeometry(wall.w, this.config.environment.wallHeight, wall.d);
      const mesh = new THREE.Mesh(geo, this.wallMaterial);
      mesh.position.set(wall.cx, this.config.environment.wallHeight / 2, wall.cz);
      this.worldRoot.add(mesh);
      this.wallMeshes.push(mesh);
    }

    // 2. Randomly Place the Cat
    const catAnchor = this.getObjectAnchor('cat.pet');
    if (catAnchor) {
      const randomSpot = CAT_SPAWN_POINTS[Math.floor(Math.random() * CAT_SPAWN_POINTS.length)];
      catAnchor.position.set(randomSpot.x, 0, randomSpot.z);
      this.attachProceduralKitty();
    }
  }

  protected override updateCustom(_ts: number, dt: number): void {
    if (this.deps.state.getDoorOpen()) return;

    // --- Glitch Logic ---
    this.glitchTimer -= dt;
    if (this.glitchTimer <= 0) {
      if (this.isGlitching) {
        // Turn Glitch Off
        this.isGlitching = false;
        this.wallMaterial.opacity = 0;
        this.glitchTimer = Math.random() * 3.5 + 1.5; // Hide for 1.5 to 5 seconds
      } else {
        // Turn Glitch On
        this.isGlitching = true;
        this.wallMaterial.opacity = 0.8;
        this.glitchTimer = Math.random() * 0.2 + 0.1; // Flash for a split second
        this.playGlitchAudio();
      }
    }

    // --- Cat Logic ---
    const catAnchor = this.getObjectAnchor('cat.pet');
    if (catAnchor) {
      const distance = Math.hypot(this.virtualPlayer.x - catAnchor.position.x, this.virtualPlayer.z - catAnchor.position.z);
      const touching = distance <= 0.85;

      if (touching && !this.wasTouchingCat) {
        this.deps.ui.setStatus('You found the glitch cat!', 'good');
      }
      this.wasTouchingCat = touching;
    }
  }

  protected override resolveCustomCollisions(): void {
    const playerRadius = this.config.player.radius;

    // Custom AABB collision for our procedural maze walls
    for (const wall of MAZE_WALLS) {
      const halfW = wall.w / 2;
      const halfD = wall.d / 2;
      const minX = wall.cx - halfW - playerRadius;
      const maxX = wall.cx + halfW + playerRadius;
      const minZ = wall.cz - halfD - playerRadius;
      const maxZ = wall.cz + halfD + playerRadius;

      if (this.virtualPlayer.x > minX && this.virtualPlayer.x < maxX &&
          this.virtualPlayer.z > minZ && this.virtualPlayer.z < maxZ) {
          
          // Determine the shallowest penetration depth to push the player out
          const pLeft = this.virtualPlayer.x - minX;
          const pRight = maxX - this.virtualPlayer.x;
          const pTop = this.virtualPlayer.z - minZ;
          const pBottom = maxZ - this.virtualPlayer.z;
          const minP = Math.min(pLeft, pRight, pTop, pBottom);

          if (minP === pLeft) this.virtualPlayer.x = minX;
          else if (minP === pRight) this.virtualPlayer.x = maxX;
          else if (minP === pTop) this.virtualPlayer.z = minZ;
          else if (minP === pBottom) this.virtualPlayer.z = maxZ;
      }
    }
    
    // Ensure the world wrapper updates based on the resolved collision
    this.worldRoot.position.set(-this.virtualPlayer.x, 0, -this.virtualPlayer.z);
  }

  private playGlitchAudio(): void {
    const sfxVolSetting = this.deps.ui.settings.sfxVol;
    if (sfxVolSetting === 0) return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    // Sawtooth wave gives it that harsh, industrial synthetic buzz
    osc.frequency.value = 65.41; // C2 note
    osc.type = 'sawtooth';
    
    const maxGain = 0.05;
    gain.gain.value = maxGain * (sfxVolSetting / 10); 
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    
    setTimeout(() => {
      osc.stop();
      void audioCtx.close();
    }, 150); // Sharp, quick cutoff
  }

  override teardown(): void {
    super.teardown();
    this.wallMeshes.length = 0;
  }

  // Cloned from Level 1
  private attachProceduralKitty(): void {
    const catAnchor = this.getObjectAnchor('cat.pet');
    if (!catAnchor) return;

    const fur = new THREE.MeshStandardMaterial({ color: 0xd7b282, roughness: 0.84, flatShading: true });
    const darkFur = new THREE.MeshStandardMaterial({ color: 0x9f7b55, roughness: 0.88, flatShading: true });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xe28f8f, roughness: 0.7, flatShading: true });

    const kitty = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 0.62), fur);
    body.position.set(0, 0.31, 0);
    kitty.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.46, 0.5), fur);
    head.position.set(0, 0.75, 0.2);
    kitty.add(head);

    const earLeft = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), fur);
    earLeft.position.set(-0.17, 1.09, 0.18);
    earLeft.rotation.z = Math.PI * 0.08;
    kitty.add(earLeft);

    const earRight = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), fur);
    earRight.position.set(0.17, 1.09, 0.18);
    earRight.rotation.z = -Math.PI * 0.08;
    kitty.add(earRight);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.06), noseMat);
    nose.position.set(0, 0.73, 0.47);
    kitty.add(nose);

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0f1116,
      roughness: 0.3,
      metalness: 0.25,
      flatShading: true
    });

    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x0d1422,
      roughness: 0.12,
      metalness: 0.45,
      flatShading: true
    });

    const lensLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.04), lensMat);
    lensLeft.position.set(-0.14, 0.82, 0.48);
    kitty.add(lensLeft);

    const lensRight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.04), lensMat);
    lensRight.position.set(0.14, 0.82, 0.48);
    kitty.add(lensRight);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.04), frameMat);
    bridge.position.set(0, 0.82, 0.48);
    kitty.add(bridge);

    const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.04), frameMat);
    topBar.position.set(0, 0.89, 0.48);
    kitty.add(topBar);

    const kittyScale = 0.75;
    kitty.scale.setScalar(kittyScale);
    
    kitty.position.set(0, 0, 0);
    kitty.rotation.y = Math.PI / 8;
    catAnchor.add(kitty);
    this.kittyMesh = kitty;
  }
}