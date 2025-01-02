import {db} from "../config/connectDB.js"
import errorHandler from "../middlewares/errors.mjs";
import {authenticateUser} from "../middlewares/verify.mjs"
import moment from "moment"
import multer from "multer";

// HANDLE MEDIA PROCESSING LOGIC
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/stores');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

const cpUpload = upload.single('logoImage');

//CREATE NEW STORE
export const newStore = (req, res) => {
    authenticateUser(req, res, () => {
        const user = req.user;
        //PARSE UPLOADED FILES
        cpUpload(req, res, function (err) {
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) {
                return res.status(500).json({ message: "Unknown error", error: err });
            }

            try {
                const c = "SELECT * FROM stores WHERE ownerId = ?";
                db.query(c, user.id, (err, data) => {
                    if (err) {
                        return res.status(500).json('Bad request');
                    } 
                    if (data.length) {
                        return res.status(409).json('You can only create one store'); 
                    }

                    const logoImage = req.file ? req.file.path : null;
 
                    const i = "INSERT INTO stores (`ownerId`, `label`, `description`, logoImage, category, created) VALUES (?)";
                    const values = [
                        user.id,
                        req.body.label,
                        req.body.description,
                        logoImage,
                        req.body.category,
                        moment(Date.now()).format("YYYY-MM-DD HH:mm:ss")
                    ];

                    db.query(i, [values], (err, data) => {
                        if (err) {
                            return res.status(500).json(`${err}`);
                        } else {
                            const storeName = req.body.label;
                            return res.status(200).json(`New store ${storeName} created successfully`);
                        }
                    });
                });
            } catch (err) {
                console.log(err);
                return res.status(500).json("internal server error");
            }
        });
    });
};
 
//API TO VIEW STORE
export const viewStores = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        //QUERY DB TO GET STORE
        const q = "SELECT * FROM stores";
        db.query(q, (err, store)=>{
        if(err) return res.status(500).json(err)
        //SHUFFLE STORES  
        if (store.length === 0) {
            return res.status(404).json("No Stores available yet ..");
        } 
        const stores = shuffleStores(store);
        return res.status(200).json(stores)
        })
    }) 
};

//API TO EDIT STORE INFO/DATA
export const editStoreDetails = (req, res)=>{
    authenticateUser(req, res, () => {
        const userId = req.user.id;
        //QUERY DB TO EDIT USER INFO
        cpUpload(req, res, function (err) {
            if (err instanceof multer.MulterError) {
                return res.status(500).json({ message: "File upload error", error: err });
            } else if (err) {
                return res.status(500).json({ message: "Unknown error", error: err });
            }
            const storeId = req.params.id
            const logoImage = req.file ? req.file.path : null;

            if (!logoImage) {
                return res.status(400).send('Store logo not uploaded correctly.');
            }
            const q = "UPDATE users SET ownerId = ?, label = ?, description = ?, logoImage = ?, category = ? WHERE id = ?"
            const values = [
                userId,
                req.body.label,
                req.body.description,
                logoImage,
                req.body.category,
                storeId
            ];
            db.query(q, values, (err, store)=>{
            if(err){
               return res.status(500).json(err)
            }
            if (ownerId !== userId){
                res.status(403).json("Can't edit, not your store")
            }
            if (store.length === 0) {
                return res.status(404).json("Store not found!");
            }
            else{
                res.status(200).json(`${store.label} Merch store  updated successfully!`)
            }
            })
        })

    }) 
}

//API TO DELETE STORE
export const closeStore = (req, res)=>{
    authenticateUser(req, res, () => {
        const user = req.user;
        //QUERY DB TO GET POSTS
        const q = "DELETE FROM stores WHERE id = ? AND ownerId = ?";

        db.query(q, [req.params.id, user.id], (err, store)=>{
        if(err) {
            return res.status(500).json(err);
        }if(store.length === 0){
            res.status(404).json("Store not found!")
        }
        if(store.affectedRows > 0 ){
            res.status(200).json("You've deleted your store.")
        }else{
            return res.status(403).json('You can only delete your store')
        }
        })
    }) 
}

const shuffleStores = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};
