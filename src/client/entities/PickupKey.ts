import * as THREE from 'three';

export class PickupKey {
  public readonly mesh: any;
  private readonly light: any;
  private readonly pickupRadius: number;
  private readonly itemId: string;
  private readonly onPickedUp: (itemId: string) => void;
  private picked = false;
  private spinPhase = Math.random() * Math.PI * 2;

  constructor(
    position: { x: number; y: number; z: number },
    pickupRadius: number,
    itemId: string,
    onPickedUp: (itemId: string) => void
  ) {
    this.pickupRadius = pickupRadius;
    this.itemId = itemId;
    this.onPickedUp = onPickedUp;

    const keyMaterial = new THREE.MeshStandardMaterial({ color: 0xe9c46a, metalness: 0.35, roughness: 0.22 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0xa88432, metalness: 0.45, roughness: 0.28 });

    const keyRoot = new THREE.Group();

    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.06, 4, 6), keyMaterial);
    bow.position.set(0, 0.86, 0);
    keyRoot.add(bow);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 6), keyMaterial);
    stem.position.set(0, 0.45, 0);
    keyRoot.add(stem);

    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.14), darkMetal);
    shoulder.position.set(0, 0.1, 0);
    keyRoot.add(shoulder);

    const toothA = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.12), keyMaterial);
    toothA.position.set(-0.04, -0.06, 0);
    keyRoot.add(toothA);

    const toothB = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.12), keyMaterial);
    toothB.position.set(0.07, -0.09, 0);
    keyRoot.add(toothB);

    keyRoot.scale.setScalar(0.82);
    keyRoot.rotation.x = Math.PI * 0.05;
    this.mesh = keyRoot;
    this.mesh.position.set(position.x, position.y, position.z);

    this.light = new THREE.PointLight(0xffd76a, 14, 8);
    this.light.position.set(position.x, position.y + 1.4, position.z);
  }

  addTo(parent: any): void {
    parent.add(this.mesh);
    parent.add(this.light);
  }

  removeFrom(parent: any): void {
    parent.remove(this.mesh);
    parent.remove(this.light);
  }

  update(dt: number): void {
    if (!this.picked) {
      this.spinPhase += dt;
      this.mesh.position.y += Math.sin(this.spinPhase * 2) * dt * 0.05;
      this.mesh.rotation.y += dt * 1.8;
    }
  }

  setCarryPose(playerPosition: { x: number; z: number }, heading: number, index = 0): void {
    const forwardDistance = 0.68;
    const sideStep = index * 0.16;
    const baseX = playerPosition.x + Math.sin(heading) * forwardDistance;
    const baseZ = playerPosition.z + Math.cos(heading) * forwardDistance;
    const sideX = Math.sin(heading + Math.PI / 2) * sideStep;
    const sideZ = Math.cos(heading + Math.PI / 2) * sideStep;
    this.mesh.position.set(baseX + sideX, 0.92, baseZ + sideZ);
    this.mesh.rotation.x = Math.PI * 0.2;
    this.mesh.rotation.y = heading + Math.PI * 0.25;
    this.mesh.rotation.z = -Math.PI * 0.08;
  }

  tryPickup(playerPosition: { x: number; z: number }): boolean {
    if (this.picked) {
      return false;
    }

    const dx = playerPosition.x - this.mesh.position.x;
    const dz = playerPosition.z - this.mesh.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > this.pickupRadius) {
      return false;
    }

    this.picked = true;
    this.onPickedUp(this.itemId);
    return true;
  }

  get position(): { x: number; z: number } {
    return { x: this.mesh.position.x, z: this.mesh.position.z };
  }

  dispose(parent: any): void {
    this.removeFrom(parent);
    this.mesh.traverse?.((child: any) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        for (const material of child.material) {
          material?.dispose?.();
        }
      } else {
        child.material?.dispose?.();
      }
    });
    this.light.dispose?.();
  }
}
