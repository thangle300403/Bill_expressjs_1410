const session = require('express-session');
const transportModel = require('../../models/Transport');

class AdminTransportController {
    //trả về view -> (req, res)
    static index = async (req, res) => {
        try {
            const page = req.query.page || 1;
            const item_per_page = process.env.PRODUCT_ITEM_PER_PAGE;
            let conds = {};
            let sorts = {};

            const provinceName = req.query.search;
            let transports = [];

            if (provinceName) {
                transports = await transportModel.searchByProvinceName(provinceName);
            } else {
                // Handle case where no search term is provided
                transports = await transportModel.getBy(conds, sorts, page, item_per_page);
            }

            const allTransports = await transportModel.getBy(conds, sorts);

            const totalPage = Math.ceil(allTransports.length / item_per_page); //để phân trag

            for (let transport of transports) {
                const province = await transportModel.findProvinceById(transport.province_id);
                transport.province = { name: province.name };
            }


            res.render('admin/transport/index', {
                transports: transports,
                totalPage: totalPage,
                page: page,
                layout: 'admin/layout',
                search: provinceName || ''
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static edit = async (req, res) => {
        try {
            const transport = await transportModel.find(req.params.id);
            res.render('admin/transport/edit', {
                transport: transport,
                layout: 'admin/layout',
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }

    static update = async (req, res) => {
        try {
            const id = req.body.id;
            const transport = await transportModel.find(id);
            const province = await transport.getProvince();
            await transportModel.update(id, {
                price: req.body.price,
            });
            // Update session message for success
            req.session.message_success = `Sửa giá vận chuyển cho ${province.name} thành công!`;
            req.session.save(() => {
                res.redirect('/admin/transport');
            });
        } catch (error) {
            throw new Error(error.message);
        }
    }


}
module.exports = AdminTransportController;