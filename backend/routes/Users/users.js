import express from "express";
import { viewUsers,
         viewProfile,
         viewUserProfile, 
         editProfile, 
         editPassword,
         deleteAccount
} from "../../controllers/Users/user.js"
import { getSettings, updateSettings } from "../../controllers/Users/settings.js";

const router = express.Router();

router.get('/all', viewUsers);
router.get('/user', viewProfile);
router.get('/:id', viewUserProfile);

router.get('/settings', getSettings);
router.put('/settings/update', updateSettings);

router.put('/edit', editProfile);
router.put('/change-password', editPassword);
router.delete('/delete', deleteAccount);


export default router;