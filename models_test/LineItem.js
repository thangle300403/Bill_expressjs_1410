const Product = require('./Product');

class LineItem {
    /**
     * @param {Product} product - Instance of Product class
     * @param {number} quantity - Quantity of product
     */
    constructor(product, quantity) {
        if (!(product instanceof Product)) {
            throw new Error("product must be an instance of Product class");
        }
        this.product = product;
        this.quantity = quantity;
    }

    getTotalPrice() {
        return this.product.price * this.quantity;
    }

    getLineItemDetails() {
        return `${this.quantity} x ${this.product.name} = ${this.getTotalPrice()} USD`;
    }
}

module.exports = LineItem;