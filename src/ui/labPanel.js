function rangeRow(parent, label, param, min, max, step) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const lab = document.createElement('label');
  const name = document.createElement('span');
  const value = document.createElement('span');
  value.className = 'value';
  name.textContent = label;
  lab.append(name, value);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(param.value);

  const onInput = () => {
    param.value = Number(input.value);
    value.textContent = Number(input.value).toFixed(step < 0.01 ? 3 : 2);
  };
  input.addEventListener('input', onInput);

  const refresh = () => {
    input.value = String(param.value);
    value.textContent = Number(param.value).toFixed(step < 0.01 ? 3 : 2);
  };

  refresh();
  wrap.append(lab, input);
  parent.append(wrap);
  return { input, refresh };
}

function vectorRow(parent, label, vector, component, min, max, step) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const lab = document.createElement('label');
  const name = document.createElement('span');
  const value = document.createElement('span');
  value.className = 'value';
  name.textContent = label;
  lab.append(name, value);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(vector[component]);

  const onInput = () => {
    vector[component] = Number(input.value);
    value.textContent = Number(input.value).toFixed(step < 0.01 ? 3 : 2);
  };
  input.addEventListener('input', onInput);

  const refresh = () => {
    input.value = String(vector[component]);
    value.textContent = Number(vector[component]).toFixed(step < 0.01 ? 3 : 2);
  };

  refresh();
  wrap.append(lab, input);
  parent.append(wrap);
  return { input, refresh };
}

function checkRow(parent, label, param) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const lab = document.createElement('label');
  const name = document.createElement('span');
  name.textContent = label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = param.value > 0;

  input.addEventListener('change', () => {
    param.value = input.checked ? 1 : 0;
  });

  const refresh = () => { input.checked = param.value > 0; };

  lab.append(name, input);
  wrap.append(lab);
  parent.append(wrap);
  return { input, refresh };
}

function button(parent, label, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', onClick);
  parent.append(b);
  return b;
}

export function createLabPanel({ params, onReset, onPreset, onModeChange, onPauseChange }) {
  const refreshers = [];
  const panel = document.createElement('aside');
  panel.className = 'panel';
  panel.innerHTML = `
    <h1>U3 · Forces Instrument</h1>
    <p>LAB: aísla fuerzas, predice y prueba. <strong>P</strong> cambia a PERFORMANCE.</p>
  `;

  const sim = document.createElement('div');
  sim.className = 'group';
  sim.innerHTML = '<h2>Simulación</h2>';
  panel.append(sim);
  refreshers.push(rangeRow(sim, 'timeScale', params.timeScale, 0, 2, 0.01));
  refreshers.push(rangeRow(sim, 'maxSpeed', params.maxSpeed, 0.2, 12, 0.1));
  refreshers.push(rangeRow(sim, 'particleSize', params.particleSize, 0.005, 0.1, 0.001));

  const force = document.createElement('div');
  force.className = 'group';
  force.innerHTML = '<h2>Fuerzas</h2>';
  panel.append(force);

  refreshers.push(checkRow(force, 'Radial', params.radialEnabled));
  refreshers.push(rangeRow(force, 'radialStrength', params.radialStrength, -8, 8, 0.05));
  refreshers.push(checkRow(force, 'Vórtice', params.vortexEnabled));
  refreshers.push(rangeRow(force, 'vortexStrength', params.vortexStrength, -8, 8, 0.05));
  refreshers.push(checkRow(force, 'Drag', params.dragEnabled));
  refreshers.push(rangeRow(force, 'dragCoefficient', params.dragCoefficient, 0, 1, 0.01));
  refreshers.push(checkRow(force, 'Viento', params.windEnabled));
  refreshers.push(vectorRow(force, 'wind.x', params.wind.value, 'x', -4, 4, 0.05));
  refreshers.push(vectorRow(force, 'wind.y', params.wind.value, 'y', -4, 4, 0.05));

  const own = document.createElement('div');
  own.className = 'group';
  own.innerHTML = '<h2>Espiral (propia)</h2>';
  panel.append(own);
  refreshers.push(checkRow(own, 'Espiral', params.spiralEnabled));
  refreshers.push(rangeRow(own, 'spiralStrength', params.spiralStrength, -8, 8, 0.05));

  const tests = document.createElement('div');
  tests.className = 'group';
  tests.innerHTML = '<h2>Pruebas</h2><p>Predice antes de pulsar.</p>';
  panel.append(tests);
  for (const [id, label] of [
    ['inertia', '1 · Inercia'],
    ['wind', '2 · Fuerza +X'],
    ['attract', '3 · Atracción'],
    ['repel', '4 · Repulsión'],
    ['vortex', '5 · Vórtice'],
    ['spiral', '6 · Espiral (propia)']
  ]) button(tests, label, () => onPreset(id));

  const actions = document.createElement('div');
  actions.className = 'group';
  actions.innerHTML = '<h2>Acciones</h2>';
  panel.append(actions);
  button(actions, 'Reset', onReset);
  button(actions, 'Pausar / continuar', () => onPauseChange());
  button(actions, 'LAB / PERFORMANCE', () => onModeChange());

  document.body.append(panel);

  return {
    element: panel,
    setVisible(visible) { panel.classList.toggle('hidden', !visible); },
    refresh() { for (const item of refreshers) item.refresh(); }
  };
}