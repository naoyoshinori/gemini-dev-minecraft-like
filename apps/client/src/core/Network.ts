export class Network {
  socket: WebSocket;
  onMessage: (message: any) => void;

  constructor(onMessage: (message: any) => void) {
    this.socket = new WebSocket(`ws://${window.location.hostname}:3000`);
    this.onMessage = onMessage;

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.onMessage(message);
    };
  }

  send(type: string, data: any) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, data }));
    }
  }

  requestChunk(x: number, y: number, z: number) {
    this.send('request_chunk', { x, y, z });
  }

  sendBlockUpdate(x: number, y: number, z: number, type: number) {
    this.send('block_update', { pos: { x, y, z }, type });
  }
}
