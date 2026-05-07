import mongoose from 'mongoose';
export default mongoose.model('DocumentPolicy', new mongoose.Schema({
  documentId:String, owner:String, passwordHint:String, restrictions:{print:Boolean,download:Boolean,copy:Boolean}, classification:String, expiresAt:Date
},{timestamps:true}));
