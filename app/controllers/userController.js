const mongoose = require('mongoose');
const shortid = require('shortid');
const time = require('../libs/timeLib');
const response = require('../libs/responseLib');
const logger = require('../libs/loggerLib');
const validateInput = require('../libs/paramsValidationLib');
const check = require('../libs/checkLib');
const axios = require('axios')
const tf = require("@tensorflow/tfjs");
const callKnn = require('../knn-tf/knn_ml').callKnn
const moment = require('moment')


/* Models */
const User = require('../models/User');

// start user signup function 

let signUpFunction = async (req, res) => {
  
    let newUser = new User(req.body);

    try{
        let token = await newUser.generateAuthToken();
        await newUser.save();
        logger.info('You are successfully registered','userController: signup',1);
        let apiResponse = response.generate(false,'You are successfully registered',200,{newUser,token});
        res.send(apiResponse);
        

    }
    catch(e){
        console.log(e)
        let apiResponse = response.generate(true,e,500,null);
        logger.error('Not able to sign-up','userController:signup',5)
        res.status('500').send(apiResponse);
    }

};// end user signup function 

// start of login function 
let loginFunction = async (req, res) => {

    // if(check.isEmpty(req.body.email)){
    //     throw Error('Enter email id')
    // }
    // if(check.isEmpty(req.body.password)){
    //     throw Error('Enter password...')
    // }

    try{
        let user = await User.findByCredentials(req.body.email,req.body.password);
        const token = await user.generateAuthToken();
        setToken(res,user,token)
        logger.info(`You are successfully logged in ${user}','userController: login`,1);
        let apiResponse = response.generate(false,'You are successfully logged in',200,{user,token});
        res.send(apiResponse);
    }
    catch(e){
        res.status('500').send('User id or password is wrong');
        logger.error('Not able to login','userController:login',5)
        console.log(e)
    }
};


// end of the login function 


let logout = async (req, res) => {
    console.log('logout-called',req.loggedInUser)
    try{
        req.loggedInUser.tokens = req.loggedInUser.tokens.filter((token)=>{
            return token.token !== req.token;
        });
        await req.loggedInUser.save();
        logger.info(`You are successfully logged out ${req.loggedInUser}','userController: logout`,1);
        res.status('200').send('successfully logout');
    }catch(e){
        res.status('501').send(e);
        logger.error('Not able to logout','userController:logout',5)
    }

}; // end of the logout function.

let getProfile = async (req,res) => {

    let uuid = req.params.id;

    try {
        let result = await User.findOne({uuid});
        res.send(result)
    }catch(e){
        console.log(e)
    }
};

let updateProfile = async (req,res) => {
    console.log('update profile')
    let loggedInUser = req.body.loggedInUser;
    const lastAddress = loggedInUser.address[0]
      try {
        let user = await User.findOne({_id: loggedInUser._id});
        if(loggedInUser.address && loggedInUser.address.length === 1){
            const splittedAddress = lastAddress.address.split(' ').join('+')
            const loc = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${splittedAddress}+${lastAddress.city}+${lastAddress.state}&key=AIzaSyADPRYiIo9c6t4R9aoyo4INvh_3H8taDhI`);
            loggedInUser.address[0].location =  loc.data ? loc.data.results[0].geometry.location : ''
        }
        if(loggedInUser.orders > user.orders ){
            console.log('if order added')
            let timeDurationToReachOrder
            const result = await callKnn(tf.tensor([lastAddress.location.lat,lastAddress.location.lng])) 
            const lastOrderTime = new Date(loggedInUser.orders[loggedInUser.orders.length -1].time*1000).getHours() 
            if(lastOrderTime >= 20 && lastOrderTime < 23){
                timeDurationToReachOrder = 10*60*60 + result    
            }   
            if(lastOrderTime >= 00 && lastOrderTime <= 4){
                timeDurationToReachOrder = 10*60*60 + result    
            }
            if(lastOrderTime > 4 && lastOrderTime <= 16){
                timeDurationToReachOrder = 4*60*60 + result    
            }
            if(lastOrderTime > 16 && lastOrderTime < 20){
                timeDurationToReachOrder = 2*60*60 + result    
            }
            const time = moment().add(+timeDurationToReachOrder, 'seconds').calendar()
            loggedInUser.orders[loggedInUser.orders.length -1]['orderDeliveryTime'] = time            
        }
        let result = await User.findByIdAndUpdate(loggedInUser._id,loggedInUser);
        res.send(result);
    }catch(e){
        console.log(e)
    }

};

let setToken = (res, user, token) => {
  res.cookie("access_token", token, {
    httpOnly: true,
  });
//   redis.set(
//     user.id,
//     JSON.stringify({
//       access_token: token,
//       expires: 60,
//     }),
//     redis.print
//   );
};

let addAddress = async(req,res) => {
    console.log(req.body)
    try {
      const result = await User.update({ email: req.body.email }, { $push: { address:req.body.address } });
      res.send(result)
    } catch (e) {
      res.status("500").send(e);
    }
   
}

module.exports = {

    signUpFunction: signUpFunction,
    loginFunction: loginFunction,
    logout: logout,
    getProfile:getProfile,
    updateProfile:updateProfile,
    addAddress
};// end exports