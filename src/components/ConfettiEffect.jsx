import React, { useEffect, useRef } from 'react';

const ConfettiEffect = ({ active, onComplete }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!active) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let animationFrameId;

        // Fit canvas to window
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const particles = [];
        const emojis = ['🍎', '🍏', '✨', '🎉', '❤️'];
        const colors = ['#EB5757', '#27AE60', '#F2C94C', '#2D9CDB', '#9B51E0'];

        // Create particles
        const particleCount = 100;
        for (let i = 0; i < particleCount; i++) {
            const isEmoji = Math.random() < 0.3;
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * -canvas.height - 20,
                size: isEmoji ? Math.random() * 16 + 16 : Math.random() * 6 + 4,
                speedY: Math.random() * 4 + 2,
                speedX: Math.random() * 2 - 1,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: Math.random() * 0.05 - 0.025,
                opacity: 1,
                isEmoji: isEmoji,
                content: isEmoji 
                    ? emojis[Math.floor(Math.random() * emojis.length)]
                    : colors[Math.floor(Math.random() * colors.length)]
            });
        }

        let startTime = Date.now();
        const duration = 4000; // 4 seconds

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress >= 1) {
                if (onComplete) onComplete();
                return;
            }

            particles.forEach((p) => {
                p.y += p.speedY;
                p.x += p.speedX + Math.sin(p.y / 30) * 0.5;
                p.rotation += p.rotationSpeed;

                // Gradually fade out towards the end
                if (progress > 0.7) {
                    p.opacity = 1 - (progress - 0.7) / 0.3;
                }

                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);

                if (p.isEmoji) {
                    ctx.font = `${p.size}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(p.content, 0, 0);
                } else {
                    ctx.fillStyle = p.content;
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();

                // Reset particle to top if it goes off screen before fading
                if (p.y > canvas.height && progress < 0.7) {
                    p.y = -20;
                    p.x = Math.random() * canvas.width;
                }
            });

            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            cancelAnimationFrame(animationFrameId);
        };
    }, [active, onComplete]);

    if (!active) return null;

    return <canvas ref={canvasRef} className="confetti-canvas" />;
};

export default ConfettiEffect;
