"use strict";
const express = require('express');
const session = require('express-session');
const app = express();
const mysql = require('mysql2');
// const mongoose = require('mongoose');
// const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
// const mongoose = require('mongoose');
app.set('trust proxy', 1);

const redis = require("redis");
const RedisStore = require("connect-redis").default;

// Redis istemcisini oluştur
const redisClient = redis.createClient({
    host: 'redis_container',
    port: 6379
});

// Redis istemcisi bağlandığında
redisClient.on('connect', function () {
    console.log('Connected to Redis successfully');
});

// Redis istemcisinde bir hata olduğunda
redisClient.on('error', function (err) {
    console.error('Redis connection error:', err);
});

// const connectToDataBase = () => {
//     mongoose.connect("mongodb://localhost:27017")
//     .then(() => {
//         console.log("Connected To DB Sucessfully....")
//     })
//     .catch((err) => {
//         console.log(err)
//     })
// }
//module.exports = connectToDataBase
const connection = mysql.createPool({
    connectionLimit: 100,
    host: "db", // MySQL servisinin adı (Docker Compose'da belirttiğiniz)
    user: "root",
    port: "3306",
    password: "root", // MySQL servisi için bir şifre belirtmediğiniz için boş bırakın
    database: "app",
    port: 3306
  });

    // Oturum yönetimi için RedisStore oluştur
    const redisStore = new RedisStore({ client: redisClient });
  
    // Oturum yönetimi için express-session kullanımı
    app.use(session({
        store: redisStore,
        secret: 'secret$%^134',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, 
            httpOnly: false, 
            maxAge: 1000 * 60 * 10 
        }
    }));
    app.post('/register', (req, res) => {
        const { username, password } = req.body; // POST isteği ile gelen veriyi al
    
        // INSERT INTO sorgusunu gönder
        connection.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], (error, results) => {
            if (error) {
                console.error('Sorgu hatasi:', error);
                res.status(500).json({ error: 'Kayıt sırasında bir hata oluştu' });
                return;
            }
                res.status(200).json({ message: 'Kayıt başarıyla tamamlandı' });
            });
        });
    

  app.post("/login", (req, res) => {
      const { username, password } = req.body; // İstekten kullanıcı adı ve parola alınıyor
  
      connection.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
          if (err) {
              res.status(500).send('Sunucu hatası');
          } else {
              if (results.length > 0) {
                  // Kullanıcı doğrulandı, oturumu başlat
                  req.session.username = username;
                  res.send('Hoşgeldiniz, ' + username);
              } else {
                  res.status(401).send('Kullanıcı adı veya parola hatalı');
              }
          }
      });
  });
  
  
  // Ürünleri listeleme endpoint'i
  app.get('/products', (req, res) => {
    // MySQL sorgusu
    const query = `SELECT product_id, product_name FROM product`;
    connection.query(query, (err, results) => {
      if (err) {
        console.error('MySQL Error:', err);
        res.status(500).json({ error: 'Sunucu hatası' });
        return;
      }
  
      res.status(200).json(results);
    });
  });

  app.post('/order', (req, res) => {
    const { username, product_id, quantity } = req.body;

    // Kullanıcı bilgisini al
    const getUserQuery = `SELECT id FROM users WHERE username = ?`;
    connection.query(getUserQuery, [username], (err, userResults) => {
        if (err) {
            console.error('MySQL Error:', err);
            res.status(500).json({ error: 'Kullanıcı bilgisi alınamadı' });
            return;
        }

        if (userResults.length === 0) {
            res.status(404).json({ error: 'Kullanıcı bulunamadı' });
            return;
        }

        const userId = userResults[0].id;

        // Ürün bilgisini al
        const getProductQuery = `SELECT product_id, stock FROM product_detail WHERE product_id = ?`;
        connection.query(getProductQuery, [product_id], (err, productResults) => {
            if (err) {
                console.error('MySQL Error:', err);
                res.status(500).json({ error: 'Ürün bilgisi alınamadı' });
                return;
            }

            if (productResults.length === 0) {
                res.status(404).json({ error: 'Ürün bulunamadı' });
                return;
            }

            const stock = productResults[0].stock;

            // Sipariş miktarı stoktan fazla ise hata dön
            if (quantity > stock) {
                res.status(400).json({ error: 'Stokta yeterli ürün bulunmamaktadır' });
                return;
            }

            // Sipariş oluşturma ve stok düşme işlemi
            const createOrderQuery = `INSERT INTO \`order\` (user_id, product_id, quantity) VALUES (?, ?, ?)`;
            connection.query(createOrderQuery, [userId, product_id, quantity], (err, orderResults) => {
                if (err) {
                    console.error('MySQL Error:', err);
                    res.status(500).json({ error: 'Sipariş oluşturulurken bir hata oluştu' });
                    return;
                }

                const updateStockQuery = `UPDATE product_detail SET stock = stock - ? WHERE product_id = ?`;
                connection.query(updateStockQuery, [quantity, product_id], (err, updateResults) => {
                    if (err) {
                        console.error('MySQL Error:', err);
                        res.status(500).json({ error: 'Stok güncellenirken bir hata oluştu' });
                        return;
                    }

                    res.status(201).json({ message: 'Sipariş oluşturuldu ve stok düşüldü' });
                });
            });
        });
    });
});


const mongoose = require('mongoose'); 
const router = express.Router();
const { MongoClient } = require('mongodb');

const username = encodeURIComponent("bahar");
const password = encodeURIComponent("123456");
const url = `mongodb://${username}:${password}@mongodb:27017`;
let client;
let db;
async function connect() {
    let client;
    
    try {
        client = new MongoClient(url);
        await client.connect();
        console.log('MongoDB\'ye bağlandı');

        const db = client.db('commentDB'); // Bağlantı başarılıysa veritabanına erişim
        return db;
    } catch (error) {
        console.error('MongoDB\'ye bağlanırken hata oluştu:', error);
        if (error.message.includes('Authentication failed.')) {
            console.error('Kullanıcı adı ve şifrenizi kontrol edin');
        }
        process.exit(1);
    }
}
client = connect();


// Yorum Şeması ve Modeli
const ReviewSchema = new mongoose.Schema({
    order_id: {
      type: String,
      required: true
    },
    user_id: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    rating: {
      type: Number,
      required: true
    }
  });
  
  const Comment = mongoose.model('Comment', ReviewSchema);
  
  // Middleware - JSON verilerini işleme
  app.use(express.json());
  
  app.post('/review', async (req, res) => {
    const { order_id, user_id, content, rating } = req.body;
  
    try {
      const comment = new Comment({ order_id, user_id, content, rating });
      await comment.save();
      res.status(201).send('Yorum başarıyla eklendi');
    } catch (err) {
      console.error('Yorum ekleme hatası:', err);
      res.status(500).send('Yorum eklenirken bir hata oluştu');
    }
  });
  
  // Tüm yorumları getiren endpoint
  app.get('/comments', async (req, res) => {
    try {
      const comments = await Comment.find();
      res.json(comments);
    } catch (err) {
      console.error('Yorumlar getirme hatası:', err);
      res.status(500).send('Yorumlar getirilirken bir hata oluştu');
    }
  });

  app.get("/logout",(req,res)=>{
      req.session.destroy((err)=>{
          if(err)
          {
              res.send("error");
              return;
          }
          res.send("logout successful");
      });
  });

 // Oturum işlemleri tamamlandığında Redis istemcisini kapat
 process.on('SIGINT', function() {
    redisClient.quit(function () {
        console.log('Redis client closed');
        process.exit(0);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} numaralı portta çalışıyor`);
});