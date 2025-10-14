const numeral = require('numeral');
const slugify = require('slugify');
require('numeral/locales/vi');
numeral.locale('vi');
const formidable = require('formidable');
const fs = require('fs'); // Use fs.promises for async/await
const path = require('path');

exports.formatMoney = money => {
    return numeral(money).format('0,0');
}

exports.formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
});

exports.genRouteCategory = category => {
    const slug = slugify(category.name, {
        lower: true
    });
    return `/danh-muc/${slug}/c${category.id}.html`;
}

exports.getCurrentRoute = path => {
    path = path.startsWith('/') ? path.slice(1) : path;
    // path.slice(1): ignore the position 0 in the string
    if (path === '') {
        return 'home';
    }
    if (path.match(/^san-pham.html$/)) {
        //^ is the start, $ is the end
        return 'product';
    }
    if (path.match(/^danh-muc/)) {
        return 'category';
    }
    if (path.match(/^san-pham/)) {
        return 'product_detail';
    }
    if (path.match(/^search/)) {
        return 'search';
    }
    if (path.match(/^lien-he.html$/)) {
        return 'contact';
    }
    if (path.match(/^chat-bot.html$/)) {
        return 'chatbot';
    }
    if (path.match(/^trai-nghiem-ao.html$/)) {
        return 'shirtTryOn';
    }
    if (path.match(/^thong-tin-tai-khoan.html$/)) {
        return 'show';
    }
    if (path.match(/^dia-chi-giao-hang-mac-dinh.html$/)) {
        return 'shippingDefault';
    }
    if (path.match(/^don-hang-cua-toi.html$/)) {
        return 'orders';
    }
    if (path.match(/^chi-tiet-don-hang-:id.html$/)) {
        return 'orderDetail';
    }
    if (path.match(/^chinh-sach-doi-tra.html$/)) {
        //^ is the start, $ is the end
        return 'returnPolicy';
    }
    if (path.match(/^chinh-sach-thanh-toan.html$/)) {
        //^ is the start, $ is the end
        return 'paymentPolicy';
    }
    if (path.match(/^chinh-sach-giao-hang.html$/)) {
        //^ is the start, $ is the end
        return 'deliveryPolicy';
    }
    if (path.match(/^chinh-sach-giao-hang.html$/)) {
        //^ is the start, $ is the end
        return 'deliveryPolicy';
    }


    //admin
    if (path.match(/^admin\/($|create|product\/edit\/\d+)/)) {
        return 'admin';
    }

    if (path.match(/^admin\/category/)) {
        return 'category';
    }
    if (path.match(/^admin\/order/)) {
        return 'order';
    }
    if (path.match(/^admin\/customer/)) {
        return 'customer';
    }
    if (path.match(/^admin\/staff/)) {
        return 'staff';
    }
    if (path.match(/^admin\/role/)) {
        return 'role';
    }
    if (path.match(/^admin\/action/)) {
        return 'action';
    }
    if (path.match(/^admin\/comment/)) {
        return 'comment';
    }
    if (path.match(/^admin\/brand/)) {
        return 'brand';
    }
    if (path.match(/^admin\/status/)) {
        return 'status';
    }
    if (path.match(/^admin\/transport/)) {
        return 'transport';
    }
    if (path.match(/^admin\/revenue/)) {
        return 'revenue';
    }
}
exports.sendEmail = async (to, subject, content) => {
    const nodemailer = require("nodemailer");

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false, // Use `true` for port 465, `false` for all other ports
        auth: {
            user: process.env.SMTP_USERNAME,
            pass: process.env.SMTP_SECRET,
        },
    });
    try {
        await transporter.sendMail({
            from: process.env.SMTP_USERNAME, // sender address
            to: to, // list of receivers
            subject: subject, // Subject line
            html: content, // html body
        });
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}

exports.genRouteOrderDetail = order => {
    return `/chi-tiet-don-hang-${order.id}.html`;
}

exports.genRouteProductDetail = product => {
    const slug = slugify(product.name, {
        lower: true
    });
    return `/san-pham/${slug}-${product.id}.html`;
}

exports.santitizeData = data => {
    const createDOMPurify = require('dompurify');
    const { JSDOM } = require('jsdom');

    const window = new JSDOM('').window;
    const DOMPurify = createDOMPurify(window);
    const clean = DOMPurify.sanitize(data);
    return clean;
}
exports.getCurrentDateTime = () => {
    const { format } = require("date-fns");
    return format(new Date(), 'yyyy-MM-dd HH:mm:ss');
}
exports.getThreeLaterDateTime = () => {
    const { addDays, format } = require("date-fns");
    const threeDaysLater = addDays(new Date(), 3); //3 days later
    return format(threeDaysLater, 'yyyy-MM-dd H:i:s');
}

exports.generateRandomString = (length) => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        result += charset[randomIndex];
    }

    return result;
}

// Di chuyển file từ chỗ cũ qua chỗ mới
exports.copyFile = (oldpath, newpath) => {
    fs.copyFile(oldpath, newpath, (err) => {
        if (err) {
            console.error('Error copying file directory:', err);
        } else {
            console.log('Coppy file successfully!');
        }
    });
}

exports.parseForm = (req) => {
    return new Promise((resolve, reject) => {
        // Create a new instance of formidable
        const form = new formidable.IncomingForm({
            allowEmptyFiles: true,
            minFileSize: 0, // Set minFileSize to 0 to accept files with size 0 bytes
        });
        form.parse(req, (err, fields, files) => {
            if (err) {
                reject(err);  // Nếu có lỗi, từ chối (reject) Promise
            } else {
                resolve({ fields, files });  // Thành công, trả về kết quả
            }
        });
    });
}

exports.checkMimeType = (files, allowed_mimetypes) => {
    return new Promise((resolve, reject) => {
        // kiểm tra trong files có gì không thì chui vô
        if (Object.keys(files).length !== 0) {
            // lấy file đầu ra
            const upload_file = files.file[0];
            // 'application/octet-stream' là mimetype mặc định khi người dùng không đăng file nào
            if (upload_file.mimetype !== 'application/octet-stream') {
                // Nếu không đúng định dạng thì bỏ
                if (!(upload_file.mimetype in allowed_mimetypes)) {
                    autoClean(files.file);
                    let extension_group = [];
                    for (const extension of Object.values(allowed_mimetypes)) {
                        extension_group.push(extension);
                    }
                    console.log(extension_group);
                    reject(`Loại file không hợp lệ. Các loại được phép: ${extension_group.join(', ')}`);
                    return;
                }
            }
        }
        resolve();
    })
}

// xóa file
exports.deleteFile = async (filepath) => {
    if (!fs.existsSync(filepath))
        return;
    fs.unlink(filepath, (err) => {
        if (err) {
            console.error('Error deleting file:', err);
        }
    });
}

// tạo đường dẫn bỏ vào database
exports.genDbpath = (dbFolderPath, oldFilename, dbPathParentDir) => {
    const file_info = path.parse(oldFilename);
    let newFileName = `${file_info.name}_${generateRandomString(6)}${file_info.ext}`;
    let dbPath = `${dbFolderPath}/${newFileName}`;

    // kiểm tra file đã tồn tại chưa, có thì tạo lại tên mới
    let fileAlreadyExist = true;
    while (fileAlreadyExist) {
        if (fs.existsSync(`${dbPathParentDir}/${dbFolderPath}/${newFileName}`)) {
            newFileName = `${file_info.name}_${generateRandomString(6)}${file_info.ext}`;
            dbPath = `${dbFolderPath}/${newFileName}`;
        } else {
            fileAlreadyExist = false;
        }
    }

    return dbPath;
}

// loop hết files.file để xóa nó
exports.autoClean = (files) => {
    for (const file of files) {
        deleteFile(file.filepath);
    }
}

// Import `generateRandomString` locally within this module for internal use
const { generateRandomString, deleteFile, autoClean } = exports;



