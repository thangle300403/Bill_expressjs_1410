const pool = require('./db');
const Base = require('./Base');
const provinceModel = require('./Province');

class District extends Base {
    TABLE_NAME = 'district';
    SELECT_ALL_QUERY = `SELECT * FROM ${this.TABLE_NAME}`;

    convertRowToObject = (row) => {
        const object = new District(row);
        return object;
    }

    getProvince = async () => {
        const province = await provinceModel.find(this.province_id);
        return province;

    }

    getWards = async () => {
        const wardModel = require('./Ward');
        const wards = await wardModel.getByDistrictId(this.id);
        return wards;
    }

    getByProvinceId = async (province_id) => {
        const districts = await this.fetch(`province_id=${province_id}`);
        return districts;
    }
}
module.exports = new District();
