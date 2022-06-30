// age: parseInt(age),
//external imports
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const ObjectId = require('mongodb').ObjectID;
const jwt = require('jsonwebtoken');

const port = process.env.PORT || 4000;

const app = express();
require('dotenv').config();

// writing utils function instead of middleware
const getEmailFromToken = (token) => {
  return 'email';
};

//database connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nlclv.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
// const client = new MongoClient(uri, { useUnifiedTopology: true}, { useNewUrlParser: true }, { connectTimeoutMS: 30000 }, { keepAlive: 1});
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 30000,
  keepAlive: 1,
});
// const client = new MongoClient(uri, { useUnifiedTopology: true}, { useNewUrlParser: true }, { connectTimeoutMS: 30000 }, { keepAlive: 1});

//middlewars
app.use(cors());
app.use(bodyParser.json());
// app.use((req, res, next) => {
//   res.header({"Access-Control-Allow-Origin": "*"});
//   next();
// })
// app.use(bodyParser.urlencoded({
//   extended: true
// }));

app.get('/', (req, res) => res.send('Hello World!'));

client.connect((err) => {
  const userCollection = client.db('powerHack').collection('usersData');
  const billingCollection = client
    .db('powerHack')
    .collection('billingCollection');

  app.post('/api/registration', (req, res) => {
    // fullName,email, age, address, phone, role, nid, profile,vehicleType
    const fullName = req.body.fullName;
    const email = req.body.email;
    const password = bcrypt.hash(req.body.password, 10);
    userCollection.find({ email: email }).toArray((err, users) => {
      if (users.length == 0) {
        userCollection
          .insertOne({
            fullName,
            email,
            password,
          })
          .then((result) => {
            // console.log(result);
            const token = jwt.sign({ email: email }, process.env.JWT_SECRET, {
              expiresIn: process.env.JWT_EXPIRY,
            });
            res.status(200).send(token);
          });
      } else {
        res.send('email already in use');
      }
    });
  });

  app.post('/api/login', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    userCollection.find({ email: email }).toArray((err, user) => {
      if (user && user.length > 0) {
        if (password === user.password) {
          const token = jwt.sign({ email: email }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRY,
          });
          res.status(200).send(token);
        } else {
          res.send('Failed');
        }
      } else {
        res.send('user not found');
      }
    });
  });

  app.post('/api/billing-list', (req, res) => {
    let { query, pageNumber } = req.body;
    var perPage = 10;

    // get records to skip
    var startFrom = pageNumber * perPage;
    // get data from mongo DB using pagination
    billingCollection
      .find({
        $or: [
          {
            fullName: { $regex: `.*${query}*` },
          },
          {
            phone: { $regex: `.*${query}*` },
          },
          {
            email: { $regex: `.*${query}*` },
          },
          {
            paidAmount: { $regex: `.*${query}*` },
          },
        ],
      })
      .skip(startFrom)
      .limit(perPage)
      .toArray()
      .then((response) => {
        res.status(200).send(response);
      })
      .catch((err) => res.send('Failed'));
  });

  app.post('/api/add-billing', (req, res) => {
    // const order = req.body;
    const { fullName, email, phone, ownerEmail, paidAmount } = req.body;
    billingCollection
      .insertOne({
        fullName,
        email,
        phone,
        ownerEmail,
        paidAmount: parseInt(paidAmount),
      })
      .then((result) => {
        res.status(200).send(result);
      })
      .catch((err) => {
        console.log(err);
        res.send('Failed');
      });
  });

  app.put('/api/update-billing/:id', async (req, res) => {
    const id = req.body.id;
    const fullName = req.body.fullName;
    const email = req.body.email;
    const phone = req.body.phone;
    const ownerEmail = req.body.ownerEmail;
    const paidAmount = parseInt(req.body.paidAmount);

    billingCollection
      .updateOne(
        { id: req.params.id },
        {
          $set: {
            // _id: ObjectId(`${req.params.id}`),
            fullName,
            email,
            phone,
            paidAmount,
            ownerEmail,
          },
        }
      )
      .then((response) => {
        res.send(response);
      });
  });

  app.delete('/api/delete-billing/:id', async (req, res) => {
    // db.test_users.deleteOne( {"_id": ObjectId("4d512b45cc9374271b02ec4f")});
    await billingCollection.deleteOne({
      _id: ObjectId(`${req.params.id}`),
    });
    return res.status(200).send({ success: true });
  });

  console.log('database connected successfully');
  // client.close();
});

app.listen(port, () =>
  console.log(`Example app listening at http://localhost:${port}`)
);
// app.listen(port, () =>
//   console.log(`Example app listening at http://localhost:${port}`)
// );