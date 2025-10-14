const provinceModel = require('../../models/Province');
const districtModel = require('../../models/District');
const wardModel = require('../../models/Ward')
const transportModel = require('../../models/Transport');

class ApiAddressController {
    static getProvinces = async (req, res) => {
        try {
            let provinces = await provinceModel.all();
            provinces = provinces.map(({ fields, ...rest }) => rest);
            res.json(provinces);
        } catch (error) {
            res.status(500).json({ message: 'Lỗi khi lấy danh sách tỉnh.', error: error.message });
        }
    };

    static getDistricts = async (req, res) => {
        try {
            const provinceId = req.params.provinceId;
            let districts = await districtModel.getByProvinceId(provinceId)
            districts = districts.map(({ fields, ...rest }) => rest);
            res.json(districts);
        } catch (error) {
            res.status(500).json({ message: 'Lỗi khi lấy danh sách quận huyện.', error: error.message });
        }
    };

    static getWards = async (req, res) => {
        try {
            const districtId = req.params.districtId;
            let wards = await wardModel.getByDistrictId(districtId)
            wards = wards.map(({ fields, ...rest }) => rest);
            res.json(wards);
        } catch (error) {
            res.status(500).json({ message: 'Lỗi khi lấy danh sách p xã.', error: error.message });
        }
    };

    static getShippingFees = async (req, res) => {
        try {
            const provinceId = req.params.provinceId;

            const transport = await transportModel.find(provinceId);

            const shippingFee = transport.price;

            res.json(shippingFee);
        } catch (error) {
            res.status(500).json({ message: 'Lỗi khi lấy phí ship.', error: error.message });
        }
    }
}



module.exports = ApiAddressController;
