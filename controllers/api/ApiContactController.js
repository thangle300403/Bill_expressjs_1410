class ApiContactController {
    static sendEmail = async (req, res) => {
        try {
            const web = process.env.FRONTEND_URL;
            const to = process.env.SHOP_OWNER;
            const subject = "G"
            const content = `
            Hello shop owner, <br>
            Here is the contact information from the customer: <br>
            Name: ${req.body.fullname}<br>
            Email: ${req.body.email}<br>
            Mobile: ${req.body.mobile}<br>
            Message: ${req.body.content}<br>
            From website: ${web}
            `;
            await req.app.locals.helpers.sendEmail(to, subject, content);
            res.end('Send mail successful!')
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
}
module.exports = ApiContactController;