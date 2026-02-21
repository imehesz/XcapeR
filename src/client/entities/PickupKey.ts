import * as THREE from 'three';

export class PickupKey {
  public readonly mesh: any;
  private readonly light: any;
  private readonly pickupRadius: number;
  private readonly itemId: string;
  private readonly onPickedUp: (itemId: string) => void;
  private picked = false;

  constructor(
    position: { x: number; y: number; z: number },
    pickupRadius: number,
    itemId: string,
    onPickedUp: (itemId: string) => void
  ) {
    this.pickupRadius = pickupRadius;
    this.itemId = itemId;
    this.onPickedUp = onPickedUp;

    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.22, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xe9c46a, metalness: 0.35, roughness: 0.2 })
    );
    this.mesh.position.set(position.x, position.y, position.z);

    this.light = new THREE.PointLight(0xffd76a, 14, 8);
    this.light.position.set(position.x, 2.1, position.z);
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
      this.mesh.rotation.y += dt * 1.8;
    }
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
    this.mesh.geometry?.dispose?.();
    this.mesh.material?.dispose?.();
    this.light.dispose?.();
  }
}
