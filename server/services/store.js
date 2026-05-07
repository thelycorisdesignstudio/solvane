import mongoose from 'mongoose';import {randomUUID} from 'crypto';
export const mem={users:[],docs:[],signatures:[],generated:[]};export const mongoReady=()=>mongoose.connection.readyState===1;export const id=()=>randomUUID();
