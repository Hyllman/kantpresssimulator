export function createRenderer(canvas) {
    const ctx = canvas.getContext('2d');

    function render(state) {
        // Clear
        ctx.fillStyle = '#0f1012';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        // Coordinate system for the machine
        // Sheet sits on Die at roughly cy + 100
        const dieY = cy + 100;

        // Draw Machine Background (Frame)
        drawFrame(ctx, w, h);

        // Draw Die (V-block) - Static
        drawDie(ctx, cx, dieY);

        // Draw Sheet Metal - Dynamic based on state.currentAngle
        drawSheet(ctx, cx, dieY, state.currentAngle);

        // Draw Ram (Punch) - Moves based on angle?
        // For visual simplicity, we can just animate the sheet bending. 
        // But adding the punch moving down adds realism.
        // 180 deg = Punch high. 90 deg = Punch low.
        drawPunch(ctx, cx, dieY, state.currentAngle);
    }

    function drawFrame(ctx, w, h) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        // Background grid or lines
        ctx.beginPath();
        for (let x = 0; x < w; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = 0; y < h; y += 50) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke();
    }

    function drawDie(ctx, x, y) {
        ctx.fillStyle = '#444';
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 4;

        // V-die shape
        ctx.beginPath();
        ctx.moveTo(x - 100, y + 50); // Bottom Left base
        ctx.lineTo(x + 100, y + 50); // Bottom Right base
        ctx.lineTo(x + 100, y);      // Top Right
        ctx.lineTo(x + 20, y);       // V start right
        ctx.lineTo(x, y + 30);       // V bottom
        ctx.lineTo(x - 20, y);       // V start left
        ctx.lineTo(x - 100, y);      // Top Left
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    function drawPunch(ctx, x, dieY, angle) {
        // Calculate Punch Y based on angle
        // 180deg (flat) -> Punch is touching top of sheet (approx dieY - thickness)
        // 90deg -> Punch is deep in V (dieY + 28 approx)

        // Mapping: 180 -> 0 offset, 90 -> 30 offset (deep in V)
        // This is approximate visual logic
        const progress = (180 - angle) / 90; // 0 to 1
        const depth = progress * 30;

        const punchY = dieY - 5 + depth; // -5 to account for sheet thickness resting on top

        ctx.fillStyle = '#555';
        ctx.strokeStyle = '#777';
        ctx.lineWidth = 3;

        ctx.beginPath();
        // Punch tip is at (x, punchY)
        // Triangle shape pointing down
        ctx.moveTo(x, punchY);
        ctx.lineTo(x + 15, punchY - 100);
        ctx.lineTo(x + 60, punchY - 100); // Shaft right
        ctx.lineTo(x + 60, punchY - 300); // Shaft up
        ctx.lineTo(x - 60, punchY - 300); // Shaft up
        ctx.lineTo(x - 60, punchY - 100); // Shaft left
        ctx.lineTo(x - 15, punchY - 100);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Accent stripe
        ctx.fillStyle = '#ff9800';
        ctx.fillRect(x - 60, punchY - 280, 120, 10);
    }

    function drawSheet(ctx, x, y, angle) {
        ctx.strokeStyle = '#ccc'; // Metal color
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Sheet bends around center (x, y)
        // Angle is total included angle.
        // Left leg angle = 180 - (180 - angle)/2 ? No.
        // If angle is 180, left is 180, right is 0?
        // Let's say vector math.
        // Center is pivot.

        // Visual pivot adjustment: visually the sheet rests on the die shoulders when flat, 
        // and slides down into V when bending.
        // For simple simulation, pivoting around (x,y) (tip of V) is easiest, 
        // but physically inaccurate (sheet lifts off shoulders).
        // Let's pivot around tip of V (x, y+30 in die drawing) -> NO.
        // Pivot around the contact point with Punch.
        // Punch tip is at (x, punchY). 

        // Let's stick to simple pivot at (x, y) for now, maybe offset up slightly.
        const pivotY = y; // Top of die surface

        // Half angle calculation
        // 180 -> wings are horizontal.
        // 90 -> wings are 45 deg up from horizontal? No, 45 deg down?
        // In a V-die press brake, the sheet moves UP as it bends if it's large, 
        // but usually we represent the cross section.

        // V-die:
        //      \  |  /
        //       \ | /
        //        \|/

        // If I look from side:
        // Flat: _____________
        // Bend: \           /  <-- NO, press brake bends UPWARDS usually? 
        // Actually, the punch comes DOWN. The sheet ends go UP.
        // So:
        //      /   \
        //     /     \
        //    /___V___\

        const bendRad = (180 - angle) / 2 * (Math.PI / 180);
        const legLength = 150;

        // Right Wing
        // Angle 0 is right. -bendRad means rotate UP.
        const rX = x + Math.cos(-bendRad) * legLength;
        const rY = pivotY + Math.sin(-bendRad) * legLength;

        // Left Wing
        // Angle 180 is left. +bendRad means rotate UP.
        const lX = x + Math.cos(Math.PI + bendRad) * legLength;
        const lY = pivotY + Math.sin(Math.PI + bendRad) * legLength;

        ctx.beginPath();
        ctx.moveTo(lX, lY);
        ctx.lineTo(x, pivotY); // Center
        ctx.lineTo(rX, rY);
        ctx.stroke();
    }

    return {
        render
    };
}
