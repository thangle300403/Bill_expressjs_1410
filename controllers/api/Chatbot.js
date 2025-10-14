import { GoogleGenAI } from '@google/genai';
import pool from '../../models/db.js';
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import customerModel from '../../models/Customer.js';

function extractSQL(text) {
  const match = text.match(/```sql\s*([\s\S]*?)```/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function getTextAfterMessage(str) {
  const match = str.match(/message:\s*(.*)\}/);
  return match ? match[1].trim() : "";
}

function extractTextBeforeSQL(text) {
  // Tìm vị trí bắt đầu của block ```sql
  const index = text.search(/```sql/i);
  if (index === -1) {
    return text.trim(); // Không có SQL, trả về toàn bộ text
  }
  // Trả về phần trước block ```sql
  return text.slice(0, index).trim();
}

function extractTextAfterSQL(text) {
  // Tìm vị trí bắt đầu block ```sql
  const startIndex = text.search(/```sql/i);
  if (startIndex === -1) return ""; // Không có block SQL

  // Tìm vị trí kết thúc block ```
  // Bắt đầu tìm từ sau ```sql
  const afterSqlBlock = text.slice(startIndex);
  const endBlockIndex = afterSqlBlock.indexOf("```", 6); // Bỏ qua '```sql'
  if (endBlockIndex === -1) return ""; // Không tìm thấy kết thúc block

  // Vị trí kết thúc block trong text gốc
  const absoluteEndBlockIndex = startIndex + endBlockIndex + 3;

  // Lấy phần sau block SQL
  return text.slice(absoluteEndBlockIndex).trim();
}

function extractMessageText(aiText) {
  const match = aiText.match(/\{message:\s*["']([^"']+)["']\s*\}/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return "";
}

// Controller nhận req.body.question, trả về JSON {aiAnswer, sql, dbRows}
export const askChatbot = async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_KEY);
  } catch (err) {
    return res.status(401).json({ message: "Token invalid or expired" });
  }
  const email = decoded.email;

  const userQuestion = req.body.question;
  const customer = await customerModel.findEmail(email);
  // Bạn có thể đưa phần schema + prompt chuẩn vào đây (cắt ngắn schema nếu muốn)
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // Prompt hệ thống và đóng vai trợ lý AI, giữ lại schema ở phần đầu
  const systemPrompt = `Bạn tên là Bill Cipher
Bạn là một trợ lý AI thông minh, làm việc như một nhân viên cho một website thương mại điện tử chuyên bán dụng cụ và quần áo thể thao CẦU LÔNG.
Bạn có quyền truy cập cơ sở dữ liệu MySQL của công ty với cấu trúc (schema) bên dưới.

Trước hết hãy chào khách bằng email của họ để lấy niềm tin: ${email}

Hướng dẫn:

Khi khách hàng gửi câu hỏi, hãy xác định dữ liệu cần thiết chỉ dựa trên schema.
Viết truy vấn SQL phù hợp để lấy đúng dữ liệu từ schema.
Trả lời khách hàng bằng ngôn ngữ thân thiện, dễ hiểu.
Nếu không thể trả lời vì thiếu dữ liệu/schema, hãy lịch sự giải thích lý do.
Hãy cố gắng sửa chính tả của khách hàng nếu không đúng hay viết tắt.
Khi khách nhắc về tên 1 chữ như Yonex, Lining, Asics.. thì hiểu nó là brand.

Bạn muốn quản lý sản phẩm bán chạy nhất theo tuần, tháng, ... (best selling product per week/month) với schema hiện tại.
- Phân tích & Định hướng:
+ Tất cả dữ liệu đơn hàng và sản phẩm đã bán nằm ở 2 bảng:
+ order (có created_date)
+ order_item (chứa thông tin product_id, qty, order_id…)
Nên chỉ tính những đơn đã giao thành công (order_status_id = 5) để số liệu chính xác.
=> Chỉ cần JOIN order_item với order (để lọc theo thời gian), GROUP BY theo sản phẩm.

Luồng xác thực khách hàng như sau:
- Lấy token từ header Authorization dạng Bearer.
- Giải mã token với JWT_KEY lấy email.
- Tìm id khách hàng qua bảng customer (bằng email).
- Khi cần truy vấn dữ liệu cá nhân của khách, dùng email hoặc id này để lọc kết quả.
- Tuyệt đối không tạo, sửa, xóa dữ liệu.
- bạn phải đặt trong dấu backtick đối với bảng order.
- Khách có thể nhờ bạn hủy đơn hàng của họ bằng order id của họ, khi đó bạn hãy hỏi họ lại thêm lần nữa để xác nhận, khi xác nhận thì bạn chuyển order id thành 6,
bạn bắt họ điền vào khung chat 1 trong 2 lựa chọn [XÁC NHẬN HỦY ĐƠN HÀNG SỐ ...], [KHÔNG HỦY] .
- Khi khách nói XÁC NHẬN HỦY ĐƠN HÀNG SỐ ... thì bạn có quyền hủy bằng cách thay đổi order_status_id thành 6 dựa theo database schema đây là ví dụ sai:
UPDATE orders SET status = 'cancelled' WHERE order_id = 25;
SELECT order_id FROM orders WHERE order_id = 25 AND status = 'cancelled';


Sau khi hoàn thành thực hiện câu lệnh sql HỦY ĐƠN HÀNG khách đưa ra, hãy đưa ra câu {message: "thông báo" }.

đây là email của khách: ${email}
Đây là thông tin của khách ${JSON.stringify(customer)}

Khi sinh SQL, hãy dùng email hoặc customer.id để tìm dữ liệu khách.

LƯU Ý: BẠN KHÔNG CÓ QUYỀN THÊM, SỬA, XÓA DỮ LIỆU.
LƯU Ý: KHI KHÁCH HÀNG CẦN LIỆT KÊ CÁC SẢN PHẨM THÌ CHỈ CẦN NÊU CỘT NAME.
LƯU Ý: PHẦN LỚN KHÁCH HỎI VỀ TÊN SẢN PHẨM MÀ KHÔNG NÓI RÕ, ex: Tôi muốn biết giá vợt cầu lông Yonex Astrox 100zz vậy tên sản phẩm là Yonex Astrox 100zz.
LƯU Ý: Không được nhắc đên câu thông báo liên quan IT .vd: Dưới đây là câu lệnh SQL để lấy thông tin này

Chính sách thanh toán
Hiện tại cửa hàng chúng tôi hỗ trợ 02 hình thức thanh toán, giúp bạn chủ động và thuận tiện hơn trong quá trình giao hàng:

Thanh toán trực tuyến trên website

Đối với hình thức này, sau khi bạn đã tạo đơn hàng  thành công ở trên website bạn vui lòng chuyển khoản tổng giá trị đơn hàng qua tài khoản sau đây:

Thông tin chuyển khoản:

Tên chủ tài khoản: Nguyễn Hữu Lộc
Số tài khoản: 0421003707901
Ngân hàng: Vietcombank
Chi nhánh: HCM

Lưu ý: Khi bạn chuyển khoản, vui lòng nhập tên người mua hàng.

Sau khi bạn đã thanh toán và chuyển khoản xong, chúng tôi sẽ giao hàng đến cho bạn theo thời gian quy định tại “Chính sách giao hàng” của chúng tôi.


Thanh toán khi nhận hàng (COD - Cash On Delivery)

Với hình thức thanh toán khi nhận hàng, bạn sẽ chỉ thanh toán khi đơn hàng đến tay của bạn và bạn chỉ cần trả đúng số tiền in trên hóa đơn. Nếu bạn thấy giá trị trên hóa đơn không chính xác, bạn vui lòng liên hệ lại ngay cho chúng tôi qua số Hotline: 0932.538.468

Chính sách đổi trả
Điều kiện đổi trả:

Shop sẽ chấp nhận đổi trả cho các trường hợp sau đây:

Sản phẩm bị hư hỏng do quá trình vận chuyển. Ví dụ: quần áo bị lấm bẩn hoặc ướt, sản phẩm không còn hình dạng giống như ban đầu, …
Sản phẩm bị hư hỏng trong quá trình sản xuất. Ví dụ: quạt điện không thể điều chỉnh được tốc độ, bếp điện có nhiệt độ bất thường, …
Sản phẩm không giống như những gì bạn được nghe, thấy và nhìn ở trên website hay từ nhân viên tư vấn. Ví dụ: Bạn đặt mua Iphone X chính hãng nhưng chỉ nhận được một chiếc Iphone X Trung Quốc, …
Nếu như sản phẩm của bạn không nằm trong những mục ở trên, chúng tôi có quyền được từ chối yêu cầu đổi trả của quý khách.

Thời gian đổi trả:

Thời gian đổi trả cố định trong vòng 07 ngày đối với khách hàng ở khu vực trung tâm Hồ Chí Minh. Còn đối với các khách hàng ở các tỉnh khác, thời gian bảo hành được kéo dài đến 14 ngày kể từ ngày mua hàng.

Quy định đổi trả:

Cùng mã sản phẩm (chỉ đổi size, đổi màu): Đổi miễn phí
Khác mã sản phẩm:
Nếu sản phẩm mới (sản phẩm muốn đổi) có giá trị > giá trị sản phẩm cũ (dựa theo hóa đơn thanh toán): Khách hàng sẽ bù thêm chi phí để đổi lấy sản phẩm mới theo công thức sau (Giá trị sản phẩm mới) - (Giá trị sản phẩm cũ).
Nếu sản phẩm mới (sản phẩm muốn đổi) có giá trị < giá trị sản phẩm cũ (dựa theo hóa đơn thanh toán): Khách hàng sẽ được nhận lại tiền thừa theo công thức (Giá trị sản phẩm cũ) - (Giá trị sản phẩm mới).

Chính sách giao hàng
Phạm vi giao hàng

Hiện tại cửa hàng của chúng tôi đã hỗ trợ giao hàng trên toàn quốc. Dù bạn có ở bất kỳ nơi đâu trên lãnh thổ Việt Nam, chúng tôi đều có thể gửi hàng trực tiếp đến tận tay của bạn.


Thời gian giao hàng

Đối với khách hàng ở Hồ Chí Minh, thời gian giao hàng sẽ từ 02 - 03 ngày làm việc.

Đối với khách hàng ở các tỉnh, thành phố còn lại thì thời gian giao hàng dự kiến từ 03 - 07 ngày kể từ lúc bạn lên đơn hàng.
Lưu ý: Thời gian giao hàng được bắt đầu tính sau khi đơn hàng của quý khách được xác nhận thành công bằng cuộc gọi của nhân viên chăm sóc khách hàng của chúng tôi.

Phí giao hàng

Đối với khách hàng ở Hồ Chí Minh thì quý khách sẽ chịu phí vận chuyển giao hàng 15,000 đ/đơn hàng (đã bao gồm VAT).
Còn các khách hàng ở các tỉnh thành còn lại, chúng tôi sẽ dựa vào địa điểm bạn đang sinh sống.


Hủy đơn hàng

Đơn hàng của bạn sẽ bị hủy nếu sau 03 lần nhân viên giao hàng hay nhân viên chăm sóc khách hàng liên lạc với bạn.
Nếu bạn đã nhận đơn hàng nhưng không đồng ý nhận sản phẩm vì một lý do nào đó, thì bạn sẽ là người trực tiếp thanh toán tiền vận chuyển cho nhân viên giao nhận.
Nếu đơn hàng của bạn đã được đóng gói và chưa được gửi đi, bạn có quyền được hủy đơn hàng mà không phải chịu bất cứ chi phí phát sinh nào cả.

Schema cơ sở dữ liệu:
  
  -- Table: action
  CREATE TABLE \`action\` (
    \`id\` int(11) NOT NULL,
    \`name\` varchar(100) NOT NULL,
    \`description\` varchar(100) NOT NULL,
    PRIMARY KEY (\`id\`)
  );
  
  -- Table: brand
  CREATE TABLE \`brand\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(200) NOT NULL,
    \`brand_image\` varchar(255) DEFAULT NULL,
    PRIMARY KEY (\`id\`)
  );

  INSERT INTO \`brand\` (\`id\`, \`name\`, \`brand_image\`) VALUES
(1, 'Asicsac', 'asics.png'),
(4, 'Yonex', 'yonex.png'),
(5, 'Lining', 'lining.png'),
(7, 'Victor', 'victor.png'),
(11, 'Mizuno', NULL);
  
  -- Table: category
  CREATE TABLE \`category\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(200) NOT NULL,
    PRIMARY KEY (\`id\`)
  );

  INSERT INTO \`category\` (\`id\`, \`name\`) VALUES
(1, 'Giày cầu lông'),
(2, 'Áo cầu lông'),
(3, 'Quần/váy cầu lông'),
(4, 'Túi vợt cầu lông'),
(5, 'Balo cầu lông'),
(6, 'Ống cầu lông'),
(15, 'Vợt cầu lông'),
(24, 'Phụ kiện cầu lông');

  
  -- Table: comment
  CREATE TABLE \`comment\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`product_id\` int(11) NOT NULL,
    \`email\` varchar(100) NOT NULL,
    \`fullname\` varchar(100) NOT NULL,
    \`star\` float NOT NULL,
    \`created_date\` datetime NOT NULL,
    \`description\` text DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`product_id\` (\`product_id\`)
  );
  
  -- Table: customer
  CREATE TABLE \`customer\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(100) NOT NULL,
    \`password\` varchar(61) NOT NULL,
    \`mobile\` varchar(15) NOT NULL,
    \`email\` varchar(100) NOT NULL,
    \`login_by\` varchar(20) NOT NULL,
    \`ward_id\` varchar(5) DEFAULT NULL,
    \`shipping_name\` varchar(200) NOT NULL,
    \`shipping_mobile\` varchar(15) NOT NULL,
    \`housenumber_street\` varchar(200) DEFAULT NULL,
    \`is_active\` tinyint(4) NOT NULL DEFAULT 0,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`email\` (\`email\`),
    KEY \`ward_id\` (\`ward_id\`)
  );
  
  -- Table: district
  CREATE TABLE \`district\` (
    \`id\` varchar(5) NOT NULL,
    \`name\` varchar(100) NOT NULL,
    \`type\` varchar(30) NOT NULL,
    \`province_id\` varchar(5) NOT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`province_id\` (\`province_id\`)
  );
  
  -- Table: image_item
  CREATE TABLE \`image_item\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`product_id\` int(11) NOT NULL,
    \`name\` varchar(100) NOT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`product_id\` (\`product_id\`)
  );
  
  -- Table: newsletter
  CREATE TABLE \`newsletter\` (
    \`email\` varchar(100) NOT NULL,
    PRIMARY KEY (\`email\`)
  );
  
  -- Table: order
  CREATE TABLE \`order\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`created_date\` datetime NOT NULL,
    \`order_status_id\` int(2) NOT NULL,
    \`staff_id\` int(10) DEFAULT NULL,
    \`customer_id\` int(10) NOT NULL,
    \`shipping_fullname\` varchar(100) NOT NULL,
    \`shipping_mobile\` varchar(15) NOT NULL,
    \`payment_method\` tinyint(4) NOT NULL DEFAULT 0 COMMENT '0:COD, 1: bank',
    \`shipping_ward_id\` varchar(5) DEFAULT NULL,
    \`shipping_housenumber_street\` varchar(200) NOT NULL,
    \`shipping_fee\` int(11) DEFAULT 0,
    \`delivered_date\` date DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`order_order_status_fk_1\` (\`order_status_id\`),
    KEY \`order_staff_fk_1\` (\`staff_id\`),
    KEY \`order_customer_fk_1\` (\`customer_id\`),
    KEY \`shipping_ward\` (\`shipping_ward_id\`)
  );
  
  -- Table: order_item
  CREATE TABLE \`order_item\` (
    \`product_id\` int(10) NOT NULL,
    \`order_id\` int(10) NOT NULL,
    \`qty\` int(4) NOT NULL,
    \`unit_price\` int(11) NOT NULL,
    \`total_price\` int(10) NOT NULL,
    PRIMARY KEY (\`product_id\`,\`order_id\`),
    KEY \`order_item_product_fk_1\` (\`product_id\`),
    KEY \`order_item_order_fk_1\` (\`order_id\`)
  );
  
  -- Table: product
  CREATE TABLE \`product\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`barcode\` varchar(13) NOT NULL,
    \`sku\` varchar(20) NOT NULL,
    \`name\` varchar(300) NOT NULL,
    \`price\` int(11) NOT NULL,
    \`discount_percentage\` int(11) NOT NULL,
    \`discount_from_date\` date NOT NULL,
    \`discount_to_date\` date NOT NULL,
    \`featured_image\` varchar(100) NOT NULL,
    \`inventory_qty\` int(11) NOT NULL,
    \`category_id\` int(11) NOT NULL,
    \`brand_id\` int(11) DEFAULT NULL,
    \`created_date\` datetime NOT NULL,
    \`description\` text NOT NULL,
    \`star\` float DEFAULT NULL,
    \`featured\` tinyint(1) DEFAULT NULL COMMENT '1: nổi bật',
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`barcode\` (\`barcode\`),
    KEY \`product_category_fk_1\` (\`category_id\`),
    KEY \`brand_id\` (\`brand_id\`)
  );
  
  -- Table: province
  CREATE TABLE \`province\` (
    \`id\` varchar(5) NOT NULL,
    \`name\` varchar(100) NOT NULL,
    \`type\` varchar(30) NOT NULL,
    PRIMARY KEY (\`id\`)
  );

  INSERT INTO \`province\` (\`id\`, \`name\`, \`type\`) VALUES
('01', 'Thành phố Hà Nội', 'Thành phố Trung ương'),
('02', 'Tỉnh Hà Giang', 'Tỉnh'),
('04', 'Tỉnh Cao Bằng', 'Tỉnh'),
('06', 'Tỉnh Bắc Kạn', 'Tỉnh'),
('08', 'Tỉnh Tuyên Quang', 'Tỉnh'),
('10', 'Tỉnh Lào Cai', 'Tỉnh'),
('11', 'Tỉnh Điện Biên', 'Tỉnh'),
('12', 'Tỉnh Lai Châu', 'Tỉnh'),
('14', 'Tỉnh Sơn La', 'Tỉnh'),
('15', 'Tỉnh Yên Bái', 'Tỉnh'),
('17', 'Tỉnh Hoà Bình', 'Tỉnh'),
('19', 'Tỉnh Thái Nguyên', 'Tỉnh'),
('20', 'Tỉnh Lạng Sơn', 'Tỉnh'),
('22', 'Tỉnh Quảng Ninh', 'Tỉnh'),
('24', 'Tỉnh Bắc Giang', 'Tỉnh'),
('25', 'Tỉnh Phú Thọ', 'Tỉnh'),
('26', 'Tỉnh Vĩnh Phúc', 'Tỉnh'),
('27', 'Tỉnh Bắc Ninh', 'Tỉnh'),
('30', 'Tỉnh Hải Dương', 'Tỉnh'),
('31', 'Thành phố Hải Phòng', 'Thành phố Trung ương'),
('33', 'Tỉnh Hưng Yên', 'Tỉnh'),
('34', 'Tỉnh Thái Bình', 'Tỉnh'),
('35', 'Tỉnh Hà Nam', 'Tỉnh'),
('36', 'Tỉnh Nam Định', 'Tỉnh'),
('37', 'Tỉnh Ninh Bình', 'Tỉnh'),
('38', 'Tỉnh Thanh Hóa', 'Tỉnh'),
('40', 'Tỉnh Nghệ An', 'Tỉnh'),
('42', 'Tỉnh Hà Tĩnh', 'Tỉnh'),
('44', 'Tỉnh Quảng Bình', 'Tỉnh'),
('45', 'Tỉnh Quảng Trị', 'Tỉnh'),
('46', 'Tỉnh Thừa Thiên Huế', 'Tỉnh'),
('48', 'Thành phố Đà Nẵng', 'Thành phố Trung ương'),
('49', 'Tỉnh Quảng Nam', 'Tỉnh'),
('51', 'Tỉnh Quảng Ngãi', 'Tỉnh'),
('52', 'Tỉnh Bình Định', 'Tỉnh'),
('54', 'Tỉnh Phú Yên', 'Tỉnh'),
('56', 'Tỉnh Khánh Hòa', 'Tỉnh'),
('58', 'Tỉnh Ninh Thuận', 'Tỉnh'),
('60', 'Tỉnh Bình Thuận', 'Tỉnh'),
('62', 'Tỉnh Kon Tum', 'Tỉnh'),
('64', 'Tỉnh Gia Lai', 'Tỉnh'),
('66', 'Tỉnh Đắk Lắk', 'Tỉnh'),
('67', 'Tỉnh Đắk Nông', 'Tỉnh'),
('68', 'Tỉnh Lâm Đồng', 'Tỉnh'),
('70', 'Tỉnh Bình Phước', 'Tỉnh'),
('72', 'Tỉnh Tây Ninh', 'Tỉnh'),
('74', 'Tỉnh Bình Dương', 'Tỉnh'),
('75', 'Tỉnh Đồng Nai', 'Tỉnh'),
('77', 'Tỉnh Bà Rịa - Vũng Tàu', 'Tỉnh'),
('79', 'Thành phố Hồ Chí Minh', 'Thành phố Trung ương'),
('80', 'Tỉnh Long An', 'Tỉnh'),
('82', 'Tỉnh Tiền Giang', 'Tỉnh'),
('83', 'Tỉnh Bến Tre', 'Tỉnh'),
('84', 'Tỉnh Trà Vinh', 'Tỉnh'),
('86', 'Tỉnh Vĩnh Long', 'Tỉnh'),
('87', 'Tỉnh Đồng Tháp', 'Tỉnh'),
('89', 'Tỉnh An Giang', 'Tỉnh'),
('91', 'Tỉnh Kiên Giang', 'Tỉnh'),
('92', 'Thành phố Cần Thơ', 'Thành phố Trung ương'),
('93', 'Tỉnh Hậu Giang', 'Tỉnh'),
('94', 'Tỉnh Sóc Trăng', 'Tỉnh'),
('95', 'Tỉnh Bạc Liêu', 'Tỉnh'),
('96', 'Tỉnh Cà Mau', 'Tỉnh');
  
  -- Table: role
  CREATE TABLE \`role\` (
    \`id\` int(3) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(100) NOT NULL,
    PRIMARY KEY (\`id\`)
  );
  
  -- Table: role_action
  CREATE TABLE \`role_action\` (
    \`role_id\` int(11) NOT NULL,
    \`action_id\` int(11) NOT NULL,
    PRIMARY KEY (\`role_id\`,\`action_id\`),
    KEY \`role_action_role_fk_1\` (\`role_id\`),
    KEY \`role_action_action_fk_1\` (\`action_id\`)
  );
  
  -- Table: staff
  CREATE TABLE \`staff\` (
    \`id\` int(11) NOT NULL AUTO_INCREMENT,
    \`role_id\` int(11) NOT NULL,
    \`name\` varchar(100) NOT NULL,
    \`mobile\` varchar(15) NOT NULL,
    \`username\` varchar(100) NOT NULL,
    \`password\` varchar(61) NOT NULL,
    \`email\` varchar(100) NOT NULL,
    \`is_active\` tinyint(4) NOT NULL DEFAULT 1,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`username\` (\`username\`,\`email\`),
    UNIQUE KEY \`email\` (\`email\`),
    UNIQUE KEY \`username_2\` (\`username\`),
    KEY \`staff_role_fk_1\` (\`role_id\`)
  );
  
  -- Table: status
  CREATE TABLE \`status\` (
    \`id\` int(2) NOT NULL AUTO_INCREMENT,
    \`name\` varchar(50) NOT NULL,
    \`description\` varchar(100) NOT NULL,
    PRIMARY KEY (\`id\`)
  );

  INSERT INTO \`status\` (\`id\`, \`name\`, \`description\`) VALUES
(1, 'ordered', 'Đã đặt hàng '),
(2, 'confirmed', 'Đã xác nhận đơn hàng'),
(3, 'packaged', 'Hoàn tất đóng gói'),
(4, 'shipping', 'Đang giao hàng'),
(5, 'delivered', 'Đã giao hàng'),
(6, 'canceled', 'Đã bị hủy');
  
  -- Table: transport
  CREATE TABLE \`transport\` (
    \`id\` int(10) NOT NULL AUTO_INCREMENT,
    \`province_id\` varchar(5) DEFAULT NULL,
    \`price\` int(10) NOT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`transport_province_id\` (\`province_id\`)
  );

  INSERT INTO \`transport\` (\`id\`, \`province_id\`, \`price\`) VALUES
(1, '01', 20001),
(2, '02', 50000),
(3, '04', 50000),
(4, '06', 50000),
(5, '08', 50001),
(6, '10', 50000),
(7, '11', 50000),
(8, '12', 50000),
(9, '14', 50000),
(10, '15', 50000),
(11, '17', 50000),
(12, '19', 50000),
(13, '20', 50000),
(14, '22', 50000),
(15, '24', 50000),
(16, '25', 50000),
(17, '26', 50000),
(18, '27', 50000),
(19, '30', 50000),
(20, '31', 50000),
(21, '33', 50000),
(22, '34', 50000),
(23, '35', 50000),
(24, '36', 50000),
(25, '37', 50000),
(26, '38', 50000),
(27, '40', 50000),
(28, '42', 50000),
(29, '44', 50000),
(30, '45', 50000),
(31, '46', 50000),
(32, '48', 50000),
(33, '49', 50000),
(34, '51', 50000),
(35, '52', 50000),
(36, '54', 50000),
(37, '56', 50000),
(38, '58', 50000),
(39, '60', 50000),
(40, '62', 50000),
(41, '64', 50000),
(42, '66', 50000),
(43, '67', 50000),
(44, '68', 50000),
(45, '70', 50000),
(46, '72', 50000),
(47, '74', 50000),
(48, '75', 50000),
(49, '77', 50000),
(50, '79', 50000),
(51, '80', 50000),
(52, '82', 50000),
(53, '83', 50000),
(54, '84', 50000),
(55, '86', 50000),
(56, '87', 50000),
(57, '89', 50000),
(58, '91', 50000),
(59, '92', 40000),
(60, '93', 50000),
(61, '94', 50000),
(62, '95', 50000),
(63, '96', 50000);
  
  -- Table: ward
  CREATE TABLE \`ward\` (
    \`id\` varchar(5) NOT NULL,
    \`name\` varchar(100) NOT NULL,
    \`type\` varchar(30) NOT NULL,
    \`district_id\` varchar(5) NOT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`district_id\` (\`district_id\`)
  );
`;

  const config = {
    responseMimeType: 'text/plain',
  };
  const model = 'gemini-1.5-pro';
  const contents = [
    {
      role: 'user',
      parts: [
        { text: systemPrompt },
      ],
    },
    {
      role: 'user',
      parts: [
        { text: userQuestion },
      ],
    }
  ];

  try {
    const response1 = await ai.models.generateContentStream({
      model,
      config,
      contents: [
        {
          role: "user",
          parts: [{ text: systemPrompt }]
        },
        {
          role: "user",
          parts: [{ text: userQuestion }]
        }
      ]
    });

    let aiText = "";
    for await (const chunk of response1) {
      aiText += chunk.text;
    }

    console.log('ai', aiText);

    const sql = extractSQL(aiText);

    console.log('sql', sql);

    const aitextBeforeSQL = extractTextBeforeSQL(aiText);
    const message = extractMessageText(aiText);

    // const message = JSON.stringify(message_after_sql);

    console.log('message', message);

    let dbRows = [];
    if (sql) {
      try {
        [dbRows] = await pool.execute(sql);
      } catch (err) {
        console.log([{ error: err.message }])
      }
    }

    console.log('dbRows', dbRows);

    let vals = [];
    if (Array.isArray(dbRows)) {
      vals = dbRows.map(row => Object.values(row)[0]);
    }
    console.log('vals', vals);

    const contextForAI = `
Dưới đây là câu hỏi của khách:
"${userQuestion}"

Đây là câu lệnh SQL mà bạn đã tạo:
\`\`\`sql
${sql}
\`\`\`

Đây là kết quả thực tế truy vấn từ cơ sở dữ liệu:
${dbRows}

Sau khi đưa ra câu lệnh sql, Nếu dbRows = [] hãy đưa ra 1 câu không phải dạng json y hệt như này: {message: "Không có kết quả."}
Nếu không thực hiện câu lệnh sql thì đừng đưa ra {message: "Không có kết quả."}
Do tôi lấy {message:..} trong câu trả lời bạn để đưa ra front end nên bạn không cần in ra: Vì dbRows chứa dữ liệu ([object Object],[object Object],...), tức là không rỗng, nên câu trả lời sẽ là danh sách ID đơn hàng đã bị hủy. Không cần in ra thông báo  "{message: "Không có kết quả."}".
`;

    const response2 = await ai.models.generateContentStream({
      model,
      config,
      contents: [
        {
          role: "user",
          parts: [{ text: contextForAI }]
        }
      ]
    });

    let aiFinalAnswer = "";
    for await (const chunk of response2) {
      aiFinalAnswer += chunk.text;
    }

    console.log('aiFinalAnswer', aiFinalAnswer);

    const noneResult = extractMessageText(aiFinalAnswer);

    console.log('noneResult', noneResult);

    try {
      const saveQuery = `
        INSERT INTO chat_history (user_email, question, ai_answer, message, db_sql, db_rows, vals, no_result)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await pool.execute(saveQuery, [
        email,
        userQuestion,
        aitextBeforeSQL,
        JSON.stringify(message),
        sql,
        JSON.stringify(dbRows),
        JSON.stringify(vals),
        JSON.stringify(noneResult),
      ]);
    } catch (error) {
      console.error("Error saving chat history:", error.message);
    }

    res.json({
      aiAnswer: aiText,
      aitextBeforeSQL,
      sql,
      dbRows,
      vals,
      message,
      aiFinalAnswer: noneResult,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
