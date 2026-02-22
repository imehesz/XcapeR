import * as THREE from 'three';
import { type EnvironmentConfig } from '../game/levels';

const FIT_MARGIN = 1.12;

export class SceneManager {
  public readonly scene: any;
  public readonly camera: any;
  public readonly renderer: any;
  public readonly clock: any;
  public readonly root: any;

  private readonly app: HTMLElement;
  private lightNodes: any[] = [];
  private starfieldTexture: any | null = null;

  constructor(app: HTMLElement) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.starfieldTexture = this.createStarfieldTexture();
    this.scene.background = this.starfieldTexture;

    const cameraAspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(-8 * cameraAspect, 8 * cameraAspect, 8, -8, 0.1, 100);
    this.camera.position.set(10, 9, 10);
    this.camera.lookAt(0, 1.2, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.app.appendChild(this.renderer.domElement);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.clock = new THREE.Clock();

    window.addEventListener('resize', this.onResize);
  }

  setEnvironment(environment: EnvironmentConfig): void {
    for (const light of this.lightNodes) {
      this.scene.remove(light);
    }
    this.lightNodes = [];

    const ambient = new THREE.AmbientLight(0xffffff, environment.lighting.ambientIntensity);
    this.scene.add(ambient);
    this.lightNodes.push(ambient);

    for (const directionalCfg of environment.lighting.directional) {
      const directional = new THREE.DirectionalLight(directionalCfg.color, directionalCfg.intensity);
      directional.position.set(directionalCfg.position.x, directionalCfg.position.y, directionalCfg.position.z);
      this.scene.add(directional);
      this.lightNodes.push(directional);
    }
  }

  fitCameraToRoom(roomHalf: number, wallHeight: number): void {
    const aspect = window.innerWidth / window.innerHeight;
    const roomBounds = new THREE.Box3(
      new THREE.Vector3(-roomHalf, 0, -roomHalf),
      new THREE.Vector3(roomHalf, wallHeight, roomHalf)
    );

    const corners = [
      new THREE.Vector3(roomBounds.min.x, roomBounds.min.y, roomBounds.min.z),
      new THREE.Vector3(roomBounds.min.x, roomBounds.min.y, roomBounds.max.z),
      new THREE.Vector3(roomBounds.min.x, roomBounds.max.y, roomBounds.min.z),
      new THREE.Vector3(roomBounds.min.x, roomBounds.max.y, roomBounds.max.z),
      new THREE.Vector3(roomBounds.max.x, roomBounds.min.y, roomBounds.min.z),
      new THREE.Vector3(roomBounds.max.x, roomBounds.min.y, roomBounds.max.z),
      new THREE.Vector3(roomBounds.max.x, roomBounds.max.y, roomBounds.min.z),
      new THREE.Vector3(roomBounds.max.x, roomBounds.max.y, roomBounds.max.z)
    ];

    this.camera.updateMatrixWorld(true);

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const corner of corners) {
      const view = corner.clone().applyMatrix4(this.camera.matrixWorldInverse);
      minX = Math.min(minX, view.x);
      maxX = Math.max(maxX, view.x);
      minY = Math.min(minY, view.y);
      maxY = Math.max(maxY, view.y);
    }

    const centerX = (minX + maxX) * 0.5;
    const centerY = (minY + maxY) * 0.5;
    const halfWidth = ((maxX - minX) * 0.5) * FIT_MARGIN;
    const halfHeight = ((maxY - minY) * 0.5) * FIT_MARGIN;
    const fittedHalfHeight = Math.max(halfHeight, halfWidth / aspect);
    const fittedHalfWidth = fittedHalfHeight * aspect;

    this.camera.left = centerX - fittedHalfWidth;
    this.camera.right = centerX + fittedHalfWidth;
    this.camera.top = centerY + fittedHalfHeight;
    this.camera.bottom = centerY - fittedHalfHeight;
    this.camera.updateProjectionMatrix();
  }

  getDelta(): number {
    return Math.min(this.clock.getDelta(), 0.05);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.starfieldTexture?.dispose();
    this.starfieldTexture = null;
    this.renderer.dispose();
  }

  private readonly onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private createStarfieldTexture(): any {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return new THREE.Color(0x000000);
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#070b1b');
    gradient.addColorStop(1, '#02040c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const starCount = 420;
    for (let i = 0; i < starCount; i += 1) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = Math.random() * 1.2 + 0.15;
      const alpha = Math.random() * 0.65 + 0.2;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 250, 255, ${alpha})`;
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
