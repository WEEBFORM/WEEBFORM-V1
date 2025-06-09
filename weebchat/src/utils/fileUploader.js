// In a real app, this would upload to S3 or your storage and return a URL.
// For now, it's a placeholder.
export const uploadMediaFile = async (file) => {
    console.log("Mock uploading file:", file.name);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Return a placeholder URL
    return `https://via.placeholder.com/150/0000FF/808080?Text=${encodeURIComponent(file.name)}`;
};

// Helper to convert file to base64 (for audio)
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result); // result includes "data:mime/type;base64,..."
        reader.onerror = (error) => reject(error);
    });
};