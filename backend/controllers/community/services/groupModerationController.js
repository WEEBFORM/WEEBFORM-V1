import {
    toggleUserMute,
    toggleUserExile,
    toggleGroupSlowMode,
    removeUserFromGroup as removeUserService // Alias to avoid naming conflicts
} from './moderationService.js';

// Controller to toggle mute for a user in a specific group.
export const muteUserInGroup = async (req, res) => {
    try {
        const { chatGroupId } = req.params;
        const { targetUserId, duration } = req.body;
        const adminId = req.user.id; // The admin performing the action

        if (!targetUserId || !duration) {
            return res.status(400).json({ message: "targetUserId and duration are required." });
        }

        const result = await toggleUserMute(targetUserId, chatGroupId, duration, adminId);
        res.status(200).json({ message: `User mute status toggled. Muted: ${result.isMuted}`, ...result });
    } catch (error) {
        console.error("Error in muteUserInGroup controller:", error);
        res.status(500).json({ message: "Failed to toggle user mute", error: error.message });
    }
};

/**
 * Controller to toggle exile for a user in a specific group.
 * Expects { targetUserId, duration } in the request body.
 */
export const exileUserInGroup = async (req, res) => {
    try {
        const { chatGroupId } = req.params;
        const { targetUserId, duration } = req.body;
        const adminId = req.user.id;

        if (!targetUserId || !duration) {
            return res.status(400).json({ message: "targetUserId and duration are required." });
        }

        const result = await toggleUserExile(targetUserId, chatGroupId, duration, adminId);
        res.status(200).json({ message: `User exile status toggled. Exiled: ${result.isExiled}`, ...result });
    } catch (error) {
        console.error("Error in exileUserInGroup controller:", error);
        res.status(500).json({ message: "Failed to toggle user exile", error: error.message });
    }
};

/**
 * Controller to remove (kick) a user from a group.
 * Expects { targetUserId } in the request body.
 */
export const removeUserFromGroup = async (req, res) => {
    try {
        const { chatGroupId } = req.params;
        const { targetUserId } = req.body;
        const adminId = req.user.id;

        if (!targetUserId) {
            return res.status(400).json({ message: "targetUserId is required." });
        }

        const result = await removeUserService(targetUserId, chatGroupId, adminId);
        if (!result.success) {
            return res.status(404).json(result);
        }
        res.status(200).json(result);
    } catch (error) {
        console.error("Error in removeUserFromGroup controller:", error);
        res.status(500).json({ message: "Failed to remove user from group", error: error.message });
    }
};

/**
 * Controller to toggle group-wide slow mode.
 * Expects { duration } in the request body to enable, can be empty to disable.
 */
export const applyGroupSlowMode = async (req, res) => {
    try {
        const { chatGroupId } = req.params;
        const { duration } = req.body;
        const adminId = req.user.id;

        const result = await toggleGroupSlowMode(chatGroupId, duration, adminId);
        res.status(200).json({ message: `Group slow mode toggled. Active: ${result.isGroupSlowModeActive}`, ...result });
    } catch (error) {
        console.error("Error in applyGroupSlowMode controller:", error);
        res.status(500).json({ message: "Failed to toggle group slow mode", error: error.message });
    }
};