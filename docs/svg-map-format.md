# SVG Map Format Specification

## Overview

Floppy Worm supports creating maps using SVG (Scalable Vector Graphics) files. This allows level designers to use visual tools like Inkscape to create levels while maintaining full control over physics properties and game behaviors.

## Design Principles

1. **Visual-first**: Design levels visually in any SVG editor
2. **Standards-based**: Uses standard SVG attributes and web conventions
3. **Runtime parsing**: SVG files are parsed at runtime, no build step required
4. **Progressive complexity**: Start simple, add advanced features as needed
5. **Backward compatible**: Works alongside existing JSON maps

## Basic Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <!-- World dimensions come from viewBox -->
  
  <!-- Worm starting position -->
  <circle class="worm-start" cx="100" cy="540" r="30"/>
  
  <!-- Goal(s) -->
  <circle class="goal" cx="1800" cy="540" r="40"/>
  
  <!-- Platforms -->
  <rect class="platform" x="0" y="1000" width="1920" height="80"/>
  
  <!-- Stickers (hints/text) -->
  <text class="sticker" x="960" y="500">Jump to reach the goal!</text>
</svg>
```

## Coordinate System

- The SVG `viewBox` defines the world dimensions in pixels
- Coordinates map 1:1 from SVG to game world
- Origin (0,0) is top-left corner
- Positive Y is downward (standard SVG/screen coordinates)

## Element Types

### Entities

#### Worm Start Position
```xml
<circle class="worm-start" cx="200" cy="300" r="20"/>
<!-- The radius is visual only, actual worm size is predetermined -->
```

#### Goals
```xml
<!-- Single goal -->
<circle class="goal" cx="1800" cy="540" r="40"/>

<!-- Multiple goals (ALL must be collected to complete the level) -->
<circle class="goal" cx="1800" cy="300" r="40"/>
<circle class="goal" cx="1800" cy="780" r="40"/>
<circle class="goal" cx="960" cy="200" r="40"/>
```

### Platforms

#### Basic Shapes

**Rectangle:**
```xml
<rect class="platform" x="100" y="500" width="200" height="50"/>

<!-- Rectangle with rounded corners (becomes chamfered in physics) -->
<rect class="platform" x="300" y="500" width="200" height="50" rx="10" ry="10"/>
```

**Circle:**
```xml
<circle class="platform" cx="300" cy="400" r="75"/>
```

**Ellipse:**
```xml
<ellipse class="platform" cx="500" cy="400" rx="100" ry="50"/>
```

**Polygon:**
```xml
<polygon class="platform" points="100,100 200,100 150,50"/>
```

**Path (Simple):**
```xml
<path class="platform" d="M 100 100 L 200 100 L 200 150 L 100 150 Z"/>
```

**Path (Complex with curves):**
```xml
<!-- Use data-collision to control how curves are handled -->
<path class="platform" 
      data-collision="sample:20"
      d="M 100 100 Q 150 50 200 100 T 300 100"/>
```

### Stickers (Text Hints)

```xml
<!-- Recommended: Use text-anchor="middle" for better positioning -->
<text class="sticker" x="500" y="300" text-anchor="middle">
  Pro tip: Hold jump to go higher!
</text>

<!-- Without text-anchor, positioning is approximated -->
<text class="sticker" x="500" y="300">
  Text aligned to the left
</text>

<!-- Multi-line text using tspan -->
<text class="sticker" x="500" y="300" text-anchor="middle">
  <tspan x="500" dy="0">First line</tspan>
  <tspan x="500" dy="20">Second line</tspan>
</text>
```

**Note on Text Positioning:**
- SVG text uses baseline positioning (y is at the text baseline)
- Use `text-anchor="middle"` for centered text (recommended)
- The parser adjusts for baseline offset automatically
- Font size affects vertical positioning calculations

## Platform Types

Platform types are specified using CSS classes. Multiple classes can be combined.

### Standard Platform
```xml
<rect class="platform" x="0" y="500" width="200" height="50"/>
```

### Special Platform Types

**Ice Platform:**
```xml
<rect class="platform ice" x="200" y="500" width="200" height="50"/>
```

**Bouncy Platform:**
```xml
<rect class="platform bouncy" x="400" y="500" width="200" height="50"/>
```

**Electric Platform:**
```xml
<rect class="platform electric" x="600" y="500" width="200" height="50"/>
```

**Fire Platform:**
```xml
<rect class="platform fire" x="800" y="500" width="200" height="50"/>
```

**Black Hole Platform:**
```xml
<circle class="platform blackhole" cx="500" cy="300" r="40"/>
```

**Water Platform:**
```xml
<rect class="platform water" x="1000" y="500" width="200" height="100"/>
```

**Waterfall Platform:**
```xml
<rect class="platform waterfall" x="1200" y="300" width="50" height="300"/>
```

## Advanced Configuration

### Physics Properties

Override default physics using `data-physics`:

```xml
<rect class="platform ice" 
      x="100" y="500" width="200" height="50"
      data-physics='{"friction": 0.01, "restitution": 0.9}'/>
```

Available physics properties:
- `friction` (0-1): Surface friction
- `frictionStatic` (0-1): Static friction
- `restitution` (0-1): Bounciness
- `density` (0+): Mass density

### Moving Platforms

Add motion using `data-motion`:

```xml
<!-- Horizontal movement -->
<rect class="platform" 
      x="300" y="500" width="100" height="50"
      data-motion='{"type": "horizontal", "distance": 200, "speed": 60}'/>

<!-- Vertical movement -->
<rect class="platform"
      x="500" y="400" width="100" height="50"
      data-motion='{"type": "vertical", "distance": 150, "speed": 45}'/>

<!-- Circular movement (future) -->
<rect class="platform"
      x="700" y="400" width="80" height="40"
      data-motion='{"type": "circular", "radius": 100, "speed": 30}'/>
```

### Platform-Specific Configuration

Different platform types support additional configuration:

**Black Hole:**
```xml
<circle class="platform blackhole" cx="500" cy="300" r="30"
        data-config='{"attractionRadius": 300, "attractionStrength": 0.2}'/>
```

**Electric Platform:**
```xml
<rect class="platform electric" x="100" y="500" width="200" height="50"
      data-config='{"damage": 10, "shockInterval": 500}'/>
```

## Visual Properties

### Colors and Styling

SVG fill and stroke properties are preserved:

```xml
<!-- Custom colored platform -->
<rect class="platform" 
      x="100" y="500" width="200" height="50"
      fill="#FF6B6B" stroke="#000000" stroke-width="3"/>

<!-- Semi-transparent platform -->
<rect class="platform glass" 
      x="300" y="500" width="200" height="50"
      fill="#87CEEB" opacity="0.5"/>
```

### Rounded Corners

SVG rounded corners (`rx` and `ry` attributes) are automatically converted to physics chamfers:

```xml
<!-- Rounded rectangle -->
<rect class="platform" x="100" y="100" width="200" height="50" rx="15" ry="15"/>

<!-- Different x/y radii (uses the larger value for chamfer) -->
<rect class="platform" x="100" y="200" width="200" height="50" rx="20" ry="10"/>
```

Note: Matter.js chamfer uses uniform corner radius, so if `rx` and `ry` differ, the larger value is used.

### Transformations

SVG transforms are applied to physics bodies:

```xml
<!-- Rotated platform -->
<rect class="platform" 
      x="100" y="500" width="200" height="50"
      transform="rotate(45 200 525)"/>

<!-- Scaled platform (visual only, use width/height for physics) -->
<rect class="platform"
      x="100" y="500" width="200" height="50"
      transform="scale(1.5 1)"/>
```

## Groups and Inheritance

Use `<g>` groups to apply properties to multiple elements:

```xml
<!-- All platforms in this group are ice platforms -->
<g class="platform ice">
  <rect x="100" y="500" width="100" height="50"/>
  <rect x="250" y="500" width="100" height="50"/>
  <rect x="400" y="500" width="100" height="50"/>
</g>

<!-- Group with shared physics -->
<g class="platform" data-physics='{"restitution": 0.8}'>
  <circle cx="200" cy="300" r="40"/>
  <circle cx="300" cy="300" r="40"/>
  <circle cx="400" cy="300" r="40"/>
</g>
```

## Path Handling

Complex SVG paths need special handling for physics collision:

### Collision Modes

**Bounding Box (default for complex paths):**
```xml
<path class="platform" data-collision="bbox" d="M 0 0 C ..."/>
```

**Polygon Sampling:**
```xml
<!-- Sample 20 points along the path -->
<path class="platform" data-collision="sample:20" d="M 0 0 C ..."/>

<!-- High precision sampling -->
<path class="platform" data-collision="sample:50" d="M 0 0 C ..."/>
```

**Convex Hull:**
```xml
<path class="platform" data-collision="hull" d="M 0 0 L ..."/>
```

## Layers and Organization

Use SVG layers (groups with IDs) for organization:

```xml
<svg viewBox="0 0 1920 1080">
  <!-- Background layer (future) -->
  <g id="background">
    <!-- Background elements -->
  </g>
  
  <!-- Platform layer -->
  <g id="platforms">
    <rect class="platform" x="0" y="1000" width="1920" height="80"/>
    <!-- More platforms -->
  </g>
  
  <!-- Entity layer -->
  <g id="entities">
    <circle class="worm-start" cx="100" cy="500" r="30"/>
    <circle class="goal" cx="1800" cy="500" r="40"/>
  </g>
  
  <!-- UI layer -->
  <g id="ui">
    <text class="sticker" x="960" y="200">Level 1: Getting Started</text>
  </g>
</svg>
```

## Inkscape Workflow

### Setting Up a New Level

1. **Create new document**
   - File → New
   - Set document size (File → Document Properties)
   - Common sizes: 1920×1080, 1024×768, 2048×1536

2. **Set up layers**
   - Layer → Layers and Objects panel
   - Create layers: platforms, entities, ui

3. **Draw platforms**
   - Use rectangle, circle, or bezier tools
   - Set fill and stroke colors as desired

4. **Add classes**
   - Select object
   - Object → Object Properties (Shift+Ctrl+O)
   - Add classes in the "Class" field (space-separated)
   - Or use XML Editor (Shift+Ctrl+X) for more control

5. **Add data attributes**
   - Open XML Editor (Shift+Ctrl+X)
   - Select element
   - Add new attribute (e.g., `data-motion`)
   - Set value as JSON string

6. **Place entities**
   - Draw circles for worm-start and goals
   - Add appropriate classes

7. **Save as Plain SVG**
   - File → Save As
   - Choose "Plain SVG" format

### Tips for Inkscape

- **Snapping**: Enable snapping to grid for precise alignment
- **Clones**: Use Edit → Clone for repeated elements
- **Symbols**: Create reusable platform symbols
- **Extensions**: Consider writing Inkscape extensions for common tasks
- **Templates**: Save template files with common setups

## Parser Implementation Notes

### Parsing Order

1. Parse viewBox for world dimensions
2. Find and process entities (worm-start, goals)
3. Process platforms in document order (preserves z-order)
4. Process stickers/text
5. Apply group inheritance for classes and data attributes

### Class Resolution

Classes are resolved in this order:
1. Element's own `class` attribute
2. Parent `<g>` group's `class` attribute
3. Grandparent groups (recursive up to root)

### Data Attribute Merging

Data attributes from groups are merged with element attributes:
```javascript
// Group has data-physics='{"friction": 0.5}'
// Element has data-physics='{"restitution": 0.8}'
// Result: {"friction": 0.5, "restitution": 0.8}
```

### Transform Handling

- Transforms are applied to physics bodies
- Multiple transforms are composed into a single matrix
- Rotation is extracted and applied to Matter.js body
- Scale affects width/height before body creation
- Translation adjusts x/y position

## Limitations and Considerations

1. **Text rendering**: SVG text styling is simplified in-game
2. **Gradients**: Not supported for platform fills (use solid colors)
3. **Filters**: SVG filters are ignored (performance reasons)
4. **Nested transforms**: Deeply nested transforms may have precision issues
5. **Path complexity**: Very complex paths may impact performance
6. **File size**: Large SVG files may have loading delays

## Example: Complete Simple Level

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <!-- Simple tutorial level -->
  
  <!-- Entities -->
  <circle class="worm-start" cx="150" cy="900" r="30" fill="#4CAF50"/>
  <circle class="goal" cx="1770" cy="200" r="40" fill="#FFD700"/>
  
  <!-- Ground -->
  <rect class="platform" x="0" y="1000" width="1920" height="80" fill="#8B7355"/>
  
  <!-- Stepping stones -->
  <g class="platform" fill="#A0522D">
    <rect x="300" y="850" width="150" height="40"/>
    <rect x="550" y="700" width="150" height="40"/>
    <rect x="800" y="550" width="150" height="40"/>
  </g>
  
  <!-- Moving platform -->
  <rect class="platform" x="1100" y="500" width="200" height="40"
        fill="#696969"
        data-motion='{"type": "vertical", "distance": 200, "speed": 50}'/>
  
  <!-- Ice platform near goal -->
  <rect class="platform ice" x="1500" y="300" width="300" height="40"
        fill="#E0FFFF"/>
  
  <!-- Help text -->
  <text class="sticker" x="150" y="850" font-size="24" fill="#FFFFFF">
    Use both sticks to move!
  </text>
</svg>
```

## Future Enhancements

- Background image support via `<image>` tags
- Constraint system for ropes/chains
- Particle emitter positions
- Trigger zones for events
- Checkpoint positions
- Camera hints/zones
- Sound trigger areas