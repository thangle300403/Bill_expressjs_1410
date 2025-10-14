class Product {
    constructor(id, name, price) {
        this.id = id;
        this.name = name;
        this.price = price;
    }

    getProductDetails() {
        return `${this.name} - ${this.price} USD`;
    }
}

module.exports = Product;
