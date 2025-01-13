import multer from "multer";

const storage = multer.memoryStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

export const cpUpload = upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'coverPhoto', maxCount: 1 },
    { name: 'groupIcon', maxCount: 1 },
    { name: 'media', maxCount: 4 },
    { name: 'storyImage', maxCount: 3 },
    { name: 'storyVideo', maxCount: 3 },
    { name: 'logoImage', maxCount: 1 },
]);


export default storage;  