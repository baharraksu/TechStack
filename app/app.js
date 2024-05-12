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

const connectToDataBase = () => {
    mongoose.connect("mongodb://localhost:27017")
    .then(() => {
        console.log("Connected To DB Sucessfully....")
    })
    .catch((err) => {
        console.log(err)
    })
}
module.exports = connectToDataBase
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
    
            // Kullanıcı başarıyla kaydedildi, Redis'e de kaydedelim
            redisClient.set(username, password, (err, reply) => {
                if (err) {
                    console.error('Redis hatası:', err);
                    res.status(500).json({ error: 'Redis\'e kaydedilirken bir hata oluştu' });
                    return;
                }
                res.status(200).json({ message: 'Kayıt başarıyla tamamlandı' });
            });
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