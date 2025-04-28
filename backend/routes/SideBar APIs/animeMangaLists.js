import express from 'express';
import {
    createList,
    getUserLists,
    getList,
    updateList,
    deleteList,
    addEntryToList,
    removeEntryFromList,
    getListEntries,
    updateEntry
} from '../../controllers/SideBar Controllers/animeMangaListsController'; // Import all functions

const router = express.Router();

router.post('/lists', createList);
router.get('/lists', getUserLists);
router.get('/lists/:listId', getList);
router.put('/lists/:listId', updateList);
router.delete('/lists/:listId', deleteList); 
router.post('/lists/:listId/entries', addEntryToList);
router.delete('/lists/:listId/entries/:entryId', removeEntryFromList);
router.get('/lists/:listId/entries', getListEntries);
router.put('/lists/:listId/entries/:entryId', updateEntry);


export default router;