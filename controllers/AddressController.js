const Cart = require('../models/Cart')
const customerModel = require('../models/Customer');
const provinceModel = require('../models/Province');
const districtModel = require('../models/District');
const wardModel = require('../models/Ward');
const transportModel = require('../models/Transport');

class AddressController {
    static districts = async (req, res) => {
        const province_id = req.query.province_id;
        const districts = await districtModel.getByProvinceId(province_id);
        res.end(JSON.stringify(districts));
    }
    static wards = async (req, res) => {
        const district_id = req.query.district_id;
        const wards = await wardModel.getByDistrictId(district_id);
        res.end(JSON.stringify(wards));
    }
}
module.exports = AddressController;