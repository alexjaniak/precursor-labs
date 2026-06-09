import "./styles.css";
import * as THREE from "three";
import { exportLogoToSvg } from "./logo-svg-export.js";

const MAX_DOTS = 24;
const DEFAULT_SQUARE_STEP = 0.115;
const DEFAULT_RADIAL_STEP = 0.115;
const canvas = document.querySelector("#scene");
const settingsPanel = document.querySelector("#groupEditor");
const showSettingsButton = document.querySelector("#showSettings");

const blendGroups = {
  none: -1,
  top: 0,
  left: 1,
  right: 2,
  customA: 3,
  customB: 4,
  customC: 5,
};

const blendGroupLabels = {
  none: "none",
  top: "top",
  left: "left",
  right: "right",
  customA: "custom A",
  customB: "custom B",
  customC: "custom C",
};

const groupOptions = Object.values(blendGroupLabels);

const presets = {
  "square pixel mark": {
    grid: {
      mode: "square",
      showGrid: false,
      squareStep: DEFAULT_SQUARE_STEP,
      squareExtent: 3,
      angleDivisions: 16,
      radialStep: 0.115,
      rings: 5,
    },
    params: {
      unionMode: "custom groups",
      liquidBlend: 0.06,
      dotScale: 0.733,
      tool: "move dots",
      paintGroup: "custom A",
      dotColor: "#f4eee9",
      backgroundColor: "#1a1a1a",
    },
    dots: [
      makeDot("pixel upper left", -1, 1, 0.069, "custom A"),
      makeDot("pixel upper right", 1, 1, 0.069, "custom A"),
      makeDot("pixel center", 0, 0, 0.069, "custom A"),
      makeDot("pixel center right", 1, 0, 0.069, "custom A"),
      makeDot("pixel lower center", 0, -1, 0.069, "custom A"),
    ],
  },
  "radial logo mark": {
    grid: {
      mode: "polar",
      showGrid: true,
      squareStep: 0.115,
      squareExtent: 3,
      angleDivisions: 16,
      radialStep: DEFAULT_RADIAL_STEP,
      rings: 5,
    },
    params: {
      unionMode: "custom groups",
      liquidBlend: 0.13,
      dotScale: 1,
      tool: "move dots",
      paintGroup: "custom A",
    },
    dots: [
      makePolarDot("top center", 90, 3, 0.104, "top"),
      makePolarDot("top left", 135, 3, 0.104, "top"),
      makePolarDot("top right", 45, 3, 0.104, "top"),
      makePolarDot("top lower", 90, 1, 0.102, "top"),

      makePolarDot("left upper", 180, 3, 0.104, "left"),
      makePolarDot("left outer", 210, 3, 0.104, "left"),
      makePolarDot("left inner", 225, 2, 0.104, "left"),
      makePolarDot("left lower", 247.5, 3, 0.104, "left"),

      makePolarDot("right upper", 0, 3, 0.104, "right"),
      makePolarDot("right outer", 330, 3, 0.104, "right"),
      makePolarDot("right inner", 315, 2, 0.104, "right"),
      makePolarDot("right lower", 292.5, 3, 0.104, "right"),
    ],
  },
};

let dots = [];
let selectedDotIndex = -1;
let hoverDotIndex = -1;
let draggedDotIndex = -1;
let settingsDrag = null;

const dotUniforms = Array.from(
  { length: MAX_DOTS },
  () => new THREE.Vector4(0, 0, -1, -1),
);

const grid = {
  mode: "square",
  showGrid: false,
  squareStep: DEFAULT_SQUARE_STEP,
  squareExtent: 3,
  angleDivisions: 16,
  radialStep: DEFAULT_RADIAL_STEP,
  rings: 5,
};

const params = {
  preset: "square pixel mark",
  unionMode: "custom groups",
  liquidBlend: 0.06,
  dotScale: 0.733,
  tool: "move dots",
  paintGroup: "custom A",
  dotColor: "#f4eee9",
  backgroundColor: "#1a1a1a",
  reset() {
    loadPreset(params.preset);
  },
  addDot() {
    if (dots.length >= MAX_DOTS) return;
    const point = snapPointToGrid(new THREE.Vector2(0, 0));
    dots.push({
      name: `dot ${dots.length + 1}`,
      x: point.x,
      y: point.y,
      radius: grid.mode === "square" ? grid.squareStep * 0.6 : grid.radialStep * 0.9,
      blend: labelToBlendKey(params.paintGroup),
    });
    selectedDotIndex = dots.length - 1;
    updateEditor();
    updateScene();
  },
  removeSelected() {
    if (dots.length <= 1 || selectedDotIndex < 0) return;
    dots.splice(selectedDotIndex, 1);
    selectedDotIndex = -1;
    updateEditor();
    updateScene();
  },
  assignAllToPaintGroup() {
    dots.forEach((dot) => {
      dot.blend = labelToBlendKey(params.paintGroup);
    });
    updateEditor();
    updateScene();
  },
  unselect() {
    selectedDotIndex = -1;
    updateEditor();
    updateScene();
  },
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});
renderer.setClearColor(0xf4eee9, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const uniforms = {
  uResolution: { value: new THREE.Vector2(1, 1) },
  uDots: { value: dotUniforms },
  uMode: { value: 0 },
  uBlend: { value: params.liquidBlend },
  uScale: { value: params.dotScale },
  uGridMode: { value: 1 },
  uShowGrid: { value: grid.showGrid },
  uGridDivisions: { value: grid.angleDivisions },
  uRadialStep: { value: grid.radialStep },
  uGridMaxRadius: { value: grid.radialStep * grid.rings },
  uSquareStep: { value: grid.squareStep },
  uSquareExtent: { value: grid.squareExtent },
  uSelectedDot: { value: selectedDotIndex },
  uHoverDot: { value: hoverDotIndex },
  uInk: { value: new THREE.Color("#1a1a1a") },
  uPaper: { value: new THREE.Color("#f4eee9") },
  uGridColor: { value: new THREE.Color("#d9cec7") },
  uAccent: { value: new THREE.Color("#0b6b57") },
};

const material = new THREE.ShaderMaterial({
  extensions: {
    derivatives: true,
  },
  uniforms,
  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;

    #define DOT_COUNT 24
    #define GROUP_COUNT 6

    uniform vec2 uResolution;
    uniform vec4 uDots[DOT_COUNT];
    uniform int uMode;
    uniform float uBlend;
    uniform float uScale;
    uniform int uGridMode;
    uniform bool uShowGrid;
    uniform float uGridDivisions;
    uniform float uRadialStep;
    uniform float uGridMaxRadius;
    uniform float uSquareStep;
    uniform float uSquareExtent;
    uniform int uSelectedDot;
    uniform int uHoverDot;
    uniform vec3 uInk;
    uniform vec3 uPaper;
    uniform vec3 uGridColor;
    uniform vec3 uAccent;

    varying vec2 vUv;

    const float TAU = 6.28318530718;

    float smin(float a, float b, float k) {
      if (k <= 0.0001) return min(a, b);
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
    }

    float dotSdf(vec2 p, vec4 dot) {
      return length(p - dot.xy) - dot.z * uScale;
    }

    float logoField(vec2 p) {
      if (uMode == 1) {
        float field = 999.0;
        for (int i = 0; i < DOT_COUNT; i++) {
          if (uDots[i].z > 0.0) {
            field = smin(field, dotSdf(p, uDots[i]), uBlend);
          }
        }
        return field;
      }

      if (uMode == 2) {
        float field = 999.0;
        for (int i = 0; i < DOT_COUNT; i++) {
          if (uDots[i].z > 0.0) {
            field = min(field, dotSdf(p, uDots[i]));
          }
        }
        return field;
      }

      float combined = 999.0;
      for (int g = 0; g < GROUP_COUNT; g++) {
        float groupField = 999.0;
        for (int i = 0; i < DOT_COUNT; i++) {
          if (uDots[i].z > 0.0 && uDots[i].w > -0.5 && int(floor(uDots[i].w + 0.5)) == g) {
            groupField = smin(groupField, dotSdf(p, uDots[i]), uBlend);
          }
        }
        combined = min(combined, groupField);
      }

      for (int i = 0; i < DOT_COUNT; i++) {
        if (uDots[i].z > 0.0 && uDots[i].w < -0.5) {
          combined = min(combined, dotSdf(p, uDots[i]));
        }
      }

      return combined;
    }

    float polarGrid(vec2 p) {
      float r = length(p);
      float visibleArea = 1.0 - smoothstep(uGridMaxRadius, uGridMaxRadius + 0.012, r);
      float ringDistance = abs(fract(r / uRadialStep + 0.5) - 0.5) * uRadialStep;
      float ringLine = 1.0 - smoothstep(0.0012, 0.0032, ringDistance);

      float angleStep = TAU / uGridDivisions;
      float angleDelta = abs(mod(atan(p.y, p.x) + angleStep * 0.5, angleStep) - angleStep * 0.5);
      float spokeDistance = r * abs(sin(angleDelta));
      float spokeLine = 1.0 - smoothstep(0.0012, 0.0032, spokeDistance);
      float centerDot = 1.0 - smoothstep(0.006, 0.014, r);

      return max(max(ringLine, spokeLine), centerDot) * visibleArea * 0.38;
    }

    float squareGrid(vec2 p) {
      float halfSize = uSquareStep * (uSquareExtent + 0.5);
      float visibleArea = 1.0 - smoothstep(halfSize, halfSize + 0.012, max(abs(p.x), abs(p.y)));
      vec2 cell = abs(fract(p / uSquareStep + 0.5) - 0.5) * uSquareStep;
      float lineDistance = min(cell.x, cell.y);
      return (1.0 - smoothstep(0.0014, 0.0034, lineDistance)) * visibleArea * 0.42;
    }

    float editorOutline(vec2 p) {
      float outline = 0.0;
      for (int i = 0; i < DOT_COUNT; i++) {
        if (uDots[i].z > 0.0 && (i == uSelectedDot || i == uHoverDot)) {
          float d = abs(length(p - uDots[i].xy) - uDots[i].z * uScale - 0.012);
          outline = max(outline, 1.0 - smoothstep(0.0015, 0.004, d));
        }
      }
      return outline;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);
      p *= 1.48;

      float grid = 0.0;
      if (uShowGrid) {
        grid = uGridMode == 0 ? polarGrid(p) : squareGrid(p);
      }

      float d = logoField(p);
      float antialias = max(fwidth(d) * 1.25, 0.00075);
      float alpha = 1.0 - smoothstep(-antialias, antialias, d);
      vec3 baseColor = mix(uPaper, uGridColor, grid);
      vec3 color = mix(baseColor, uInk, alpha);
      color = mix(color, uAccent, editorOutline(p) * 0.9);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
});

scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

function makeDot(name, gridX, gridY, radius, blend) {
  return {
    name,
    x: gridX * DEFAULT_SQUARE_STEP,
    y: gridY * DEFAULT_SQUARE_STEP,
    radius,
    blend,
  };
}

function makePolarDot(name, angle, ring, radius, blend) {
  const theta = THREE.MathUtils.degToRad(angle);
  return {
    name,
    x: Math.cos(theta) * ring * DEFAULT_RADIAL_STEP,
    y: Math.sin(theta) * ring * DEFAULT_RADIAL_STEP,
    radius,
    blend,
  };
}

function labelToBlendKey(value) {
  return Object.entries(blendGroupLabels).find(([, label]) => label === value)?.[0] ?? value;
}

function pointToSquare(point) {
  const max = grid.squareExtent * grid.squareStep;
  return new THREE.Vector2(
    THREE.MathUtils.clamp(Math.round(point.x / grid.squareStep) * grid.squareStep, -max, max),
    THREE.MathUtils.clamp(Math.round(point.y / grid.squareStep) * grid.squareStep, -max, max),
  );
}

function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

function pointToPolar(point) {
  const radius = point.length();
  const angle = normalizeAngle(THREE.MathUtils.radToDeg(Math.atan2(point.y, point.x)));
  const angleStep = 360 / grid.angleDivisions;
  const snappedAngle = normalizeAngle(Math.round(angle / angleStep) * angleStep);
  const snappedRing = THREE.MathUtils.clamp(Math.round(radius / grid.radialStep), 0, grid.rings);
  const theta = THREE.MathUtils.degToRad(snappedAngle);
  return new THREE.Vector2(
    Math.cos(theta) * snappedRing * grid.radialStep,
    Math.sin(theta) * snappedRing * grid.radialStep,
  );
}

function snapPointToGrid(point) {
  return grid.mode === "polar" ? pointToPolar(point) : pointToSquare(point);
}

function snapAllDotsToGrid() {
  dots.forEach((dot) => {
    const snapped = snapPointToGrid(new THREE.Vector2(dot.x, dot.y));
    dot.x = snapped.x;
    dot.y = snapped.y;
  });
}

function pointerToLogoPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const minSide = Math.min(rect.width, rect.height);
  const x = ((event.clientX - rect.left - rect.width * 0.5) / minSide) * 1.48;
  const y = ((rect.height * 0.5 - (event.clientY - rect.top)) / minSide) * 1.48;
  return new THREE.Vector2(x, y);
}

function findDotAt(point) {
  let nearest = null;
  let nearestDistance = Infinity;

  dots.forEach((dot, index) => {
    const distance = Math.hypot(point.x - dot.x, point.y - dot.y);
    const hitRadius = dot.radius * params.dotScale + 0.055;
    if (distance < hitRadius && distance < nearestDistance) {
      nearest = { dot, index };
      nearestDistance = distance;
    }
  });

  return nearest;
}

function updateDotUniforms() {
  for (let index = 0; index < MAX_DOTS; index += 1) {
    const uniform = dotUniforms[index];
    const dot = dots[index];

    if (!dot) {
      uniform.set(0, 0, -1, -1);
      continue;
    }

    const blendKey = labelToBlendKey(dot.blend);
    uniform.set(dot.x, dot.y, dot.radius, blendGroups[blendKey]);
  }
}

function updateScene() {
  uniforms.uMode.value =
    params.unionMode === "all dots" ? 1 : params.unionMode === "separate dots" ? 2 : 0;
  uniforms.uBlend.value = params.liquidBlend;
  uniforms.uScale.value = params.dotScale;
  uniforms.uGridMode.value = grid.mode === "polar" ? 0 : 1;
  uniforms.uShowGrid.value = grid.showGrid;
  uniforms.uGridDivisions.value = grid.angleDivisions;
  uniforms.uRadialStep.value = grid.radialStep;
  uniforms.uGridMaxRadius.value = grid.radialStep * grid.rings;
  uniforms.uSquareStep.value = grid.squareStep;
  uniforms.uSquareExtent.value = grid.squareExtent;
  uniforms.uSelectedDot.value = selectedDotIndex;
  uniforms.uHoverDot.value = hoverDotIndex;
  uniforms.uInk.value.set(params.dotColor);
  uniforms.uPaper.value.set(params.backgroundColor);
  renderer.setClearColor(params.backgroundColor, 1);
  document.documentElement.style.backgroundColor = params.backgroundColor;
  document.querySelector("#app").style.backgroundColor = params.backgroundColor;
  updateDotUniforms();
  render();
}

function selectedDotLabel() {
  const dot = dots[selectedDotIndex];
  return dot ? `${selectedDotIndex + 1}. ${dot.name}` : "none";
}

function dotGridLabel(dot) {
  if (grid.mode === "polar") {
    const radius = Math.hypot(dot.x, dot.y);
    const angle = normalizeAngle(THREE.MathUtils.radToDeg(Math.atan2(dot.y, dot.x)));
    return `${Math.round(angle)}deg / r${Math.round(radius / grid.radialStep)}`;
  }

  return `${Math.round(dot.x / grid.squareStep)}, ${Math.round(dot.y / grid.squareStep)}`;
}

function updateEditor() {
  settingsPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>Settings</h2>
        <span>${dots.length}/${MAX_DOTS} dots</span>
      </div>
      <button id="hideSettings" class="icon-button" type="button" aria-label="Hide settings">Hide</button>
    </div>

    <div class="settings-grid">
      ${selectControl("presetSelect", "Preset", params.preset, Object.keys(presets))}
      ${selectControl("unionMode", "Union", params.unionMode, [
        "custom groups",
        "all dots",
        "separate dots",
      ])}
      ${selectControl("toolSelect", "Tool", params.tool, ["move dots", "assign groups"])}
      ${selectControl("paintGroup", "Paint", params.paintGroup, groupOptions)}
    </div>

    <div class="settings-grid">
      ${rangeControl("liquidBlend", "Liquid blend", params.liquidBlend, 0, 0.34, 0.001, 3)}
      ${rangeControl("dotScale", "Dot scale", params.dotScale, 0.15, 1.5, 0.001, 3)}
    </div>

    <div class="settings-grid">
      ${selectControl("gridMode", "Grid", grid.mode, ["square", "polar"])}
      <label class="check-control">
        <input id="showGrid" type="checkbox"${grid.showGrid ? " checked" : ""} />
        <span>Show grid</span>
      </label>
      ${rangeControl("squareStep", "Square step", grid.squareStep, 0.05, 0.18, 0.001, 3)}
      ${rangeControl("squareExtent", "Square extent", grid.squareExtent, 2, 7, 1, 0)}
      ${rangeControl("angleDivisions", "Polar divisions", grid.angleDivisions, 8, 32, 1, 0)}
      ${rangeControl("radialStep", "Polar step", grid.radialStep, 0.075, 0.16, 0.001, 3)}
      ${rangeControl("rings", "Polar rings", grid.rings, 3, 7, 1, 0)}
    </div>

    <div class="settings-grid compact">
      ${colorControl("dotColor", "Dot", params.dotColor)}
      ${colorControl("backgroundColor", "Background", params.backgroundColor)}
    </div>

    <div class="action-row">
      <button type="button" data-action="add">Add</button>
      <button type="button" data-action="remove"${selectedDotIndex < 0 ? " disabled" : ""}>Remove</button>
      <button type="button" data-action="unselect"${selectedDotIndex < 0 ? " disabled" : ""}>Unselect</button>
      <button type="button" data-action="snap">Snap</button>
      <button type="button" data-action="assignAll">Assign All</button>
      <button type="button" data-action="screenshot">Screenshot</button>
      <button type="button" data-action="svg">SVG</button>
      <button type="button" data-action="svgTransparent">SVG Clear</button>
      <button type="button" data-action="reset">Reset</button>
    </div>

    <div class="selected-dot">Selected: ${selectedDotLabel()}</div>

    <div class="dot-list">
      ${dots
        .map(
          (dot, index) => `
            <div class="dot-row${index === selectedDotIndex ? " is-selected" : ""}">
              <button type="button" data-select-dot="${index}">
                <span>${index + 1}</span>
                <strong>${dot.name}</strong>
                <em>${dotGridLabel(dot)}</em>
              </button>
              <select data-group-dot="${index}">
                ${groupOptions
                  .map(
                    (label) =>
                      `<option value="${label}"${
                        blendGroupLabels[labelToBlendKey(dot.blend)] === label ? " selected" : ""
                      }>${label}</option>`,
                  )
                  .join("")}
              </select>
            </div>
          `,
        )
        .join("")}
    </div>
  `;

  settingsPanel.querySelector(".panel-header").addEventListener("pointerdown", startSettingsDrag);
  settingsPanel.querySelector("#hideSettings").addEventListener("click", hideSettings);
  settingsPanel.querySelector("#presetSelect").addEventListener("change", (event) => {
    loadPreset(event.target.value);
  });
  settingsPanel.querySelector("#unionMode").addEventListener("change", (event) => {
    params.unionMode = event.target.value;
    updateScene();
  });
  settingsPanel.querySelector("#toolSelect").addEventListener("change", (event) => {
    params.tool = event.target.value;
    updateScene();
  });
  settingsPanel.querySelector("#paintGroup").addEventListener("change", (event) => {
    params.paintGroup = event.target.value;
  });
  bindRange("liquidBlend", (value) => {
    params.liquidBlend = value;
  });
  bindRange("dotScale", (value) => {
    params.dotScale = value;
  });
  settingsPanel.querySelector("#gridMode").addEventListener("change", (event) => {
    grid.mode = event.target.value;
    snapAllDotsToGrid();
    updateEditor();
    updateScene();
  });
  settingsPanel.querySelector("#showGrid").addEventListener("change", (event) => {
    grid.showGrid = event.target.checked;
    updateScene();
  });
  bindRange("squareStep", (value) => {
    grid.squareStep = value;
    if (grid.mode === "square") snapAllDotsToGrid();
  });
  bindRange("squareExtent", (value) => {
    grid.squareExtent = value;
    if (grid.mode === "square") snapAllDotsToGrid();
  });
  bindRange("angleDivisions", (value) => {
    grid.angleDivisions = value;
    if (grid.mode === "polar") snapAllDotsToGrid();
  });
  bindRange("radialStep", (value) => {
    grid.radialStep = value;
    if (grid.mode === "polar") snapAllDotsToGrid();
  });
  bindRange("rings", (value) => {
    grid.rings = value;
    if (grid.mode === "polar") snapAllDotsToGrid();
  });
  settingsPanel.querySelector("#dotColor").addEventListener("input", (event) => {
    params.dotColor = event.target.value;
    updateScene();
  });
  settingsPanel.querySelector("#backgroundColor").addEventListener("input", (event) => {
    params.backgroundColor = event.target.value;
    updateScene();
  });

  settingsPanel.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "add") params.addDot();
      if (action === "remove") params.removeSelected();
      if (action === "unselect") params.unselect();
      if (action === "assignAll") params.assignAllToPaintGroup();
      if (action === "reset") params.reset();
      if (action === "snap") {
        snapAllDotsToGrid();
        updateEditor();
        updateScene();
      }
      if (action === "screenshot") downloadScreenshot();
      if (action === "svg") downloadSvg({ includeBackground: true, suffix: "svg" });
      if (action === "svgTransparent") {
        downloadSvg({ includeBackground: false, suffix: "transparent-svg" });
      }
    });
  });

  settingsPanel.querySelectorAll("[data-select-dot]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextIndex = Number(button.dataset.selectDot);
      selectedDotIndex = selectedDotIndex === nextIndex ? -1 : nextIndex;
      updateEditor();
      updateScene();
    });
  });

  settingsPanel.querySelectorAll("[data-group-dot]").forEach((select) => {
    select.addEventListener("change", () => {
      dots[Number(select.dataset.groupDot)].blend = labelToBlendKey(select.value);
      updateEditor();
      updateScene();
    });
  });
}

function selectControl(id, label, value, options) {
  return `
    <label class="field">
      <span>${label}</span>
      <select id="${id}">
        ${options
          .map((option) => `<option value="${option}"${value === option ? " selected" : ""}>${option}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function rangeControl(id, label, value, min, max, step, precision) {
  return `
    <label class="field range-field">
      <span>${label} <em>${Number(value).toFixed(precision)}</em></span>
      <div class="range-pair">
        <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
        <input
          id="${id}Number"
          class="number-input"
          type="number"
          min="${min}"
          max="${max}"
          step="${step}"
          value="${Number(value).toFixed(precision)}"
          inputmode="decimal"
        />
      </div>
    </label>
  `;
}

function colorControl(id, label, value) {
  return `
    <label class="field color-field">
      <span>${label}</span>
      <input id="${id}" type="color" value="${value}" />
    </label>
  `;
}

function bindRange(id, updateValue) {
  const input = settingsPanel.querySelector(`#${id}`);
  const numberInput = settingsPanel.querySelector(`#${id}Number`);
  const precision = Number(input.step) === 1 ? 0 : 3;

  input.addEventListener("input", (event) => {
    const nextValue = Number(event.target.value);
    updateValue(nextValue);
    numberInput.value = nextValue.toFixed(precision);
    updateRangeLabel(event.target, precision);
    updateScene();
  });
  input.addEventListener("change", () => {
    updateEditor();
  });

  numberInput.addEventListener("input", (event) => {
    if (event.target.value === "") return;

    const nextValue = clampNumber(
      Number(event.target.value),
      Number(input.min),
      Number(input.max),
    );
    if (!Number.isFinite(nextValue)) return;

    input.value = nextValue;
    updateValue(nextValue);
    updateRangeLabel(input, precision);
    updateScene();
  });
  numberInput.addEventListener("change", (event) => {
    const nextValue = clampNumber(
      Number(event.target.value),
      Number(input.min),
      Number(input.max),
    );
    const value = Number.isFinite(nextValue) ? nextValue : Number(input.value);
    input.value = value;
    event.target.value = value.toFixed(precision);
    updateValue(value);
    updateEditor();
    updateScene();
  });
}

function updateRangeLabel(input, precision) {
  const label = input.closest(".range-field")?.querySelector("em");
  if (label) {
    label.textContent = Number(input.value).toFixed(precision);
  }
}

function clampNumber(value, min, max) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

function loadPreset(presetName) {
  const preset = presets[presetName];
  if (!preset) return;

  params.preset = presetName;
  Object.assign(params, preset.params);
  Object.assign(grid, preset.grid);
  dots = preset.dots.map((dot) => ({ ...dot }));
  selectedDotIndex = -1;
  hoverDotIndex = -1;
  draggedDotIndex = -1;
  snapAllDotsToGrid();
  updateEditor();
  updateScene();
}

function hideSettings() {
  settingsPanel.hidden = true;
  showSettingsButton.hidden = false;
}

function showSettings() {
  settingsPanel.hidden = false;
  showSettingsButton.hidden = true;
  updateEditor();
  keepSettingsInViewport();
}

function startSettingsDrag(event) {
  if (event.target.closest("button, input, select")) return;

  const rect = settingsPanel.getBoundingClientRect();
  settingsDrag = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };

  settingsPanel.setPointerCapture(event.pointerId);
  settingsPanel.classList.add("is-dragging");
}

function moveSettingsDrag(event) {
  if (!settingsDrag || settingsDrag.pointerId !== event.pointerId) return;

  const rect = settingsPanel.getBoundingClientRect();
  const margin = 12;
  const x = clampNumber(
    event.clientX - settingsDrag.offsetX,
    margin,
    window.innerWidth - rect.width - margin,
  );
  const y = clampNumber(
    event.clientY - settingsDrag.offsetY,
    margin,
    window.innerHeight - rect.height - margin,
  );

  placeSettingsPanel(x, y);
}

function endSettingsDrag(event) {
  if (!settingsDrag || settingsDrag.pointerId !== event.pointerId) return;

  if (settingsPanel.hasPointerCapture(event.pointerId)) {
    settingsPanel.releasePointerCapture(event.pointerId);
  }
  settingsDrag = null;
  settingsPanel.classList.remove("is-dragging");
}

function placeSettingsPanel(x, y) {
  settingsPanel.style.left = `${Math.round(x)}px`;
  settingsPanel.style.top = `${Math.round(y)}px`;
  settingsPanel.style.right = "auto";
  settingsPanel.style.bottom = "auto";
}

function keepSettingsInViewport() {
  const rect = settingsPanel.getBoundingClientRect();
  const margin = 12;
  const x = clampNumber(rect.left, margin, window.innerWidth - rect.width - margin);
  const y = clampNumber(rect.top, margin, window.innerHeight - rect.height - margin);
  placeSettingsPanel(x, y);
}

function downloadScreenshot() {
  render();
  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `liquid-dots-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

function downloadSvg({ includeBackground, suffix }) {
  const { svg } = exportLogoToSvg(dots, params, {
    includeBackground,
    resolution: 768,
    size: 1024,
  });
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `liquid-dots-${suffix}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.svg`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  uniforms.uResolution.value.set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
  keepSettingsInViewport();
  render();
}

function render() {
  renderer.render(scene, camera);
}

canvas.addEventListener("pointerdown", (event) => {
  const point = pointerToLogoPoint(event);
  const hit = findDotAt(point);
  if (!hit) {
    selectedDotIndex = -1;
    updateEditor();
    updateScene();
    return;
  }

  selectedDotIndex = hit.index;

  if (params.tool === "assign groups") {
    hit.dot.blend = labelToBlendKey(params.paintGroup);
    updateEditor();
    updateScene();
    return;
  }

  draggedDotIndex = hit.index;
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor = "grabbing";
  updateEditor();
  updateScene();
});

canvas.addEventListener("pointermove", (event) => {
  const point = pointerToLogoPoint(event);

  if (draggedDotIndex > -1) {
    const snapped = snapPointToGrid(point);
    dots[draggedDotIndex].x = snapped.x;
    dots[draggedDotIndex].y = snapped.y;
    selectedDotIndex = draggedDotIndex;
    updateEditor();
    updateScene();
    return;
  }

  const hit = findDotAt(point);
  hoverDotIndex = hit?.index ?? -1;
  canvas.style.cursor = hit ? (params.tool === "assign groups" ? "copy" : "grab") : "default";
  updateScene();
});

canvas.addEventListener("pointerup", (event) => {
  draggedDotIndex = -1;
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  canvas.style.cursor = "default";
  updateScene();
});

canvas.addEventListener("pointercancel", () => {
  draggedDotIndex = -1;
  canvas.style.cursor = "default";
  updateScene();
});

window.addEventListener("resize", resize);
showSettingsButton.addEventListener("click", showSettings);
settingsPanel.addEventListener("pointermove", moveSettingsDrag);
settingsPanel.addEventListener("pointerup", endSettingsDrag);
settingsPanel.addEventListener("pointercancel", endSettingsDrag);
loadPreset(params.preset);
resize();
