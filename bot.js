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
const TEAMSPEAK_HOST = process.env.TEAMSPEAK_HOST;

const teamspeak = new TeamSpeak({
  host: TEAMSPEAK_HOST,
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

    const trainingChannels = ['7','70','9','12','14'];

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

    if(serverGroupsById.some((item)=>item.name.includes("SWEATBOX 1"))){
      const positionToDelete = serverGroupsById.filter((item) => item.name.includes("SWEATBOX 1"));
      try{
        positionToDelete.forEach(async (item) => {
          await teamspeak.serverGroupDelClient(client.propcache.clientDatabaseId, item.sgid);
          await teamspeak.serverGroupDel(item.sgid);
        })
      }catch(err){
        console.log(client.nickname);
        console.log(err.msg);
      }
    }else if(serverGroupsById.some((item)=>item.name.includes("SWEATBOX 2"))){
      const positionToDelete = serverGroupsById.filter((item) => item.name.includes("SWEATBOX 2"));
      try{
        positionToDelete.forEach(async (item) => {
          await teamspeak.serverGroupDelClient(client.propcache.clientDatabaseId, item.sgid);
          await teamspeak.serverGroupDel(item.sgid);
        })
      }catch(err){
        console.log(client.nickname);
        console.log(err.msg);
      }
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

  const sweatboxOneData = sweatboxOne.controllers.filter((obj)=>obj.artccId === 'ZDC' && !obj.vatsimData.controllerInfo.includes("ATCTrainer"))
  const sweatboxTwoData = sweatboxTwo.controllers.filter((obj)=>obj.artccId === 'ZDC' && !obj.vatsimData.controllerInfo.includes("ATCTrainer"))

  sweatboxOneData.forEach(async (sweatboxUser)=>{
    if(sweatboxUser.vatsimData.cid === data.cid){

      if (!(await teamspeak.serverGroupList()).some((item) => item.propcache.name === "SWEATBOX 1 - "+sweatboxUser.vatsimData.callsign)){
        try {
          const createdServerGroup = await teamspeak.serverGroupCreate("SWEATBOX 1 - "+sweatboxUser.vatsimData.callsign);
          await createdServerGroup.addPerm({
            permname: "i_group_show_name_in_tree",
            permvalue: 1,
            skip: false,
            negate: false,
          });
          await createdServerGroup.addClient(client);
        } catch(err) {
          console.log(client.nickname);
          console.log(err.msg);
        }
      }
    }
  })

  if(serverGroupsById.some((item) => item.name.includes("SWEATBOX 1")) && sweatboxOneData.length === 0){
    const positionToDelete = serverGroupsById.filter((item) => item.name.includes("SWEATBOX 1"));
    try{
      positionToDelete.forEach(async (item) => {
        await teamspeak.serverGroupDelClient(client.propcache.clientDatabaseId, item.sgid);
        await teamspeak.serverGroupDel(item.sgid);
      })
    }catch(err){
      console.log(client.nickname);
      console.log(err.msg);
    }
  }

  sweatboxTwoData.forEach(async (sweatboxUser)=>{
    if(sweatboxUser.vatsimData.cid === data.cid){
      if (!(await teamspeak.serverGroupList()).some((item) => item.propcache.name === "SWEATBOX 2 - "+sweatboxUser.vatsimData.callsign)){
        try {
          const createdServerGroup = await teamspeak.serverGroupCreate("SWEATBOX 2 - "+sweatboxUser.vatsimData.callsign);
          await createdServerGroup.addPerm({
            permname: "i_group_show_name_in_tree",
            permvalue: 1,
            skip: false,
            negate: false,
          });
          await createdServerGroup.addClient(client);
        } catch(err) {
          console.log(client.nickname);
          console.log(err.msg);
        }
      }
    }
  })

  if(serverGroupsById.some((item) => item.name.includes("SWEATBOX 2")) && sweatboxTwoData.length === 0){
    const positionToDelete = serverGroupsById.filter((item) => item.name.includes("SWEATBOX 2"));
    try{
      positionToDelete.forEach(async (item) => {
        await teamspeak.serverGroupDelClient(client.propcache.clientDatabaseId, item.sgid);
        await teamspeak.serverGroupDel(item.sgid);
      })
    }catch(err){
      console.log(client.nickname);
      console.log(err.msg);
    }
  }

}


const clearRatings = async (client) => {
  const ratings = ["OBS","S1","S2","S3","C1","C3","I1","I3"];
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

    if(serverGroupsById.some((item)=>item.name.includes("SWEATBOX 1"))){
      const positionToDelete = serverGroupsById.filter((item) => item.name.includes("SWEATBOX 1"));
      try{
        positionToDelete.forEach(async (item) => {
          await teamspeak.serverGroupDelClient(client.propcache.clientDatabaseId, item.sgid);
          await teamspeak.serverGroupDel(item.sgid);
        })
      }catch(err){
        console.log(client.nickname);
        console.log(err.msg);
      }
    }else if(serverGroupsById.some((item)=>item.name.includes("SWEATBOX 2"))){
      const positionToDelete = serverGroupsById.filter((item) => item.name.includes("SWEATBOX 2"));
      try{
        positionToDelete.forEach(async (item) => {
          await teamspeak.serverGroupDelClient(client.propcache.clientDatabaseId, item.sgid);
          await teamspeak.serverGroupDel(item.sgid);
        })
      }catch(err){
        console.log(client.nickname);
        console.log(err.msg);
      }
    }

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
    client.delGroups("50");
  }

  if (serverGroupsById.every((sg) => sg.sgid !== "9")) {
    switch (controllerStatus) {
    case 0:
      if (
        !serverGroupsById.some((item) => item.name === "Visitor") && rating) {
        client.addGroups(await teamspeak.getServerGroupByName("Visitor"));
      }
      break;
    case 1:
      if (!serverGroupsById.some((item) => item.name === "ZDC Member")) {
        client.addGroups(await teamspeak.getServerGroupByName("ZDC Member"));
      }
      break;
    }
  }

  switch (rating) {
    case 0:
      client.kickFromServer("Suspended members do not have access to the TeamSpeak");
    case 1:
      if (!serverGroupsById.some((item) => item.name === "OBS")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("OBS"));
      }
      break;
    case 2:
      if (!serverGroupsById.some((item) => item.name === "S1")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("S1"));
      }
      break;
    case 3:
      if (!serverGroupsById.some((item) => item.name === "S2")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("S2"));
      }
      break;
    case 4:
      if (!serverGroupsById.some((item) => item.name === "S3")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("S3"));
      }
      break;
    case 5:
      if (!serverGroupsById.some((item) => item.name === "C1")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("C1"));
      }
      break;
    case 7:
      if (!serverGroupsById.some((item) => item.name === "C3")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("C3"));
      }
      break;
    case 8:
      if (!serverGroupsById.some((item) => item.name === "I1")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("I1"));
      }
      break;
    case 10:
      if (!serverGroupsById.some((item) => item.name === "I3")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("I3"));
      }
      break;
    case 11:
      if (!serverGroupsById.some((item) => item.name === "SUP")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("SUP"));
      }
      break;
    case 12:
      if (!serverGroupsById.some((item) => item.name === "ADM")) {
        await clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("ADM"));
      }
      break;
  }
}

teamspeak.on("ready", async () => {
  positionUpdate()
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
      client.message("Add your UID on the vZDC Website in the dropdown menu in the top right corner or in the sidebar.");
      client.message("After you have added your Unique ID to your profile, please disconnect from the server and reconnect.");

      client.addGroups("50");
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
