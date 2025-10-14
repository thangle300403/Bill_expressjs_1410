CREATE VIEW view_product AS 
SELECT product.*,
	ROUND(

		IF(discount_percentage IS NULL || 
			discount_from_date > CURRENT_DATE || 
			discount_to_date < CURRENT_DATE , 
			price, 
		price * (1-discount_percentage/100))
		, -3) AS sale_price 
FROM product;


-- Áo: 385000
-- Giảm 15% => bán bao nhiêu?. 327250 làm tròn 327000
-- ROUND(327250, -3) => 327000
-- ROUND(327850, -3) => 328000
-- IF(dk, 10, 100)

-- ROUND(17.2579, 3) = 17.258

-- round(3.2756, 3) => 3.276