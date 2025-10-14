const multer = require("multer");

const upload = multer({
    dest: "uploads/tmp/", // hoặc thư mục tạm nào đó bạn đã tạo
    limits: { fileSize: 5 * 1024 * 1024 }, // giới hạn 5MB
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(txt|sql)$/)) {
            return cb(new Error("Chỉ cho phép file .txt hoặc .sql"));
        }
        cb(null, true);
    },
});

module.exports = upload;
