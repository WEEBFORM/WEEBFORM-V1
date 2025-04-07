import { db } from "../config/connectDB.js";
import { authenticateUser } from "../middlewares/verify.mjs";

const handleAPIError = (error, res, message = 'Internal Server Error') => {
    console.error(message + ':', error);
    return res.status(500).json({ message, error: error.message });
};

// API TO CREATE NEW LIST
export const createList = async (req, res) => {
  authenticateUser(req, res, async () => {
    const userId = req.user.id;
    const { title, subcategory } = req.body;

    if (!title || !subcategory) {
      return res.status(400).json({ message: "Title and subcategory are required" });
    }

    const q = "INSERT INTO lists (userId, title, subcategory) VALUES (?, ?, ?)";
    try {
        const [result] = await db.promise().query(q, [userId, title, subcategory]);
        return res.status(201).json({ message: "List created successfully", listId: result.insertId });
    } catch (error) {
        return handleAPIError(error, res, "Failed to create list");
    }
  });
};

// API TO GET ALL USER LISTS
export const getUserLists = async (req, res) => {
  authenticateUser(req, res, async () => {
    const userId = req.user.id;
    const q = "SELECT * FROM lists WHERE userId = ?";

    try {
        const [lists] = await db.promise().query(q, [userId]);
        return res.status(200).json(lists);
    } catch (error) {
        return handleAPIError(error, res, "Failed to retrieve user lists");
    }
  });
};

// API TO GET A SPECIFIC LIST
export const getList = async (req, res) => {
  authenticateUser(req, res, async () => {
    const userId = req.user.id;
    const listId = req.params.listId;

    if (!Number.isInteger(Number(listId))) {
        return res.status(400).json({ message: "Invalid listId" });
    }

    const q = "SELECT * FROM lists WHERE id = ? AND userId = ?";
    try {
        const [lists] = await db.promise().query(q, [listId, userId]);
        if (lists.length === 0) {
            return res.status(404).json({ message: "List not found" });
        }
        return res.status(200).json(lists[0]);
    } catch (error) {
        return handleAPIError(error, res, "Failed to retrieve list");
    }
  });
};

// API TO UPDATE A LIST
export const updateList = async (req, res) => {
  authenticateUser(req, res, async () => {
    const userId = req.user.id;
    const listId = req.params.listId;
    const { title, subcategory } = req.body;

      if (!Number.isInteger(Number(listId))) {
            return res.status(400).json({ message: "Invalid listId" });
        }
    if (!title || !subcategory) {
      return res.status(400).json({ message: "Title and subcategory are required" });
    }

    const q = "UPDATE lists SET title = ?, subcategory = ? WHERE id = ? AND userId = ?";
    try {
        const [result] = await db.promise().query(q, [title, subcategory, listId, userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "List not found or unauthorized" });
        }
        return res.status(200).json({ message: "List updated successfully" });
    } catch (error) {
        return handleAPIError(error, res, "Failed to update list");
    }
  });
};

// API TO DELETE A LIST
export const deleteList = async (req, res) => {
  authenticateUser(req, res, async () => {
    const userId = req.user.id;
    const listId = req.params.listId;
    if (!Number.isInteger(Number(listId))) {
            return res.status(400).json({ message: "Invalid listId" });
        }

    const q = "DELETE FROM lists WHERE id = ? AND userId = ?";
    try {
        const [result] = await db.promise().query(q, [listId, userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "List not found or unauthorized" });
        }
        return res.status(200).json({ message: "List deleted successfully" });
    } catch (error) {
        return handleAPIError(error, res, "Failed to delete list");
    }
  });
};

// API TO ADD ENTRY TO LIST
export const addEntryToList = async (req, res) => {
  authenticateUser(req, res, async () => {
    const userId = req.user.id;
    const listId = req.params.listId;
    const { malId, type } = req.body;

      if (!Number.isInteger(Number(listId))) {
            return res.status(400).json({ message: "Invalid listId" });
        }
    if (!malId || !type) {
      return res.status(400).json({ message: "malId and type are required" });
    }
    const q = "INSERT INTO listEntries (listId, malId, type) VALUES (?, ?, ?)";
    try {
        const [result] = await db.promise().query(q, [listId, malId, type]);
        return res.status(201).json({ message: "Entry added successfully", entryId: result.insertId });
    } catch (error) {
        return handleAPIError(error, res, "Failed to add entry to list");
    }
  });
};

// API TO REMOVE ENTRY FROM LIST
export const removeEntryFromList = async (req, res) => {
  authenticateUser(req, res, async () => {
    const userId = req.user.id;
    const listId = req.params.listId;
    const entryId = req.params.entryId;
    if (!Number.isInteger(Number(listId))) {
            return res.status(400).json({ message: "Invalid listId" });
        }
      if (!Number.isInteger(Number(entryId))) {
            return res.status(400).json({ message: "Invalid entryId" });
        }

    const q = "DELETE FROM listEntries WHERE id = ? AND listId = ?";
    try {
        const [result] = await db.promise().query(q, [entryId, listId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Entry not found or unauthorized" });
        }
        return res.status(200).json({ message: "Entry removed successfully" });
    } catch (error) {
        return handleAPIError(error, res, "Failed to remove entry from list");
    }
  });
};

// API TO GET ENTRIES FROM A SPECIFIC LIST
export const getListEntries = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const listId = req.params.listId;

        if (!Number.isInteger(Number(listId))) {
            return res.status(400).json({ message: "Invalid listId" });
        }

        const q = `
            SELECT le.*
            FROM listEntries le
            JOIN lists l ON le.listId = l.id
            WHERE le.listId = ? AND l.userId = ?
        `;
        try {
            const [entries] = await db.promise().query(q, [listId, userId]);
            return res.status(200).json(entries);
        } catch (error) {
            return handleAPIError(error, res, "Failed to get list entries");
        }
    });
};

// API TO UPDATE A SPECIFIC ENTRY IN A LIST
export const updateEntry = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;
        const listId = req.params.listId;
        const entryId = req.params.entryId;
        const { malId, type } = req.body;

        if (!Number.isInteger(Number(listId))) {
            return res.status(400).json({ message: "Invalid listId" });
        }

        if (!Number.isInteger(Number(entryId))) {
            return res.status(400).json({ message: "Invalid entryId" });
        }

        if (!malId || !type) {
            return res.status(400).json({ message: "malId and type are required" });
        }

        const q = "UPDATE listEntries SET malId = ?, type = ? WHERE id = ? AND listId = (SELECT id FROM lists WHERE userId = ?)";
        try {
            const [result] = await db.promise().query(q, [malId, type, entryId, userId]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Entry not found or unauthorized" });
            }
            return res.status(200).json({ message: "Entry updated successfully" });
        } catch (error) {
            return handleAPIError(error, res, "Failed to update entry");
        }
    });
};

// export default {
//     createList,
//     getUserLists,
//     getList,
//     updateList,
//     deleteList,
//     addEntryToList,
//     removeEntryFromList,
//     getListEntries,
//     updateEntry
// };