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

        // Coordinate system
        const dieTopY = cy + 50;

        // Draw Frame
        drawFrame(ctx, w, h);

        // Calculate Punch Depth based on Angle
        // 180 deg = Flat (Punch at die top level approx)
        // Lower angle = Deeper punch
        // Simple linear interpolation for visual effect
        // 180 -> 0 depth
        // 30 -> Max depth (e.g. 50px)
        const bendProgress = (180 - state.currentAngle) / (180 - 30);
        const maxDepth = 60;
        const currentDepth = bendProgress * maxDepth;

        // Punch Tip Y
        // Start slightly above dieTopY when flat to allow sheet thickness
        const sheetThickness = 6;
        const punchTipY = dieTopY - sheetThickness / 2 + currentDepth;

        // Draw Die (Static)
        drawDie(ctx, cx, dieTopY);

        // Draw Sheet (Moves with Punch)
        // Vertex is exactly at punchTipY + visual offset if needed.
        // Actually, the punch pushes the INNER radius. The OUTER radius is what we see mostly.
        // Let's say the sheet vertex (midpoint) is at punchTipY.
        drawSheet(ctx, cx, punchTipY, state.currentAngle, sheetThickness);

        // Draw Punch (Tip follows calculations)
        drawPunch(ctx, cx, punchTipY);
    }

    function drawFrame(ctx, w, h) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < w; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = 0; y < h; y += 50) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke();
    }

    function drawDie(ctx, x, y) {
        ctx.fillStyle = '#222';
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;

        ctx.beginPath();
        // V shape
        const vWidth = 120;
        const vDepth = 60;

        ctx.moveTo(x - 150, y + 150); // Base Left
        ctx.lineTo(x + 150, y + 150); // Base Right
        ctx.lineTo(x + 150, y);       // Top Right
        ctx.lineTo(x + vWidth / 2, y);  // Shoulder Right
        ctx.lineTo(x, y + vDepth);    // V Bottom
        ctx.lineTo(x - vWidth / 2, y);  // Shoulder Left
        ctx.lineTo(x - 150, y);       // Top Left
        ctx.closePath();

        ctx.fill();
        ctx.stroke();
    }

    function drawPunch(ctx, x, tipY) {
        ctx.fillStyle = '#444';
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(x, tipY); // Tip
        ctx.lineTo(x + 15, tipY - 100);
        ctx.lineTo(x + 60, tipY - 100);
        ctx.lineTo(x + 60, tipY - 400); // Shaft goes up
        ctx.lineTo(x - 60, tipY - 400);
        ctx.lineTo(x - 60, tipY - 100);
        ctx.lineTo(x - 15, tipY - 100);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Stripe
        ctx.fillStyle = '#ff9800';
        ctx.fillRect(x - 60, tipY - 380, 120, 10);
    }

    function drawSheet(ctx, x, vertexY, angle, thickness) {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const legLength = 180;
        const rad = (Math.PI / 180) * (180 - angle) / 2;

        // Visual correction: When fully flat (180), vertexY is somewhat "down" because of our logic.
        // But physically, if punch is up, sheet is flat on Die.
        // Our new logic moves punch DOWN, so sheet V moves DOWN. 
        // We just need to calculate the wings so they look anchored or sliding.
        // For simplicity, just drawing wings extending from vertexY is fine, 
        // as long as vertexY matches punch tip.

        // Right wing (Angle 0 is right, subtract rad to rotate UP/CCW)
        const rX = x + Math.cos(-rad) * legLength;
        const rY = vertexY + Math.sin(-rad) * legLength;

        // Left wing (Angle 180 is left, add rad to rotate UP/CW)
        const lX = x + Math.cos(Math.PI + rad) * legLength;
        const lY = vertexY + Math.sin(Math.PI + rad) * legLength;

        ctx.beginPath();
        ctx.moveTo(lX, lY);
        ctx.lineTo(x, vertexY);
        ctx.lineTo(rX, rY);
        ctx.stroke();
    }

    return {
        render
    };
}
