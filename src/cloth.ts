import * as THREE from 'three';
import { chunkify } from './utils';

export type ClothConstraintOpts = {
  stretchFactor: number;
  shrinkFactor: number;
  restLength?: number;
}

export type ClothOpts = {
  structuralConstraints: ClothConstraintOpts
  sheerConstraints: ClothConstraintOpts
  isPointFixed: (x:number, y:number) => boolean
}

const CONSTRAINT_ITERATIONS = 32
const GRAVITY = new THREE.Vector3(0, -9.81, 0)

export class ClothPoint {
  pos: THREE.Vector3
  oldPos: THREE.Vector3
  acc: THREE.Vector3
  mass: number;
  fixed: boolean

  constructor(vec: THREE.Vector3, fixed: boolean = false) {
    this.pos = new THREE.Vector3(vec.x, vec.y, vec.z)
    this.oldPos = new THREE.Vector3(vec.x, vec.y, vec.z)
    this.acc = new THREE.Vector3(0, 0, 0)
    this.fixed = fixed
    this.mass = 0.1
  }

  get velocity() {
    return this.pos.clone().sub(this.oldPos).clone()
  }

  update(deltaSeconds: number) {
    if (this.fixed) return
    let temp = this.pos.clone();
		this.pos.add(this.velocity.clone().multiplyScalar(0.99).add(this.acc.clone().multiplyScalar(deltaSeconds)))
		this.oldPos = temp.clone();
    this.acc = new THREE.Vector3()
  }

  addForce(f: THREE.Vector3) {
    this.acc.add(f.clone().multiplyScalar(this.mass))
  }

  addGravity(acceleration: THREE.Vector3, deltaSeconds: number) {
    this.acc.add(acceleration.clone().multiplyScalar(deltaSeconds))
  }

  move(offset: THREE.Vector3) {
    if (this.fixed) return
    this.pos.add(offset)
  }
}

export class ClothConstraint {
  p1: ClothPoint
  p2: ClothPoint
  restLength: number // length when at rest
  length: number // current length
  stretchFactor: number
  shrinkFactor: number

  constructor(p1: ClothPoint, p2: ClothPoint, opts: ClothConstraintOpts) {
    this.p1 = p1
    this.p2 = p2
    this.restLength = opts.restLength || this.p1.pos.distanceTo(this.p2.pos)
    this.length = this.p1.pos.distanceTo(this.p2.pos)
    this.stretchFactor = opts.stretchFactor
    this.shrinkFactor = opts.shrinkFactor
  }

  satisfyConstraint()
  {
    const P1toP2 = this.p2.pos.clone().sub(this.p1.pos)
    this.length = P1toP2.length()
    const correctionFactor = 1 - this.restLength / this.length
    const correction = P1toP2.multiplyScalar(correctionFactor)
    let factor = this.shrinkFactor
    // if (correction.length() > 1) {
    //   correction.clampScalar(-1, 1)
    //   console.log(correction) // something looks wrong
    // }
    if (correctionFactor > 0) factor = this.stretchFactor
    const hasFixed = this.p1.fixed || this.p2.fixed
    if (hasFixed) factor *= 2
    this.p1.move(correction.multiplyScalar(factor))
    this.p2.move(correction.multiplyScalar(-factor))
  }

  get points() { return [this.p1, this.p2]}
  get constraintAmount() { return this.length - this.restLength}
}

export class ClothTriangle {
  p1: ClothPoint
  p2: ClothPoint
  p3: ClothPoint
  normal: THREE.Vector3

  constructor(p1: ClothPoint, p2: ClothPoint, p3: ClothPoint) {
    this.p1 = p1
    this.p2 = p2
    this.p3 = p3
    this.normal = this.calcNormal()
  }

  update() {
    this.normal = this.calcNormal()
  }

  calcNormal() {
    const v1 = new THREE.Vector3().subVectors(this.p2.pos, this.p1.pos);
    const v2 = new THREE.Vector3().subVectors(this.p3.pos, this.p1.pos);
    return new THREE.Vector3().crossVectors(v1, v2).normalize();
  }

  addWindForce(f: THREE.Vector3) {
    const windContribution = f.multiplyScalar(Math.abs(f.clone().normalize().dot(this.normal)))
    this.addForce(windContribution)
  }

  addForce(f: THREE.Vector3) {
    const forceOneThird = f.clone().divideScalar(3)
    this.p1.addForce(forceOneThird)
    this.p2.addForce(forceOneThird)
    this.p3.addForce(forceOneThird)
  }
}

export default class Cloth {

  private _points: ClothPoint[]
  private _triangles: ClothTriangle[]
  private _constraints: ClothConstraint[]

  constructor(vertices: Float32Array, faces: number[][], opts: ClothOpts) {
    this._points = chunkify([...vertices], 3)
      .map(([x, y, z]) => new ClothPoint(
        new THREE.Vector3(x, y, z), opts.isPointFixed(x, y)
      ))
    this._triangles = faces.flatMap(face => {
      const [p1, p2, p3, p4] = face
      if (face.length === 3) 
        return [new ClothTriangle(this._points[p1], this._points[p2], this._points[p3])]
      return [
        new ClothTriangle(this._points[p1], this._points[p2], this._points[p3]),
        new ClothTriangle(this._points[p1], this._points[p3], this._points[p4]),
      ]
    })
    this._constraints = [
      // add structural constraints
      ...faces.flatMap(face => {
        const segments = [] as [number, number][]
        face.forEach((val, idx, arr) => {
          if (idx === arr.length - 1) return;
          const aIdx = val
          const bIdx = arr[idx + 1]
          segments.push([aIdx, bIdx])
        })
        segments.push([face[face.length - 1], face[0]])
        return segments.map(([a, b]) => 
          new ClothConstraint(this._points[a], this._points[b], opts.structuralConstraints)
        )
      }),
      // add sheer constraints for quads
      ...faces.flatMap(face => {
        if (face.length !== 4) return null
        const [p1, p2, p3, p4] = face
        return [
          new ClothConstraint(this._points[p1], this._points[p3], opts.sheerConstraints),
          new ClothConstraint(this._points[p2], this._points[p4], opts.sheerConstraints),
        ]
      }),
      // // add a fake rope
      // new ClothConstraint(this._points[2], new ClothPoint(new THREE.Vector3(18.5, -7, 0), true), {
      //   stretchFactor: 1,
      //   shrinkFactor: 0,
      //   restLength: 10
      // })
    ].filter(Boolean) as ClothConstraint[]

    // console.log(this._points.findIndex(p => p.fixed))
  }

  i = 0
  update(deltaSeconds: number, wind: THREE.Vector3) {
    this.i += 0.0025
    
    for (let i = 0; i < CONSTRAINT_ITERATIONS; i++) {
      for (const constraint of this._constraints) {
        constraint.satisfyConstraint()
      }
    }
    for (const triangle of this._triangles) {
      triangle.update()
      triangle.addWindForce(wind.clone())
    }
    for (const point of this._points) {
      point.addGravity(GRAVITY, deltaSeconds)
      point.update(deltaSeconds)
    }
    for (let i = 0; i < CONSTRAINT_ITERATIONS; i++) {
      for (const constraint of this._constraints) {
        constraint.satisfyConstraint()
      }
    }

  }
  
  onKeyUp() {
    // this._constraints[this._constraints.length - 1].restLength += 0.05
  }
  
  onKeyDown() {
    // this._constraints[this._constraints.length - 1].restLength -= 0.05
  }

  get vertices() { return this._points.map(p => p.pos) }
  get constraints() { return this._constraints }
}
