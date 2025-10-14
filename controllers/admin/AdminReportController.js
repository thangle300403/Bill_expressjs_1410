class ReportController {
    static index = async (req, res) => {
        try {
            res.end('index');
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
}