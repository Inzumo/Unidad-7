import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  color,
  hash,
  instanceIndex,
  instancedArray,
  max,
  mix,
  mod,
  step,
  uint,
  uv,
  vec3,
  vec4
} from 'three/tsl';

export function createSimulation({ renderer, scene, params, count = 131072 }) {
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');

  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    const r1 = hash(i.add(uint(11)));
    const r2 = hash(i.add(uint(23)));
    const r3 = hash(i.add(uint(37)));
    const r4 = hash(i.add(uint(53)));
    const r5 = hash(i.add(uint(71)));
    const r6 = hash(i.add(uint(89)));

    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(0.45)));
    v.assign(vec3(r4, r5, r6).sub(0.5).mul(params.initialSpeed));
  })().compute(count).setName('Initialize Particles');

  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();

    force.addAssign(params.wind.mul(params.windEnabled));

    const toAttractor = params.attractor.sub(p);
    const distance = max(toAttractor.length(), params.softening);
    const radialDirection = toAttractor.div(distance);
    const radialForce = radialDirection
      .mul(params.radialStrength)
      .div(distance.pow(2))
      .mul(params.radialEnabled);
    force.addAssign(radialForce);

    const zAxis = vec3(0.0, 0.0, 1.0);
    const tangent = zAxis.cross(radialDirection);
    force.addAssign(tangent.mul(params.vortexStrength).mul(params.vortexEnabled));

    force.addAssign(v.mul(params.dragCoefficient).mul(params.dragEnabled).mul(-1.0));

    const spiralForce = tangent
      .div(distance)
      .mul(params.spiralStrength)
      .mul(params.spiralDirection)
      .mul(params.spiralEnabled);
    force.addAssign(spiralForce);

    v.addAssign(force.mul(dt));

    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => {
      v.assign(v.normalize().mul(params.maxSpeed));
    });

    p.addAssign(v.mul(dt));

    const half = params.boundsSize.mul(0.5);
    p.assign(mod(p.add(half), params.boundsSize).sub(half));
  })().compute(count).setName('Update Particles');

  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();
  material.scaleNode = params.particleSize;

  material.colorNode = Fn(() => {
    const speed = velocityBuffer.toAttribute().length();
    const t = speed.div(params.maxSpeed).clamp(0.0, 1.0);

    const cobaltBlue = color('#0047ab');
    const purple = color('#7a1fa0');
    const crimsonRed = color('#d12e2e');

    const lowToMid = mix(cobaltBlue, purple, t.mul(2.0).clamp(0.0, 1.0));
    const midToHigh = mix(purple, crimsonRed, t.sub(0.5).mul(2.0).clamp(0.0, 1.0));
    const finalRGB = mix(lowToMid, midToHigh, step(0.5, t));

    return vec4(finalRGB, 1.0);
  })();

  material.opacityNode = step(uv().xy.sub(0.5).length(), 0.5).mul(params.globalOpacity);

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);

  function reset() {
    renderer.compute(initParticles);
  }
  function stepSimulation() {
    renderer.compute(updateParticles);
  }
  function dispose() {
    geometry.dispose();
    material.dispose();
    scene.remove(mesh);
  }

  return {
    count,
    positionBuffer,
    velocityBuffer,
    reset,
    stepSimulation,
    dispose
  };
}