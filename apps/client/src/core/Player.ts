import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { BlockType, CHUNK_SIZE } from '@voxel/shared';
import { World } from './World';
import { AudioManager } from './AudioManager';

export class Player {
  controls: PointerLockControls;
  velocity = new THREE.Vector3();
  moveState = { forward: false, backward: false, left: false, right: false };
  onGround = false;
  playerSize = { width: 0.6, height: 1.8 };
  world: World;
  camera: THREE.PerspectiveCamera;
  lastStepDist = 0;
  gravityWait = true;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, world: World) {
    this.camera = camera;
    this.world = world;
    this.controls = new PointerLockControls(camera, domElement);
    this.camera.position.set(0, 50, 0); // Start high for safe chunk load

    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));
    domElement.addEventListener('click', () => { if (!this.controls.isLocked) this.controls.lock(); });
  }

  onKeyDown(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW': this.moveState.forward = true; break;
      case 'KeyS': this.moveState.backward = true; break;
      case 'KeyA': this.moveState.left = true; break;
      case 'KeyD': this.moveState.right = true; break;
      case 'Space': if (this.onGround) this.velocity.y = 6.0; break;
    }
  }

  onKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW': this.moveState.forward = false; break;
      case 'KeyS': this.moveState.backward = false; break;
      case 'KeyA': this.moveState.left = false; break;
      case 'KeyD': this.moveState.right = false; break;
    }
  }

  checkCollision(pos: THREE.Vector3) {
    const minX = pos.x - this.playerSize.width / 2, maxX = pos.x + this.playerSize.width / 2;
    const minY = pos.y - this.playerSize.height, maxY = pos.y;
    const minZ = pos.z - this.playerSize.width / 2, maxZ = pos.z + this.playerSize.width / 2;
    for (let x = Math.floor(minX); x <= Math.floor(maxX); x++) {
      for (let y = Math.floor(minY); y <= Math.floor(maxY); y++) {
        for (let z = Math.floor(minZ); z <= Math.floor(maxZ); z++) {
          if (this.world.getBlockAt(x, y, z) !== BlockType.AIR) return true;
        }
      }
    }
    return false;
  }

  update(delta: number, audio: AudioManager) {
    if (!this.controls.isLocked) return;

    // Void Protection
    if (this.camera.position.y < -100) {
        this.camera.position.set(0, 50, 0);
        this.velocity.set(0, 0, 0);
        this.gravityWait = true;
        return;
    }

    // Wait for world data before applying gravity
    if (this.gravityWait) {
        const cx = Math.floor(this.camera.position.x / CHUNK_SIZE);
        const cz = Math.floor(this.camera.position.z / CHUNK_SIZE);
        let hasData = false;
        // Check if any chunk at the vertical column exists
        for (let cy = -2; cy <= 4; cy++) {
            if (this.world.chunks.has(`${cx},${cy},${cz}`)) {
                hasData = true;
                break;
            }
        }
        if (!hasData) return; // Stay suspended until world arrives
        this.gravityWait = false;
    }

    const oldPos = this.camera.position.clone();
    const epsilon = 0.001; 

    // Gravity
    this.velocity.y -= 9.8 * 2.0 * delta; 

    const direction = new THREE.Vector3();
    direction.z = Number(this.moveState.forward) - Number(this.moveState.backward);
    direction.x = Number(this.moveState.right) - Number(this.moveState.left);
    direction.normalize();

    const speed = 8.0;
    const horizontalVelocity = new THREE.Vector3();
    if (this.moveState.forward || this.moveState.backward) horizontalVelocity.z -= direction.z * speed;
    if (this.moveState.left || this.moveState.right) horizontalVelocity.x -= direction.x * speed;

    const stepHeight = 0.6;

    // 1. Move Right/Left (X)
    const oldPosX = this.camera.position.x;
    this.controls.moveRight(horizontalVelocity.x * delta);
    if (this.checkCollision(this.camera.position)) {
      this.camera.position.y += stepHeight;
      if (this.checkCollision(this.camera.position)) {
        this.camera.position.y -= stepHeight;
        this.camera.position.x = oldPosX;
      }
    }

    // 2. Move Forward/Backward (Z)
    const oldPosZ = this.camera.position.z;
    const oldPosXAfterX = this.camera.position.x;
    this.controls.moveForward(horizontalVelocity.z * delta);
    if (this.checkCollision(this.camera.position)) {
        this.camera.position.y += stepHeight;
        if (this.checkCollision(this.camera.position)) {
          this.camera.position.y -= stepHeight;
          this.camera.position.z = oldPosZ;
          this.camera.position.x = oldPosXAfterX;
        }
    }

    // 3. Vertical (Y)
    const oldPosY = this.camera.position.y;
    this.camera.position.y += this.velocity.y * delta;
    if (this.checkCollision(this.camera.position)) {
      if (this.velocity.y < 0) this.onGround = true;
      this.camera.position.y = oldPosY;
      this.velocity.y = 0;
    } else {
      this.onGround = false;
    }

    if (this.checkCollision(this.camera.position)) this.camera.position.y += epsilon;

    // Step Sound
    if (this.onGround) {
        const moved = new THREE.Vector3(this.camera.position.x, 0, this.camera.position.z).distanceTo(new THREE.Vector3(oldPos.x, 0, oldPos.z));
        this.lastStepDist += moved;
        if (this.lastStepDist > 2.0) {
            audio.playStep();
            this.lastStepDist = 0;
        }
    }
  }
}
