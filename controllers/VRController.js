class VRController {
    static index = async (req, res) => {
        try {
            res.render('VR/index', {

            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
}
module.exports = VRController;