const crypto = require('crypto');

const rawKey = process.env.SECRET_ENCRYPT_KEY;
const key = crypto.createHash('sha256').update(rawKey).digest(); // Hash thành 32 bytes
const iv = Buffer.alloc(16, 0); // 16 bytes IV toàn 0

function encrypt(text) {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}

function decrypt(encryptedText) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = { encrypt, decrypt };
