import mysql from "mysql"
import {config} from "dotenv"
config()
export const db = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB
}) 
db.connect(function(err){ 
    if (err)
    throw err;
    console.log("connection successful") 
}) 

 



