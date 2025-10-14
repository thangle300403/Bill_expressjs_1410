const mysql = require("mysql2/promise");

// Create pool
const pool = mysql.createPool({
    host: "localhost",
    user: "billie",
    password: "",
    database: "bill",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

async function testConnection() {
    try {
        // Test SELECT
        const [rows] = await pool.query("SELECT * FROM brand LIMIT 5");
        console.log("✅ Query OK. Result:");
        console.table(rows);

        // Test INSERT (should fail with read-only user)
        try {
            await pool.query("INSERT INTO brand (name) VALUES ('Hacker')");
        } catch (err) {
            console.log("❌ Insert failed as expected (read-only user):", err.message);
        }
    } catch (err) {
        console.error("DB error:", err);
    } finally {
        await pool.end();
    }
}

testConnection();
