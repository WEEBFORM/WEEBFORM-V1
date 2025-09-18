import express from "express";
import { 
    newStore, 
    viewStores, 
    editStoreDetails, 
    closeStore, 
    viewSingleStore,
    getCreatedStores
} from "../../controllers/Marketplace/stores.js";

const router = express.Router();

// STORE ENDPOINTS
router.post('/create', newStore);
router.get('/created', getCreatedStores);
router.get('/', viewStores);
router.get('/:id', viewSingleStore);
router.put('/edit-store-details/:id', editStoreDetails);
router.delete('/close-store/:id', closeStore); 

export default router;
  