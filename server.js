'use strict';
const dotenv = require('dotenv');
const express = require('express');
const line = require('@line/bot-sdk');
const { Configuration, OpenAIApi } = require('openai');
dotenv.config();

const PORT = process.env.PORT || 3000;

// Messaging APIを利用するための鍵を設定します。
const config = {
  channelSecret: process.env.CHANNEL_SECRET || '作成したBOTのチャネルシークレット',
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN ||'作成したBOTのチャネルアクセストークン'
};

const client = new line.Client(config);

// openAI のパラメータ設定
const aiConfig = {
    apiKey: process.env.OPENAI_API_KEY
};
const configuration = new Configuration(aiConfig)
const openai = new OpenAIApi(configuration);

const generateImageUrl = async (prompt) => {
    const res = await openai.createImage({
        prompt: prompt,
        n: 1,
        size: "1024x1024"
    })
    return res.data.data[0].url;
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  const { userId } = event.source;
  const { text } = event.message;

  // ユーザーにリプライメッセージを送ります。
  const res = await client.replyMessage(event.replyToken, {
    type: 'text', // テキストメッセージ
    text: 'now drawing ...'
  });
  console.log(res);
  const imageUrl = await generateImageUrl(text);

  return await client.pushMessage(userId, {
    type: 'image',
    originalContentUrl: imageUrl,
    previewImageUrl: imageUrl
  })
}

// ここ以降は理解しなくてOKです
const app = express();
app.get('/', (_, res) => res.send('Hello LINE BOT! (HTTP GET)'));
app.post('/webhook', line.middleware(config), (req, res) => {
  
  if (req.body.events.length === 0) {
    res.send('Hello LINE BOT! (HTTP POST)');
    console.log('検証イベントを受信しました！');
    return;
  } else {
    console.log('受信しました:', req.body.events);
  }
  
  Promise.all(req.body.events.map(handleEvent))
  .then((result) => res.json(result))
  .catch((err) => {
    console.error(err.originalError.response.data);
    res.status(500).end();
  });
});

app.listen(PORT, () => {
  console.log(`ポート${PORT}番でExpressサーバーを実行中です…`);
});