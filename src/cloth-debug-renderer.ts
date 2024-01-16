import * as THREE from 'three';
import Cloth from "./cloth";

export default class ClothDebugRenderer {
  cloth: Cloth

  points: THREE.Points<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.PointsMaterial>
  lines: THREE.Line<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.LineBasicMaterial>[]
  
  constructor(cloth: Cloth) {
    this.cloth = cloth
    this.points = new THREE.Points(
      new THREE.BufferGeometry(), 
      new THREE.PointsMaterial({color: 0xFF00FF, size: 0.5})
    );
    this.lines = cloth.constraints.map((structure) => {
      const geom = new THREE.BufferGeometry().setFromPoints(structure.points.map(s => s.pos));
      return new THREE.Line(geom, new THREE.LineBasicMaterial({color: 0xFFFFFF}))
    })
  }

  update(pos?: THREE.Vector3) {
    if (pos) {
      this.points.position.set(pos.x, pos.y, pos.z)
      this.lines.forEach(line => line.position.set(pos.x, pos.y, pos.z))
    }
    this.points.geometry.setFromPoints(this.cloth.vertices)
    this.points.geometry.dispose()
    this.lines.forEach((line, idx) => {
      const structure = this.cloth.constraints[idx]
      const constraint = structure.constraintAmount
      if (constraint < 0) {
        const col = Math.abs(constraint) * 20
        line.material.color.r = col + 1
        line.material.color.g = col + 1
        line.material.color.b = 1 - col
      }
      else if (constraint > 0) {
        const col = Math.abs(constraint) * 20
        line.material.color.r = col + 1
        line.material.color.g = 1 - col
        line.material.color.b = 1 - col
      }
      else {
        line.material.color.r = 1;
        line.material.color.g = 1;
        line.material.color.b = 1;
      }
      line.geometry.dispose()
      line.geometry.setFromPoints(structure.points.map(s => s.pos))
    })
  }

  get sceneObjects() { return [...this.lines, this.points] }
}