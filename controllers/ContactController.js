class ContactController {
    static form = async (req, res) => {
        try {
            res.render('contact/form', {
            });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    static sendEmail = async (req, res) => {
        try {
            const web = `${req.protocol}://${req.headers.host}`;
            const to = process.env.SHOP_OWNER;
            const subject = "Godashop - liên hệ"
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
module.exports = ContactController;