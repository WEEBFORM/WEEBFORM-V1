import express from "express";
import { 
    newStore, 
    viewStores, 
    editStoreDetails, 
    closeStore, 
    viewSingleStore,
    viewUserStores
} from "../../controllers/Marketplace/stores.js";

const router = express.Router();

// STORE ENDPOINTS
router.post('/create', newStore);
router.get('/view', viewUserStores);
router.get('/', viewStores);
router.get('/:id', viewSingleStore);
router.put('/edit-store-details/:id', editStoreDetails);
router.delete('/close-store/:id', closeStore); 

export default router;
  