import express from "express";
import {
    addCatalogueItem,
    getCatalogueItems,
    editCatalogueItem,
    getCatalogueItemById
} from "../../controllers/Marketplace/catalogues.js";

const router = express.Router();


router.get('/catalogue/item/view/:id', getCatalogueItemById);

router.post('/:id/catalogue', addCatalogueItem);
router.get('/catalogue/:storeId', getCatalogueItems);

router.put('/catalogue/edit/:id', editCatalogueItem);

export default router; 