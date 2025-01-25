import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"


const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}))  // 16kb is the limit of the request body , the use of this is to parse the data from the form
app.use(express.urlencoded({extended: true, limit: "16kb"}))   // 16kb is the limit of the request body, the use urlencoded is to parse the data from the form
app.use(express.static("public")) // to serve static files , the use of this is to serve the images from the server
app.use(cookieParser())    // to parse the cookies from the request headers


//routes import

import userRouter from './routes/user.routes.js'


//routes declaration
app.use("/api/v1/users", userRouter)
//http://localhost:8000/api/v1/users/register

export {app}