import { executeQuery } from "../../middlewares/dbExecute.js";
import { db } from "../../config/connectDB.js";
import { s3KeyFromUrl, generateS3Url } from "../../middlewares/S3bucketConfig.js";
import authenticateUser from "../../middlewares/verify.mjs";

export const createReport = async (req, res) => {
    authenticateUser(req, res, async () => {
        const reporterId = req.user.id;
        // e.g., 'post', 'user', 'community'
        const { reportable_type, reportable_id, category, reason } = req.body;

        if (!reportable_type || !reportable_id || !category) {
            return res.status(400).json({ message: "Report type, ID, and category are required." });
        }

        //VALIDATIONS TO BE ADDED HERE FOR reportable_type AND category
        //(ENUM('spam', 'harassment', 'hate_speech', 'impersonation', 'inappropriate_content', 'other'))

        try {
            const q = "INSERT INTO reports (reporterId, reportable_type, reportable_id, category, reason) VALUES (?, ?, ?, ?, ?)";
            await executeQuery(q, [reporterId, reportable_type, reportable_id, category, reason]);
            
            return res.status(200).json({ message: "Report submitted successfully." });
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: "You have already reported this item." });
            }
            console.error("Failed to submit report:", err);
            return res.status(500).json({ message: "Failed to submit report", error: err });
        }
    });
};


export const getReports = async (req, res) => {
    authenticateUser(req, res, async () => {

        const requestingUser = req.user;

        // ENSURE ONLY ADMINS/MODERATORS CAN ACCESS REPORTS
        if (requestingUser.role !== 'admin' && requestingUser.role !== 'moderator') {
            return res.status(403).json({ message: "You are not authorized to view reports." });
        }

        const { status = 'pending', page = 1, limit = 20 } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;

        try {
            // FETCH REPORTS WITH REPORTER DETAILS
            const reportsQuery = `
                SELECT 
                    r.*,
                    u.username AS reporterUsername,
                    u.profilePic AS reporterProfilePic
                FROM reports AS r
                JOIN users AS u ON r.reporterId = u.id
                WHERE r.status = ?
                ORDER BY r.createdAt ASC
                LIMIT ?
                OFFSET ?
            `;
            
            const countQuery = "SELECT COUNT(*) as total FROM reports WHERE status = ?";

            const [[reports], [countResult]] = await Promise.all([
                db.promise().query(reportsQuery, [status, limitNum, offset]),
                db.promise().query(countQuery, [status])
            ]);

            const totalReports = countResult[0].total;
            if (reports.length === 0) {
                return res.status(200).json({
                    message: "No reports found with the specified status.",
                    reports: [],
                    pagination: { totalReports, currentPage: pageNum, totalPages: Math.ceil(totalReports / limitNum) }
                });
            }

            // GROUP REPORTS BY TYPE TO MINIMIZE DB QUERIES
            const itemsToFetch = {
                post: new Set(),
                user: new Set(),
                community: new Set(),
                comment: new Set(),
                store: new Set()
            };

            for (const report of reports) {
                if (itemsToFetch[report.reportable_type]) {
                    itemsToFetch[report.reportable_type].add(report.reportable_id);
                }
            }

            // FETCH REPORTED ITEMS IN BATCHES
            const fetchedItems = new Map();

            // Batch fetch posts
            if (itemsToFetch.post.size > 0) {
                const postIds = Array.from(itemsToFetch.post);
                const [posts] = await db.promise().query("SELECT id, description, media FROM posts WHERE id IN (?)", [postIds]);
                for (const post of posts) fetchedItems.set(`post_${post.id}`, post);
            }

            // BATCH FETCH USERS
            if (itemsToFetch.user.size > 0) {
                const userIds = Array.from(itemsToFetch.user);
                // IMPORTANT: Only select non-sensitive public information
                const [users] = await db.promise().query("SELECT id, username, full_name, profilePic FROM users WHERE id IN (?)", [userIds]);
                for (const user of users) fetchedItems.set(`user_${user.id}`, user);
            }

            // (SIMILAR LOGIC TO BE ADDED FOR 'community', 'comment', 'store' TYPES)

            // COMBINE REPORTS WITH THEIR RESPECTIVE ITEMS
            const fullReports = await Promise.all(reports.map(async (report) => {
                const reportedItem = fetchedItems.get(`${report.reportable_type}_${report.reportable_id}`) || null;
                
                // PROCESS S3 URLS FOR IMAGES/MEDIA
                if (report.reporterProfilePic) {
                    report.reporterProfilePic = await generateS3Url(s3KeyFromUrl(report.reporterProfilePic));
                }
                if (reportedItem?.profilePic) {
                    reportedItem.profilePic = await generateS3Url(s3KeyFromUrl(reportedItem.profilePic));
                }
                 if (reportedItem?.media) { // Handle post media
                    const mediaKeys = reportedItem.media.split(",").map(s3KeyFromUrl);
                    reportedItem.media = await Promise.all(mediaKeys.map(generateS3Url));
                }
                
                return {
                    ...report,
                    reported_item: reportedItem || { message: "Reported item not found or may have been deleted." }
                };
            }));

            // FINAL RESPONSE
            return res.status(200).json({
                reports: fullReports,
                pagination: {
                    totalReports,
                    currentPage: pageNum,
                    totalPages: Math.ceil(totalReports / limitNum),
                    limit: limitNum
                }
            });

        } catch (error) {
            console.error("Failed to fetch reports:", error);
            return res.status(500).json({ message: "Failed to fetch reports", error: error.message });
        }
    });
};


export const updateReportStatus = async (req, res) => {
    authenticateUser(req, res, async () => {
        const requestingUser = req.user;
        const { reportId } = req.params;
        const { status, notes } = req.body;

        // ENSURE ONLY ADMINS/MODERATORS CAN UPDATE REPORTS
        if (requestingUser.role !== 'admin' && requestingUser.role !== 'moderator') {
            return res.status(403).json({ message: "You are not authorized to modify reports." });
        }

        if (!status) {
            return res.status(400).json({ message: "A new status is required." });
        }

        // VALIDATE STATUS INPUT
        const allowedStatuses = ['pending', 'reviewed', 'action_taken', 'dismissed'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ 
                message: "Invalid status provided.",
                valid_options: allowedStatuses
            });
        }

        try {
            // DYNAMICALLY BUILD UPDATE QUERY
            const updateFields = [];
            const values = [];

            updateFields.push("status = ?");
            values.push(status);

            // CONDITIONALLY ADD NOTES IF PROVIDED
            if (notes !== undefined) {
                updateFields.push("notes = ?");
                values.push(notes);
            }

            values.push(reportId);

            const updateQuery = `UPDATE reports SET ${updateFields.join(', ')} WHERE id = ?`;

            const [result] = await db.promise().query(updateQuery, values);

            // HANDLE CASE WHERE REPORT ID DOES NOT EXIST
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Report not found with the specified ID." });
            }

            return res.status(200).json({ message: "Report updated successfully." });

        } catch (error) {
            console.error(`Failed to update report ${reportId}:`, error);
            return res.status(500).json({ message: "Failed to update report", error: error.message });
        }
    });
};