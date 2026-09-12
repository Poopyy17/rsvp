require('dotenv').config()

const express = require('express')
const cors = require('cors')

const connectDB = require('./db')
const routes = require('./routes')

const app = express()

app.use(cors())
app.use(express.json())
app.use('/api', routes)

app.get('/', (req, res) => {
  res.send('RSVP API is running.')
})

const PORT = process.env.PORT || 3001

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err)
    process.exit(1)
  })
