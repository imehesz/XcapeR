import * as THREE from 'three';
import { gsap } from 'gsap';

export class Door {
  public readonly mesh: any;
  private readonly root: any;
  private readonly pivot: any;
  private readonly hingeX = -0.79;

  constructor() {
    const frameWidth = 1.86;
    const frameThickness = 0.14;
    const openingWidth = 1.58;
    const openingHeight = 2.58;

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x5f4232,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true
    });
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x8d5f3b,
      roughness: 0.88,
      metalness: 0.05,
      flatShading: true
    });
    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8a46a,
      roughness: 0.4,
      metalness: 0.75,
      flatShading: true
    });

    this.root = new THREE.Group();
    const frameGroup = new THREE.Group();
    const doorLeafGroup = new THREE.Group();

    // Leaf pivots from the left edge (hinge).
    const panel = new THREE.Mesh(new THREE.BoxGeometry(openingWidth, openingHeight, 0.22), doorMaterial);
    panel.position.set(openingWidth * 0.5, openingHeight * 0.5, 0);
    doorLeafGroup.add(panel);
    this.mesh = panel;

    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(frameWidth, 0.16, 0.32), frameMaterial);
    topBeam.position.set(0, 2.68, 0);
    frameGroup.add(topBeam);

    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, 2.64, 0.32), frameMaterial);
    leftPost.position.set(-0.86, 1.32, 0);
    frameGroup.add(leftPost);

    const rightPost = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, 2.64, 0.32), frameMaterial);
    rightPost.position.set(0.86, 1.32, 0);
    frameGroup.add(rightPost);

    const insetPanel = new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.84, 0.08), frameMaterial);
    insetPanel.position.set(openingWidth * 0.5, openingHeight * 0.51, 0.09);
    doorLeafGroup.add(insetPanel);

    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), metalMaterial);
    knob.position.set(1.42, 1.28, 0.14);
    doorLeafGroup.add(knob);

    this.pivot = new THREE.Group();
    this.pivot.add(doorLeafGroup);
    this.pivot.position.set(this.hingeX, 0, 0);

    this.root.add(frameGroup);
    this.root.add(this.pivot);
  }

  get object3D(): any {
    return this.root;
  }

  open(): Promise<void> {
    return new Promise((resolve) => {
      gsap.to(this.pivot.rotation, {
        y: -Math.PI * 0.55,
        duration: 0.65,
        ease: 'power2.out',
        onComplete: resolve
      });
    });
  }

  checkUnlockCriteria(keysOwned: number, keysRequired: number): boolean {
    return keysOwned >= keysRequired;
  }

  lockedShake(): void {
    const originX = this.root.position.x;
    gsap.fromTo(
      this.root.position,
      { x: originX - 0.06 },
      {
        x: originX + 0.06,
        duration: 0.05,
        repeat: 4,
        yoyo: true,
        ease: 'power1.inOut',
        onComplete: () => {
          this.root.position.x = originX;
        }
      }
    );
  }

  reset(): void {
    gsap.killTweensOf(this.pivot.rotation);
    gsap.killTweensOf(this.root.position);
    this.pivot.rotation.y = 0;
  }

  dispose(): void {
    this.root.traverse((child: any) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        for (const material of child.material) {
          material.dispose?.();
        }
      } else {
        child.material?.dispose?.();
      }
    });
  }
}
