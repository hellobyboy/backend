import { response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshToken = async( userID ) =>{
    try {
        const user = await User.findById(userID)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating Access and Refresh tokens")
    }
}

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
    // console.log("Email: ", email);
    // console.log("password: ", password);
    
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
    const existedUser = await User.findOne({
        $or: [{ username },{ email}]
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists")
    }

    //✔️4
    // console.log("Files: ", req.files);
    
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

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
        password,
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



const loginUser = asyncHandler(async (req, res) => {
    
    // logic building | login controller
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie


    /*1. get user the data from the Frontend                       ✔️1
    2. validation - not empty                                    ✔️2
    3. check if the user already exists: username, email         ✔️3
    4. check if the password is correct                          ✔️4
    5. generate access token and refresh token                   ✔️5
    6. save the refresh token in the db                          ✔️6
    7. remove passowrd field from response                       ✔️7
    8. check for user creation                                   ✔️8
    9. return response(res)
     */


    const {email, username, password} = req.body
    if(!email || !username){
        throw new ApiError(400, "Email or Username is required")
    }

    const user = await User.findOne({
        $or: [{email}, {username}]
    })
    if(!user){
        throw new ApiError(404, "User not found")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid password")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser,
                accessToken,
                refreshToken
            },
            "User logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async (req, res) => {

    // logic building | logout controller
    // 1. clear the cookies
    // 2. update the refresh token in the db
    // 3. return response(res)

    User.findByIdAndUpdate(
        await req.user._id, {
            $set: {
                refreshToken: undefined
            },
            {
                new: true
            }
        }
    ) 
    
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User logged out successfully")
    )
})

export{ 
    registerUser, 
    loginUser,
    logoutUser 
}