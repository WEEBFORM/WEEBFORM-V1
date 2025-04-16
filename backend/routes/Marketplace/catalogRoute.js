import express from "express";
import {
    addCatalogueItem,
    getCatalogueItems,
    editCatalogueItem
} from "../../controllers/Marketplace/catalogues.js";

const router = express.Router();

router.post('/:id/catalogue', addCatalogueItem);
router.get('/catalogue/:storeId', getCatalogueItems);
router.put('/catalogue/edit/:id', editCatalogueItem);

export default router;