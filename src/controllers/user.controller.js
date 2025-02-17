import { response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary, deleteOnCloudinary  } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userID) => {
    try {
        const user = await User.findById(userID)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

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
    const { fullName, email, username, password } = req.body
    // console.log("Email: ", email);
    // console.log("password: ", password);

    // if(fullName === ""){
    //     throw new ApiError(400, "Full Name is required")
    // }

    //✔️2
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    //✔️3
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    //✔️4
    // console.log("Files: ", req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    // console.log("Avatar Path: ", avatarLocalPath);
    // console.log("Cover Image Path: ", coverImageLocalPath);

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required")
    }

    //✔️5
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar is required")
    }

    //✔️6
    const user = await User.create({
        fullName,
        avatar: {
            public_id: avatar.public_id,
            url: avatar.secure_url
        },
        coverImage: {
            public_id: coverImage?.public_id || "",
            url: coverImage?.secure_url || ""
        },
        email,
        password,
        username: username.toLowerCase()
    })

    //✔️7
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //✔️8
    if (!createdUser) {
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


    const { email, username, password } = req.body
    console.log(email);

    if (!email && !username) {
        throw new ApiError(400, "Email or Username is required")
    }

    // Here is an alternative of above code based on logic discussed in video:
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")
        
    // }

    const user = await User.findOne({
        $or: [{ email }, { username }]
    })
    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

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
        await req.user._id, 
        {
            // $set: {     // what is difference between $set and $unset ? ans is $set is used to update the field and $unset is used to remove the field
            //     refreshToken: undefined
            // }
            $unset: {
                refreshToken: 1 //this remove the field from document
            }
        }, 
        {
            new: true
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

const refreshAccessToken = asyncHandler(async (req, res) => {


    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken._id)
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (user.refreshToken !== incomingRefreshToken) {
            throw new ApiError(401, "Refresh token is expired or used") 
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(200, {accessToken, refreshToken: newRefreshToken}, "Access token refreshed successfully")
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
        
    }


})


const changeCurrentPassword = asyncHandler(async (req, res) => {

    const {oldPassword, newPassword } = req.body

    // if(!(newPassword === confPassword)){
    //     throw new ApiError(400, "Passwords do not match")
    // }

    const user = await User.findByIdAndUpdate(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))

})

const getCurrentUser = asyncHandler(async (req, res) => {

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user, 
        "current User fetched successfully"
    ))

})

const updateAccountDetails = asyncHandler(async (req, res) => {

    const {fullName, email } = req.body

    if(!fullName || !email){
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id, 
        {
            $set: {
                fullName,
                email: email
            }
        }, 
        {
            new: true
        }
    ).select("-password ")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))

})

const updateUserAvatar = asyncHandler(async (req, res) => {

    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required")
    }

    // ToDO: Delete the previous avatar from cloudinary

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }
    const user = await User.findById(req.user._id).select("avatar");
    const avatarToDelete = user.avatar.public_id;

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: {
                    public_id: avatar.public_id,
                    url: avatar.secure_url
                
                }
            }
        },
        {
            new: true
        }
    ).select("-password")

    if (avatarToDelete && updatedUser.avatar.public_id) {
        await deleteOnCloudinary(avatarToDelete);
    }

    return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler(async (req, res) => {

    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, " cover image file is missing")
    }
    
    // TODO : Delete the previous cover image from cloudinary
    
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findById(req.user._id).select("coverImage");
    const coverImageToDelete = user.coverImage.public_id;

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: {
                    public_id: coverImage.public_id,
                    url: coverImage.secure_url
                }
            }
        },
        {
            new: true
        }
    ).select("-password")

    if (coverImageToDelete && updatedUser.coverImage.public_id) {
        await deleteOnCloudinary(coverImageToDelete);
    }

    return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Cover image updated successfully"))
})

const getUserChannelProfile = asyncHandler(async (req, res) => {

    const { username } = req.params
    if(!username?.trim()){
        throw new ApiError(400, "Username is missing")
    }

    // Ensure req.user and req.user._id are defined
    if (!req.user || !req.user._id) {
        throw new ApiError(401, "Unauthorized");
    }

    const channel = await User.aggregate([
        {
            $match:{
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from: "subscriptions",    //from the subscription model
                localField: "_id",        // local field of the user
                foreignField: "channel",   // foreign field of the subscription
                as: "subscribers"          // store the result in subscribers, data like who has subscribed to this channel
            }
        },
        {
            $lookup:{
                from: "subscriptions",      // from the subscription model
                localField: "_id",      // local field of the user
                foreignField: "subscriber",    // foreign field of the subscription
                as: "subscribedTo"    // store the result in subscribedTo, data like to whom this channel has subscribed
            }
        },
        {
            $addFields:{
                subscriberCount:{
                    $size: "$subscribers"
                },
                channelsSubscribedToCount:{
                    $size: "$subscribedTo"
                },
                isSubscribed:{    // check if the logged in user is subscribed to this channel or not // the logic is to check if the logged in user is in the list of subscribers or not
                    $cond:{
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project:{
                fullName: 1,
                username: 1,
                subscriberCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])
    console.log(channel);

    if(!channel?.length){
        throw new ApiError(404, "Channel does not exists")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "Channel profile fetched successfully"))
    
    
    
})

const getWatchHistory = asyncHandler(async (req, res) => {


    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.objectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200, 
            user[0].watchHistory, 
            "Watch history fetched successfully"
        )
    )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}