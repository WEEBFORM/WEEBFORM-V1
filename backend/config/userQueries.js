import { db } from '../config/connectDB.js'; // Adjust path as needed
import { generateS3Url, s3KeyFromUrl } from '../middlewares/S3bucketConfig.js';
import { executeQuery } from '../middlewares/dbExecute.js';

//FETCH AND PROCESS USER DATA
export const fetchAndProcessUserData = async (userId) => {
    const q = `SELECT
                    u.id, u.full_name, u.username, u.email, u.profilePic, u.coverPhoto, u.bio, u.nationality, u.dateOfBirth,
                    (SELECT COUNT(*) FROM reach WHERE followed = u.id) AS followerCount,
                    (SELECT COUNT(*) FROM reach WHERE follower = u.id) AS followingCount,
                    (SELECT COUNT(*) FROM posts WHERE userId = u.id) AS postsCount
                FROM users AS u
                WHERE u.id = ?`;
                
    const [data] = await executeQuery(q, [userId]);
    if (!data) {
        return null;
    }
    
    const userInfo = data;

    // GENERATE S3 URLS FOR IMAGES
    if (userInfo.coverPhoto) {
        const coverPhotoKey = s3KeyFromUrl(userInfo.coverPhoto);
        userInfo.coverPhoto = await generateS3Url(coverPhotoKey);
    }
    if (userInfo.profilePic) {
        const profilePicKey = s3KeyFromUrl(userInfo.profilePic);
        userInfo.profilePic = await generateS3Url(profilePicKey);
    }

    return userInfo;
};