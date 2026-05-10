export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  WOOD = 4,
  WATER = 5,
  SAND = 6,
  LOG = 7,
  LEAVES = 8,
  PICKAXE = 9,
  AXE = 10,
}

export const BLOCK_PROPS: Record<number, { hardness: number, tool?: number }> = {
  [BlockType.GRASS]: { hardness: 0.5 },
  [BlockType.DIRT]: { hardness: 0.5 },
  [BlockType.STONE]: { hardness: 2.0, tool: BlockType.PICKAXE },
  [BlockType.WOOD]: { hardness: 1.0, tool: BlockType.AXE },
  [BlockType.SAND]: { hardness: 0.4 },
  [BlockType.LOG]: { hardness: 1.2, tool: BlockType.AXE },
  [BlockType.LEAVES]: { hardness: 0.2 },
};

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface BlockUpdate {
  pos: Vector3;
  type: BlockType;
}

export const CHUNK_SIZE = 16;

export function getBlockIndex(x: number, y: number, z: number): number {
  return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
}

export interface ChunkData {
  x: number;
  y: number;
  z: number;
  blocks: Uint8Array;
}

export interface MobData {
  id: string;
  type: string;
  pos: Vector3;
  rot: number; // yaw
}

export interface PlayerData {
  id: string;
  pos: Vector3;
  rot: number;
}

export interface ChatMessage {
  sender: string;
  text: string;
}
