import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import Cloth, { ClothOpts } from './cloth';
import ClothDebugRenderer from './cloth-debug-renderer';

const GENOA_CONSTRAINT_OPTS: ClothOpts = {
  structuralConstraints: {
    stretchFactor: 1,
    shrinkFactor: 0.15
  },
  sheerConstraints: {
    stretchFactor: 1,
    shrinkFactor: 0.15
  },
  isPointFixed: (x: number, y: number) => (y >= 27.8 || x === 0) 
}

const SPI_CONSTRAINT_OPTS: ClothOpts = {
  structuralConstraints: {
    stretchFactor: 1,
    shrinkFactor: 0.1
  },
  sheerConstraints: {
    stretchFactor: 1,
    shrinkFactor: 0
  },
  isPointFixed: (x: number, y: number) => (y >= 27 || (y === 0 && x >= -6.5) || (y === 0 && x <= 6.5)) 
}

const MAINSAIL_CONSTRAINT_OPTS: ClothOpts = {
  structuralConstraints: {
    stretchFactor: 0.95,
    shrinkFactor: 0.05
  },
  sheerConstraints: {
    stretchFactor: 0.9,
    shrinkFactor: 0.1
  },
  isPointFixed: (x: number, y: number) => x === 0 || (y <= 0.5 && x >= 7.5)
}

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

const genoaCloth = await loadCloth('./genoa_sail.obj', GENOA_CONSTRAINT_OPTS)
const genoaDebugRenderer = new ClothDebugRenderer(genoaCloth)

const spiCloth = await loadCloth('./spi_sail.obj', SPI_CONSTRAINT_OPTS)
const spiDebugRenderer = new ClothDebugRenderer(spiCloth)

// const mainSailCloth = await loadCloth('./main_sail.obj', MAINSAIL_CONSTRAINT_OPTS)
// const mainSailDebugRenderer = new ClothDebugRenderer(mainSailCloth)

// points.scale.set(10, 10, 10)
// lines.forEach(line => line.scale.set(10, 10, 10))

document.addEventListener('keydown', (event) => {
  handleKeyPress(event.key);
});

function handleKeyPress(key: string) {
  switch (key) {
    case 'ArrowUp':
      genoaCloth.onKeyUp()
      break;
    case 'ArrowDown':
      genoaCloth.onKeyDown()
      break;
    case 'ArrowLeft':
      break;
    case 'ArrowRight':
      break;
  }
}

// scene.add(...mainSailDebugRenderer.sceneObjects)
scene.add(...spiDebugRenderer.sceneObjects)

const wind = new THREE.Vector3(0, 0, -20)
  .multiplyScalar(0.51444) // knots to m/s

function update(deltaSecs: number) {
  // mainSailCloth.update(deltaSecs)
  // genoaCloth.update(deltaSecs, wind)
  spiCloth.update(deltaSecs, wind)

  // mainSailDebugRenderer.update()
  // genoaDebugRenderer.update() //new THREE.Vector3(-8.5, 0, 0))
  spiDebugRenderer.update() //new THREE.Vector3(-8.5, 0, 0))

  document.getElementById('wind-speed-slot1')!.innerHTML = 'WIND: ' + (wind.length() * 1.94384).toFixed(2) + ' knots'
}

let lastTime = performance.now()
function render() {
  requestAnimationFrame( render );

  const currTime = performance.now()
  const deltaSeconds = (currTime - lastTime) / 1000
  if (deltaSeconds >= 1/60) {
    update(1/60)
    lastTime = currTime
  }
  
  controls.update();
  renderer.render( scene, camera );
}

render();


async function loadCloth(objFile: string, clothOpts: ClothOpts) {
  const file = (await new THREE.FileLoader().loadAsync(objFile)) as string
  const fileLines = file.split('\n')
  const { vertices, faces } = fileLines.reduce((acc, line) => {
    const [key, ...toks] = line.split(' ')
    if (key === 'v') 
      acc.vertices = [...(acc.vertices || []), +toks[0], +toks[1], +toks[2]]
    if (key === 'f')
      acc.faces = [...(acc.faces || []), toks.map(Number).map(v => v - 1)]
    return acc
  }, {} as { vertices: number[], faces: number[][] })
  return new Cloth(new Float32Array(vertices), faces, clothOpts)
}