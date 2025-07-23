import Phaser from 'phaser';

export default class GamepadTest extends Phaser.Scene {
    constructor() {
        super({ key: 'GamepadTest' });
        this.gamepad = null;
        this.stickVisuals = {};
        this.buttonVisuals = {};
        this.triggerBars = {};
        this.buttonLog = [];
        this.maxLogEntries = 10;
    }

    create() {
        // Dark background
        this.cameras.main.setBackgroundColor('#1a1a2e');
        
        // Title
        this.add.text(400, 30, 'PS4 Gamepad Test', {
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Instructions
        this.add.text(400, 70, 'Connect a PS4 controller and press any button', {
            fontSize: '16px',
            color: '#cccccc'
        }).setOrigin(0.5);
        
        // Create controller visualization
        this.createControllerLayout();
        
        // Create button log display
        this.createButtonLog(800, 300);
        
        // Listen for gamepad connection
        this.input.gamepad.once('connected', (pad) => {
            this.gamepad = pad;
            this.add.text(400, 100, `Controller Connected: ${pad.id}`, {
                fontSize: '14px',
                color: '#4ecdc4'
            }).setOrigin(0.5);
        });
        
        // Listen for gamepad events
        this.input.gamepad.on('down', (pad, button, value) => {
            console.log(`Button ${button.index} pressed`);
            this.addButtonLog(this.getButtonName(button.index), button.index);
        });
        
        // Listen for gamepad events
        this.input.gamepad.on('up', (pad, button, value) => {
            console.log(`Button ${button.index} unpressed`);
            this.addButtonLog(this.getButtonName(button.index), button.index);
        });
        // ESC to return to menu (only if MapSelectScene exists)
        this.input.keyboard.on('keydown-ESC', () => {
            if (this.scene.get('MapSelectScene')) {
                this.scene.start('MapSelectScene');
            }
        });
    }
    
    createControllerLayout() {
        const centerX = 400;
        const centerY = 350;
        
        // Controller body outline
        const graphics = this.add.graphics();
        graphics.fillStyle(0x2d3436, 0.8);
        graphics.fillRoundedRect(centerX - 200, centerY - 100, 400, 200, 20);
        
        // Left analog stick
        this.createAnalogStick('left', centerX - 120, centerY - 20);
        
        // Right analog stick  
        this.createAnalogStick('right', centerX + 120, centerY - 20);
        
        // D-Pad
        this.createDPad(centerX - 120, centerY + 150);
        
        // Action buttons (Triangle, Circle, X, Square)
        this.createActionButtons(centerX + 120, centerY + 150);
        
        // Shoulder buttons
        this.createShoulderButtons(centerX);
        
        // Triggers
        this.createTriggers(centerX);
        
        // Start/Options buttons
        this.createMenuButtons(centerX, centerY - 70);
        
        // Touchpad
        this.createTouchpad(centerX, centerY - 35);
    }
    
    createAnalogStick(side, x, y) {
        // Stick base
        const base = this.add.circle(x, y, 40, 0x34495e);
        base.setStrokeStyle(2, 0x7f8c8d);
        
        // Stick position indicator
        const stick = this.add.circle(x, y, 15, 0xe74c3c);
        stick.setStrokeStyle(2, 0xc0392b);
        
        // Axis value text
        const text = this.add.text(x, y + 60, 'X: 0.00\nY: 0.00', {
            fontSize: '12px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        
        // L3/R3 button indicator
        const buttonIndicator = this.add.circle(x, y, 38, 0x3498db, 0);
        buttonIndicator.setStrokeStyle(3, 0x3498db);
        
        this.stickVisuals[side] = { base, stick, text, buttonIndicator };
    }
    
    createDPad(x, y) {
        const size = 20;
        const graphics = this.add.graphics();
        
        // D-Pad cross
        graphics.fillStyle(0x34495e);
        graphics.fillRect(x - size/2, y - size*1.5, size, size*3); // Vertical
        graphics.fillRect(x - size*1.5, y - size/2, size*3, size); // Horizontal
        
        // Button highlights
        this.buttonVisuals.up = this.add.rectangle(x, y - size, size-4, size-4, 0xe74c3c, 0);
        this.buttonVisuals.down = this.add.rectangle(x, y + size, size-4, size-4, 0xe74c3c, 0);
        this.buttonVisuals.left = this.add.rectangle(x - size, y, size-4, size-4, 0xe74c3c, 0);
        this.buttonVisuals.right = this.add.rectangle(x + size, y, size-4, size-4, 0xe74c3c, 0);
    }
    
    createActionButtons(x, y) {
        const radius = 18;
        const spread = 35;
        
        // Triangle (top)
        const triangle = this.add.triangle(x, y - spread, 0, radius, -radius, -radius, radius, -radius, 0x27ae60, 0.2);
        triangle.setStrokeStyle(2, 0x27ae60);
        this.buttonVisuals.Y = triangle;
        
        // Add labels to buttons
        this.add.text(x, y - spread - 25, '△', {
            fontSize: '12px',
            color: '#95a5a6'
        }).setOrigin(0.5);
        
        // Circle (right)
        const circle = this.add.circle(x + spread, y, radius, 0xc0392b, 0.2);
        circle.setStrokeStyle(2, 0xc0392b);
        this.buttonVisuals.B = circle;
        this.add.text(x + spread + 30, y, '○', {
            fontSize: '12px',
            color: '#95a5a6'
        }).setOrigin(0.5);
        
        // X (bottom)
        const crossBg = this.add.circle(x, y + spread, radius, 0x2980b9, 0.2);
        crossBg.setStrokeStyle(2, 0x2980b9);
        this.buttonVisuals.A = crossBg;
        const cross = this.add.text(x, y + spread, 'X', {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Square (left)
        const square = this.add.rectangle(x - spread, y, radius*1.5, radius*1.5, 0xd68910, 0.2);
        square.setStrokeStyle(2, 0xd68910);
        this.buttonVisuals.X = square;
        this.add.text(x - spread - 30, y, '□', {
            fontSize: '12px',
            color: '#95a5a6'
        }).setOrigin(0.5);
    }
    
    createShoulderButtons(x) {
        // L1/R1
        const l1 = this.add.rectangle(x - 150, 180, 60, 20, 0x34495e);
        l1.setStrokeStyle(2, 0x7f8c8d);
        this.add.text(x - 150, 180, 'L1', {
            fontSize: '12px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.buttonVisuals.L1 = l1;
        
        const r1 = this.add.rectangle(x + 150, 180, 60, 20, 0x34495e);
        r1.setStrokeStyle(2, 0x7f8c8d);
        this.add.text(x + 150, 180, 'R1', {
            fontSize: '12px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.buttonVisuals.R1 = r1;
    }
    
    createTriggers(x) {
        // L2/R2 trigger bars
        const barWidth = 60;
        const barHeight = 10;
        const y = 160;
        
        // L2
        const l2Bg = this.add.rectangle(x - 150, y, barWidth, barHeight, 0x2c3e50);
        const l2Bar = this.add.rectangle(x - 150 - barWidth/2, y, 0, barHeight, 0xe74c3c);
        l2Bar.setOrigin(0, 0.5);
        this.add.text(x - 150, y - 15, 'L2', {
            fontSize: '12px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.triggerBars.L2 = { bg: l2Bg, bar: l2Bar, maxWidth: barWidth };
        
        // R2
        const r2Bg = this.add.rectangle(x + 150, y, barWidth, barHeight, 0x2c3e50);
        const r2Bar = this.add.rectangle(x + 150 - barWidth/2, y, 0, barHeight, 0xe74c3c);
        r2Bar.setOrigin(0, 0.5);
        this.add.text(x + 150, y - 15, 'R2', {
            fontSize: '12px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.triggerBars.R2 = { bg: r2Bg, bar: r2Bar, maxWidth: barWidth };
    }
    
    createMenuButtons(x, y) {
        // Options button
        const options = this.add.rectangle(x + 40, y, 30, 15, 0x34495e);
        options.setStrokeStyle(1, 0x7f8c8d);
        this.add.text(x + 40, y - 20, 'Options', {
            fontSize: '10px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.buttonVisuals.Start = options;
        
        // Share button
        const share = this.add.rectangle(x - 40, y, 30, 15, 0x34495e);
        share.setStrokeStyle(1, 0x7f8c8d);
        this.add.text(x - 40, y - 20, 'Share', {
            fontSize: '10px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.buttonVisuals.Back = share;
    }
    
    createTouchpad(x, y) {
        const touchpad = this.add.rectangle(x, y, 80, 40, 0x2c3e50);
        touchpad.setStrokeStyle(1, 0x34495e);
        this.add.text(x, y, 'Touchpad', {
            fontSize: '10px',
            color: '#7f8c8d'
        }).setOrigin(0.5);
    }
    
    createButtonLog(x = 650, y = 300) {
        // Create log background
        const width = 280;
        const height = 400;
        const logBg = this.add.rectangle(x, y, width, height, 0x2c3e50, 0.9);
        logBg.setStrokeStyle(2, 0x34495e);
        
        // Log title
        const titleY = y - height/2 + 20;
        this.add.text(x, titleY, 'Button Log', {
            fontSize: '18px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Create log text entries
        this.logTexts = [];
        const startY = titleY + 30;
        const textX = x - width/2 + 20;
        
        for (let i = 0; i < this.maxLogEntries; i++) {
            const logText = this.add.text(textX, startY + i * 35, '', {
                fontSize: '14px',
                color: '#ecf0f1'
            });
            this.logTexts.push(logText);
        }
    }
    
    addButtonLog(buttonName, buttonIndex) {
        const timestamp = new Date().toLocaleTimeString();
        const entry = `${timestamp} - ${buttonName} (${buttonIndex})`;
        
        // Add to beginning of log
        this.buttonLog.unshift(entry);
        
        // Keep only max entries
        if (this.buttonLog.length > this.maxLogEntries) {
            this.buttonLog.pop();
        }
        
        // Update display
        this.buttonLog.forEach((log, index) => {
            if (this.logTexts[index]) {
                this.logTexts[index].setText(log);
                // Fade older entries
                this.logTexts[index].setAlpha(1 - (index * 0.08));
            }
        });
    }
    
    getButtonName(index) {
        const buttonNames = {
            0: 'X (Cross)',
            1: 'Circle',
            2: 'Square',
            3: 'Triangle',
            4: 'L1',
            5: 'R1',
            6: 'L2',
            7: 'R2',
            8: 'Share',
            9: 'Options',
            10: 'L3',
            11: 'R3',
            12: 'D-Pad Up',
            13: 'D-Pad Down',
            14: 'D-Pad Left',
            15: 'D-Pad Right',
            16: 'PS Button',
            17: 'Touchpad'
        };
        
        return buttonNames[index] || `Button ${index}`;
    }
    
    update() {
        if (!this.gamepad) return;
        
        // Update analog sticks
        this.updateAnalogStick('left', this.gamepad.leftStick);
        this.updateAnalogStick('right', this.gamepad.rightStick);
        
        // Update buttons
        this.updateButton('up', this.gamepad.up);
        this.updateButton('down', this.gamepad.down);
        this.updateButton('left', this.gamepad.left);
        this.updateButton('right', this.gamepad.right);
        
        this.updateButton('A', this.gamepad.A);
        this.updateButton('B', this.gamepad.B);
        this.updateButton('X', this.gamepad.X);
        this.updateButton('Y', this.gamepad.Y);
        
        this.updateButton('L1', this.gamepad.L1);
        this.updateButton('R1', this.gamepad.R1);
        
        // Update triggers
        this.updateTrigger('L2', this.gamepad.L2);
        this.updateTrigger('R2', this.gamepad.R2);
        
        // Update stick buttons
        this.updateStickButton('left', this.gamepad.L3);
        this.updateStickButton('right', this.gamepad.R3);
        
        // Update menu buttons
        this.updateButton('Start', this.gamepad.buttons[9]); // Options
        this.updateButton('Back', this.gamepad.buttons[8]);  // Share
    }
    
    updateAnalogStick(side, stick) {
        if (!stick) return;
        
        const visual = this.stickVisuals[side];
        const maxOffset = 25;
        
        // Update stick position
        visual.stick.x = visual.base.x + (stick.x * maxOffset);
        visual.stick.y = visual.base.y + (stick.y * maxOffset);
        
        // Update text
        visual.text.setText(`X: ${stick.x.toFixed(2)}\nY: ${stick.y.toFixed(2)}`);
        
        // Color based on intensity
        const intensity = Math.min(stick.length(), 1);
        const color = Phaser.Display.Color.Interpolate.ColorWithColor(
            { r: 231, g: 76, b: 60 },
            { r: 52, g: 152, b: 219 },
            100,
            intensity * 100
        );
        visual.stick.setFillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
    }
    
    updateButton(name, button) {
        if (!button || !this.buttonVisuals[name]) return;
        
        const visual = this.buttonVisuals[name];
        const pressed = button.pressed || button.value > 0;
        
        if (pressed) {
            // Get the original fill color or default
            let fillColor = 0xe74c3c;
            if (name === 'Y') fillColor = 0x2ecc71;
            else if (name === 'B') fillColor = 0xe74c3c;
            else if (name === 'A') fillColor = 0x3498db;
            else if (name === 'X') fillColor = 0xf39c12;
            else if (name === 'L1' || name === 'R1') fillColor = 0x95a5a6;
            else if (name === 'Start' || name === 'Back') fillColor = 0x7f8c8d;
            else if (name === 'up' || name === 'down' || name === 'left' || name === 'right') fillColor = 0xecf0f1;
            
            visual.setFillStyle(fillColor, 1);
            visual.setScale(1.3);
            visual.setStrokeStyle(3, fillColor);
        } else {
            visual.setFillStyle(visual.fillColor || 0xe74c3c, 0.3);
            visual.setScale(1);
            visual.setStrokeStyle(2, visual.strokeColor || 0x7f8c8d);
        }
    }
    
    updateTrigger(name, trigger) {
        if (!trigger || !this.triggerBars[name]) return;
        
        const bar = this.triggerBars[name];
        const value = trigger.value || 0;
        
        // Update bar width
        bar.bar.width = value * bar.maxWidth;
        
        // Color based on pressure
        const color = Phaser.Display.Color.Interpolate.ColorWithColor(
            { r: 231, g: 76, b: 60 },
            { r: 241, g: 196, b: 15 },
            100,
            value * 100
        );
        bar.bar.setFillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
    }
    
    updateStickButton(side, button) {
        if (!button) return;
        
        const visual = this.stickVisuals[side];
        const pressed = button.pressed || button.value > 0;
        
        visual.buttonIndicator.setAlpha(pressed ? 1 : 0);
    }
}
