# Worm Physics Game - Product Requirements Document

## 1. Game Overview

### Core Concept
A physics-based platformer where players control a segmented worm using analog stick controls for head and tail movement. The game emphasizes skill expression through emergent physics-based maneuvers including jumps, flips, extensions, and complex aerial tricks.

### Target Audience
- **Primary**: Streamers and speedrunners seeking skill-based content
- **Secondary**: Players who enjoy physics-based platformers and trick scoring systems

### Core Pillars
1. **Responsive Physics**: Predictable, skill-based movement system
2. **Emergent Mastery**: Advanced techniques discoverable through physics exploration
3. **Streaming Appeal**: Visually spectacular moments and natural retry loops
4. **Speedrun Optimization**: Consistent mechanics enabling route discovery and time optimization

## 2. Core Mechanics

### 2.1 Worm Physics System

```mermaid
graph TD
    A[Analog Stick Input] --> B[Head Control]
    A --> C[Tail Control]
    D[Trigger Input] --> E[Spring Stiffness Control]
    B --> F[Physics Engine - Matter.js]
    C --> F
    E --> F
    F --> G[Worm Segment Chain]
    G --> H[Visual Representation]
    G --> I[Collision Detection]
    I --> J[Movement Response]
    
    K[Worm Folding State] --> E
    E --> L[Rapid Straightening]
    L --> M[Launch Force]
```

**Specifications:**
- **Worm Composition**: 12 segments with radius 15 (largest) to 11 (smallest)
- **Physics Engine**: Matter.js
- **Control Scheme**: Dual analog sticks (head/tail independent control)
- **Extension System**: Trigger-controlled spring stiffness for rapid straightening
- **Chain Physics**: Rope-like behavior enabling natural pendulum and elastic motions

### 2.2 Movement Capabilities

**Core Movements:**
- Basic locomotion via head/tail coordination
- Extension jumps using trigger-controlled straightening force
- Natural physics enabling: pogo jumps, flips, twists, pendulum swings
- Launch potential: Up to 3x worm length in distance/height based on folding and trigger pressure

**Emergent Techniques:**
- Gymnastic maneuvers through momentum conservation
- Precision platforming via segment control
- High-speed traversal combining multiple movement types

## 3. Game Modes and Structure

### 3.1 Training Mode

```mermaid
flowchart TD
    A[Training Mode Entry] --> B[Basic Movement Tutorials]
    B --> C[Extension Mechanics]
    C --> D[Advanced Techniques]
    D --> E[Trick Combinations]
    E --> F[Graduation to Tower Mode]
    
    B --> G[5-Second Level Challenges]
    C --> G
    D --> G
    E --> G
```

**Purpose**: Skill development and mechanic familiarization
**Structure**: Progressive tutorial levels teaching specific techniques
**Level Design**: 5-second completion time for skilled players
**Objective**: Single goal per level (touch the star)

### 3.2 Tower Mode (Primary Challenge)

```mermaid
graph TD
    A[Tower Entry] --> B[Multi-Target Navigation]
    B --> C[Switch/Gate Mechanics]
    C --> D[Vertical Progression]
    D --> E[Route Planning Required]
    E --> F[Fall Punishment System]
    F --> G[Climb Recovery Mechanics]
    
    H[Collectibles] --> B
    I[Alternative Routes] --> D
    J[Risk/Reward Sections] --> E
```

**Core Features:**
- **Multi-target objectives**: Multiple stars, switches, gates per section
- **Vertical design**: Climbing-focused with fall punishment
- **Route planning**: Multiple viable paths with skill/risk tradeoffs
- **Progressive difficulty**: Advanced sections require mastery of multiple techniques

**Punishment System:**
- Falls result in downward progression loss
- Players must re-climb to previous position
- No permanent failure states

## 4. Time Machine System

### 4.1 State Management

```mermaid
sequenceDiagram
    participant Player
    participant Input
    participant StateCapture
    participant PhysicsEngine
    participant RewindSystem
    
    Player->>Input: Hold North Button + Analog
    Input->>RewindSystem: Activate Rewind Mode
    StateCapture->>StateCapture: Capture Frame Data
    Note over StateCapture: Every 5-10 frames
    RewindSystem->>PhysicsEngine: Pause Physics
    RewindSystem->>PhysicsEngine: Restore Target State
    Player->>Input: Release North Button
    Input->>RewindSystem: Resume Real-time
    RewindSystem->>PhysicsEngine: Resume Physics
```

**Technical Requirements:**
- **State Capture**: Position, velocity, angle, angular velocity for all worm segments
- **Capture Frequency**: Every 5-10 frames to balance memory usage
- **Storage Duration**: Maximum 5-10 seconds of history
- **Memory Management**: Circular buffer with automatic cleanup

### 4.2 Control Scheme

```mermaid
stateDiagram-v2
    [*] --> NormalPlay
    NormalPlay --> RewindMode : Hold North Button
    RewindMode --> Rewinding : Analog CCW
    RewindMode --> FastForward : Analog CW
    RewindMode --> Paused : Analog Neutral
    Rewinding --> RewindMode : Release Analog
    FastForward --> RewindMode : Release Analog
    Paused --> RewindMode : Move Analog
    RewindMode --> NormalPlay : Release North Button
```

**Control Mapping:**
- **Activation**: Hold North button (Y/Triangle)
- **Rewind Speed**: Analog stick counter-clockwise
- **Fast Forward**: Analog stick clockwise
- **Precision**: Analog magnitude determines speed

**Visual Effects:**
- Particle trails flowing backwards during rewind
- Chromatic aberration/time distortion effects
- Timeline scrubber UI display
- Ghost trails showing previous positions

## 5. Trick Detection and Scoring System

### 5.1 Trick Categories

```mermaid
mindmap
  root((Trick System))
    Launch Tricks
      Power Launch
      Precision Launch
      Maximum Fold Launch
      Chain Launch
      Angled Launch
    Rotation Tricks
      Single Flip
      Double Flip
      Spiral Climb
      Flip Chain
      Launch Flip
    Momentum Tricks
      Pogo Jump
      Ricochet
      Wall Ride
      Accordion
      Speed Demon
    Precision Tricks
      Perfect Landing
      Recovery
      Slalom
      Corner Wrap
      Ceiling Crawl
```

### 5.2 Detection Algorithm

```mermaid
flowchart TD
    A[Physics State Monitor] --> B[Pattern Recognition]
    B --> C{Trick Detected?}
    C -->|Yes| D[Trick Validation]
    C -->|No| A
    D --> E{Valid Execution?}
    E -->|Yes| F[Score Calculation]
    E -->|No| A
    F --> G[Combo System Update]
    G --> H[Visual Feedback]
    
    I[Velocity Threshold] --> D
    J[Duration Requirements] --> D
    K[Smoothness Metrics] --> D
```

**Detection Parameters:**
- **Flip Detection**: Angular momentum > threshold + complete rotation
- **Pogo Detection**: Compression cycles + rhythmic ground contact
- **Launch Detection**: Rapid straightening force + resulting trajectory distance
- **Fold Quality**: Degree of worm compression before launch
- **Style Modifiers**: Smoothness metrics, air time, launch power efficiency

### 5.3 Scoring Framework

**Base Scores:**
- Basic Jump: 100 points
- Power Launch: 200 points + distance bonus
- Flip: 500 points per rotation
- Pogo: 300 points + 100 per consecutive bounce
- Perfect Landing: 2x multiplier
- Maximum Fold Launch: 3x multiplier

**Combo System:**
```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Active : First Trick
    Active --> Grace : Trick Complete
    Grace --> Active : New Trick
    Grace --> Ending : Timeout
    Active --> Broken : Hard Impact/Hazard
    Ending --> ScoreDisplay : Calculate Final
    Broken --> Idle : Reset
    ScoreDisplay --> Idle : Display Complete
```

**Combo Rules:**
- **Grace Period**: 1-2 seconds after trick completion
- **Break Conditions**: Hard impacts, hazards, full stop on ground
- **Multipliers**: Consecutive tricks increase score exponentially

## 6. Camera System

### 6.1 Dynamic Zoom

```mermaid
graph LR
    A[Worm Velocity] --> B[Calculate Target Zoom]
    C[Worm Fold State] --> B
    D[Launch Trajectory] --> B
    E[Base Zoom: 1.0] --> B
    F[Min Zoom: 0.3] --> B
    B --> G[Smooth Transition]
    G --> H[Camera Update]
    
    I[Delay Timer] --> G
    J[Movement Prediction] --> H
```

**Zoom Algorithm:**
- **Base Zoom**: 1.0 for stationary/slow movement
- **Minimum Zoom**: 0.3 for maximum velocity or major launches
- **Fold Factor**: Additional zoom-out when worm is highly compressed (anticipating launch)
- **Trajectory Zoom**: Dynamic zoom based on predicted launch distance
- **Smooth Transitions**: Lerp with delay before zoom-in recovery

### 6.2 Camera Behavior

**Velocity-Based Scaling:**
```
targetZoom = baseZoom - (wormSpeed / maxSpeed) * (baseZoom - minZoom)
```

**Predictive Following:**
- Camera leads slightly during fast movement
- Temporary pull-back during anticipated launches (when worm is highly folded)
- Zoom out to frame entire launch trajectory
- Dynamic framing based on worm compression state

## 7. Level Design Systems

### 7.1 Training Level Structure

```mermaid
flowchart TD
    A[Movement Basics] --> B[Extension Mechanics]
    B --> C[Basic Jumping]
    C --> D[Advanced Techniques]
    D --> E[Trick Combinations]
    E --> F[Challenge Levels]
    
    G[5-Second Target] --> A
    G --> B
    G --> C
    G --> D
    G --> E
    G --> F
```

**Design Principles:**
- **Single Objective**: Touch the star
- **5-Second Completion**: Target time for skilled players
- **Progressive Difficulty**: Each level introduces or combines techniques
- **Retry-Friendly**: Immediate restart capability

### 7.2 Tower Design

```mermaid
graph TD
    A[Entry Level] --> B[Multi-Path Section 1]
    B --> C[Switch Gate 1]
    C --> D[Vertical Challenge]
    D --> E[Collectible Branch]
    E --> F[Switch Gate 2]
    F --> G[Advanced Section]
    G --> H[Final Challenge]
    
    I[Safe Route] --> B
    J[Risk Route] --> B
    K[Fall Recovery] --> D
    L[Alternative Path] --> G
```

**Tower Features:**
- **Multiple Collectibles**: Stars, switches, special items per section
- **Gate Mechanics**: Require backtracking and route planning
- **Difficulty Scaling**: Progressive skill requirements
- **Fall Punishment**: Lose elevation, must re-climb
- **Route Variety**: Multiple viable paths with different skill requirements

## 8. Technical Specifications

### 8.1 Physics Requirements

**Matter.js Configuration:**
- **Engine**: Standard Matter.js physics engine
- **Body Types**: Circular segments with constraints
- **Collision Detection**: Continuous for all worm segments
- **Constraint System**: Rope-like connections between segments

**Performance Targets:**
- **Frame Rate**: 60 FPS consistent
- **Physics Steps**: 60Hz physics updates
- **Segment Count**: 12 segments maximum
- **Constraint Stability**: No constraint breaking under normal play

### 8.2 Data Management

```mermaid
erDiagram
    PLAYER {
        string playerID
        int totalScore
        int rewindTimeRemaining
        json progressData
    }
    
    LEVEL_COMPLETION {
        string levelID
        float completionTime
        int score
        json tricksPerformed
    }
    
    LEADERBOARD_ENTRY {
        string playerID
        string levelID
        float bestTime
        int bestScore
        timestamp achievedDate
    }
    
    REWIND_PURCHASE {
        string playerID
        int timesPurchased
        timestamp lastPurchase
    }
    
    PLAYER ||--o{ LEVEL_COMPLETION : completes
    PLAYER ||--o{ LEADERBOARD_ENTRY : achieves
    PLAYER ||--o{ REWIND_PURCHASE : makes
```

### 8.3 Leaderboard Integration

**Platform Integration:**
- **Steam Leaderboards**: Primary platform for PC
- **Speedrun.com Compatibility**: Export format for community boards
- **Local Storage**: Offline leaderboards for guest play
- **Account Sync**: Cross-device progress synchronization

**Data Points:**
- Completion times per level
- Trick scores and combinations
- Perfect completion rates
- Rewind usage statistics

## 9. User Interface Systems

### 9.1 HUD Elements

```mermaid
graph TD
    A[Game HUD] --> B[Timer Display]
    A --> C[Minimap]
    A --> D[Score Display]
    A --> E[Rewind Meter]
    
    F[Rewind Mode HUD] --> G[Timeline Scrubber]
    F --> H[Rewind Direction Indicator]
    F --> I[State Preview]
    
    J[Trick Display] --> K[Trick Name Popup]
    J --> L[Score Animation]
    J --> M[Combo Multiplier]
```

**Standard HUD:**
- **Timer**: Precision timing display (0:00.00 format)
- **Minimap**: Enhanced navigation with hints and collectible markers
- **Score**: Real-time trick scoring with combo indicators
- **Rewind Meter**: Available rewind time remaining

**Rewind Mode Interface:**
- **Timeline Scrubber**: Visual timeline with position indicator
- **Direction Arrows**: Clear indication of rewind/fast-forward direction
- **State Preview**: Ghost worm showing target position

### 9.2 Visual Feedback Systems

**Trick Recognition:**
- Popup text with trick names and scores
- Screen effects (shake, flash, particle bursts)
- Worm visual effects (glow, trails, color shifts)
- Audio cues matching visual feedback

**Physics Enhancement:**
- Particle trails during high-speed movement
- Impact effects on collisions
- Extension visualization during stretching
- Momentum lines showing trajectory

## 10. Monetization Framework

### 10.1 Rewind Time System

```mermaid
stateDiagram-v2
    [*] --> FreeRewindPool
    FreeRewindPool --> InGame : Use Rewind
    InGame --> FreeRewindPool : Rewind Complete
    FreeRewindPool --> PurchasePrompt : Pool Depleted
    PurchasePrompt --> PaidRewindPool : Purchase Made
    PaidRewindPool --> InGame : Use Rewind
    InGame --> PaidRewindPool : Rewind Complete
    PurchasePrompt --> ContinueWithout : Decline Purchase
    ContinueWithout --> InGame : Resume Play
```

**Free Allocation:**
- **Base Amount**: Sufficient for normal learning and occasional mistakes
- **Regeneration**: Time-based or level-completion recovery
- **No Requirement**: Game fully playable without purchases

**Purchase Options:**
- **Small Pack**: 30 seconds additional rewind time
- **Medium Pack**: 2 minutes additional rewind time
- **Large Pack**: 10 minutes additional rewind time
- **Premium**: Unlimited rewind for premium players

### 10.2 Monetization Principles

**Fair Play Requirements:**
- Game completable without purchases
- Skill development not monetization-gated
- Rewind purchases are convenience only
- No pay-to-win mechanics in competitive modes

## 11. Platform and Technical Requirements

### 11.1 Target Platforms

**Primary Platform:**
- **PC/Steam**: Full feature set with Steam integration
- **Gamepad Support**: Xbox/PlayStation controller optimization
- **Keyboard Alternative**: Basic keyboard controls for accessibility

**Secondary Platforms:**
- **Mobile**: Touch controls with virtual analog sticks
- **Console**: PlayStation, Xbox, Nintendo Switch adaptation

### 11.2 Performance Specifications

**Minimum Requirements:**
- **Physics Calculations**: 60Hz stable with 12-segment worm
- **Rendering**: 60 FPS at 1080p minimum
- **Memory Usage**: Under 512MB for core gameplay
- **Storage**: Under 2GB total game size

**Optimization Targets:**
- **Physics Determinism**: Identical results from identical inputs
- **Network Sync**: Leaderboard data synchronization
- **Quick Load**: Under 2 seconds level restart time
- **Memory Management**: Efficient state history circular buffer

## 12. Success Metrics

### 12.1 Streaming Metrics

**Engagement Indicators:**
- Average session duration
- Retry rate per level
- Trick attempt frequency
- Social media clip generation rate

**Content Creation Support:**
- Built-in replay system
- Highlight detection and saving
- Easy sharing mechanisms
- Spectator-friendly visual design

### 12.2 Speedrunning Metrics

**Community Health:**
- Active leaderboard participation
- Route discovery rate
- Technique innovation frequency
- Community tutorial creation

**Technical Support:**
- Deterministic physics behavior
- Precise timing systems
- Anti-cheat compatibility
- Video verification support

---

*This PRD serves as the comprehensive specification for the worm physics game, focusing on emergent skill expression, streaming appeal, and speedrunning optimization while maintaining accessibility through progressive difficulty and optional monetization.*
