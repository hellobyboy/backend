import { response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    // res.status(200).json({
    //     message: "ok kashaf"
    // })

    // logic building | register controller
    // 1. get user the data from the Frontend                       ✔️1
    // 2. validation - not empty                                    ✔️2
    // 3. check if the user already exists: username, email         ✔️3
    // 4. check for image, check for avatar                         ✔️4
    // 5. upload them to coludinary, avatar                         ✔️5   
    // 6. create user object - create entry in the database(db)     ✔️6
    // 7. remove passowrd and refresh token field from response     ✔️7
    // 8. check for user creation                                   ✔️8
    // 9. return response(res)

    //✔️1
    const {fullName, email, username, password} = req.body
    console.log("Email: ", email);
    
    // if(fullName === ""){
    //     throw new ApiError(400, "Full Name is required")
    // }

    //✔️2
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "" )
    ){
        throw new ApiError(400, "All fields are required")
    }

    //✔️3
    const existedUser = User.findOne({
        $or: [{ username },{ email}]
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists")
    }

    //✔️4
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    // console.log("Avatar Path: ", avatarLocalPath);
    // console.log("Cover Image Path: ", coverImageLocalPath);

    if (!avatarLocalPath){
        throw new ApiError(400, "Avatar is required")
    }

    //✔️5
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    
    if (!avatar){
        throw new ApiError(400, "Avatar is required")
    }

    //✔️6
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url  || "",
        email,
        passowrd,
        username: username.toLowerCase()
    })

    //✔️7
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //✔️8
    if(!createdUser){
        throw new ApiError(500, "something went wrong whil registring the user")
    }

    // ✔️9
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
})



export{ registerUser, }