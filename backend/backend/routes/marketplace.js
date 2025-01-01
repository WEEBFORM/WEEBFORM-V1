import express from "express";
import {newStore, viewStores, editStoreDetails, closeStore} from "../controllers/marketplace.js"

const router = express.Router()

router.post('/create', newStore)
router.get('/', viewStores )
router.put('/stores/:id', editStoreDetails)
router.delete('/close-store/:id', closeStore)

export default router