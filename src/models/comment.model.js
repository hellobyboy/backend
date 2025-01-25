import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"; 

const commmentSchema = new Schema(
    {
        content: {
            type: String,
            required: true,
        },
        video: {
            type: Schema.Types.ObjectId,
            ref: "Video",
            // required: true,
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            // required: true,
        }
    },
    { 
        timestamps: true 
    }
);

commmentSchema.plugin(mongooseAggregatePaginate);

export const Comment = mongoose.model("Comment", commmentSchema);