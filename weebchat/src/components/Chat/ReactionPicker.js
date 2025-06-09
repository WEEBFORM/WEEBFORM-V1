import React from 'react';
import { REACTION_TYPES } from '../../constants';
import './ReactionPicker.css'; // Create this CSS

const ReactionPicker = ({ onSelect }) => {
    // REACTION_TYPES is an object { LIKE: 'like', LOVE: 'love', ...}
    // You want to display the values (e.g., '👍', '❤️') if you defined them as such.
    // If REACTION_TYPES are just strings ('like', 'love'), then you display those.
    // Based on your `constants/index.js`, REACTION_TYPES is `{ LIKE: 'like', LOVE: 'love', ...}`.
    // So you'll display the keys, or map them to actual emojis for UI.
    const emojis = { // Map backend types to emojis for display
        'like': '👍',
        'love': '❤️',
        'laugh': '😂',
        'wow': '😮',
        'sad': '😢',
        'angry': '😡',
        'pog': '✨',
        'pepega': '🐸',
        'omegalul': '🤣'
    };

    return (
        <div className="reaction-picker">
            {Object.keys(REACTION_TYPES).map(key => { // Iterate over keys
                const type = REACTION_TYPES[key]; // Get the string value ('like', 'love')
                const displayEmoji = emojis[type] || type; // Get emoji or fallback to type string
                return (
                    <button key={key} onClick={() => onSelect(type, null)} title={type}>
                        {displayEmoji}
                    </button>
                );
            })}
            {/* You can add custom emotes here if your backend supports them beyond REACTION_TYPES */}
        </div>
    );
};

export default ReactionPicker;