const decrypt = require("./controllers/api/Chatbot/extra/encrypt.js");
const pool = require('./models/db.js');

const [rows] = await pool.execute(`
  SELECT id, role, content 
  FROM chatbot_history_role 
  WHERE session_id = '66912d84-48bc-4142-8148-bfd8173456'
  ORDER BY id DESC LIMIT 2
`);

console.log("Raw DB rows:", rows);

for (const row of rows) {
    try {
        console.log(row.role, decrypt(row.content));
    } catch (err) {
        console.error("Decrypt failed for", row.role, row.id, err.message);
    }
}
