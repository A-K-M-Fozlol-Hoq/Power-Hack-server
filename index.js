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
  const token2 = token.split(' ')[1];
  const decoded = jwt.verify(token2, process.env.JWT_SECRET);
  const { email } = decoded;
  return email;
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
  //   keepAlive: 1,
  keepAlive: true,
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

  app.post('/api/registration', async (req, res) => {
    // fullName,email, age, address, phone, role, nid, profile,vehicleType
    const fullName = req.body.fullName;
    const email = req.body.email;
    const password = await bcrypt.hash(req.body.password, 10);
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
            var token = jwt.sign({ email }, process.env.JWT_SECRET, {
              expiresIn: process.env.JWT_EXPIRE, // expires in 365 days
            });

            // const token = jwt.sign({ email: email }, process.env.JWT_SECRET, {
            //   expiresIn: '1d',
            //   //   expiresIn: process.env.JWT_EXPIRY,
            // });
            return res.status(200).send({ token: token });
          });
      } else {
        res.send({ msg: 'email already in use' });
      }
    });
  });

  app.post('/api/login', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    userCollection.find({ email: email }).toArray(async (err, user) => {
      if (user && user.length > 0) {
        const isValidPassword = await bcrypt.compare(
          password,
          user[0].password
        );

        if (isValidPassword) {
          var token = jwt.sign({ email }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRE, // expires in 365 days
          });
          return res.status(200).send({ token: token });
        } else {
          res.send({ msg: 'Failed' });
        }
      } else {
        res.send({ msg: 'user not found' });
      }
    });
  });

  app.post('/api/billing-list', (req, res) => {
    let { query, pageNumber } = req.body;
    var perPage = 10;
    const ownerEmail = getEmailFromToken(req.headers.token);
    // get records to skip
    var startFrom = pageNumber * perPage;
    // get data from mongo DB using pagination
    if (query) {
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
          ],
          $and: [
            {
              ownerEmail: ownerEmail,
            },
            // {age:{$gt:minAge,$lt:maxAge}}
          ],
        })
        .skip(startFrom)
        .limit(perPage)
        .toArray()
        .then((response) => {
          res.status(200).send(response);
        })
        .catch((err) => res.send({ msg: 'Failed' }));
    } else {
      billingCollection
        .find({
          ownerEmail: ownerEmail,
        })
        .skip(startFrom)
        .limit(perPage)
        .toArray()
        .then((response) => {
          res.status(200).send(response);
        })
        .catch((err) => res.send({ msg: 'Failed' }));
    }
  });

  app.post('/api/add-billing', (req, res) => {
    // const order = req.body;
    const { fullName, email, phone, paidAmount } = req.body;
    const ownerEmail = getEmailFromToken(req.headers.token);
    // console.log(ownerEmail);
    if (fullName && email && phone && ownerEmail && paidAmount) {
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
          res.send({ msg: 'Internal server error' });
        });
    } else {
      res.send({ msg: 'Please Send all data properly' });
    }
  });

  app.put('/api/update-billing/:id', async (req, res) => {
    const fullName = req.body.fullName;
    const email = req.body.email;
    const phone = req.body.phone;
    const paidAmount = parseInt(req.body.paidAmount);
    const ownerEmail = getEmailFromToken(req.headers.token);
    // console.log({
    //   fullName,
    //   email,
    //   phone,
    //   paidAmount,
    //   ownerEmail,
    //   id: req.params.id,
    // });
    billingCollection
      .updateOne(
        // { id: req.params.id },
        { _id: ObjectId(`${req.params.id}`) },
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
    // console.log({ _id: ObjectId(`${req.params.id}`) });
    await billingCollection.deleteOne({
      _id: ObjectId(`${req.params.id}`),
    });
    return res.status(200).send({ success: true });
  });

  console.log({ msg: 'database connected successfully' });
  // client.close();
});

app.listen(port, () =>
  console.log(`Example app listening at http://localhost:${port}`)
);
// app.listen(port, () =>
//   console.log(`Example app listening at http://localhost:${port}`)
// );
