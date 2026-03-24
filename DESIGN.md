# Azure Ethos: Design System Document

### 1. Overview & Creative North Star
**Creative North Star: The Academic Curator**
Azure Ethos is a high-end editorial design system tailored for educational management. It moves away from the "industrial dashboard" look, favoring an aesthetic that feels like a premium digital publication. It rejects the rigid grid in favor of **Intentional Asymmetry**, where a heavy left sidebar balances against a multi-paneled main stage and a focused right-side utility column. The system uses negative space as a functional element to reduce cognitive load while maintaining a dense information hierarchy.

### 2. Colors
The palette is built on a foundation of "clean" neutrals and a singular, vibrant Primary Blue (#2b7cee) that acts as the intellectual beacon.

- **Primary Roles:** Used for high-priority actions, active states, and brand signatures.
- **Supportive Tones:** Amber (#f59e0b) represents "In Progress" or "Pedagogical Review," while Emerald is used for "Completion."
- **The "No-Line" Rule:** Visual sectioning is achieved through the transition between `#ffffff` (Card/Sidebar) and `#f8f9fb` (Page Background). 1px solid borders are strictly limited to the `outline-variant` for essential containment, never for primary sectioning.
- **Surface Hierarchy:** 
    - `surface`: The base of the main canvas.
    - `surface_dim`: The background for the entire application wrapper.
    - `surface_container`: Used for nested components like the calendar or secondary inputs.
- **Glass & Gradient:** Floating elements should utilize a subtle `bg-white/80` with a `backdrop-blur-md` to maintain the editorial feel of layered paper.

### 3. Typography
Azure Ethos uses **Inter** across all scales, leaning on varied weights (from 300 to 900) to create a rhythmic, authoritative hierarchy.

- **Display & Headline:** The system utilizes large sizes like `1.875rem` (30px) for welcome messages and `1.5rem` for section headers. Bold weights (700-900) are used to "anchor" the eye.
- **Body & Labels:** The standard body rhythm is set at `0.875rem` (14px). For metadata and tiny "uppercase" labels, we drop to `9px` or `10px` with increased letter spacing (`tracking-wider`).
- **Typographic Rhythm:** There is a sharp contrast between the massive headlines and the tiny, high-density label text, mimicking the layout of a broadsheet newspaper or a modern textbook.

### 4. Elevation & Depth
Depth is communicated through **Tonal Layering** and soft, ambient shadows rather than harsh lines.

- **The Layering Principle:** A white card (`surface`) sits on a light grey floor (`surface_dim`). Inside the card, progress tracks use a darker grey floor (`surface_container`) to create "recessed" depth.
- **Ambient Shadows:** 
    - `shadow-sm`: Used for standard cards to create a slight lift from the background.
    - `shadow-lg`: Reserved for primary CTA buttons (e.g., "Novo Projeto"), combined with a colored glow (shadow-primary/20) to denote interactivity.
- **The Ghost Border:** Where borders are required (e.g., Sidebar-to-Main-Content), use `slate-100` (#f1f5f9) at a maximum width of 1px.

### 5. Components
- **Buttons:** Primary buttons are pill-shaped or "lg" rounded (12px), utilizing a shadow that shares the button's hue.
- **Chips & Status:** Status indicators are never boxed; they are represented by a "Pill + Text" or a "Dot + Text" combination to keep the interface airy.
- **Sidebars:** The active state is indicated by a vertical "marker" on the left edge and a color shift in the icon/text.
- **Progress Bars:** Use a high-contrast relationship between the track (`surface_container`) and the fill (`primary`).
- **Cards:** All cards use a uniform `rounded-2xl` (16px) or `rounded-xl` (12px) to soften the information-heavy layout.

### 6. Do's and Don'ts
**Do:**
- Use generous padding (e.g., `p-8` or `p-10`) to separate distinct data regions.
- Use `Inter Bold` for numbers to make them stand out as "data points."
- Use subtle background shifts to define the right-hand activity rail.

**Don't:**
- Do not use black (#000000) for text; use `slate-900` (#0f172a) for high-contrast headers.
- Avoid using multiple 1px lines in close proximity; it creates "visual noise."
- Do not use sharp corners (0px); the system requires at least a `rounded-lg` (8px) radius for all interactive elements.