//import with typescript
// import { TeamSpeak, QueryProtocol } from "ts3-nodejs-library"
//import with javascript
const {
  TeamSpeak,
  TeamSpeakClient,
} = require("ts3-nodejs-library");
require("dotenv").config({ path: "./.env" });
const TEAMSPEAK_KEY = process.env.TEAMSPEAK_KEY;
const SERVERQUERY_USER = process.env.SERVERQUERY_USER;
const SERVERQUERY_PASS = process.env.SERVERQUERY_PASS;

const teamspeak = new TeamSpeak({
  host: "ts.vzdc.org",
  serverport: 9987,
  username: SERVERQUERY_USER,
  password: SERVERQUERY_PASS,
  nickname: "vZDC Bot",
});

const positionUpdate = async () => {
  const clients = await teamspeak.clientList({ clientType: 0 });
  

  clients.forEach(async (client) => {
    const clientUid = TeamSpeakClient.getUid(client);
    const clientDbid = await teamspeak.clientGetDbidFromUid(clientUid);
    const channelID = (await client.getInfo()).clientChannelGroupInheritedChannelId;

    const trainingChannels = ['56','62','92','58','55','61','478','89'];

    const data = await fetch(
      `https://vzdc.org/api/teamspeak?key=${TEAMSPEAK_KEY}`,
      {
        method: "POST",
        body: clientUid,
      }
    ).then((res) => res.json())
    .catch((err) => console.log(err));

    const position = data.onlinePosition;

    const serverGroupsById = await teamspeak.serverGroupsByClientId(clientDbid.cldbid);

    if (trainingChannels.includes(channelID)){
      checkSweatbox(client, data, serverGroupsById);
      return;
    }

    if(serverGroupsById.some((item)=>item.name==="SWEATBOX 1")){
      client.delGroups(1053);
    }else if(serverGroupsById.some((item)=>item.name==="SWEATBOX 2")){
      client.delGroups(1054);
    }

    dataUpdate(client, data, serverGroupsById);


    if (position) {
      if (serverGroupsById.some((item)=> item.name===position)){
        return;
      }

      const previousPosition = serverGroupsById.find((item) => item.name.includes("_"));
      
      if (previousPosition && previousPosition.name !== position){
        removePosition(client);
      }

      const groupExists = await teamspeak.getServerGroupByName(position);
      if (groupExists){
        try{
          groupExists.addClient(client);
          // return;
        }catch(err){
          console.log("error in groupExists");
          console.log(err.msg);
          console.log(groupExists);
          console.log(client);
          console.log(serverGroupsById.some((item)=> item.name===position));
          // return;
        }
        return;
      }

      try {
        const createdServerGroup = await teamspeak.serverGroupCreate(position);
        await createdServerGroup.addPerm({
          permname: "i_group_show_name_in_tree",
          permvalue: 1,
          skip: false,
          negate: false,
        });
        // await createdServerGroup.delPerm('b_group_is_permanent');
        await createdServerGroup.addClient(client);
      } catch(err) {
        console.log(position);
        console.log(client.nickname);
        console.log(err.msg);
      }
    }else{
      removePosition(client);
    }
  });
}

const checkSweatbox = async (client, data, serverGroupsById) => {
  const sweatboxOne = await fetch('https://sweatbox1.env.vnas.vatsim.net/data-feed/controllers.json')
  .then((res) => res.json())
  .catch((err) => console.log("couldn't pull from sweatbox 1", err));

  const sweatboxTwo = await fetch('https://sweatbox2.env.vnas.vatsim.net/data-feed/controllers.json')
  .then((res) => res.json())
  .catch((err) => console.log("couldn't pull from sweatbox 2", err));

  const sweatboxOneData = sweatboxOne.controllers.filter((obj)=>obj.artccId === 'ZDC' && obj.vatsimData.realName !== 'None')
  const sweatboxTwoData = sweatboxTwo.controllers.filter((obj)=>obj.artccId === 'ZDC' && obj.vatsimData.realName !== 'None')

  sweatboxOneData.forEach((sweatboxUser)=>{
    if(sweatboxUser.vatsimData.cid === data.cid){
      client.addGroups(1053);
    }
  })

  if(serverGroupsById.some((item)=>item.name==="SWEATBOX 1" && sweatboxOneData.length === 0)){
    client.delGroups(1053);
  }

  sweatboxTwoData.forEach((sweatboxUser)=>{
    if(sweatboxUser.vatsimData.cid === data.cid){
      client.addGroups(1054);
    }
  })

  if(serverGroupsById.some((item)=>item.name==="SWEATBOX 2" && sweatboxTwoData.length === 0)){
    client.delGroups(1054);
  }

}


const clearRatings = async (client) => {
  const ratings = ["Observer","Tower Trainee","Tower Controller","Radar Controller","Controller","Senior Controller","Instructor","Senior Instructor"];
  const clientUid = TeamSpeakClient.getUid(client);
  const clientDbid = await teamspeak.clientGetDbidFromUid(clientUid);

  const serverGroupsById = await teamspeak.serverGroupsByClientId(clientDbid.cldbid);

  serverGroupsById.forEach(async (serverGroup)=>{
    if(ratings.includes(serverGroup.name)){
      client.delGroups(await teamspeak.getServerGroupByName(serverGroup.name));
    }
  })
}

const removePosition = async (client) => {
  try{
    const clientDbid = client.propcache.clientDatabaseId;

    const serverGroupsById = await teamspeak.serverGroupsByClientId(clientDbid);

    const positionToDelete = serverGroupsById.find((item) => item.name.includes("_"));

    if(positionToDelete){
      console.log("position to delete:", positionToDelete);
      await teamspeak.serverGroupDelClient(clientDbid, positionToDelete.sgid);
      await teamspeak.serverGroupDel(positionToDelete.sgid);
    }
  }catch(err){
    console.log(new Date().toLocaleTimeString(), "error in removePosition")
    console.log(client.propcache);
    console.log(err);
  }
}

const dataUpdate = async (client, data, serverGroupsById) => {
  const controllerStatus = data.controllerStatus === "HOME" ? 1 : 0;
  const rating = data.rating;

  // console.log(client.nickname,controllerStatus,rating,position,clientDbid);

  if (serverGroupsById.some((item) => item.name === "ADD TS UNIQUE ID ON WEBSITE")){
    client.delGroups("246");
  }

  switch (controllerStatus) {
    case 0:
      if (
        !serverGroupsById.some((item) => item.name === "Visitor") && rating) {
        client.addGroups(await teamspeak.getServerGroupByName("Visitor"));
      }
      break;
    case 1:
      if (!serverGroupsById.some((item) => item.name === "Member")) {
        client.addGroups(await teamspeak.getServerGroupByName("Member"));
      }
      break;
  }

  switch (rating) {
    case 0:
      client.kickFromServer("Suspended members do not have access to the TeamSpeak");
    case 1:
      if (!serverGroupsById.some((item) => item.name === "Observer")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Observer"));
      }
      break;
    case 2:
      if (!serverGroupsById.some((item) => item.name === "Tower Trainee")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Tower Trainee"));
      }
      break;
    case 3:
      if (!serverGroupsById.some((item) => item.name === "Tower Controller")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Tower Controller"));
      }
      break;
    case 4:
      if (!serverGroupsById.some((item) => item.name === "Radar Controller")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Radar Controller"));
      }
      break;
    case 5:
      if (!serverGroupsById.some((item) => item.name === "Controller")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Controller"));
      }
      break;
    case 7:
      if (!serverGroupsById.some((item) => item.name === "Senior Controller")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Senior Controller"));
      }
      break;
    case 8:
      if (!serverGroupsById.some((item) => item.name === "Instructor")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Instructor"));
      }
      break;
    case 10:
      if (!serverGroupsById.some((item) => item.name === "Senior Instructor")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Senior Instructor"));
      }
      break;
    case 11:
      if (!serverGroupsById.some((item) => item.name === "VATSIM Supervisor")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("VATSIM Supervisor"));
      }
      break;
    case 12:
      if (!serverGroupsById.some((item) => item.name === "VATSIM Admin")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("VATSIM Admin"));
      }
      break;
  }
}

teamspeak.on("ready", async () => {
  setInterval(positionUpdate,60*1000);
});

teamspeak.on("clientconnect", async (connected) => {
    const client = connected.client;
    const clientUid = TeamSpeakClient.getUid(client);
    const clientDbid = await teamspeak.clientGetDbidFromUid(clientUid);
    const serverGroupsById = await teamspeak.serverGroupsByClientId(clientDbid.cldbid);
 
    const res = await fetch(
      `https://vzdc.org/api/teamspeak?key=${TEAMSPEAK_KEY}`,
      {
        method: "POST",
        body: clientUid,
      }
    );

    if (!res.ok){
      console.log(new Date().toLocaleTimeString(), "Unable to pull from website API/giveRatings",client.nickname);
      client.message("You have not registered your TeamSpeak Unique ID on your profile in the vZDC website. This is required to sync your rating and membership status, and to assign online position roles.");
      client.message("You can find your TeamSpeak Unique ID under `Tools>Identities`. You may have to hit the `Go Advanced` link next to the OK button if you do not see your Unique ID");
      client.message("Refer to this controller bulletin for additional information (vzdc.org/publications/cm6zjy455002gr8ugfapcb0am)");
      client.message("After you have added your Unique ID to your profile, please disconnect from the server and reconnect.");

      client.addGroups("246");
      return;
    }
  
    const data = await res.json();
  
    dataUpdate(client, data, serverGroupsById);
})

teamspeak.on("clientdisconnect", async (connected) => {
  const client = connected.client;
  removePosition(client);
});

teamspeak.on("close", async () => {
  console.log(new Date().toLocaleTimeString(), "disconnected, trying to reconnect...")
  await teamspeak.reconnect(-1, 5000)
  console.log(new Date().toLocaleTimeString(), "reconnected!")
})

teamspeak.on("error", () => {});
