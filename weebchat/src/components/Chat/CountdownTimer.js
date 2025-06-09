import React, { useState, useEffect } from 'react';

const CountdownTimer = ({ id, title, endTime, onEnd }) => {
    const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));

    useEffect(() => {
        if (timeLeft <= 0) {
            onEnd(id);
            return;
        }

        const intervalId = setInterval(() => {
            setTimeLeft(prevTime => {
                if (prevTime <= 1) {
                    clearInterval(intervalId);
                    onEnd(id);
                    return 0;
                }
                return prevTime - 1;
            });
        }, 1000);

        return () => clearInterval(intervalId);
    }, [timeLeft, id, onEnd]);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;
    };

    if (timeLeft <= 0) return null;

    return (
        <div className="countdown-timer" style={{border: '1px solid orange', padding: '10px', margin: '10px 0', background: '#fff3e0'}}>
            <h4>{title}</h4>
            <p>Time Remaining: {formatTime(timeLeft)}</p>
        </div>
    );
};

export default CountdownTimer;