// @ weebAI/intents/ModActionsIntent.js
import DatabaseConnector from "../core/DatabaseConnector.js";

class ModActionsIntent {
    constructor(databaseConnector) {
        this.databaseConnector = databaseConnector;
    }

    async execute(message, userId) {
        // Check if user has moderation permissions
        const isModerator = await this.checkUserPermission(userId, 'moderator');
        if (!isModerator) {
            return "Gomen nasai! You need moderator privileges to perform these actions.";
        }

        try {
            // Parse the moderation request
            const banUserMatch = message.match(/ban\s+user\s+@?([a-zA-Z0-9_]+)/i);
            const deletePostMatch = message.match(/delete\s+post\s+#?([0-9]+)/i);
            const lockThreadMatch = message.match(/lock\s+thread\s+#?([0-9]+)/i);
            const pinPostMatch = message.match(/pin\s+post\s+#?([0-9]+)/i);

            if (banUserMatch) {
                const username = banUserMatch[1];
                return await this.banUser(username, userId);
            } else if (deletePostMatch) {
                const postId = deletePostMatch[1];
                return await this.deletePost(postId, userId);
            } else if (lockThreadMatch) {
                const threadId = lockThreadMatch[1];
                return await this.lockThread(threadId, userId);
            } else if (pinPostMatch) {
                const postId = pinPostMatch[1];
                return await this.pinPost(postId, userId);
            } else {
                return "I'm not sure what moderation action you're trying to perform. Try specific commands like 'ban user @username', 'delete post #123', 'lock thread #456', or 'pin post #789'.";
            }
        } catch (error) {
            console.error("Mod Action Error:", error);
            return "An error occurred while performing the moderation action. Please try again.";
        }
    }

    async banUser(username, modUserId) {
        return new Promise((resolve, reject) => {
            // First, get the user ID from the username
            db.query("SELECT id FROM users WHERE username = ?", [username], (err, results) => {
                if (err || results.length === 0) {
                    resolve(`User @${username} not found.`);
                    return;
                }

                const userId = results[0].id;

                // Update the user's status to banned
                db.query("UPDATE users SET status = 'banned', bannedBy = ?, bannedAt = NOW() WHERE id = ?",
                    [modUserId, userId], (err, results) => {
                        if (err) {
                            console.error("Error banning user:", err);
                            resolve("Error banning user. Please try again.");
                            return;
                        }

                        resolve(`User @${username} has been banned from the platform. Their posts will no longer be visible.`);
                    });
            });
        });
    }

    async deletePost(postId, modUserId) {
        return new Promise((resolve, reject) => {
            // Check if post exists
            db.query("SELECT * FROM posts WHERE id = ?", [postId], (err, results) => {
                if (err || results.length === 0) {
                    resolve(`Post #${postId} not found.`);
                    return;
                }

                // Delete the post
                db.query("DELETE FROM posts WHERE id = ?", [postId], (err, results) => {
                    if (err) {
                        console.error("Error deleting post:", err);
                        resolve("Error deleting post. Please try again.");
                        return;
                    }

                    // Log the deletion
                    db.query("INSERT INTO mod_logs (modId, action, targetType, targetId, createdAt) VALUES (?, 'delete_post', 'post', ?, NOW())",
                        [modUserId, postId], (err) => {
                            if (err) {
                                console.error("Error logging mod action:", err);
                            }
                        });

                    resolve(`Post #${postId} has been deleted.`);
                });
            });
        });
    }

    async lockThread(threadId, modUserId) {
        return new Promise((resolve, reject) => {
            // Check if thread exists
            db.query("SELECT * FROM posts WHERE id = ? AND isThread = 1", [threadId], (err, results) => {
                if (err || results.length === 0) {
                    resolve(`Thread #${threadId} not found.`);
                    return;
                }

                // Lock the thread
                db.query("UPDATE posts SET isLocked = 1, lockedBy = ?, lockedAt = NOW() WHERE id = ?",
                    [modUserId, threadId], (err, results) => {
                        if (err) {
                            console.error("Error locking thread:", err);
                            resolve("Error locking thread. Please try again.");
                            return;
                        }

                        // Log the action
                        db.query("INSERT INTO mod_logs (modId, action, targetType, targetId, createdAt) VALUES (?, 'lock_thread', 'thread', ?, NOW())",
                            [modUserId, threadId], (err) => {
                                if (err) {
                                    console.error("Error logging mod action:", err);
                                }
                            });

                    resolve(`Thread #${threadId} has been locked. No new replies can be added.`);
                });
            });
        });
    }

    async pinPost(postId, modUserId) {
          return new Promise((resolve, reject) => {
            // Check if post exists
            db.query("SELECT * FROM posts WHERE id = ?", [postId], (err, results) => {
                if (err || results.length === 0) {
                    resolve(`Post #${postId} not found.`);
                    return;
                }
                
                // Pin the post
                db.query("UPDATE posts SET isPinned = 1, pinnedBy = ?, pinnedAt = NOW() WHERE id = ?", 
                    [modUserId, postId], (err, results) => {
                    if (err) {
                        console.error("Error pinning post:", err);
                        resolve("Error pinning post. Please try again.");
                        return;
                    }
                    
                                          db.query("INSERT INTO mod_logs (modId, action, targetType, targetId, createdAt) VALUES (?, 'pin_post', 'post', ?, NOW())",
                        [modUserId, postId], (err) => {
                        if (err) {
                            console.error("Error logging mod action:", err);
                        }
                    });
                    
                    resolve(`Post #${postId} has been pinned`);
                });
            });
        });
    }
}

export default ModActionsIntent;