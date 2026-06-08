const express = require('express')
const dotenv = require("dotenv")
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const port = process.env.PORT




const uri = process.env.MONGODB_URI

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)

console.log("JWKS", JWKS)




// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


const logger = (req, res, next) => {
  console.log(`${req.method} | ${req.url}`)
  next()
}

const verifyToken = async (req, res, next) => {

  const { authorization } = req.headers
  // console.log(req.headers)

  const token = authorization?.split(" ")[1]
  console.log(token)



  if (!token) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  try {
    const JWKS = createRemoteJWKSet(
      new URL('http://localhost:3000/api/auth/jwks')
    )
    const { payload } = await jwtVerify(token, JWKS)
    req.user = payload;

    next()

  } catch (error) {
    console.error('Token validation failed:', error)
    return res.status(401).json({ message: "Unauthorized" })
  }


}





async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const db = client.db("studynookdb")
    const roomsCollection = db.collection("rooms")
    const bookingCollection = db.collection("bookings")

    // app.get("/rooms", async (req, res) => {

    //   const { search, amenities } = req.query;

    //   let cursor
    //   if (search) {
    //     cursor = roomsCollection.find({
    //       room_name: {
    //         $regex: search,
    //         $options: "i"
    //       }
    //     })
    //   }

    //   if (amenities) {
    //     query.amenities = {
    //       $in: [amenities],
    //     };
    //   }


    //   else {
    //     cursor = roomsCollection.find()

    //   }




    //   const result = await cursor.toArray()
    //   console.log(result)


    //   // console.log(result)
    //   res.send(result)
    // })



    app.get("/rooms", async (req, res) => {
      const { search, amenities } = req.query;

      let query = {};


      if (search) {
        query.room_name = {
          $regex: search,
          $options: "i",
        };
      }


      if (amenities) {
        const amenitiesArray = amenities.split(",");

        query.amenities = {
          $in: amenitiesArray,
        };
      }

      const result = await roomsCollection.find(query).toArray();

      res.send(result);
    });



    app.get("/availablerooms", async (req, res) => {
      const cursor = roomsCollection.find().sort({ _id: -1 }).limit(6)
      const result = await cursor.toArray()
      res.send(result)
    })


    app.get("/rooms/:roomsId", logger, verifyToken, async (req, res) => {

      console.log(req.user, "req")

      const { roomsId } = req.params;

      const query = { _id: new ObjectId(roomsId) }
      const result = await roomsCollection.findOne(query)
      res.send(result);
    })


    // my listings
    app.get("/my-listings/:email",verifyToken, async (req, res) => {
      const { email } = req.params;

      console.log(email)
  
      if (req.user.email !== email) {
        return res.status(401).send({
          message: "Unauthorized"
        });
      }

      const result = await roomsCollection.find({ ownerEmail: email }).toArray();

      res.send(result);
    });



    // update room details
    app.patch("/rooms/:roomsId", verifyToken, async (req, res) => {

      const { roomsId } = req.params
      const updatedData = req.body

      const result = await roomsCollection.updateOne(
        { _id: new ObjectId(roomsId) },
        { $set: updatedData }
      )

      res.send(result)


    })

    // delete room details
    app.delete("/rooms/:roomsId", verifyToken, async (req, res) => {

      const { roomsId } = req.params
      const result = await roomsCollection.deleteOne({ _id: new ObjectId(roomsId) })

      res.send(result);

    })


    // database for add rooms
    app.post("/add-room", verifyToken, async (req, res) => {
      const roomData = req.body
      console.log(roomData)
      const result = await roomsCollection.insertOne(roomData)
      res.send(result)

    })

    // for storing booking data and checking booking conflict
    app.post("/booking", async (req, res) => {
      const bookingData = req.body

      const {
        room_name,
        bookingDate,
        startTime,
        endTime
      } = bookingData;

      // const conflict = await bookingCollection.findOne({
      //   room_name,
      //   bookingDate,
      //   status: "confirmed",

      //   startHour: { $lte: endHour },
      //   endHour: { $gte: startHour }

      // });

      // if (conflict) {
      //   return res.status(400).send({
      //     success: false,
      //     message: "This room is already booked for this time slot"
      //   })
      // }



      const newBookingData = {
        ...bookingData,
        status: "confirmed",
        createdAt: new Date()
      }

      const result = await bookingCollection.insertOne(newBookingData)
      res.send(result)

    })


    // for getting booking data
    app.get("/booking/:userId",verifyToken, async (req, res) => {
      const { userId } = req.params
      const result = await bookingCollection.find({ userId: userId }).toArray()
      res.send(result)

    })

    // for deleting booking data
    app.patch("/booking/:bookingId", async (req, res) => {
      const { bookingId } = req.params;
      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(bookingId) },
        { $set: { status: "cancelled" } }
      )

      res.send(result)
    })






    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Hello World!')
})


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})



