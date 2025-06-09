import React, { useState } from 'react';

const CommunityForm = ({ onSubmit, initialData = {}, loading }) => {
    const [title, setTitle] = useState(initialData.title || '');
    const [description, setDescription] = useState(initialData.description || '');
    const [groupIcon, setGroupIcon] = useState(null); // File object
    const [previewIcon, setPreviewIcon] = useState(initialData.groupIconUrl || null); // URL for preview

    const handleIconChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setGroupIcon(file);
            setPreviewIcon(URL.createObjectURL(file));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        if (groupIcon) {
            formData.append('groupIcon', groupIcon);
        }
        // If it's an update and no new icon, initialData.groupIconUrl might be needed by backend
        // But for create, it's fine.
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div>
                <label htmlFor="title">Community Title:</label>
                <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />
            </div>
            <div>
                <label htmlFor="description">Description:</label>
                <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows="3"
                />
            </div>
            <div>
                <label htmlFor="groupIcon">Group Icon:</label>
                <input
                    type="file"
                    id="groupIcon"
                    accept="image/*"
                    onChange={handleIconChange}
                />
                {previewIcon && <img src={previewIcon} alt="Icon Preview" style={{ maxWidth: '100px', marginTop: '10px' }} />}
            </div>
            <button type="submit" disabled={loading}>
                {loading ? 'Saving...' : (initialData.id ? 'Update Community' : 'Create Community')}
            </button>
        </form>
    );
};

export default CommunityForm;