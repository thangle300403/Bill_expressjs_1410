(async () => {
    const express = require('express');
    const ejsLayout = require('express-ejs-layouts');
    const path = require('path');
    const bodyParser = require('body-parser');
    const session = require('express-session');
    const FileStore = require('session-file-store')(session);
    const cookieParser = require('cookie-parser');
    const cors = require('cors');
    const { initVectorStore } = require("./controllers/api/Chatbot/vectorStore");
    const { debugListChromaContents } = require("./controllers/api/Chatbot/vectorStore");
    const { runInitialSeeds, runProductSeeds } = require("./controllers/api/Chatbot/runInitialSeed");
    const dotenv = require("dotenv");
    // const { rebuildMemoryFromDB } = require("./controllers/api/Chatbot/rebuiltmemoryDB");

    // ✅ Load .env file
    dotenv.config();

    // ✅ Environment variables
    const HOST_NAME = process.env.HOST_NAME;
    const PORT = process.env.PORT;
    const FRONTEND_URL = process.env.FRONTEND_URL_NEXT;

    // ✅ Initialize vector store before anything else
    await initVectorStore();
    await runInitialSeeds();
    await runProductSeeds();
    // await rebuildMemoryFromDB();
    // await debugListChromaContents("consult_docs");
    // await debugListChromaContents("sql_docs");

    const app = express();

    // Set the layout
    app.use(ejsLayout);
    app.use(
        cors({
            origin: [FRONTEND_URL],
            credentials: true,
        })
    );

    const helpers = require('./utils/helpers');
    app.locals.helpers = helpers;
    app.use(cookieParser());

    app.set('views', './views');
    app.set('view engine', 'ejs');
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
    app.use('/generated', express.static(path.join(process.cwd(), 'generated')));

    var fileStoreOptions = {};
    app.use(session({
        store: new FileStore(fileStoreOptions),
        secret: 'sinra tensei',
        resave: false,
        saveUninitialized: true,
    }));

    const indexRouter = require('./routers/IndexRouter');
    const adminRouter = require('./routers/AdminRouter');
    const apiRouter = require('./routers/ApiRouter');

    app.use((req, res, next) => {
        app.locals.currentRoute = helpers.getCurrentRoute(req.path);
        app.locals.uploadDir = __dirname + '/public/images';
        app.locals.session = req.session;
        next();
    });

    app.use('/', indexRouter);
    app.use('/admin', adminRouter);
    app.use('/api/v1', apiRouter);

    app.listen(PORT, HOST_NAME, () => {
        console.log(`✅ Server running at http://${HOST_NAME}:${PORT}`);
    });
})();
