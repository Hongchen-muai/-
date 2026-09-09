# AI Agent Instructions (AGENTS.md)

Welcome, AI Agent (OpenCode, Copilot, etc.). When you are tasked with assisting in this repository (`Map-projection-visualization`), please adhere to the following strict guidelines and context to ensure your code matches the existing architecture and standards.

## 1. Project Overview & Architecture

This project is a 3D/2D geographical math visualization platform built with **Vue 3, Three.js, and D3.js**.
The core architectural philosophy is **strict decoupling of the 3D WebGL engine and the Vue 2D UI**.

- **`src/App.vue`**: The single source of truth for UI state, drag mode selections, and configuration params (like `globeRotation`, `projectionType`).
- **`src/components/Map2D.vue`**: The D3.js SVG renderer. It listens to props from `App.vue` and `emit`s events when the user interacts with 2D elements (like the secant slider).
- **`src/core/threeApp.js`**: A pure JavaScript module that handles all Three.js WebGL rendering, GSAP animations, and custom GLSL shaders. **IT MUST NOT IMPORT VUE**. It communicates with the UI via callback functions (e.g., `onRotationChange`).

## 2. Core Constraints & Magic Numbers

When writing code for the 3D space (`threeApp.js`), adhere to these specific constants and rules to avoid visual glitches (Z-fighting):
- **Earth Radius (`R_EARTH`)**: Always use `5.0`.
- **Projection Geometries (Cylinder, Cone, Plane)**: Must be rendered slightly larger than the Earth to avoid Z-fighting. Use a multiplier of `1.01` (e.g., `radius = R_EARTH * 1.01`).
- **Oblique Cylinders**: Use the shared `geoRotation([-lonC, -latC, azimuth - 90])` in `projectionModel.js`. `orientToWorld` applies the inverse aspect to the 3D surface while keeping the globe's geographic pole upright; the shader must match this helper. Do not introduce separate geographical rotations in the two renderers.

## 3. UI Conventions (Minimalist Theme)

The UI was completely refactored to a minimalist, "OpenCode-inspired" theme. Do NOT introduce:
- Heavy drop shadows (use `box-shadow: 0 1px 3px rgba(0,0,0,0.05)` at most).
- Rounded, pill-shaped buttons with gradients.
- Bright, neon colors (except for the `#d92d20` red invariant line).
- Default emojis (use `lucide-vue-next` icons instead).

*Always* use ultra-thin borders (`1px solid #e0e0e0`), stark white/light grey backgrounds, and dark typography (`#333` or `#666`).

### 3.1 Button Design Guidelines (2026-05-12 Update)

To improve UI guidance and clarity, follow these button design rules:

**Gradient Buttons** (for interactive elements):
```css
background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
border: 1px solid #dee2e6;
/* Hover state */
background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
/* Active state */
background: linear-gradient(135deg, #343a40 0%, #212529 100%);
color: white;
```

**Step Buttons** (numbered steps):
- Use numbered badges with dark gradient background
- Add hover animation (translateX(2px))

**Category Buttons** (sidebar navigation):
- Add left colored indicator bar (4px width)
- Use `::before` pseudo-element for the indicator

**Variant Toggle Buttons**:
- Use filled style for active state
- Add box-shadow for depth

**Navigation Arrows** (step navigation):
- Position at bottom of 3D scene
- Use backdrop-filter for glass effect
- Include step indicator (e.g., "1/3")

## 4. Workflows for Adding New Projections

If asked to add a new projection type, follow these exact 3 steps:

1. **`threeApp.js` (The 3D Math)**:
   - Add a coordinate mapping function (e.g., `lonLatToMyNewShape(lon, lat, R)`).
   - Create a transparent, physical wrapping geometry (e.g., `THREE.CylinderGeometry`).
   - Write custom `onBeforeCompile` vertex shaders in `createUnfoldMaterial` to animate the 3D geometry morphing into a flat plane.
2. **`Map2D.vue` (The 2D Math)**:
   - Update the D3 projection generator logic to support the new mode.
   - You may need to create a custom D3 projection using `d3.geoProjection()` if a native one doesn't exist, applying the exact mathematical inverse of your 3D logic.
3. **`App.vue` (The UI)**:
   - Expose the new projection type in the sidebar tabs.
   - Create any necessary UI controls (sliders, inputs) for the specific projection parameters (like standard parallels).

## 5. Development Reminders

- The Vite build requires precise file paths. Do not introduce spaces in static asset names (e.g., `public/wechat-pay.jpg`).
- When making file edits, prefer exact string replacement over full file rewrites.
- After modifying math logic, verify that the 3D invariant line (red) perfectly matches the 2D invariant line (red) and that they both reflect the `secantLat` mathematically.
- Ensure `npm run build` passes before concluding your task.
- Testing preference (2026-09-09): verify desktop behavior only by default. Do not perform routine mobile viewport/adaptation checks. Scope math and interaction tests to the changed functionality and relevant regressions.

## 6. Cartographic Terminology Standards (2026-05-12 Update)

Use professional GIS/Cartography terminology in the UI:

| Current Term | Professional Term | English |
|-------------|-------------------|---------|
| 经度 | 投影中心经度 | Central Meridian |
| 纬度 | 投影中心纬度 | Projection Origin |
| 标准纬线 | 割线纬度 | Secant Latitude |
| 2D投影参数控制 | 投影参数面板 | Projection Parameters |

**Projection Properties**:
- 等角投影 (Conformal Projection): Preserves local angles
- 等面积投影 (Equal-Area Projection): Preserves area ratios
- 等距投影 (Equidistant Projection): Preserves distances from center

**Distortion Types**:
- 角度变形 (Angular Distortion)
- 面积变形 (Areal Distortion)  
- 长度变形 (Linear Distortion)

## 7. Modification History

### 2026-05-12 Major Update

**Bug Fixes**:
- Fixed cylindrical equal-area (Lambert) projection Step 1 not showing cylinder
  - Root cause: `step1_wrapCylinder()` didn't recreate geometry when projection type changed
  - Fix: Added geometry type check and recreation logic

**UI Improvements**:
1. Enhanced button guidance with gradient backgrounds and hover effects
2. Added left indicator bars for category buttons
3. Redesigned variant toggle buttons with filled active state
4. Added step navigation arrows (← Previous / Next →) to 3D scene
5. Added step indicator (1/3, 2/3, 3/3) between arrows

**Terminology Updates**:
- Updated Map2D.vue parameter labels to professional cartographic terms
- Added English translations for each parameter

**Files Modified**:
- `src/core/threeApp.js`: Bug fix for cylinder geometry recreation
- `src/App.vue`: UI redesign, step navigation state management
- `src/components/Map2D.vue`: Terminology updates
- `AGENTS.md`: This documentation update

## 8. Known Issues & TODO

- [ ] Consider adding tooltips for projection type explanations
- [ ] Add keyboard shortcuts for step navigation (← →)
- [ ] Consider adding animation speed control
- [ ] Add more projection types (Mollweide, Robinson, etc.)

## 9. Communication Guidelines

When encountering issues:
1. Always ask for clarification before making assumptions
2. Provide specific examples of the problem
3. Show code snippets when discussing implementation
4. Verify changes with `npm run build` before reporting completion
