# Floppy Worm - Steam Beta Testing Roadmap

## Executive Summary
This roadmap outlines the critical features and improvements needed to launch Floppy Worm as a beta on Steam. The focus is on player-facing features that ensure a smooth first-time experience and enable meaningful feedback collection.

## Current State Analysis

### ✅ What's Working
- **Core Gameplay**: Physics-based worm movement with Matter.js
- **Level Structure**: 25+ levels across multiple categories (Tutorial, Challenges, Morgan, Test)
- **Progress System**: Time tracking, best times, completion status
- **Input Support**: Keyboard, gamepad, and touch controls
- **Audio Foundation**: Background music system, volume controls
- **Map Variety**: Both JSON and SVG-based levels
- **Pause Menu**: Basic pause functionality with volume controls
- **Title Screen**: Animated title with worm physics showcase

### ⚠️ Critical Gaps for Beta
- No main menu navigation (Start, Settings, Quit)
- Missing comprehensive tutorial flow
- Incomplete audio (limited sound effects)
- No Steam integration
- Missing settings/options menu
- No crash recovery or error handling
- Limited visual polish and juice

## Priority Tiers for Beta Launch

### 🔴 Tier 1: MUST HAVE (Week 1-2)
*Without these, the beta will fail to provide basic functionality*

#### 1.1 Main Menu & Title Screen
- [x] Create proper title screen with game logo
- [x] Main menu with Start, Settings, Quit options
- [x] Version number display
- [x] Basic animations/transitions

#### 1.2 Tutorial & Onboarding

**low priority we have some basic levels to do this already**
- [ ] Expand tutorial levels with clear control instructions
- [ ] Visual control prompts (show keys/buttons)
- [ ] Progressive difficulty introduction
- [ ] Skip tutorial option for returning players

#### 1.3 Audio & Sound Effects
- [x] Movement sounds (squish, stretch)
- [x] Platform interaction sounds (electric zap, water splash)
- [x] Victory/completion jingle
- [x] UI sounds (menu navigation, button clicks)
- [ ] Ambient sounds for atmosphere

#### 1.4 Settings Menu
- [ ] Master volume slider
- [ ] Music volume slider
- [ ] SFX volume slider
- [ ] Graphics quality options (if needed)
- [ ] Control remapping (basic)
- [ ] Fullscreen toggle

#### 1.5 Error Handling & Stability
- [ ] Graceful crash recovery
- [ ] "Return to Menu" failsafe
- [ ] Loading screen improvements
- [ ] Performance monitoring
- [ ] Memory leak prevention

### 🟡 Tier 2: SHOULD HAVE (Week 2-3)
*These significantly improve the player experience*

#### 2.1 Visual Polish & Juice
- [ ] Worm animation improvements (squash/stretch)
- [ ] Particle effects (death, victory, collisions)
- [ ] Screen shake on impacts
- [ ] Better visual feedback for interactions
- [ ] Improved UI styling and consistency

#### 2.2 Steam Integration Basics
- [ ] Steam SDK integration
- [ ] Cloud saves
- [ ] Rich presence ("Playing Level X")
- [ ] Steam overlay support
- [ ] Basic achievements (5-10 core achievements)

#### 2.3 Level Selection Improvements
- [ ] Level preview images/thumbnails
- [ ] Difficulty indicators
- [ ] Lock/unlock system for progression
- [ ] Category descriptions
- [ ] Star rating system (1-3 stars based on time)

#### 2.4 Quality of Life
- [ ] Quick restart button (R key)
- [ ] Level timer display
- [ ] Death counter
- [ ] Ghost/replay of best run
- [ ] Checkpoint system for longer levels

#### 2.5 Performance Optimization
- [ ] Asset loading optimization
- [ ] Render optimization for low-end systems
- [ ] Consistent 60 FPS on target hardware
- [ ] Loading time reduction

### 🟢 Tier 3: NICE TO HAVE (Week 3-4)
*These add polish but aren't critical for beta*

#### 3.1 Advanced Features
- [ ] Leaderboards (global/friends)
- [ ] Daily challenge level
- [ ] Speed run mode
- [ ] Accessibility options (colorblind mode)
- [ ] Multiple worm skins/colors

#### 3.2 Social Features
- [ ] Screenshot mode
- [ ] Share button for times
- [ ] Steam Workshop support prep
- [ ] Discord Rich Presence

#### 3.3 Extended Content
- [ ] 10+ additional levels
- [ ] Secret/bonus levels
- [ ] New platform types
- [ ] Environmental hazards

## Beta Testing Focus Areas

### Primary Metrics to Track
1. **Completion Rate**: Which levels do players quit?
2. **Time to Complete**: Average completion times per level
3. **Death Locations**: Heat map of where players fail
4. **Control Preference**: Keyboard vs gamepad usage
5. **Session Length**: How long do players play?

### Feedback Collection Plan
- [ ] In-game feedback button
- [ ] Steam forums setup
- [ ] Discord server for beta testers
- [ ] Anonymous telemetry (with opt-in)
- [ ] Post-session survey prompts

## Technical Requirements

### Minimum System Requirements (Target)
- **OS**: Windows 10 64-bit
- **Processor**: Intel Core i3 or equivalent
- **Memory**: 4 GB RAM
- **Graphics**: DirectX 11 compatible
- **Storage**: 500 MB available space

### Steam Setup Checklist
- [ ] Steamworks account setup
- [ ] App ID registration
- [ ] Store page assets (screenshots, trailer, description)
- [ ] Beta branch configuration
- [ ] Depot upload scripts
- [ ] Achievement icons and descriptions

## Development Timeline

### Week 1 (Days 1-7)
- Main menu implementation
- Tutorial enhancement
- Core sound effects

### Week 2 (Days 8-14)
- Settings menu
- Error handling
- Steam SDK integration
- Visual polish pass 1

### Week 3 (Days 15-21)
- Performance optimization
- QoL features
- Achievement system
- Visual polish pass 2

### Week 4 (Days 22-28)
- Beta testing with small group
- Bug fixes from feedback
- Final polish
- Steam page preparation

### Week 5
- Steam beta launch

## Success Criteria for Beta

### Minimum Viable Beta
- [ ] 30-minute minimum playtime
- [ ] 90% crash-free sessions
- [ ] 50% tutorial completion rate
- [ ] Clear feedback channels established
- [ ] 100+ beta testers recruited

### Stretch Goals
- [ ] 60-minute average playtime
- [ ] 95% crash-free sessions
- [ ] 70% tutorial completion rate
- [ ] 500+ beta testers
- [ ] Streamer/content creator interest

## Risk Mitigation

### High-Risk Areas
1. **Performance on Low-End Systems**
   - Mitigation: Early testing on minimum spec machines
   - Fallback: Graphics quality options

2. **Tutorial Difficulty Curve**
   - Mitigation: Playtesting with newcomers
   - Fallback: Multiple difficulty options

3. **Steam Integration Issues**
   - Mitigation: Early SDK integration and testing
   - Fallback: Launch without Steam features initially

4. **Audio Implementation Delays**
   - Mitigation: Use placeholder sounds if needed
   - Fallback: Launch with minimal SFX

## Post-Beta Roadmap Preview

After successful beta testing:
1. Level editor and Steam Workshop
2. Multiplayer/co-op modes
3. Mobile port consideration
4. Expanded campaign (50+ levels)
5. Seasonal events and challenges

## Action Items for Immediate Start

### Day 1-2
1. Set up Steam Steamworks account
2. Implement basic main menu
3. Add movement sound effects
4. Create feedback collection form

### Day 3-4
1. Enhance tutorial with visual prompts
2. Add victory sound and particles
3. Implement quick restart
4. Set up Discord server

### Day 5-7
1. Create settings menu with volume controls
2. Add error boundary and crash recovery
3. Begin Steam SDK integration
4. Polish UI consistency

---

## Notes

- **Priority**: Focus on Tier 1 items exclusively until complete
- **Testing**: Test each feature with at least 3 different players
- **Feedback**: Document all feedback, even if not immediately actionable
- **Communication**: Weekly updates to beta testers on progress
- **Flexibility**: Be ready to pivot based on early feedback

This roadmap is a living document and should be updated weekly based on progress and feedback.
