import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { gsap } from 'gsap';

export class Door {
  public readonly mesh: any;
  private readonly pivot: any;
  private readonly hingeX = -0.8;

  constructor() {
    const fallbackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2.6, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x7c4628 })
    );

    fallbackMesh.position.set(0.8, 0, 0);
    this.mesh = fallbackMesh;

    this.pivot = new THREE.Group();
    this.pivot.add(fallbackMesh);
    this.pivot.position.set(this.hingeX, 1.4, 4.45);

    this.loadMedievalDoor(fallbackMesh);
  }

  get object3D(): any {
    return this.pivot;
  }

  private loadMedievalDoor(fallbackMesh: any): void {
    const objUrl = new URL('../../../assets/models/door_medieval/door.obj', import.meta.url).href;
    const textureUrl = new URL('../../../assets/models/door_medieval/door.png', import.meta.url).href;

    const texture = new THREE.TextureLoader().load(textureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;

    const loader = new OBJLoader();
    loader.load(
      objUrl,
      (object: any) => {
        const initialBounds = new THREE.Box3().setFromObject(object);
        const initialSize = initialBounds.getSize(new THREE.Vector3());
        if (initialSize.x <= 0.0001 || initialSize.y <= 0.0001) {
          return;
        }

        let uniformScale = 1.6 / initialSize.x;
        if (initialSize.y * uniformScale > 2.9) {
          uniformScale = 2.9 / initialSize.y;
        }
        object.scale.setScalar(uniformScale);

        const fittedBounds = new THREE.Box3().setFromObject(object);
        const fittedCenter = fittedBounds.getCenter(new THREE.Vector3());
        object.position.set(-fittedBounds.min.x, -fittedBounds.min.y, -fittedCenter.z);

        object.traverse((child: any) => {
          if (!(child instanceof THREE.Mesh)) {
            return;
          }

          child.material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.82,
            metalness: 0.04
          });
        });

        this.pivot.remove(fallbackMesh);
        this.pivot.add(object);
      },
      undefined,
      () => {
        // Keep fallback mesh when medieval model fails to load.
      }
    );
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
      { x: this.hingeX - 0.06 },
      {
        x: this.hingeX + 0.06,
        duration: 0.05,
        repeat: 4,
        yoyo: true,
        ease: 'power1.inOut',
        onComplete: () => {
          this.pivot.position.x = this.hingeX;
        }
      }
    );
  }

  reset(): void {
    gsap.killTweensOf(this.pivot.rotation);
    gsap.killTweensOf(this.pivot.position);
    this.pivot.rotation.y = 0;
    this.pivot.position.x = this.hingeX;
  }
}
