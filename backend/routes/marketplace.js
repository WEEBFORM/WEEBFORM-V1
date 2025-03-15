import express from "express";
import { 
    newStore, 
    viewStores, 
    editStoreDetails, 
    closeStore, 
    viewSingleStore,
    addCatalogueItem,
    getCatalogueItems,
    editCatalogueItem
} from "../controllers/marketplace.js";

const router = express.Router();

// STORE ENDPOINTS
router.post('/create', newStore);
router.get('/', viewStores);
router.get('/:id', viewSingleStore);
router.put('/edit-store-details/:id', editStoreDetails);
router.delete('/close-store/:id', closeStore);

// CATALOGUE ENPOINTS
router.post('/:id/catalogue', addCatalogueItem);
router.get('/catalogue/:storeId', getCatalogueItems);
router.put('/catalogue/edit/:id', editCatalogueItem);

export default router;
  