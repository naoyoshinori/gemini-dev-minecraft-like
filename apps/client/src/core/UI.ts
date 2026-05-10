import { BlockType } from '@voxel/shared';
import { Inventory } from './Inventory';

export class UI {
  hud: HTMLDivElement;
  coordsHud: HTMLDivElement;
  inventoryOverlay: HTMLDivElement;
  chatOverlay: HTMLDivElement;
  chatInput: HTMLInputElement;
  chatHistory: HTMLDivElement;
  slots: HTMLElement[] = [];
  selectedBlock = BlockType.GRASS;
  onBlockSwitch: (type: number) => void;
  onChatMessage: (text: string) => void;
  inventory: Inventory;
  isInventoryOpen = false;
  isChatOpen = false;

  constructor(inventory: Inventory, onBlockSwitch: (type: number) => void, onChatMessage: (text: string) => void) {
    this.inventory = inventory;
    this.onBlockSwitch = onBlockSwitch;
    this.onChatMessage = onChatMessage;

    this.hud = this.createDiv('absolute', { bottom: '20px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px' });
    this.coordsHud = this.createDiv('absolute', { top: '10px', left: '10px', color: 'white', fontFamily: 'monospace', backgroundColor: 'rgba(0,0,0,0.5)', padding: '5px' });
    this.createDiv('absolute', { top: '50%', left: '50%', width: '20px', height: '20px', border: '2px solid white', borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' });

    this.inventoryOverlay = this.createDiv('absolute', { top: '0', left: '0', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: '100' });
    this.inventoryOverlay.innerHTML = '<h2>Inventory</h2><div id="inv-grid" style="display:grid; grid-template-columns: repeat(4, 60px); gap:10px;"></div><button id="craft-btn" style="margin-top:20px; padding:10px;">Craft Log -> 4 Wood</button>';

    this.chatOverlay = this.createDiv('absolute', { bottom: '100px', left: '20px', width: '300px', height: '200px', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', color: 'white', zIndex: '50', pointerEvents: 'none' });
    this.chatHistory = document.createElement('div');
    this.chatHistory.style.flex = '1'; this.chatHistory.style.overflowY = 'auto'; this.chatHistory.style.padding = '5px';
    this.chatOverlay.appendChild(this.chatHistory);
    this.chatInput = document.createElement('input');
    this.chatInput.style.backgroundColor = 'rgba(0,0,0,0.8)'; this.chatInput.style.color = 'white'; this.chatInput.style.border = 'none'; this.chatInput.style.width = '100%'; this.chatInput.style.display = 'none'; this.chatInput.style.pointerEvents = 'auto';
    this.chatOverlay.appendChild(this.chatInput);

    this.setupHotbar();
    this.setupEvents();
  }

  createDiv(position: string, style: Partial<CSSStyleDeclaration>): HTMLDivElement {
    const div = document.createElement('div');
    div.style.position = position;
    Object.assign(div.style, style);
    document.body.appendChild(div);
    return div;
  }

  setupHotbar() {
    this.hud.innerHTML = '';
    this.slots = [];
    [BlockType.GRASS, BlockType.STONE, BlockType.LOG, BlockType.PICKAXE, BlockType.AXE].forEach((type, i) => {
      const slot = document.createElement('div');
      slot.style.width = '50px'; slot.style.height = '50px'; slot.style.border = '2px solid white';
      slot.style.backgroundColor = 'rgba(0,0,0,0.5)'; slot.style.position = 'relative';
      slot.style.display = 'flex'; slot.style.alignItems = 'center'; slot.style.justifyContent = 'center'; slot.style.color = 'white';
      
      const label = document.createElement('span');
      label.innerText = (i + 1).toString();
      slot.appendChild(label);

      const dur = this.inventory.getDurability(type);
      if (dur !== undefined) {
          const bar = document.createElement('div');
          bar.style.position = 'absolute'; bar.style.bottom = '0'; bar.style.left = '0';
          bar.style.height = '4px'; bar.style.backgroundColor = 'green';
          bar.style.width = `${dur * 100}%`;
          slot.appendChild(bar);
      }

      if (type === this.selectedBlock) slot.style.borderColor = 'yellow';
      this.hud.appendChild(slot); this.slots.push(slot);
    });
  }

  setupEvents() {
    document.addEventListener('keydown', (e) => {
      if (this.isInventoryOpen && e.key !== 'e' && e.key !== 'E') return;
      if (this.isChatOpen) {
        if (e.key === 'Enter') {
          if (this.chatInput.value) { this.onChatMessage(this.chatInput.value); this.chatInput.value = ''; }
          this.closeChat();
        }
        return;
      }
      if (e.key === 't' || e.key === 'T') { this.openChat(); e.preventDefault(); return; }
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        const types = [BlockType.GRASS, BlockType.STONE, BlockType.LOG, BlockType.PICKAXE, BlockType.AXE];
        this.selectedBlock = types[idx];
        this.setupHotbar();
        this.onBlockSwitch(this.selectedBlock);
      }
    });

    document.getElementById('craft-btn')?.addEventListener('click', () => {
      if (this.inventory.remove(BlockType.LOG, 1)) { this.inventory.add(BlockType.WOOD, 4); this.updateInventoryUI(); }
    });
  }

  openChat() { this.isChatOpen = true; this.chatInput.style.display = 'block'; this.chatInput.focus(); }
  closeChat() { this.isChatOpen = false; this.chatInput.style.display = 'none'; this.chatInput.blur(); }

  addChat(sender: string, text: string) {
    const msg = document.createElement('div');
    msg.innerText = `${sender}: ${text}`;
    this.chatHistory.appendChild(msg);
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
  }

  toggleInventory(controls: any) {
    this.isInventoryOpen = !this.isInventoryOpen;
    this.inventoryOverlay.style.display = this.isInventoryOpen ? 'flex' : 'none';
    if (this.isInventoryOpen) { controls.unlock(); this.updateInventoryUI(); }
    else { controls.lock(); }
  }

  updateInventoryUI() {
    const grid = document.getElementById('inv-grid')!;
    grid.innerHTML = '';
    [BlockType.GRASS, BlockType.DIRT, BlockType.STONE, BlockType.WOOD, BlockType.LOG, BlockType.LEAVES].forEach(type => {
      const count = this.inventory.getCount(type);
      const cell = document.createElement('div');
      cell.style.width = '60px'; cell.style.height = '60px'; cell.style.border = '1px solid white';
      cell.style.display = 'flex'; cell.style.flexDirection = 'column'; cell.style.alignItems = 'center'; cell.style.justifyContent = 'center';
      cell.innerHTML = `<span style="font-size:10px">${BlockType[type]}</span><span>${count}</span>`;
      grid.appendChild(cell);
    });
  }

  updateCoords(pos: { x: number, y: number, z: number }, chunk: { x: number, y: number, z: number }) {
    this.coordsHud.innerText = `Pos: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}\nChunk: ${chunk.x}, ${chunk.y}, ${chunk.z}`;
  }
}
