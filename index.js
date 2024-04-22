const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
// const stripe = require("stripe")(process.env.STRIPE_SECRECT_KEY)
const stripeSecretKey = "sk_test_51P0kprLOD0pcFdhKUPRrkddmMgDnX555pE26tRkdzmfMFeKVxEET2otiKB4HWNYLpzYYScPHOYZiR0B54XLBZFmR00IGEjYRUD";
const stripe = require("stripe")(stripeSecretKey);
const port = process.env.PORT || 5000;

// middleware

// app.use(
//   cors({
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], // Include PATCH method
//     origin: "http://localhost:5173", // Allow requests from this origin
//   })
// );
app.use(cors({
  origin: [
    "http://localhost:5173"
    ,
 ' https://bistro-restaurant-client.vercel.app/'
],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// const corsOptions = {
//   origin: 'http://localhost:5173',
//   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true // Allow credentials
// };

// app.use(cors(corsOptions));


app.use(express.json());
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.thodmul.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
console.log(process.env.DB_USER);
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const menuCollection = client.db("bistroRdb").collection("menu");
    const reviewCollection = client.db("bistroRdb").collection("review");
    const cartCollection = client.db("bistroRdb").collection("carts");
    const usersCollection = client.db("bistroRdb").collection("users");
    const paymentsCollection = client.db("bistroRdb").collection("payments");
    // jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, {
        expiresIn: "365d",
      });
      res.send({ token });
    });

    // middleware
    const verifyToken = (req, res, next) => {
      //   console.log("verifyToken", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden" });
      }
      const token = req.headers.authorization.split(" ")[1];
      //   if(!token){
      //     return res.status(401).send({message: 'forbidden'});
      //   }
      jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "forbidden access " });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(401).send({ message: "forbidden access " });
      }
      next();
    };

    // user Api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      // console.log(req.headers);
      const user = await usersCollection.find().toArray();
      res.send(user);
    });
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access " });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    // menu related api
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result);
    });

    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });
    app.patch('/menu/:id', async (req, res) => {
        const item = req.body;
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: {
                name: item.name,
                price: item.price,
                recipe: item.recipe,
                image: item.image,
                category: item.category
            }
        };
        try {
            const result = await menuCollection.updateOne(filter, updateDoc);
            res.send(result);
        } catch (error) {
            console.error("Error updating document:", error);
            res.status(500).send("Error updating document");
        }
    });
    

    app.get("/review", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // stripe payment
   
    app.post('/create-payment-intent',async(req,res)=>{
      const {price}=req.body;
      // console.log(price);

      const amount = parseInt(price*100);
      // console.log(amount);//because stripe always count pisa
      const paymentIntents = await stripe.paymentIntents.create({
        amount:amount,
        currency:'usd',
        payment_method_types:['card']
      });
      res.send({
        clientSecret: paymentIntents.client_secret
      })
    })

  app.post('/payments', async (req, res) => {
    try {
        const payment = req.body;
        const result = await paymentsCollection.insertOne(payment);

        // Assuming paymentsCollection and cartCollection are defined elsewhere

        const query = { _id: { $in: payment.cartId.map(id => new ObjectId(id)) } };
        const deletePayment = await cartCollection.deleteMany(query);

        // Send a response indicating success
        res.status(200).json({ result, deletePayment });
    } catch (error) {
        console.error("Error inserting payment:", error);
        // Send a response indicating failure
        res.status(500).json({ error: "Error inserting payment" });
    }
});
app.get('/payments/:email',verifyToken, async (req, res) => {
  const query = {email : req.params.email}
  if(req.params.email !==req.decoded.email){
    return res.status(403).send({message:'forbidden access'})
  }
  const result = await paymentsCollection.find(query).toArray();
  res.send(result);
})

// static analysis
app.get('/admin_analytics', async (req, res) => {

  const users = await usersCollection.estimatedDocumentCount();
  const menuItems = await menuCollection.estimatedDocumentCount();
  const orders = await paymentsCollection.estimatedDocumentCount();

  const result = await paymentsCollection.aggregate([

    {
      $group:{
        _id : null,
        totalRevenue:{
          $sum:'$price'
        }
      }
    }
  ]).toArray();
  const revenue = result.length >0 ? result[0].totalRevenue.toFixed(2):0;

  res.send({
    
    menuItems,
    orders,
    revenue,
    users
  })
})

// using aggregate pipeline

app.get('/order_stats', async (req, res) => {
  const result = await paymentsCollection.aggregate([
    {
      $unwind:'$menuId',
    },
    {
      $lookup: {
        from: 'menu',
        localField: 'menuId',
        foreignField: '_id',
        as: 'menuItems'
      }
    },
    {
      $unwind:'$menuItems'
    },
    {
      $group:{
        _id:'$menuItems.category',
        quantity:{
          $sum :1
        },
        revenue :{$sum:'$menuItems.price'}
      }
    }
  ]).toArray();
  res.send(result);
})


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("boss is running");
});

app.listen(port, () => {
  console.log(`listening on ${port}`);
});
