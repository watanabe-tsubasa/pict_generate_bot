'use strict';
const axios = require('axios');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const dotenv = require('dotenv');
const express = require('express');
const line = require('@line/bot-sdk');
const { Configuration, OpenAIApi } = require('openai');
const { error } = require('console');
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

let binaryData;
let isBinaryFilled = false;

async function handleEvent(event) {
  console.log(event.message);
  if (event.type !== 'message') {
    return Promise.resolve(null);
  }
  const { userId } = event.source;
  const { text, id } = event.message;

  if (event.message.type === 'text') {
    if (isBinaryFilled) {
        // Canvasを作成し、バイナリデータをPNG形式の画像として描画
        const canvas = createCanvas(1024, 1024); // 必要なサイズを設定
        const ctx = canvas.getContext('2d');
        // loadImageメソッドを使用して画像を読み込む
        loadImage(binaryData)
        .then(image => {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        
        // 画像の処理が完了した後の処理を記述する
        })
        .catch(error => {
        // エラーハンドリング
        console.error(error);
        });

        // CanvasからPNG形式のデータを取得
        const pngData = canvas.toBuffer();
        console.log(text);

        const res = await openai.createImageEdit(
            pngData,
            text,
        );
        const imageUrl = res.data.data[0].url;
        isBinaryFilled = false;     
        return await client.pushMessage(userId, {
          type: 'image',
          originalContentUrl: imageUrl,
          previewImageUrl: imageUrl
        });        
    } else {
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
  } else if (event.message.type === 'image') {
    client.replyMessage(event.replyToken, {
        type: 'text', // テキストメッセージ
        text: 'プロンプトを送ってください'
    });
    const url = `https://api-data.line.me/v2/bot/message/${id}/content`;
    const token = config.channelAccessToken;
    try {
        const res = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            responseType: 'arraybuffer',
            responseEncoding: 'binary'
        });
        binaryData = res.data;
        isBinaryFilled = true;
    } catch {
        console.error(error.originalError.response.data);
        res.status(500).end();
    }
  } else {
    return Promise.resolve(null);
  }

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
    console.error(err);
    res.status(500).end();
  });
});

app.listen(PORT, () => {
  console.log(`ポート${PORT}番でExpressサーバーを実行中です…`);
});