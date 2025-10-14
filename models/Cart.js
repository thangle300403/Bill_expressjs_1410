const productModel = require('./Product');
const helpers = require('../utils/helpers')
class Cart {
    items = {};
    total_price = 0;
    total_product_number = 0;

    constructor(stringCookie) {
        if (stringCookie) {
            const temp = JSON.parse(stringCookie);
            this.items = temp.items;
            this.total_price = temp.total_price;
            this.total_product_number = temp.total_product_number;
        }

    }

    toString = () => {
        // JSON.stringify là hàm ngược của JSON.parse()
        return JSON.stringify({
            items: this.items,
            total_price: this.total_price,
            total_product_number: this.total_product_number
        })
    }

    addProduct = async (product_id, qty) => {
        const product = await productModel.find(product_id);
        const item = {
            product_id: product_id,
            name: product.name,
            img: product.featured_image,
            qty: qty,
            unit_price: product.sale_price,
            total_price: product.price * qty,
            url: helpers.genRouteProductDetail(product)
        };
        this.addItem(item);
    }

    addItem(item) {

        const product_id = item.product_id;
        const img = item.img;
        const name = item.name;
        const total_price = item.total_price;
        const qty = item.qty;
        const unit_price = item.unit_price;
        const url = item.unit_price;
        if (!this.items[product_id]) {
            this.items[product_id] = {
                img: img,
                name: name,
                product_id: product_id,
                qty: Number(qty),
                unit_price: Number(unit_price),
                total_price: Number(total_price),
                url: url
            };
        }
        else {
            this.items[product_id].qty += Number(qty);
            this.items[product_id].total_price = this.items[product_id].qty * Number(unit_price);
        }
        this.total_price += Number(unit_price) * Number(qty);
        this.total_product_number += Number(qty);
    }

    deleteProduct = (product_id) => {
        if (this.items[product_id]) {
            delete this.items[product_id];
        }
        //Recalculate total_product_number & total_price
        this.total_price = 0;
        this.total_product_number = 0;
        for (var key in this.items) {
            if (this.items[key]) {
                var item = this.items[key];
                this.total_price += item.unit_price * item.qty;
                this.total_product_number += item.qty;
            }
        }
    }

}
module.exports = Cart;
