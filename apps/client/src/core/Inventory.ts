import { BlockType } from '@voxel/shared';

export interface ItemState {
  type: number;
  count: number;
  durability?: number; // 0.0 to 1.0
}

export class Inventory {
  items: Map<number, ItemState> = new Map();

  constructor() {
    this.items.set(BlockType.GRASS, { type: BlockType.GRASS, count: 64 });
    this.items.set(BlockType.PICKAXE, { type: BlockType.PICKAXE, count: 1, durability: 1.0 });
    this.items.set(BlockType.AXE, { type: BlockType.AXE, count: 1, durability: 1.0 });
  }

  add(type: number, count: number = 1) {
    const existing = this.items.get(type);
    if (existing) {
      existing.count += count;
    } else {
      this.items.set(type, { type, count });
    }
  }

  remove(type: number, count: number = 1): boolean {
    const item = this.items.get(type);
    if (!item || item.count < count) return false;
    
    item.count -= count;
    if (item.count <= 0 && !this.isTool(type)) {
      this.items.delete(type);
    }
    return true;
  }

  useTool(type: number): boolean {
    const item = this.items.get(type);
    if (!item || item.durability === undefined) return false;
    
    item.durability -= 0.01;
    if (item.durability <= 0) {
      this.items.delete(type);
      return true; // tool broke
    }
    return false;
  }

  isTool(type: number): boolean {
    return type === BlockType.PICKAXE || type === BlockType.AXE;
  }

  getCount(type: number): number {
    return this.items.get(type)?.count || 0;
  }
  
  getDurability(type: number): number | undefined {
    return this.items.get(type)?.durability;
  }
}
