import { BlockType, CHUNK_SIZE, getBlockIndex, MobData, Vector3 } from '@voxel/shared';

export class Mob {
  id: string;
  type: string;
  pos: Vector3;
  rot: number = 0;
  velocity: Vector3 = { x: 0, y: 0, z: 0 };
  
  constructor(id: string, type: string, x: number, y: number, z: number) {
    this.id = id; this.type = type; this.pos = { x, y, z };
  }

  update(delta: number, getBlock: (x: number, y: number, z: number) => number) {
    // Gravity
    this.velocity.y -= 9.8 * delta;

    // AI: Random walk
    if (Math.random() < 0.01) {
      this.velocity.x = (Math.random() - 0.5) * 4;
      this.velocity.z = (Math.random() - 0.5) * 4;
      this.rot = Math.atan2(this.velocity.x, this.velocity.z);
    }

    // Move & Collision (very basic for mobs)
    const newY = this.pos.y + this.velocity.y * delta;
    if (getBlock(Math.floor(this.pos.x), Math.floor(newY), Math.floor(this.pos.z)) === BlockType.AIR) {
      this.pos.y = newY;
    } else {
      this.velocity.y = 0;
    }

    const newX = this.pos.x + this.velocity.x * delta;
    if (getBlock(Math.floor(newX), Math.floor(this.pos.y + 0.5), Math.floor(this.pos.z)) === BlockType.AIR) {
      this.pos.x = newX;
    }

    const newZ = this.pos.z + this.velocity.z * delta;
    if (getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.5), Math.floor(newZ)) === BlockType.AIR) {
      this.pos.z = newZ;
    }
  }

  getData(): MobData {
    return { id: this.id, type: this.type, pos: this.pos, rot: this.rot };
  }
}

export class MobManager {
  mobs: Mob[] = [];

  constructor() {
    // Initial mobs
    for (let i = 0; i < 5; i++) {
      this.mobs.push(new Mob(`mob_${i}`, 'villager', Math.random() * 20 - 10, 30, Math.random() * 20 - 10));
    }
  }

  update(delta: number, getBlock: (x: number, y: number, z: number) => number) {
    this.mobs.forEach(mob => mob.update(delta, getBlock));
  }

  getMobData(): MobData[] {
    return this.mobs.map(mob => mob.getData());
  }
}
