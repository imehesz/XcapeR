import * as THREE from 'three';
import { BaseLevel } from './BaseLevel';

export class Level1 extends BaseLevel {
  private wasTouchingCat = false;
  private meowAudio: HTMLAudioElement | null = null;
  private meowChance = 0.5;
  private kittyMesh: any | null = null;

  override initialize(): void {
    super.initialize();
    this.wasTouchingCat = false;
    this.kittyMesh = null;
    this.attachProceduralKitty();
    this.meowChance = this.config.custom?.catMeowChance ?? 0.5;
    if (this.config.custom?.catMeowUrl) {
      this.meowAudio = new Audio(this.config.custom.catMeowUrl);
      this.meowAudio.preload = 'auto';
      this.meowAudio.volume = 0.45;
    } else {
      this.meowAudio = null;
    }
  }

  override teardown(): void {
    this.wasTouchingCat = false;
    this.meowAudio = null;
    const catAnchor = this.getObjectAnchor('cat.pet');
    if (catAnchor && this.kittyMesh) {
      catAnchor.remove(this.kittyMesh);
      this.kittyMesh.traverse?.((child: any) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) {
          for (const material of child.material) {
            material?.dispose?.();
          }
        } else {
          child.material?.dispose?.();
        }
      });
      this.kittyMesh = null;
    }
    super.teardown();
  }

  protected override updateCustom(): void {
    const catObject = this.findObjectConfig('cat.pet');
    if (!catObject) {
      this.wasTouchingCat = false;
      return;
    }

    const catAnchor = this.getObjectAnchor(catObject.id);
    if (!catAnchor) {
      this.wasTouchingCat = false;
      return;
    }

    const playerPos = this.getVirtualPlayerPosition();
    const distance = Math.hypot(playerPos.x - catAnchor.position.x, playerPos.z - catAnchor.position.z);
    const touchRadius = catObject.interaction?.touchRadius ?? 0.85;
    const touching = distance <= touchRadius;

    if (!touching) {
      this.wasTouchingCat = false;
      return;
    }

    if (!this.wasTouchingCat) {
      this.maybePlayMeow();
    }
    this.wasTouchingCat = true;
  }

  private maybePlayMeow(): void {
    if (!this.meowAudio || Math.random() > this.meowChance) {
      return;
    }

    const meow = this.meowAudio.cloneNode(true) as HTMLAudioElement;
    meow.volume = this.meowAudio.volume;
    void meow.play().catch(() => {
      // Ignore playback errors caused by browser autoplay policies.
    });
  }

  private attachProceduralKitty(): void {
    const catAnchor = this.getObjectAnchor('cat.pet');
    if (!catAnchor) {
      return;
    }

    const fur = new THREE.MeshStandardMaterial({
      color: 0xd7b282,
      roughness: 0.84,
      metalness: 0.04,
      flatShading: true
    });
    const darkFur = new THREE.MeshStandardMaterial({
      color: 0x9f7b55,
      roughness: 0.88,
      metalness: 0.03,
      flatShading: true
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0xe28f8f,
      roughness: 0.7,
      metalness: 0.02,
      flatShading: true
    });

    const kitty = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 0.62), fur);
    body.position.set(0, 0.31, 0);
    kitty.add(body);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.46, 0.42), fur);
    chest.position.set(0, 0.26, 0.28);
    kitty.add(chest);

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

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.65, 6), darkFur);
    tail.position.set(-0.35, 0.63, -0.2);
    tail.rotation.x = Math.PI * 0.34;
    tail.rotation.z = Math.PI * 0.18;
    kitty.add(tail);

    const pawFrontLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.2), fur);
    pawFrontLeft.position.set(-0.18, 0.12, 0.34);
    kitty.add(pawFrontLeft);

    const pawFrontRight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.2), fur);
    pawFrontRight.position.set(0.18, 0.12, 0.34);
    kitty.add(pawFrontRight);

    const pawBackLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.24), darkFur);
    pawBackLeft.position.set(-0.25, 0.11, -0.2);
    kitty.add(pawBackLeft);

    const pawBackRight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.24), darkFur);
    pawBackRight.position.set(0.25, 0.11, -0.2);
    kitty.add(pawBackRight);

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
    const earCompensationScale = 1 / kittyScale;
    earLeft.scale.setScalar(earCompensationScale);
    earRight.scale.setScalar(earCompensationScale);

    kitty.position.set(0, 0, 0);
    catAnchor.add(kitty);
    this.kittyMesh = kitty;
  }
}
