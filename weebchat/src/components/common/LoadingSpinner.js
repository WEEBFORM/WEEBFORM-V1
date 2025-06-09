import React from 'react';
import './LoadingSpinner.css'; // Create this CSS file

const LoadingSpinner = () => (
    <div className="spinner-overlay">
        <div className="spinner"></div>
    </div>
);

export default LoadingSpinner;