import mysql from "mysql2"
import {config} from "dotenv"
config()
export const db = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB
});
  
function handleDisconnect() {     
    db.connect((err) => {
        if (err) {
          console.error('Error connecting to MySQL:', err);
        }
        else{
          console.log('Connected to MySQL');
        }
      });
     
      db.on('error', (err) => {
        console.error('MySQL error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
          handleDisconnect();
        } else {
          throw err;
        }
      });
}  

handleDisconnect();

