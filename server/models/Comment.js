import mongoose from 'mongoose';
export default mongoose.model('Comment', new mongoose.Schema({
  documentId:String, owner:String, page:{type:Number,default:1}, x:Number, y:Number, text:String, author:String, resolved:{type:Boolean,default:false}
},{timestamps:true}));
