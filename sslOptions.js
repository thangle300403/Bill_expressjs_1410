import fs from "fs";
import path from "path";

export const getSSLOptions = (basePath = "C:\\Users\\Administrator\\Desktop\\ssl\\billwinslow.top") => ({
    key: fs.readFileSync(path.join(basePath, "private.key")),
    cert: fs.readFileSync(path.join(basePath, "certificate.crt")),
    ca: fs.readFileSync(path.join(basePath, "ca_bundle.crt")),
});
