import mongoose from 'mongoose';
export default mongoose.model('Team', new mongoose.Schema({
  owner:String, name:String, members:[{email:String, role:{type:String,default:'viewer'}, invitedAt:Date}]
},{timestamps:true}));
