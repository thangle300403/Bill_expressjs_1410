const pool = require('./db');
const Base = require('./Base');
class Province extends Base {
    TABLE_NAME = 'province';
    SELECT_ALL_QUERY = `SELECT * FROM ${this.TABLE_NAME}`;

    convertRowToObject = (row) => {
        const object = new Province(row);
        return object;
    }

    getDistricts = async () => {
        const districtModel = require('./District');
        const districts = await districtModel.getByProvinceId(this.id);
        return districts;
    }
}
module.exports = new Province();
