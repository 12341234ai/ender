export const BLOCK_SIZE = 32;
export const WORLD_WIDTH = 600;
export const WORLD_HEIGHT = 120;
export const SURFACE_BASE_Y = 42;

export const GRAVITY = 0.55;
export const JUMP_FORCE = -11.5;
export const MOVE_SPEED = 4.5;
export const MAX_FALL_SPEED = 20;
export const CREATIVE_FLY_SPEED = 6;

export const PLAYER_W = 28;
export const PLAYER_H = 54;

export const MINE_RADIUS = 5.5;
export const MAX_HP = 20;
export const MAX_HUNGER = 20;

export const DAY_LENGTH = 20000;

export const BLOCKS = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COAL: 4,
  IRON: 5,
  DIAMOND: 6,
  WOOD: 7,
  LEAVES: 8,
  SAND: 9,
  GRAVEL: 10,
  WATER: 11,
  LAVA: 12,
  GLASS: 13,
  BRICK: 14,
  PLANKS: 15,
  OBSIDIAN: 16,
  SNOW: 17,
  ICE: 18,
  BEDROCK: 19,
  FLOWER: 20,
  CACTUS: 21,
  TORCH: 22,
  CHEST: 23,
  CRAFTING: 24,
  GOLD_ORE: 25,
  REDSTONE_ORE: 26,
  EMERALD_ORE: 27,
  SPONGE: 28,
  TNT: 29,
} as const;

export type BlockType = (typeof BLOCKS)[keyof typeof BLOCKS];

export const NON_SOLID_BLOCKS = new Set<number>([
  BLOCKS.AIR, BLOCKS.WATER, BLOCKS.LAVA, BLOCKS.FLOWER, BLOCKS.TORCH,
]);

export const LIQUID_BLOCKS = new Set<number>([BLOCKS.WATER, BLOCKS.LAVA]);

export const BLOCK_NAMES: Record<number, string> = {
  0: "Air", 1: "Grass", 2: "Dirt", 3: "Stone", 4: "Coal Ore",
  5: "Iron Ore", 6: "Diamond Ore", 7: "Log", 8: "Leaves",
  9: "Sand", 10: "Gravel", 11: "Water", 12: "Lava",
  13: "Glass", 14: "Brick", 15: "Planks", 16: "Obsidian",
  17: "Snow", 18: "Ice", 19: "Bedrock", 20: "Flower",
  21: "Cactus", 22: "Torch", 23: "Chest", 24: "Crafting Table",
  25: "Gold Ore", 26: "Redstone Ore", 27: "Emerald Ore", 28: "Sponge", 29: "TNT",
};

export const CREATIVE_PALETTE: BlockType[] = [
  BLOCKS.GRASS, BLOCKS.DIRT, BLOCKS.STONE, BLOCKS.WOOD, BLOCKS.PLANKS,
  BLOCKS.LEAVES, BLOCKS.SAND, BLOCKS.GRAVEL, BLOCKS.BRICK, BLOCKS.GLASS,
  BLOCKS.OBSIDIAN, BLOCKS.COAL, BLOCKS.IRON, BLOCKS.GOLD_ORE, BLOCKS.DIAMOND,
  BLOCKS.EMERALD_ORE, BLOCKS.REDSTONE_ORE, BLOCKS.SNOW, BLOCKS.ICE, BLOCKS.LAVA,
  BLOCKS.WATER, BLOCKS.FLOWER, BLOCKS.CACTUS, BLOCKS.TORCH, BLOCKS.CHEST,
  BLOCKS.CRAFTING, BLOCKS.SPONGE, BLOCKS.TNT, BLOCKS.BEDROCK,
];

export const HOTBAR_SLOTS = 9;
export const DEFAULT_HOTBAR: BlockType[] = [
  BLOCKS.DIRT, BLOCKS.STONE, BLOCKS.WOOD, BLOCKS.PLANKS, BLOCKS.GLASS,
  BLOCKS.BRICK, BLOCKS.SAND, BLOCKS.TORCH, BLOCKS.DIAMOND,
];

export const SAVE_KEY = "mc2d_save_v5";
export const PROFILE_LIST_KEY = "mc2d_profiles_v1";

export enum GameMode {
  SURVIVAL = "survival",
  CREATIVE = "creative",
}
