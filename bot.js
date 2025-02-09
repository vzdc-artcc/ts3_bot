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

    const res = await fetch(
      `https://vzdc.org/api/teamspeak?key=${TEAMSPEAK_KEY}`,
      {
        method: "POST",
        body: clientUid,
      }
    );

    const data = await res.json();

    if (Object.keys(data).length === 0) {
      return;
    }

    const position = data.onlinePosition;

    if (position) {
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
        console.log(err.msg);
      }
    }
  });
};

const clearRatings = async (client) => {
  const ratings = ["Observer","Tower Trainee","Tower Controller","Radar Controller","Controller","Senior Controller","Instructor","Senior Instructor"];
  const clientUid = TeamSpeakClient.getUid(client);
  const clientDbid = await teamspeak.clientGetDbidFromUid(clientUid);

  const serverGroupsById = await teamspeak.serverGroupsByClientId(
    clientDbid.cldbid
  );

  serverGroupsById.forEach(async (serverGroup)=>{
    if(ratings.includes(serverGroup.name)){
      client.delGroups(await teamspeak.getServerGroupByName(serverGroup.name));
    }
  })
}

teamspeak.on("ready", async () => {
  positionUpdate();
  setInterval(positionUpdate,60*1000);
});

teamspeak.on("clientconnect", async (connected) => {
  const client = connected.client;
  const clientUid = TeamSpeakClient.getUid(client);
  const clientDbid = await teamspeak.clientGetDbidFromUid(clientUid);

  const res = await fetch(
    `https://vzdc.org/api/teamspeak?key=${TEAMSPEAK_KEY}`,
    {
      method: "POST",
      body: clientUid,
    }
  );

  const data = await res.json();

  if (Object.keys(data).length === 0) {
    client.message(
      "You have not registered your Teamspeak Unique ID on your profile in the vZDC website. Please do so at your earliest convenience."
    );
    client.message("You can find your Teamspeak Unique ID under `Tools>Identities`. You may have to hit the `Go Advanced` link next to the OK button if you do not see your Unique ID")
    return;
  }

  const controllerStatus = data.controllerStatus === "HOME" ? 1 : 0;
  const rating = data.rating;

  const serverGroupsById = await teamspeak.serverGroupsByClientId(
    clientDbid.cldbid
  );

  // console.log(client.nickname,controllerStatus,rating,position,clientDbid);

  switch (controllerStatus) {
    case 0:
      if (
        !serverGroupsById.some((item) => item.name === "Visitor") &&
        rating
      ) {
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
    case 1:
      if (!serverGroupsById.some((item) => item.name === "Observer")) {
        clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Observer"));
      }
      break;
    case 2:
      if (!serverGroupsById.some((item) => item.name === "Tower Trainee")) {
        clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Tower Trainee"));
      }
      break;
    case 3:
      if (!serverGroupsById.some((item) => item.name === "Tower Controller")) {
        clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Tower Controller"));
      }
      break;
    case 4:
      if (!serverGroupsById.some((item) => item.name === "Radar Controller")) {
        clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Radar Controller"));
      }
      break;
    case 5:
      if (!serverGroupsById.some((item) => item.name === "Controller")) {
        clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Controller"));
      }
      break;
    case 7:
      if (!serverGroupsById.some((item) => item.name === "Senior Controller")) {
        clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Senior Controller"));
      }
      break;
    case 8:
      if (!serverGroupsById.some((item) => item.name === "Instructor")) {
        clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Instructor"));
      }
      break;
    case 10:
      if (!serverGroupsById.some((item) => item.name === "Senior Instructor")) {
        clearRatings(client)
        client.addGroups(await teamspeak.getServerGroupByName("Senior Instructor"));
      }
      break;
  }
})

teamspeak.on("clientdisconnect", async (data) => {

  const clientDbid = data.client.propcache.clientDatabaseId;
  const serverGroupsById = await teamspeak.serverGroupsByClientId(clientDbid);

  const positionToDelete = serverGroupsById.find((item) => item.name.includes("_"));

  if(positionToDelete){
    await teamspeak.serverGroupDelClient(clientDbid, positionToDelete.sgid);
    await teamspeak.serverGroupDel(positionToDelete.sgid);
  }

});

teamspeak.on("error", () => {});
