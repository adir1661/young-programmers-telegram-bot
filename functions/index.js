const functions = require('firebase-functions');
// const TelegramBot = require('node-telegram-bot-api');
// const ogs = require('open-graph-scraper');
const admin = require('firebase-admin');
const {TOKEN} = require('./secret');
const cors = require('cors');
const fetch = require('node-fetch');
// Bot config
// const bot = new TelegramBot(TOKEN, {polling: true});
const express = require('express');
// Init Firebase
admin.initializeApp();
// console.log('functions.config().firebase: ', functions.config().firebase);
// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//     databaseURL: "https://muli-sela.firebaseio.com",
//     storageBucket: "gs://muli-sela.appspot.com"
// });
// const sitesRef = ref.child("sites");
let db = admin.firestore();

const app = express();
const router = express.Router();

function telegramMethod(methudName, httpMethod = 'GET', body = {}) {
    return fetch(`https://api.telegram.org/bot${TOKEN}/${methudName}`, {
        method: httpMethod,
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    }).then(res => res.json());
}

// Automatically allow cross-origin requests
app.use(cors({origin: true}));
const requestGeneral = ['/addUrlToStack',(req, res) => {
        const params = Object.keys(req.body).length > 0 ? req.body : req.query || {};
        console.log(params);
        // res.status(200).send(params || 'no params');
        const urlRecordObject = {
            url: params.url,
            message: params.message,
            created: String((new Date()).toJSON())
        };
        db.collection('urlStack').doc('urls-to-pop').collection('urls').doc(String((new Date()).toJSON())).set(urlRecordObject).then(result => {
            return res.status(200).send({
                data: result,
                message: 'object added to database!'
            });
        }).catch(err => {
            console.error(err);
            res.status(502).send(err);
        });
    }
];
router.post(requestGeneral[0], requestGeneral[1]);
router.get(requestGeneral[0], requestGeneral[1]);
router.get('/getWebhookInfo', (req, res) => {
    telegramMethod('getWebhookInfo').then(data => {
        return res.status(200).send(data);
    }).catch(err => {
        res.status(502).send(err);
    });
});
// our single entry point for every message
router.post('*', (req, res) => {
    /*
      You can put the logic you want here
      the message receive will be in this
      https://core.telegram.org/bots/api#update
    */
    const isTelegramMessage = req.body
        && req.body.message
        && req.body.message.chat
        && req.body.message.chat.id
        && req.body.message.from
        && req.body.message.from.first_name;

    if (isTelegramMessage) {
        const chat_id = req.body.message.chat.id;
        const {first_name} = req.body.message.from;
        const {text} = req.body.message;
        console.log('massage from : ', first_name);
        console.log('text : ', text);
        console.log('chat_id : ', chat_id);
        db.collection('chats').doc(String(chat_id)).collection('messages').doc(String(req.body.message.meddage_id)).set(req.body.message);
        return res.status(200).send({
            method: 'none',
            chat_id,
            ok: true
            // text: `Hello ${first_name}`
        })
    }

    return res.status(502).send({status: 'not a telegram message'})
});
router.get('*', (req, res) => {
    res.status(200).send('working!, but what are u doing here exactly?')
});
app.use('/'+TOKEN, router);
// app.get('*',(req,res)=>{
//     res.status(200).send('working, but what are u looking at here?');
// });
// this is the only function it will be published in firebase
exports.router = functions.https.onRequest(app);

exports.schedule = functions.pubsub.schedule('0 9 * * 3')//0 9 * * 1
    .timeZone('Asia/Jerusalem') // Users can choose timezone - default is America/Los_Angeles
    .onRun((context) => {
        let firstDoc = {};
        return db.collection('urlStack/urls-to-pop/urls').get().then(collection => {
            let listArray = [];
            collection.forEach(doc => {
                listArray.push(doc);
            });
            if (listArray.length === 0) {
                return null
            }
            firstDoc = JSON.parse(JSON.stringify(listArray[0].data()));
            return listArray[0].ref.delete();
        }).then(deletion => {
            firstDoc.deleted = (new Date()).toJSON();
            return db.collection('urlStack/urls-poped/urls').doc((new Date()).toJSON()).set(firstDoc);
        }).then(doc => {
            console.log("doc: ", doc);
            console.log('added to "poped":', doc);
            return Promise.all([telegramMethod('sendMessage', 'POST', {
                chat_id: -1001365487698,
                text: `${firstDoc.url}`,
                disable_web_page_preview: false
            }), telegramMethod('sendMessage', 'POST', {
                chat_id: -1001365487698,
                text: `${firstDoc.message}`,
                disable_web_page_preview: false
            })]);
        }).then(result => {
            return res.status(200).send(result);
        }).catch(err => {
            err.text__ = 'hi';
            console.log(err);
            res.status(200).send(err);
        });
    });

exports.test = functions.https.onRequest((req, res) => {
    let firstDoc = {};
    db.collection('urlStack/urls-to-pop/urls').get().then(collection => {
        let listArray = [];
        collection.forEach(doc => {
            listArray.push(doc);
        });
        if (listArray.length === 0) {
            return null
        }
        firstDoc = JSON.parse(JSON.stringify(listArray[0].data()));
        return Promise.all([telegramMethod('sendMessage', 'POST', {
            chat_id: 484148845,
            text: `${firstDoc.url}`,
            disable_web_page_preview: false
        }), telegramMethod('sendMessage', 'POST', {
            chat_id: 484148845,
            text: `${firstDoc.message}`,
            disable_web_page_preview: false
        })]);
    }).then(result => {
        return res.status(200).send(result);
    }).catch(err => {
        err.text__ = 'hi';
        console.log(err);
        res.status(200).send(err);
    });
});