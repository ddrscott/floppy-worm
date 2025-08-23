# Switch and Door Platform System

## Overview

The switch and door system provides interactive puzzle mechanics for Floppy Worm levels. Switches can be activated by the worm to open corresponding doors, creating dynamic paths and puzzle challenges.

## Features

### Switches
- **Visual Feedback**: Colored button that depresses when activated
- **Two Modes**: Toggle (stays on/off) or Pressure (requires continuous weight)
- **Color Coding**: Each switch has a unique color that matches its doors
- **Audio Feedback**: Sound effects on activation/deactivation
- **Anti-Bounce**: 100ms cooldown prevents accidental re-triggering

### Doors
- **Directional Movement**: Slides up, down, left, or right when activated
- **Visual Indicators**: 
  - Thick arrow showing slide direction
  - Direction-based pattern lines (vertical for up/down, horizontal for left/right)
  - Color-matched to corresponding switch
- **State Changes**: 
  - Solid when closed (blocks passage)
  - Non-solid when open (allows passage)
  - Smooth animated transitions

## Color System

Switches and doors use a shared color palette for clear visual connections:

| ID | Color | Hex Code | Description |
|---|---|---|---|
| `red` | Red | `#ff0000` | Bright red switches/doors |
| `blue` | Blue | `#0000ff` | Bright blue switches/doors |
| `green` | Green | `#00ff00` | Bright green switches/doors |
| `yellow` | Yellow | `#ffff00` | Bright yellow switches/doors |
| `purple` | Purple | `#ff00ff` | Magenta/purple switches/doors |
| `cyan` | Cyan | `#00ffff` | Cyan switches/doors |
| `orange` | Orange | `#ffa500` | Orange switches/doors |
| `pink` | Pink | `#ff69b4` | Pink switches/doors |

**Visual States:**
- **Inactive**: 40% brightness of base color with reduced opacity
- **Active**: Full brightness with increased opacity and subtle pulsing effect

## Implementation

### JSON Map Format

#### Switch Platform
```json
{
  "type": "rectangle",
  "platformType": "switch",
  "x": 200,
  "y": 400,
  "width": 100,
  "height": 30,
  "switchId": "red",
  "toggleMode": true,
  "color": "#808080"
}
```

**Properties:**
- `platformType`: Must be `"switch"`
- `switchId`: Unique identifier that links to doors (e.g., "red", "blue", "green")
- `toggleMode`: 
  - `true` (default): Switch stays on/off when pressed
  - `false`: Switch only active while worm is on it (pressure mode)

#### Door Platform
```json
{
  "type": "rectangle",
  "platformType": "door",
  "x": 500,
  "y": 400,
  "width": 30,
  "height": 100,
  "doorId": "red",
  "slideDirection": "up",
  "slideDistance": 150,
  "color": "#604020"
}
```

**Properties:**
- `platformType`: Must be `"door"`
- `doorId`: Must match a switch's `switchId` to be controlled by it
- `slideDirection`: Direction door moves when activated
  - `"up"`: Slides upward
  - `"down"`: Slides downward
  - `"left"`: Slides to the left
  - `"right"`: Slides to the right
- `slideDistance`: How far the door slides in pixels (default: 1.5x the door's largest dimension)

### SVG Map Format

#### Switch Element
```xml
<rect
  class="platform switch"
  data-switch-id="red"
  data-toggle-mode="true"
  x="100"
  y="400"
  width="100"
  height="30"
  fill="#808080"
  stroke="#000000"
  stroke-width="2"
/>
```

#### Door Element
```xml
<rect
  class="platform door"
  data-door-id="red"
  data-slide-direction="up"
  data-slide-distance="150"
  x="350"
  y="400"
  width="30"
  height="100"
  fill="#604020"
  stroke="#000000"
  stroke-width="2"
/>
```

**SVG-Specific Attributes:**
- Use `data-*` attributes for platform properties
- Classes must include both `platform` and the type (`switch` or `door`)
- Standard SVG attributes for positioning and styling

## Usage Examples

### Example 1: Simple Toggle Switch and Door
One switch that opens one door permanently until toggled again.

```json
{
  "platforms": [
    {
      "type": "rectangle",
      "platformType": "switch",
      "x": 100,
      "y": 500,
      "width": 80,
      "height": 25,
      "switchId": "blue",
      "toggleMode": true
    },
    {
      "type": "rectangle",
      "platformType": "door",
      "x": 300,
      "y": 400,
      "width": 25,
      "height": 100,
      "doorId": "blue",
      "slideDirection": "up",
      "slideDistance": 120
    }
  ]
}
```

### Example 2: Pressure Switch with Horizontal Door
Door only stays open while the worm is on the switch.

```json
{
  "platforms": [
    {
      "type": "rectangle",
      "platformType": "switch",
      "x": 200,
      "y": 600,
      "width": 100,
      "height": 30,
      "switchId": "yellow",
      "toggleMode": false
    },
    {
      "type": "rectangle",
      "platformType": "door",
      "x": 400,
      "y": 550,
      "width": 150,
      "height": 30,
      "doorId": "yellow",
      "slideDirection": "right",
      "slideDistance": 200
    }
  ]
}
```

### Example 3: One Switch Controls Multiple Doors
All doors with the same ID respond to the same switch.

```json
{
  "platforms": [
    {
      "type": "rectangle",
      "platformType": "switch",
      "x": 150,
      "y": 700,
      "width": 100,
      "height": 30,
      "switchId": "green",
      "toggleMode": true
    },
    {
      "type": "rectangle",
      "platformType": "door",
      "x": 300,
      "y": 600,
      "width": 30,
      "height": 80,
      "doorId": "green",
      "slideDirection": "left",
      "slideDistance": 100
    },
    {
      "type": "rectangle",
      "platformType": "door",
      "x": 450,
      "y": 550,
      "width": 100,
      "height": 30,
      "doorId": "green",
      "slideDirection": "down",
      "slideDistance": 100
    }
  ]
}
```

## Level Design Tips

### Best Practices
1. **Color Consistency**: Use consistent switch/door colors throughout a level or section
2. **Visual Clarity**: Ensure switches and their corresponding doors are visually connected (use proximity or sight lines)
3. **Progressive Difficulty**: Start with simple one-to-one relationships before introducing multiple doors
4. **Clear Feedback**: Place doors where players can see them activate when pressing switches

### Common Patterns

#### Gate Pattern
Use a door to block access to a goal or section until the switch is found and activated.

#### Timing Challenge
Use pressure switches to create time-limited passages where players must move quickly.

#### Sequential Puzzles
Multiple switches that must be activated in order, with each opening the path to the next.

#### Choice Paths
Multiple colored switch/door systems where activating one might block access to another.

### Technical Considerations

1. **Performance**: Each door animation runs for 500ms - avoid triggering too many simultaneously
2. **Physics**: Doors become non-solid when open, completely removing collision
3. **State Persistence**: Switch states are not saved - restarting a level resets all switches
4. **Audio**: Each switch activation plays a sound with built-in cooldown to prevent audio spam

## Troubleshooting

### Common Issues

**Problem**: Switch doesn't activate door
- **Solution**: Verify `switchId` matches `doorId` exactly (case-sensitive)

**Problem**: Door slides wrong direction
- **Solution**: Check `slideDirection` spelling (must be exactly "up", "down", "left", or "right")

**Problem**: Switch rapidly toggles
- **Solution**: Built-in 100ms cooldown should prevent this, but check for multiple collision bodies

**Problem**: Door doesn't return to original position
- **Solution**: For pressure switches, ensure `toggleMode` is set to `false`

## Test Level

A comprehensive test level is available at `levels/050-test/050-switch-and-doors.svg` demonstrating:
- Red toggle switch with vertical door
- Blue toggle switch with horizontal door  
- Green switch controlling multiple doors
- Yellow pressure switch with temporary door

Load this level to see all features in action and test the system functionality.

## File Locations

- **Implementation**: 
  - `/src/entities/SwitchPlatform.js`
  - `/src/entities/DoorPlatform.js`
- **Factory**: `/src/factories/PlatformFactory.js`
- **Test Levels**: 
  - `/levels/050-test/050-switch-and-doors.svg`
  - `/levels/050-test/switch-door-test.json`

## Future Enhancements

Potential improvements for future versions:
- Timed switches (auto-deactivate after X seconds)
- Combination locks (multiple switches must be active simultaneously)
- Remote switches (activated by projectiles or other mechanisms)
- Rotating doors instead of sliding
- Switches that cycle through multiple states
- Visual connection lines between switches and doors