import mongoose from 'mongoose';
export default mongoose.model('Share', new mongoose.Schema({
  documentId:String, owner:String, token:{type:String,unique:true}, permission:{type:String,default:'view'}, expiresAt:Date, revoked:{type:Boolean,default:false}
},{timestamps:true}));
