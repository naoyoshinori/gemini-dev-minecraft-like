import * as THREE from 'three';

export class WeatherManager {
  scene: THREE.Scene;
  rain: THREE.Points | null = null;
  snow: THREE.Points | null = null;
  currentWeather: string = 'CLEAR';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createRain();
    this.createSnow();
  }

  private createRain() {
    const geo = new THREE.BufferGeometry();
    const pos = [];
    for (let i = 0; i < 5000; i++) {
      pos.push(Math.random() * 100 - 50, Math.random() * 50, Math.random() * 100 - 50);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xaaaaaf, size: 0.1, transparent: true, opacity: 0.6 });
    this.rain = new THREE.Points(geo, mat);
  }

  private createSnow() {
    const geo = new THREE.BufferGeometry();
    const pos = [];
    for (let i = 0; i < 3000; i++) {
      pos.push(Math.random() * 100 - 50, Math.random() * 50, Math.random() * 100 - 50);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.8 });
    this.snow = new THREE.Points(geo, mat);
  }

  update(weather: string, playerPos: THREE.Vector3, delta: number) {
    this.currentWeather = weather;

    if (this.rain) {
      if (weather === 'RAIN') {
        if (!this.rain.parent) this.scene.add(this.rain);
        const attr = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < attr.count; i++) {
          let y = attr.getY(i) - delta * 20;
          if (y < 0) y = 50;
          attr.setY(i, y);
        }
        attr.needsUpdate = true;
        this.rain.position.set(playerPos.x, 0, playerPos.z);
      } else if (this.rain.parent) {
        this.scene.remove(this.rain);
      }
    }

    if (this.snow) {
      if (weather === 'SNOW') {
        if (!this.snow.parent) this.scene.add(this.snow);
        const attr = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < attr.count; i++) {
          let y = attr.getY(i) - delta * 5;
          let x = attr.getX(i) + Math.sin(Date.now() * 0.001 + i) * 0.01;
          if (y < 0) y = 50;
          attr.setXY(i, x, y);
        }
        attr.needsUpdate = true;
        this.snow.position.set(playerPos.x, 0, playerPos.z);
      } else if (this.snow.parent) {
        this.scene.remove(this.snow);
      }
    }
  }
}
