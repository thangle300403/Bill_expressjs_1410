const pool = require('./db');
const Base = require('./Base');
const districtModel = require('./District');
class Ward extends Base {
    TABLE_NAME = 'ward';
    SELECT_ALL_QUERY = `SELECT * FROM ${this.TABLE_NAME}`;

    convertRowToObject = (row) => {
        const object = new Ward(row);
        return object;
    }

    getDistrict = async () => {
        const district = await districtModel.find(this.district_id);
        return district;
    }

    getByDistrictId = async (district_id) => {
        const wards = await this.fetch(`district_id=${district_id}`);
        return wards;
    }
}
module.exports = new Ward();
