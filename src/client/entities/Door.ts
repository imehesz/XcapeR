import * as THREE from 'three';
import { gsap } from 'gsap';

export class Door {
  public readonly mesh: any;
  private readonly pivot: any;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2.6, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x7c4628 })
    );

    this.mesh.position.set(0.8, 0, 0);

    this.pivot = new THREE.Group();
    this.pivot.add(this.mesh);
    this.pivot.position.set(-0.8, 1.4, 4.45);
  }

  get object3D(): any {
    return this.pivot;
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

  lockedShake(): void {
    gsap.fromTo(
      this.pivot.position,
      { x: -0.8 - 0.06 },
      {
        x: -0.8 + 0.06,
        duration: 0.05,
        repeat: 4,
        yoyo: true,
        ease: 'power1.inOut',
        onComplete: () => {
          this.pivot.position.x = -0.8;
        }
      }
    );
  }
}
