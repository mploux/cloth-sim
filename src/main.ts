import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import Cloth from './cloth';

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 500 );
camera.position.set( 0, 14, 40 );
camera.lookAt( 4, 14, 0 );

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(4, 14, 0);
controls.enableDamping = true;
controls.minDistance = 0;
controls.maxDistance = 180;

const scene = new THREE.Scene();

// load obj (simple)
const file = (await new THREE.FileLoader().loadAsync('./main_sail.obj')) as string
const fileLines = file.split('\n')
const { vertices, faces } = fileLines.reduce((acc, line) => {
  const [key, ...toks] = line.split(' ')
  if (key === 'v') 
    acc.vertices = [...(acc.vertices || []), +toks[0], +toks[1], +toks[2]]
  if (key === 'f')
    acc.faces = [...(acc.faces || []), toks.map(Number).map(v => v - 1)]
  return acc
}, {} as { vertices: number[], faces: number[][] })

const cloth = new Cloth(new Float32Array(vertices), faces)

const points = new THREE.Points(
  new THREE.BufferGeometry(), 
  new THREE.PointsMaterial({color: 0xFF00FF, size: 0.5})
);

const lines = cloth.constraints.map((structure) => {
  const geom = new THREE.BufferGeometry().setFromPoints(structure.points.map(s => s.pos));
  return new THREE.Line(geom, new THREE.LineBasicMaterial({color: 0xFFFFFF}))
})

// points.scale.set(10, 10, 10)
// lines.forEach(line => line.scale.set(10, 10, 10))

scene.add(points, ...lines)

function update(deltaSecs: number) {
  cloth.update(deltaSecs)
  points.geometry.setFromPoints(cloth.vertices)
  points.geometry.dispose()
  lines.forEach((line, idx) => {
    const structure = cloth.constraints[idx]
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

let lastTime = performance.now()
function render() {
  requestAnimationFrame( render );

  const currTime = performance.now()
  const deltaSeconds = (currTime - lastTime) / 1000
  if (deltaSeconds >= 1/60) {
    update(deltaSeconds)
    lastTime = currTime
  }
  
  controls.update();
  renderer.render( scene, camera );
}

render();
